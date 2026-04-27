module.exports = app => ({
  verb: 'get',
  route: '/all',
  handler: async (req, res) => {
    const { Pg } = app.services;
    // Traz todos (ativos + inativos) — frontend mostra coluna Status e botão Ativar/Desativar.
    const data = await Pg.connectAndQuery('SELECT * FROM tab_intranet_usr ORDER BY ativo DESC, nome');
    return res.json(data);
  }
});
