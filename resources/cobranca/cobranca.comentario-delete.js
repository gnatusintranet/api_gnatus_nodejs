// Remove comentário (apenas autor ou admin)
module.exports = (app) => ({
  verb: 'delete',
  route: '/comentario/:id',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    try {
      const existing = await Mssql.connectAndQuery(
        `SELECT ID_USER FROM TAB_COBRANCA_COMENTARIO WHERE ID = @id`, { id }
      );
      if (!existing.length) return res.status(404).json({ message: 'Comentário não encontrado.' });
      if (existing[0].ID_USER !== user.ID && user.EMAIL !== 'admin@gnatus.com.br') {
        return res.status(403).json({ message: 'Sem permissão para excluir este comentário.' });
      }
      await Mssql.connectAndQuery(`DELETE FROM TAB_COBRANCA_COMENTARIO WHERE ID = @id`, { id });
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cobranca/comentario-delete:', err);
      return res.status(500).json({ message: 'Erro ao excluir comentário.' });
    }
  }
});
