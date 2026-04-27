const bcrypt = require("bcryptjs");

module.exports = (app) => ({
  verb: "post",
  route: "/password",
  //anonymous: true,

  handler: async (req, res) => {
    const { Pg } = app.services;

    const { SENHA } = req.body;

    try {
      const { NOME, MATRICULA } = req.user[0];

      await Pg.connectAndQuery(
        `UPDATE tab_intranet_usr SET SENHA = @senha WHERE MATRICULA = @matricula`,
        { senha: bcrypt.hashSync(SENHA, 10), matricula: MATRICULA }
      );

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
