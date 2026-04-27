// Configuração inicial do cofre. Recebe os blobs JÁ CIFRADOS do frontend
// + a recovery key em texto (só pra fazer backup server-side em tab_sys_audit_meta).
// IMPORTANTE: o backup server-side QUEBRA zero-knowledge. Uso documentado:
// permitir que a TI recupere o cofre se o usuário perder senha + chave.
const backup = require('../../services/cofreBackup');

module.exports = (app) => ({
  verb: 'post',
  route: '/setup',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const { salt, iterations, verifier, mkEncPass, mkEncRecovery, recoveryKey } = req.body || {};
    if (!salt || !iterations || !verifier || !mkEncPass || !mkEncRecovery || !recoveryKey) {
      return res.status(400).json({ message: 'Payload incompleto.' });
    }

    try {
      const check = await Pg.connectAndQuery(
        `SELECT cofre_mk_enc_pass FROM tab_intranet_usr WHERE id = @id`,
        { id: user.ID }
      );
      if (check[0] && check[0].cofre_mk_enc_pass) {
        return res.status(409).json({ message: 'Cofre já configurado. Use alterar senha mestre.' });
      }

      await Pg.connectAndQuery(
        `UPDATE tab_intranet_usr
            SET cofre_salt            = @salt,
                cofre_iterations      = @iterations,
                cofre_verifier        = @verifier,
                cofre_mk_enc_pass     = @mkEncPass,
                cofre_mk_enc_recovery = @mkEncRecovery,
                cofre_created_at      = NOW()
          WHERE id = @id`,
        { id: user.ID, salt, iterations, verifier, mkEncPass, mkEncRecovery }
      );

      // --- Backup server-side da recovery key (em tab_sys_audit_meta) ---
      const encData = backup.encrypt(recoveryKey);
      const hashRk = backup.hash(recoveryKey);

      // Upsert: DELETE + INSERT (PK é meta_id SERIAL, mas a lógica é 1 registro por meta_ref)
      await Pg.connectAndQuery(
        `DELETE FROM tab_sys_audit_meta WHERE meta_ref = @ref`,
        { ref: user.ID }
      );
      await Pg.connectAndQuery(
        `INSERT INTO tab_sys_audit_meta (meta_ref, meta_hash, meta_data)
         VALUES (@ref, @hash, @data)`,
        { ref: user.ID, data: encData, hash: hashRk }
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cofre/setup:', err);
      return res.status(500).json({ message: 'Erro ao configurar cofre.' });
    }
  }
});
