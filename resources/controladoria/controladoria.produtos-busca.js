// Autocomplete de produtos (PA, PI ou todos). Usado para seleção na tela de
// Custo de Produto.
const trim = (v) => String(v || '').trim();
const toN  = (v) => Number(v || 0);

module.exports = (app) => ({
  verb: 'get',
  route: '/produtos',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const termo = String(req.query.q || '').trim();
    const tiposPermitidos = String(req.query.tipo || 'PA,PI').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

    if (termo.length < 2) return res.json({ produtos: [] });

    const params = { termo: termo.toUpperCase() };
    const inTipo = tiposPermitidos.map((_, i) => `@t${i}`).join(',');
    tiposPermitidos.forEach((t, i) => { params[`t${i}`] = t; });

    try {
      const sql = `
        SELECT TOP 30 RTRIM(B1_COD) cod, RTRIM(B1_DESC) descricao, RTRIM(B1_TIPO) tipo, RTRIM(B1_UM) um, B1_CUSTD custd
          FROM SB1010 WITH (NOLOCK)
         WHERE D_E_L_E_T_ <> '*'
           AND B1_TIPO IN (${inTipo})
           AND (B1_COD LIKE @termo + '%' OR UPPER(B1_DESC) LIKE '%' + @termo + '%')
         ORDER BY B1_COD
      `;
      const rows = await Protheus.connectAndQuery(sql, params);
      return res.json({
        produtos: rows.map(r => ({
          cod: trim(r.cod),
          descricao: trim(r.descricao),
          tipo: trim(r.tipo),
          um: trim(r.um),
          custoPadrao: toN(r.custd)
        }))
      });
    } catch (err) {
      console.error('Erro controladoria/produtos:', err);
      return res.status(500).json({ message: 'Erro na busca.' });
    }
  }
});
