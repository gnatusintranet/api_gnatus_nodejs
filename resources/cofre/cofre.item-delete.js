module.exports = (app) => ({
  verb: 'post',
  route: '/items/:id/delete',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

    try {
      await Mssql.connectAndQuery(
        `DELETE FROM TAB_COFRE_ITEM WHERE ID = @id AND ID_USER = @idUser`,
        { id, idUser: user.ID }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro cofre/items-delete:', err);
      return res.status(500).json({ message: 'Erro ao excluir item.' });
    }
  }
});
