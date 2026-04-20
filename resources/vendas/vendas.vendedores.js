module.exports = (app) => ({
  verb: 'get',
  route: '/vendedores',

  handler: async (req, res) => {
    const { Protheus } = app.services;

    try {
      const rows = await Protheus.connectAndQuery(`
        SELECT RTRIM(A3_COD) AS codigo, RTRIM(A3_NOME) AS nome
        FROM SA3010 WITH (NOLOCK)
        WHERE D_E_L_E_T_ <> '*'
        ORDER BY A3_NOME
      `);

      return res.json(rows.map((r) => ({ codigo: r.codigo, nome: r.nome })));
    } catch (error) {
      console.error('Erro ao listar vendedores:', error);
      return res.status(500).json({ message: 'Erro ao listar vendedores.' });
    }
  }
});
