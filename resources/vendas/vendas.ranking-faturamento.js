const CFOPS_FATURAMENTO = [
  '5105','5106','5116','5117','5119','5405','5933',
  '6105','6106','6107','6108','6110','6116','6117',
  '6119','6122','6123','6404','6933'
];

const toProtheusDate = (iso) => {
  if (!iso) return null;
  const s = String(iso).replace(/-/g, '').slice(0, 8);
  return /^\d{8}$/.test(s) ? s : null;
};

module.exports = (app) => ({
  verb: 'get',
  route: '/ranking-faturamento',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const { inicio, fim, vendedor } = req.query;

    const dtInicio = toProtheusDate(inicio);
    const dtFim = toProtheusDate(fim);

    if (!dtInicio || !dtFim) {
      return res.status(400).json({ message: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD).' });
    }

    const metaTotal = Number(process.env.META_TOTAL || 130000000);

    const cfopList = CFOPS_FATURAMENTO.map(c => `'${c}'`).join(',');
    const condVendedor = vendedor
      ? `AND (sf2.f2_vend1 = @vendedor OR sf2.f2_vend2 = @vendedor OR sf2.f2_vend3 = @vendedor)`
      : '';

    const sql = `
      SELECT
        sf2.f2_vend1 AS cod_vendedor,
        MAX(sa3.A3_NOME) AS nome,
        CAST(SUM(sd2.d2_valbrut - sd2.d2_valdev) AS DECIMAL(15,2)) AS total
      FROM dbo.Sf2010 sf2 WITH (NOLOCK)
      INNER JOIN Sd2010 sd2 WITH (NOLOCK)
        ON (sd2.D2_FILIAL = sf2.F2_FILIAL
            AND sd2.D2_DOC = sf2.f2_doc
            AND sd2.D2_SERIE = sf2.f2_serie
            AND sd2.D2_CLIENTE = sf2.F2_CLIENTE
            AND sd2.D2_LOJA = sf2.F2_LOJA)
      INNER JOIN sa3010 sa3 WITH (NOLOCK)
        ON (sf2.f2_vend1 = sa3.a3_cod AND sa3.D_E_L_E_T_ <> '*')
      WHERE sf2.D_E_L_E_T_ <> '*'
        AND sf2.F2_FILIAL = '01'
        AND sf2.F2_EMISSAO >= @inicio
        AND sf2.F2_EMISSAO <= @fim
        AND sd2.D_E_L_E_T_ <> '*'
        AND sd2.d2_filial = '01'
        AND sd2.d2_emissao >= @inicio
        AND sd2.d2_emissao <= @fim
        AND sd2.D2_CF IN (${cfopList})
        ${condVendedor}
      GROUP BY sf2.f2_vend1
      ORDER BY SUM(sd2.d2_valbrut - sd2.d2_valdev) DESC
    `;

    try {
      const params = { inicio: dtInicio, fim: dtFim };
      if (vendedor) params.vendedor = String(vendedor);

      const rows = await Protheus.connectAndQuery(sql, params);

      const ranking = rows.map((r, i) => {
        const total = Number(r.total || 0);
        return {
          posicao: i + 1,
          cod_vendedor: (r.cod_vendedor || '').trim(),
          nome: (r.nome || '').trim(),
          total,
          percentualMetaTotal: metaTotal > 0 ? Number(((total / metaTotal) * 100).toFixed(2)) : 0
        };
      });

      return res.json({
        periodo: { inicio: dtInicio, fim: dtFim },
        metaTotal,
        ranking
      });
    } catch (error) {
      console.error('Erro no ranking de faturamento:', error);
      return res.status(500).json({ message: 'Erro ao consultar ranking de faturamento.' });
    }
  }
});
