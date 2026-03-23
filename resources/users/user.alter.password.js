const bcrypt = require("bcryptjs");

module.exports = (app) => ({
  verb: "post",
  route: "/password",
  //anonymous: true,

  handler: async (req, res) => {
    const { Mssql } = app.services;

    const { SENHA } = req.body;

    try {
      const { NOME, MATRICULA } = req.user[0];

      const alterPassword = `
            UPDATE TAB_INTRANET_USR 
            SET SENHA = '${bcrypt.hashSync(SENHA, 10)}'
            WHERE MATRICULA = '${MATRICULA}'
        `;
      await Mssql.connectAndQuery(alterPassword);

      return res.status(200).json({
        message: `senha alterada com sucesso  ${NOME} - ${MATRICULA}`,
      });
    } catch (error) {
      return res.status(500).json({
        error,
        message: `Erro ao alterar senha - ${NOME} - ${MATRICULA}`,
      });
    }
  },
});
