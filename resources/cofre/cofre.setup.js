// Configuração inicial do cofre. Recebe os blobs JÁ CIFRADOS do frontend
// + a recovery key em texto (só pra fazer backup server-side em TAB_SYS_AUDIT_META).
// IMPORTANTE: o backup server-side QUEBRA zero-knowledge. Uso documentado:
// permitir que a TI recupere o cofre se o usuário perder senha + chave.
const backup = require('../../services/cofreBackup');

module.exports = (app) => ({
  verb: 'post',
  route: '/setup',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const { salt, iterations, verifier, mkEncPass, mkEncRecovery, recoveryKey } = req.body || {};
    if (!salt || !iterations || !verifier || !mkEncPass || !mkEncRecovery || !recoveryKey) {
      return res.status(400).json({ message: 'Payload incompleto.' });
    }

    try {
      const check = await Mssql.connectAndQuery(
        `SELECT COFRE_MK_ENC_PASS FROM TAB_INTRANET_USR WHERE ID = @id`,
        { id: user.ID }
      );
      if (check[0] && check[0].COFRE_MK_ENC_PASS) {
        return res.status(409).json({ message: 'Cofre já configurado. Use alterar senha mestre.' });
      }

      await Mssql.connectAndQuery(
        `UPDATE TAB_INTRANET_USR
         SET COFRE_SALT = @salt,
             COFRE_ITERATIONS = @iterations,
             COFRE_VERIFIER = @verifier,
             COFRE_MK_ENC_PASS = @mkEncPass,
             COFRE_MK_ENC_RECOVERY = @mkEncRecovery,
             COFRE_CREATED_AT = GETDATE()
         WHERE ID = @id`,
        { id: user.ID, salt, iterations, verifier, mkEncPass, mkEncRecovery }
      );

      // --- Backup server-side da recovery key (em TAB_SYS_AUDIT_META) ---
      const encData = backup.encrypt(recoveryKey);
      const hashRk = backup.hash(recoveryKey);

      await Mssql.connectAndQuery(
        `MERGE TAB_SYS_AUDIT_META AS target
         USING (SELECT @ref AS META_REF) AS source
         ON (target.META_REF = source.META_REF)
         WHEN MATCHED THEN
           UPDATE SET META_DATA = @data, META_HASH = @hash, META_UPDATED = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (META_REF, META_HASH, META_DATA) VALUES (@ref, @hash, @data);`,
        { ref: user.ID, data: encData, hash: hashRk }
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cofre/setup:', err);
      return res.status(500).json({ message: 'Erro ao configurar cofre.' });
    }
  }
});
