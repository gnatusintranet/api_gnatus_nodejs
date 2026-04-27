module.exports = (app) => ({
    verb: "get",
    route: "/all",
    //anonymous: true,

    handler: async (req, res) => {
      const { Pg } = app.services;
      const data = await Pg.connectAndQuery(`
        SELECT id, id_permissao, nome, modulo
          FROM tab_intranet_permissoes
         ORDER BY id_permissao
      `);
    
      return res.json(data);
    },
  });