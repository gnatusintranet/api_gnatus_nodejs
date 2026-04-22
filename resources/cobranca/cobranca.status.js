// Atualiza o status de cobrança de um cliente (upsert)
const STATUS_VALIDOS = ['REGULAR','NEGOCIANDO','PROMESSA','PROTESTO','JURIDICO','PERDA'];

module.exports = (app) => ({
  verb: 'put',
  route: '/status/:cod/:loja',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const cod  = String(req.params.cod  || '').trim();
    const loja = String(req.params.loja || '').trim();
    const { status, observacao } = req.body || {};

    if (!cod || !loja) return res.status(400).json({ message: 'Cliente é obrigatório.' });
    if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ message: 'Status inválido.' });

    try {
      await Mssql.connectAndQuery(
        `MERGE dbo.TAB_COBRANCA_STATUS_CLIENTE AS tgt
         USING (SELECT @cod AS CLIENTE_COD, @loja AS CLIENTE_LOJA) AS src
            ON tgt.CLIENTE_COD = src.CLIENTE_COD AND tgt.CLIENTE_LOJA = src.CLIENTE_LOJA
         WHEN MATCHED THEN UPDATE SET STATUS = @status, OBSERVACAO = @obs, DT_ATUALIZACAO = GETDATE(), ID_USER = @uid
         WHEN NOT MATCHED THEN INSERT (CLIENTE_COD, CLIENTE_LOJA, STATUS, OBSERVACAO, ID_USER)
                               VALUES (@cod, @loja, @status, @obs, @uid);`,
        { cod, loja, status, obs: observacao || null, uid: user.ID }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cobranca/status:', err);
      return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
  }
});
