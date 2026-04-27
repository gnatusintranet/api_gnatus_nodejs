// Retorna se o usuário já tem o cofre configurado e, em caso afirmativo,
// devolve o salt / iterations / verifier / mk_enc_pass pro browser conseguir
// derivar a chave e validar a master password.
module.exports = (app) => ({
  verb: 'get',
  route: '/status',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    try {
      const rows = await Pg.connectAndQuery(
        `SELECT COFRE_SALT, COFRE_ITERATIONS, COFRE_VERIFIER, COFRE_MK_ENC_PASS, COFRE_CREATED_AT
         FROM tab_intranet_usr WHERE ID = @id`,
        { id: user.ID }
      );
      const r = rows[0] || {};
      const configurado = !!(r.COFRE_SALT && r.COFRE_MK_ENC_PASS);
      return res.json({
        configurado,
        salt: r.COFRE_SALT || null,
        iterations: r.COFRE_ITERATIONS || null,
        verifier: r.COFRE_VERIFIER || null,
        mkEncPass: r.COFRE_MK_ENC_PASS || null,
        createdAt: r.COFRE_CREATED_AT || null
      });
    } catch (err) {
      console.error('Erro cofre/status:', err);
      return res.status(500).json({ message: 'Erro ao consultar status do cofre.' });
    }
  }
});
