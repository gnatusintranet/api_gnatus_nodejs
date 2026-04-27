// Retorna o blob COFRE_MK_ENC_RECOVERY pro frontend tentar recuperar a master key
// a partir da recovery key. O frontend cifra uma nova master password e envia
// via /cofre/reset-password.
module.exports = (app) => ({
  verb: 'get',
  route: '/recovery-blob',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    try {
      const rows = await Pg.connectAndQuery(
        `SELECT COFRE_SALT, COFRE_ITERATIONS, COFRE_MK_ENC_RECOVERY
         FROM tab_intranet_usr WHERE ID = @id`,
        { id: user.ID }
      );
      const r = rows[0] || {};
      if (!r.COFRE_MK_ENC_RECOVERY) {
        return res.status(404).json({ message: 'Cofre sem recovery configurada.' });
      }
      return res.json({
        salt: r.COFRE_SALT,
        iterations: r.COFRE_ITERATIONS,
        mkEncRecovery: r.COFRE_MK_ENC_RECOVERY
      });
    } catch (err) {
      console.error('Erro cofre/recovery-blob:', err);
      return res.status(500).json({ message: 'Erro ao consultar recovery.' });
    }
  }
});
