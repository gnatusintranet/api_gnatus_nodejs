const toProtheusDate = (iso) => {
  if (!iso) return null;
  const s = String(iso).replace(/-/g, '').slice(0, 8);
  return /^\d{8}$/.test(s) ? s : null;
};

const trim = (v) => String(v || '').trim();
const toNumber = (v) => Number(v || 0);

const calcStatusSC1 = (r) => {
  const quant = toNumber(r.C1_QUANT);
  const quje = toNumber(r.C1_QUJE);
  const aprov = trim(r.C1_APROV);
  const cotacao = trim(r.C1_COTACAO);
  const pedido = trim(r.C1_PEDIDO);
  const residuo = trim(r.C1_RESIDUO);

  if (residuo === 'S') return { codigo: 'RESIDUO', label: 'Resíduo eliminado', cor: '#6b7a90' };
  if (aprov === 'B') return { codigo: 'BLOQUEADA', label: 'Bloqueada', cor: '#c9302c' };
  if (quant > 0 && quje >= quant) return { codigo: 'ATENDIDA_TOTAL', label: 'Atendida total', cor: '#09A013' };
  if (quje > 0) return { codigo: 'ATENDIDA_PARCIAL', label: 'Atendida parcial', cor: '#800080' };
  if (pedido) return { codigo: 'EM_PEDIDO', label: 'Em pedido', cor: '#1e5fb5' };
  if (cotacao) return { codigo: 'EM_COTACAO', label: 'Em cotação', cor: '#f5a500' };
  if (aprov && aprov !== 'L') return { codigo: 'EM_APROVACAO', label: 'Em aprovação', cor: '#e55a1a' };
  return { codigo: 'EM_ABERTO', label: 'Em aberto', cor: '#5b9bd5' };
};

module.exports = (app) => ({
  verb: 'get',
  route: '/solicitacoes',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const { inicio, fim, status, solicitante } = req.query;

    const dtInicio = toProtheusDate(inicio);
    const dtFim = toProtheusDate(fim);

    if (!dtInicio || !dtFim) {
      return res.status(400).json({ message: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD).' });
    }

    const params = { inicio: dtInicio, fim: dtFim };
    let condSolic = '';
    if (solicitante) {
      params.solicitante = String(solicitante);
      condSolic = `AND RTRIM(sc1.C1_SOLICIT) LIKE '%' + @solicitante + '%'`;
    }

    const sql = `
      SELECT
        RTRIM(sc1.C1_FILIAL)  AS filial,
        RTRIM(sc1.C1_NUM)     AS numero,
        RTRIM(sc1.C1_ITEM)    AS item,
        RTRIM(sc1.C1_PRODUTO) AS produto,
        RTRIM(sc1.C1_DESCRI)  AS descricao,
        RTRIM(sc1.C1_UM)      AS unidade,
        sc1.C1_QUANT          AS quantidade,
        sc1.C1_QUJE           AS atendido,
        sc1.C1_PRECO          AS preco,
        sc1.C1_TOTAL          AS total,
        RTRIM(sc1.C1_LOCAL)   AS armazem,
        sc1.C1_EMISSAO        AS emissao,
        sc1.C1_DATPRF         AS dataPrevista,
        DATEDIFF(day, GETDATE(), sc1.C1_DATPRF) AS dias,
        RTRIM(sc1.C1_SOLICIT) AS solicitante,
        RTRIM(sc1.C1_USER)    AS usuario,
        RTRIM(sc1.C1_CC)      AS centroCusto,
        RTRIM(sc1.C1_FORNECE) AS fornecedor,
        RTRIM(sc1.C1_LOJA)    AS fornecedorLoja,
        RTRIM(sa2.A2_NOME)    AS fornecedorNome,
        RTRIM(sc1.C1_COTACAO) AS cotacao,
        RTRIM(sc1.C1_PEDIDO)  AS pedido,
        RTRIM(sc1.C1_APROV)   AS aprov,
        RTRIM(sc1.C1_RESIDUO) AS residuo,
        RTRIM(sc1.C1_OBS)     AS observacao
      FROM SC1010 sc1 WITH (NOLOCK)
      LEFT JOIN SA2010 sa2 WITH (NOLOCK)
        ON sa2.A2_COD  = sc1.C1_FORNECE
       AND sa2.A2_LOJA = sc1.C1_LOJA
       AND sa2.D_E_L_E_T_ <> '*'
      WHERE sc1.D_E_L_E_T_ <> '*'
        AND sc1.C1_FILIAL = '01'
        AND sc1.C1_EMISSAO BETWEEN @inicio AND @fim
        ${condSolic}
      ORDER BY sc1.C1_EMISSAO DESC, sc1.C1_NUM DESC, sc1.C1_ITEM
    `;

    try {
      const rows = await Protheus.connectAndQuery(sql, params);

      const statusList = status ? String(status).split(',').map(s => s.trim()).filter(Boolean) : null;

      const dados = rows
        .map((r) => {
          const st = calcStatusSC1({
            C1_QUANT: r.quantidade,
            C1_QUJE: r.atendido,
            C1_APROV: r.aprov,
            C1_COTACAO: r.cotacao,
            C1_PEDIDO: r.pedido,
            C1_RESIDUO: r.residuo
          });
          return {
            filial: r.filial,
            numero: r.numero,
            item: r.item,
            produto: r.produto,
            descricao: r.descricao,
            unidade: r.unidade,
            quantidade: toNumber(r.quantidade),
            atendido: toNumber(r.atendido),
            saldo: Math.max(0, toNumber(r.quantidade) - toNumber(r.atendido)),
            preco: toNumber(r.preco),
            total: toNumber(r.total),
            armazem: r.armazem,
            emissao: trim(r.emissao),
            dataPrevista: trim(r.dataPrevista),
            dias: toNumber(r.dias),
            solicitante: r.solicitante,
            usuario: r.usuario,
            centroCusto: r.centroCusto,
            fornecedor: r.fornecedor,
            fornecedorLoja: r.fornecedorLoja,
            fornecedorNome: r.fornecedorNome,
            cotacao: r.cotacao,
            pedido: r.pedido,
            observacao: r.observacao,
            status: st
          };
        })
        .filter((r) => !statusList || statusList.includes(r.status.codigo));

      return res.json({
        periodo: { inicio: dtInicio, fim: dtFim },
        totalRegistros: dados.length,
        geradoEm: new Date().toISOString(),
        dados
      });
    } catch (error) {
      console.error('Erro em compras/solicitacoes:', error);
      return res.status(500).json({ message: 'Erro ao listar solicitações de compra.' });
    }
  }
});
