module.exports = app => ({
    verb: 'get',
    route: '/permissoes/:ID_USER',
 
    handler: async (req, res) => {
 
        const { ID_USER } = req.params;
        const id = Number(ID_USER);

         
        const { Pg } = app.services;
         try {
      const data = await Pg.connectAndQuery(`
        SELECT
           P.ID
          ,P.ID_PERMISSAO
          ,P.NOME
          ,P.MODULO
          ,ASSIGNED = CASE WHEN UP.ID_PERMISSAO IS NULL THEN 0 ELSE 1 END
        FROM tab_intranet_permissoes AS P WITH (NOLOCK)
        LEFT JOIN tab_intranet_usr_permissoes AS UP WITH (NOLOCK)
          ON UP.ID_PERMISSAO = P.ID_PERMISSAO
         AND UP.ID_USER = ${id}
        ORDER BY P.MODULO, P.NOME
      `);

      return res.json(data);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
});
