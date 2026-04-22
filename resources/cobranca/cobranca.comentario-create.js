// Adiciona comentário interno (visível apenas para equipe) em um cliente
module.exports = (app) => ({
  verb: 'post',
  route: '/comentario',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const { clienteCod, clienteLoja, texto } = req.body || {};
    if (!clienteCod || !clienteLoja) return res.status(400).json({ message: 'Cliente é obrigatório.' });
    if (!texto || !String(texto).trim()) return res.status(400).json({ message: 'Texto do comentário é obrigatório.' });

    try {
      const result = await Mssql.connectAndQuery(
        `INSERT INTO TAB_COBRANCA_COMENTARIO (CLIENTE_COD, CLIENTE_LOJA, ID_USER, TEXTO)
         OUTPUT INSERTED.ID, INSERTED.CRIADO_EM
         VALUES (@cod, @loja, @uid, @texto)`,
        {
          cod: String(clienteCod).trim(),
          loja: String(clienteLoja).trim(),
          uid: user.ID,
          texto: String(texto).trim()
        }
      );
      return res.status(201).json({
        ok: true,
        id: result[0]?.ID,
        criadoEm: result[0]?.CRIADO_EM,
        userNome: user.NOME
      });
    } catch (err) {
      console.error('Erro cobranca/comentario-create:', err);
      return res.status(500).json({ message: 'Erro ao adicionar comentário.' });
    }
  }
});
