module.exports = (app) => ({
  verb: 'post',
  route: '/items/:id/update',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

    const { titulo, categoria, url, usuarioEnc, senhaEnc, notasEnc } = req.body || {};
    if (!titulo || !senhaEnc) {
      return res.status(400).json({ message: 'Título e senha são obrigatórios.' });
    }

    try {
      await Pg.connectAndQuery(
        `UPDATE tab_cofre_item
         SET TITULO = @titulo, CATEGORIA = @categoria, URL = @url,
             USUARIO_ENC = @usuarioEnc, SENHA_ENC = @senhaEnc, NOTAS_ENC = @notasEnc,
             UPDATED_AT = GETDATE()
         WHERE ID = @id AND ID_USER = @idUser`,
        {
          id, idUser: user.ID,
          titulo, categoria: categoria || '', url: url || '',
          usuarioEnc: usuarioEnc || '', senhaEnc, notasEnc: notasEnc || ''
        }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cofre/items-update:', err);
      return res.status(500).json({ message: 'Erro ao atualizar item.' });
    }
  }
});
