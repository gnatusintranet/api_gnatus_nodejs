module.exports = app => ({
  verb: 'get',
  route: '/all',
  //anonymous: true,
  handler: async (req, res) => {
    const { Mssql } = app.services

    const data = await Mssql.connectAndQuery('SELECT * FROM TAB_INTRANET_USR WHERE ATIVO = 1')
    return res.json(data)
    
  }
})
