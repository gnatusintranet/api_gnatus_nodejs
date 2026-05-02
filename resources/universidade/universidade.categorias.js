// Lista categorias ativas.
// GET /universidade/categorias

module.exports = (app) => ({
  verb: 'get',
  route: '/categorias',

  handler: async (req, res) => {
    const { Pg } = app.services;
    try {
      const rows = await Pg.connectAndQuery(`
        SELECT id, nome, descricao, cor, ordem
          FROM tab_uni_categoria
         WHERE ativo = true
         ORDER BY ordem, nome`, {});
      return res.json({ categorias: rows });
    } catch (err) {
      console.error('Erro universidade/categorias:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
