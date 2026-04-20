module.exports = (app) => ({
  verb: 'post',
  route: '/items',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const { titulo, categoria, url, usuarioEnc, senhaEnc, notasEnc } = req.body || {};
    if (!titulo || !senhaEnc) {
      return res.status(400).json({ message: 'Título e senha são obrigatórios.' });
    }

    try {
      const result = await Mssql.connectAndQuery(
        `INSERT INTO TAB_COFRE_ITEM (ID_USER, TITULO, CATEGORIA, URL, USUARIO_ENC, SENHA_ENC, NOTAS_ENC)
         OUTPUT INSERTED.ID
         VALUES (@id, @titulo, @categoria, @url, @usuarioEnc, @senhaEnc, @notasEnc)`,
        {
          id: user.ID,
          titulo,
          categoria: categoria || '',
          url: url || '',
          usuarioEnc: usuarioEnc || '',
          senhaEnc,
          notasEnc: notasEnc || ''
        }
      );
      return res.status(201).json({ ok: true, id: result[0]?.ID });
    } catch (err) {
      console.error('Erro cofre/items-create:', err);
      return res.status(500).json({ message: 'Erro ao criar item.' });
    }
  }
});
