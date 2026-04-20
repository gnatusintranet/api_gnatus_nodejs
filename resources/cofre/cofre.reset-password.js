// Após recovery, o frontend gera nova salt + reencripta a master key com a
// nova master password, e envia aqui. O servidor simplesmente substitui os blobs.
// recoveryKey opcional: se vier, re-sincroniza o backup server-side.
const backup = require('../../services/cofreBackup');

module.exports = (app) => ({
  verb: 'post',
  route: '/reset-password',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const { salt, iterations, verifier, mkEncPass, mkEncRecovery, recoveryKey } = req.body || {};
    if (!salt || !iterations || !verifier || !mkEncPass || !mkEncRecovery) {
      return res.status(400).json({ message: 'Payload incompleto.' });
    }

    try {
      await Mssql.connectAndQuery(
        `UPDATE TAB_INTRANET_USR
         SET COFRE_SALT = @salt,
             COFRE_ITERATIONS = @iterations,
             COFRE_VERIFIER = @verifier,
             COFRE_MK_ENC_PASS = @mkEncPass,
             COFRE_MK_ENC_RECOVERY = @mkEncRecovery
         WHERE ID = @id`,
        { id: user.ID, salt, iterations, verifier, mkEncPass, mkEncRecovery }
      );

      // Se a recovery key foi fornecida, re-sincroniza o backup
      if (recoveryKey) {
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
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cofre/reset-password:', err);
      return res.status(500).json({ message: 'Erro ao redefinir senha mestre.' });
    }
  }
});
