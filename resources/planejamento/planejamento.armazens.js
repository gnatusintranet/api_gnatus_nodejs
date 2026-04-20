module.exports = (app) => ({
  verb: 'get',
  route: '/armazens',

  handler: async (req, res) => {
    const { Protheus } = app.services;

    try {
      const rows = await Protheus.connectAndQuery(`
        SELECT RTRIM(NNR_CODIGO) AS codigo, RTRIM(NNR_DESCRI) AS descricao
        FROM dbo.NNR010 WITH (NOLOCK)
        WHERE D_E_L_E_T_ <> '*'
        ORDER BY NNR_CODIGO
      `);

      return res.json(
        rows.map((r) => ({
          codigo: r.codigo,
          descricao: r.descricao
        }))
      );
    } catch (error) {
      console.error('Erro ao listar armazéns:', error);
      return res.status(500).json({ message: 'Erro ao listar armazéns.' });
    }
  }
});
