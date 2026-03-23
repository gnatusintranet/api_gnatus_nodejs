module.exports = (app) => ({
    verb: "get",
    route: "/all",
    //anonymous: true,

    handler: async (req, res) => {
      const { Mssql } = app.services;
      const data = await Mssql.connectAndQuery(`
      SELECT 
      [ID]
      ,[ID_PERMISSAO]
      ,[NOME]
      ,[MODULO]  
      FROM TAB_INTRANET_PERMISSOES WITH (NOLOCK)

    `);
    
      return res.json(data);
    },
  });