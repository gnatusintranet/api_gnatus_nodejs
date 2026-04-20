const toProtheusDate = (iso) => {
  if (!iso) return null;
  const s = String(iso).replace(/-/g, '').slice(0, 8);
  return /^\d{8}$/.test(s) ? s : null;
};

const trim = (v) => String(v || '').trim();
const toNumber = (v) => Number(v || 0);

const calcStatusSC7 = (r) => {
  const quant = toNumber(r.C7_QUANT);
  const quje = toNumber(r.C7_QUJE);
  const conapro = trim(r.C7_CONAPRO);
  const residuo = trim(r.C7_RESIDUO);
  const encer = trim(r.C7_ENCER);

  if (residuo === 'S') return { codigo: 'RESIDUO', label: 'Resíduo eliminado', cor: '#800080' };
  if (encer === 'E') return { codigo: 'ENCERRADO', label: 'Encerrado', cor: '#6b7a90' };
  if (conapro === 'B') return { codigo: 'BLOQUEADO', label: 'Bloqueado', cor: '#c9302c' };
  if (quant > 0 && quje >= quant) return { codigo: 'ATENDIDO_TOTAL', label: 'Totalmente atendido', cor: '#1e5fb5' };
  if (quje > 0) return { codigo: 'ENTREGA_PARCIAL', label: 'Entrega parcial', cor: '#f5a500' };
  if (conapro === 'L') return { codigo: 'LIBERADO', label: 'Liberado', cor: '#09A013' };
  return { codigo: 'EM_APROVACAO', label: 'Em aprovação', cor: '#e55a1a' };
};

module.exports = (app) => ({
  verb: 'get',
  route: '/pedidos',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const { inicio, fim, status, fornecedor, comprador } = req.query;

    const dtInicio = toProtheusDate(inicio);
    const dtFim = toProtheusDate(fim);

    if (!dtInicio || !dtFim) {
      return res.status(400).json({ message: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD).' });
    }

    const params = { inicio: dtInicio, fim: dtFim };
    const conds = [];
    if (fornecedor) {
      params.fornecedor = String(fornecedor);
      conds.push(`AND RTRIM(sc7.C7_FORNECE) = @fornecedor`);
    }
    if (comprador) {
      params.comprador = String(comprador);
      conds.push(`AND RTRIM(sc7.C7_USER) LIKE '%' + @comprador + '%'`);
    }

    const sql = `
      SELECT
        RTRIM(sc7.C7_FILIAL)  AS filial,
        RTRIM(sc7.C7_NUM)     AS numero,
        RTRIM(sc7.C7_ITEM)    AS item,
        RTRIM(sc7.C7_PRODUTO) AS produto,
        RTRIM(sc7.C7_DESCRI)  AS descricao,
        RTRIM(sc7.C7_UM)      AS unidade,
        sc7.C7_QUANT          AS quantidade,
        sc7.C7_QUJE           AS atendido,
        sc7.C7_PRECO          AS preco,
        sc7.C7_TOTAL          AS total,
        RTRIM(sc7.C7_LOCAL)   AS armazem,
        sc7.C7_EMISSAO        AS emissao,
        sc7.C7_DATPRF         AS dataPrevista,
        DATEDIFF(day, GETDATE(), sc7.C7_DATPRF) AS dias,
        RTRIM(sc7.C7_FORNECE) AS fornecedor,
        RTRIM(sc7.C7_LOJA)    AS fornecedorLoja,
        RTRIM(sa2.A2_NOME)    AS fornecedorNome,
        RTRIM(sc7.C7_NUMSC)   AS origemSC,
        RTRIM(sc7.C7_ITEMSC)  AS origemSCItem,
        RTRIM(sc7.C7_CC)      AS centroCusto,
        RTRIM(sc7.C7_USER)    AS usuario,
        RTRIM(sc7.C7_COND)    AS condPag,
        RTRIM(sc7.C7_CONAPRO) AS conapro,
        RTRIM(sc7.C7_RESIDUO) AS residuo,
        RTRIM(sc7.C7_ENCER)   AS encer,
        RTRIM(sc7.C7_OBS)     AS observacao
      FROM SC7010 sc7 WITH (NOLOCK)
      LEFT JOIN SA2010 sa2 WITH (NOLOCK)
        ON sa2.A2_COD  = sc7.C7_FORNECE
       AND sa2.A2_LOJA = sc7.C7_LOJA
       AND sa2.D_E_L_E_T_ <> '*'
      WHERE sc7.D_E_L_E_T_ <> '*'
        AND sc7.C7_FILIAL = '01'
        AND sc7.C7_EMISSAO BETWEEN @inicio AND @fim
        ${conds.join(' ')}
      ORDER BY sc7.C7_EMISSAO DESC, sc7.C7_NUM DESC, sc7.C7_ITEM
    `;

    try {
      const rows = await Protheus.connectAndQuery(sql, params);
      const statusList = status ? String(status).split(',').map(s => s.trim()).filter(Boolean) : null;

      const dados = rows
        .map((r) => {
          const st = calcStatusSC7({
            C7_QUANT: r.quantidade,
            C7_QUJE: r.atendido,
            C7_CONAPRO: r.conapro,
            C7_RESIDUO: r.residuo,
            C7_ENCER: r.encer
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
            fornecedor: r.fornecedor,
            fornecedorLoja: r.fornecedorLoja,
            fornecedorNome: r.fornecedorNome,
            origemSC: r.origemSC,
            origemSCItem: r.origemSCItem,
            centroCusto: r.centroCusto,
            usuario: r.usuario,
            condPag: r.condPag,
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
      console.error('Erro em compras/pedidos:', error);
      return res.status(500).json({ message: 'Erro ao listar pedidos de compra.' });
    }
  }
});
