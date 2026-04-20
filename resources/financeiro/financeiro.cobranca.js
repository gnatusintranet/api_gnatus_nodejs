// Cobrança: contas a receber em aberto com atraso > 5 dias (D+5 ou mais).
// Retorna tanto a lista detalhada quanto um agregado por cliente pra
// facilitar o trabalho da equipe de cobrança.
const trim = (v) => String(v || '').trim();
const toNumber = (v) => Number(v || 0);

const faixaAtraso = (dias) => {
  if (dias <= 15)  return { codigo: 'A_6_15',   label: '6-15 dias',   cor: '#f5a500' };
  if (dias <= 30)  return { codigo: 'A_16_30',  label: '16-30 dias',  cor: '#e55a1a' };
  if (dias <= 60)  return { codigo: 'A_31_60',  label: '31-60 dias',  cor: '#c9302c' };
  if (dias <= 90)  return { codigo: 'A_61_90',  label: '61-90 dias',  cor: '#8a1f1b' };
  return             { codigo: 'A_90_MAIS', label: '90+ dias',    cor: '#4a0e0e' };
};

module.exports = (app) => ({
  verb: 'get',
  route: '/cobranca',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const { cliente, uf, faixa } = req.query;
    const diasMinimos = Number(req.query.diasMinimos || 5);

    const params = { diasMinimos };
    const conds = [];
    if (cliente) {
      params.cliente = String(cliente).toUpperCase();
      conds.push(`AND (UPPER(sa1.A1_NOME) LIKE '%' + @cliente + '%' OR RTRIM(se1.E1_CLIENTE) = @cliente OR RTRIM(se1.E1_NOMCLI) LIKE '%' + @cliente + '%')`);
    }
    if (uf) {
      params.uf = String(uf).toUpperCase();
      conds.push(`AND RTRIM(sa1.A1_EST) = @uf`);
    }

    const sql = `
      SELECT
        RTRIM(se1.E1_PREFIXO) AS prefixo,
        RTRIM(se1.E1_NUM)     AS numero,
        RTRIM(se1.E1_PARCELA) AS parcela,
        RTRIM(se1.E1_TIPO)    AS tipo,
        RTRIM(se1.E1_CLIENTE) AS clienteCod,
        RTRIM(se1.E1_LOJA)    AS clienteLoja,
        RTRIM(COALESCE(NULLIF(sa1.A1_NOME, ''), se1.E1_NOMCLI)) AS clienteNome,
        RTRIM(sa1.A1_MUN)     AS clienteMunicipio,
        RTRIM(sa1.A1_EST)     AS clienteEstado,
        RTRIM(sa1.A1_EMAIL)   AS clienteEmail,
        RTRIM(sa1.A1_DDD)     AS clienteDDD,
        RTRIM(sa1.A1_TEL)     AS clienteTel,
        RTRIM(sa1.A1_VEND)    AS vendedor,
        RTRIM(sa3.A3_NOME)    AS vendedorNome,
        se1.E1_EMISSAO        AS emissao,
        se1.E1_VENCTO         AS vencimento,
        se1.E1_VENCREA        AS vencimentoReal,
        se1.E1_VALOR          AS valor,
        se1.E1_SALDO          AS saldo,
        RTRIM(se1.E1_NATUREZ) AS natureza,
        RTRIM(se1.E1_HIST)    AS historico,
        DATEDIFF(day, CONVERT(date, se1.E1_VENCREA, 112), GETDATE()) AS diasAtraso
      FROM SE1010 se1 WITH (NOLOCK)
      LEFT JOIN SA1010 sa1 WITH (NOLOCK)
        ON sa1.A1_COD  = se1.E1_CLIENTE
       AND sa1.A1_LOJA = se1.E1_LOJA
       AND sa1.D_E_L_E_T_ <> '*'
      LEFT JOIN SA3010 sa3 WITH (NOLOCK)
        ON sa3.A3_COD = sa1.A1_VEND AND sa3.D_E_L_E_T_ <> '*'
      WHERE se1.D_E_L_E_T_ <> '*'
        AND se1.E1_SALDO > 0
        AND (se1.E1_BAIXA = '' OR se1.E1_BAIXA IS NULL)
        AND DATEDIFF(day, CONVERT(date, se1.E1_VENCREA, 112), GETDATE()) >= @diasMinimos
        ${conds.join(' ')}
      ORDER BY DATEDIFF(day, CONVERT(date, se1.E1_VENCREA, 112), GETDATE()) DESC
    `;

    try {
      const rows = await Protheus.connectAndQuery(sql, params);

      const titulos = rows.map((r) => {
        const dias = toNumber(r.diasAtraso);
        return {
          prefixo: trim(r.prefixo),
          numero: trim(r.numero),
          parcela: trim(r.parcela),
          tipo: trim(r.tipo),
          clienteCod: trim(r.clienteCod),
          clienteLoja: trim(r.clienteLoja),
          clienteNome: trim(r.clienteNome),
          clienteMunicipio: trim(r.clienteMunicipio),
          clienteEstado: trim(r.clienteEstado),
          clienteEmail: trim(r.clienteEmail),
          clienteDDD: trim(r.clienteDDD),
          clienteTel: trim(r.clienteTel),
          vendedor: trim(r.vendedor),
          vendedorNome: trim(r.vendedorNome),
          emissao: trim(r.emissao),
          vencimento: trim(r.vencimento),
          vencimentoReal: trim(r.vencimentoReal),
          valor: toNumber(r.valor),
          saldo: toNumber(r.saldo),
          natureza: trim(r.natureza),
          historico: trim(r.historico),
          diasAtraso: dias,
          faixa: faixaAtraso(dias)
        };
      });

      const filtrados = faixa
        ? titulos.filter(t => t.faixa.codigo === String(faixa))
        : titulos;

      // Agrega por cliente
      const porClienteMap = new Map();
      filtrados.forEach(t => {
        const key = `${t.clienteCod}-${t.clienteLoja}`;
        if (!porClienteMap.has(key)) {
          porClienteMap.set(key, {
            clienteCod: t.clienteCod,
            clienteLoja: t.clienteLoja,
            clienteNome: t.clienteNome,
            clienteMunicipio: t.clienteMunicipio,
            clienteEstado: t.clienteEstado,
            clienteEmail: t.clienteEmail,
            clienteDDD: t.clienteDDD,
            clienteTel: t.clienteTel,
            vendedorNome: t.vendedorNome,
            totalSaldo: 0,
            qtdTitulos: 0,
            maiorAtraso: 0,
            titulos: []
          });
        }
        const agg = porClienteMap.get(key);
        agg.totalSaldo += t.saldo;
        agg.qtdTitulos += 1;
        if (t.diasAtraso > agg.maiorAtraso) agg.maiorAtraso = t.diasAtraso;
        agg.titulos.push({ numero: t.numero, parcela: t.parcela, saldo: t.saldo, diasAtraso: t.diasAtraso, vencimento: t.vencimento });
      });
      const porCliente = Array.from(porClienteMap.values())
        .sort((a, b) => b.totalSaldo - a.totalSaldo);

      // KPIs
      const totalGeral = filtrados.reduce((s, t) => s + t.saldo, 0);
      const qtdClientes = porCliente.length;
      const porFaixa = {};
      filtrados.forEach(t => {
        const f = t.faixa.codigo;
        if (!porFaixa[f]) porFaixa[f] = { label: t.faixa.label, cor: t.faixa.cor, qtd: 0, valor: 0 };
        porFaixa[f].qtd += 1;
        porFaixa[f].valor += t.saldo;
      });

      return res.json({
        diasMinimos,
        totalRegistros: filtrados.length,
        qtdClientes,
        totalGeral,
        porFaixa,
        geradoEm: new Date().toISOString(),
        titulos: filtrados,
        porCliente
      });
    } catch (error) {
      console.error('Erro em financeiro/cobranca:', error);
      return res.status(500).json({ message: 'Erro ao consultar cobrança.' });
    }
  }
});
