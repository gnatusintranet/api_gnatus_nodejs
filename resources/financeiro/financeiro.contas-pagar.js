const toProtheusDate = (iso) => {
  if (!iso) return null;
  const s = String(iso).replace(/-/g, '').slice(0, 8);
  return /^\d{8}$/.test(s) ? s : null;
};

const trim = (v) => String(v || '').trim();
const toNumber = (v) => Number(v || 0);

const calcStatus = (r, hojeProt) => {
  const saldo = toNumber(r.E2_SALDO);
  const valor = toNumber(r.E2_VALOR);
  const vencreal = trim(r.E2_VENCREA) || trim(r.E2_VENCTO);
  const baixa = trim(r.E2_BAIXA);

  if (saldo <= 0 && baixa) return { codigo: 'PAGO', label: 'Pago', cor: '#09A013' };
  if (saldo < valor && saldo > 0) {
    return vencreal < hojeProt
      ? { codigo: 'PARCIAL_VENCIDO', label: 'Parcial vencido', cor: '#c9302c' }
      : { codigo: 'PARCIAL', label: 'Parcial', cor: '#f5a500' };
  }
  if (vencreal < hojeProt) return { codigo: 'VENCIDO', label: 'Vencido', cor: '#c9302c' };
  return { codigo: 'ABERTO', label: 'Em aberto', cor: '#1e5fb5' };
};

const hojeProtheus = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${m}${day}`;
};

module.exports = (app) => ({
  verb: 'get',
  route: '/contas-pagar',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const { inicio, fim, status, fornecedor, tipoData } = req.query;

    const dtInicio = toProtheusDate(inicio);
    const dtFim = toProtheusDate(fim);

    if (!dtInicio || !dtFim) {
      return res.status(400).json({ message: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD).' });
    }

    const dataCol = tipoData === 'vencimento' ? 'E2_VENCTO' : 'E2_EMISSAO';
    const params = { inicio: dtInicio, fim: dtFim };
    const conds = [];
    if (fornecedor) {
      params.fornecedor = String(fornecedor).toUpperCase();
      conds.push(`AND (UPPER(sa2.A2_NOME) LIKE '%' + @fornecedor + '%' OR RTRIM(se2.E2_FORNECE) = @fornecedor OR RTRIM(se2.E2_NOMFOR) LIKE '%' + @fornecedor + '%')`);
    }

    const sql = `
      SELECT
        RTRIM(se2.E2_PREFIXO) AS prefixo,
        RTRIM(se2.E2_NUM)     AS numero,
        RTRIM(se2.E2_PARCELA) AS parcela,
        RTRIM(se2.E2_TIPO)    AS tipo,
        RTRIM(se2.E2_NATUREZ) AS natureza,
        RTRIM(se2.E2_PORTADO) AS portador,
        RTRIM(se2.E2_FORNECE) AS fornecedorCod,
        RTRIM(se2.E2_LOJA)    AS fornecedorLoja,
        RTRIM(COALESCE(NULLIF(sa2.A2_NOME, ''), se2.E2_NOMFOR)) AS fornecedorNome,
        se2.E2_EMISSAO        AS emissao,
        se2.E2_VENCTO         AS vencimento,
        se2.E2_VENCREA        AS vencimentoReal,
        se2.E2_BAIXA          AS dataBaixa,
        se2.E2_VALOR          AS valor,
        se2.E2_SALDO          AS saldo,
        RTRIM(se2.E2_HIST)    AS historico,
        DATEDIFF(day, CONVERT(date, se2.E2_VENCREA, 112), GETDATE()) AS diasAtraso
      FROM SE2010 se2 WITH (NOLOCK)
      LEFT JOIN SA2010 sa2 WITH (NOLOCK)
        ON sa2.A2_COD  = se2.E2_FORNECE
       AND sa2.A2_LOJA = se2.E2_LOJA
       AND sa2.D_E_L_E_T_ <> '*'
      WHERE se2.D_E_L_E_T_ <> '*'
        AND se2.${dataCol} BETWEEN @inicio AND @fim
        ${conds.join(' ')}
      ORDER BY se2.E2_VENCTO DESC, se2.E2_NUM DESC
    `;

    try {
      const rows = await Protheus.connectAndQuery(sql, params);
      const hoje = hojeProtheus();
      const statusList = status ? String(status).split(',').map(s => s.trim()).filter(Boolean) : null;

      const dados = rows
        .map((r) => ({
          prefixo: trim(r.prefixo),
          numero: trim(r.numero),
          parcela: trim(r.parcela),
          tipo: trim(r.tipo),
          natureza: trim(r.natureza),
          portador: trim(r.portador),
          fornecedorCod: trim(r.fornecedorCod),
          fornecedorLoja: trim(r.fornecedorLoja),
          fornecedorNome: trim(r.fornecedorNome),
          emissao: trim(r.emissao),
          vencimento: trim(r.vencimento),
          vencimentoReal: trim(r.vencimentoReal),
          dataBaixa: trim(r.dataBaixa),
          valor: toNumber(r.valor),
          saldo: toNumber(r.saldo),
          historico: trim(r.historico),
          diasAtraso: toNumber(r.diasAtraso),
          status: calcStatus({
            E2_SALDO: r.saldo, E2_VALOR: r.valor,
            E2_VENCREA: r.vencimentoReal, E2_VENCTO: r.vencimento,
            E2_BAIXA: r.dataBaixa
          }, hoje)
        }))
        .filter((d) => !statusList || statusList.includes(d.status.codigo));

      return res.json({
        periodo: { inicio: dtInicio, fim: dtFim },
        totalRegistros: dados.length,
        geradoEm: new Date().toISOString(),
        dados
      });
    } catch (error) {
      console.error('Erro em financeiro/contas-pagar:', error);
      return res.status(500).json({ message: 'Erro ao listar contas a pagar.' });
    }
  }
});
