module.exports = (app) => ({
  verb: "get",
  route: "/me",
  handler: async (req, res) => {
    const { Mssql } = app.services;

    try {
      const { ID, NOME, MATRICULA, EMAIL } = req.user[0];

      const formatName = NOME.split(' ');
      const primeiroNome = formatName[0];
      const ultimoNome = formatName[formatName.length - 1];

      const permissoes = await Mssql.connectAndQuery(
        `SELECT ID_PERMISSAO FROM TAB_INTRANET_USR_PERMISSOES WHERE ID_USER = @id`,
        { id: ID }
      );

      const mapPermissions = permissoes.map(p => p.ID_PERMISSAO);

      return res.json({
        id: ID, 
        matricula: MATRICULA,
        email: EMAIL,
        nome: primeiroNome + ' ' + ultimoNome, 
        permissoes: mapPermissions
      });
    } catch (error) {
      console.error("Erro ao processar a solicitação", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  },
});
