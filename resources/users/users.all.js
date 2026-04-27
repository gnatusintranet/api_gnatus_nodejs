module.exports = app => ({
  verb: 'get',
  route: '/all',
  //anonymous: true,
  handler: async (req, res) => {
    const { Pg } = app.services

    const data = await Pg.connectAndQuery('SELECT * FROM tab_intranet_usr WHERE ativo = true')
    return res.json(data)
    
  }
})
