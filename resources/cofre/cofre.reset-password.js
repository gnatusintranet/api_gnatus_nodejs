// Após recovery, o frontend gera nova salt + reencripta a master key com a
// nova master password, e envia aqui. O servidor simplesmente substitui os blobs.
// recoveryKey opcional: se vier, re-sincroniza o backup server-side.
const backup = require('../../services/cofreBackup');

module.exports = (app) => ({
  verb: 'post',
  route: '/reset-password',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const { salt, iterations, verifier, mkEncPass, mkEncRecovery, recoveryKey } = req.body || {};
    if (!salt || !iterations || !verifier || !mkEncPass || !mkEncRecovery) {
      return res.status(400).json({ message: 'Payload incompleto.' });
    }

    try {
      await Pg.connectAndQuery(
        `UPDATE tab_intranet_usr
            SET cofre_salt            = @salt,
                cofre_iterations      = @iterations,
                cofre_verifier        = @verifier,
                cofre_mk_enc_pass     = @mkEncPass,
                cofre_mk_enc_recovery = @mkEncRecovery
          WHERE id = @id`,
        { id: user.ID, salt, iterations, verifier, mkEncPass, mkEncRecovery }
      );

      // Se a recovery key foi fornecida, re-sincroniza o backup (DELETE+INSERT)
      if (recoveryKey) {
        const encData = backup.encrypt(recoveryKey);
        const hashRk = backup.hash(recoveryKey);
        await Pg.connectAndQuery(
          `DELETE FROM tab_sys_audit_meta WHERE meta_ref = @ref`,
          { ref: user.ID }
        );
        await Pg.connectAndQuery(
          `INSERT INTO tab_sys_audit_meta (meta_ref, meta_hash, meta_data)
           VALUES (@ref, @hash, @data)`,
          { ref: user.ID, data: encData, hash: hashRk }
        );
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cofre/reset-password:', err);
      return res.status(500).json({ message: 'Erro ao redefinir senha mestre.' });
    }
  }
});
