module.exports = (app) => ({
  verb: "get",
  route: "/me",
  handler: async (req, res) => {
    const { Pg } = app.services;

    try {
      const { ID, NOME, MATRICULA, EMAIL, CODIGO_PROTHEUS, RAMAL } = req.user[0];

      const formatName = NOME.split(' ');
      const primeiroNome = formatName[0];
      const ultimoNome = formatName[formatName.length - 1];

      const permissoes = await Pg.connectAndQuery(
        `SELECT ID_PERMISSAO FROM tab_intranet_usr_permissoes WHERE ID_USER = @id`,
        { id: ID }
      );

      const mapPermissions = permissoes.map(p => p.ID_PERMISSAO);

      // Sem cache HTTP — sempre devolve perms atualizadas (impede continuar com perm revogada)
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      return res.json({
        id: ID,
        matricula: MATRICULA,
        email: EMAIL,
        nome: primeiroNome + ' ' + ultimoNome,
        codigoProtheus: (CODIGO_PROTHEUS || '').trim() || null,
        ramal: (RAMAL || '').trim() || null,
        permissoes: mapPermissions
      });
    } catch (error) {
      console.error("Erro ao processar a solicitação", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  },
});
