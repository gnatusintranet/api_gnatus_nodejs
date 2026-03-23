module.exports = app => ({
    verb: 'get',
    route: '/permissoes/:ID_USER',
 
    handler: async (req, res) => {
 
        const { ID_USER } = req.params;
        const id = Number(ID_USER);

         
        const { Mssql } = app.services;
         try {
      const data = await Mssql.connectAndQuery(`
        SELECT
           P.ID
          ,P.ID_PERMISSAO
          ,P.NOME
          ,P.MODULO
          ,ASSIGNED = CASE WHEN UP.ID_PERMISSAO IS NULL THEN 0 ELSE 1 END
        FROM TAB_INTRANET_PERMISSOES AS P WITH (NOLOCK)
        LEFT JOIN TAB_INTRANET_USR_PERMISSOES AS UP WITH (NOLOCK)
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
