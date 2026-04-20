// Lista todos os itens do cofre do usuário atual (apenas dados deste user).
module.exports = (app) => ({
  verb: 'get',
  route: '/items',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    try {
      const rows = await Mssql.connectAndQuery(
        `SELECT ID, TITULO, CATEGORIA, URL, USUARIO_ENC, SENHA_ENC, NOTAS_ENC,
                CREATED_AT, UPDATED_AT
         FROM TAB_COFRE_ITEM
         WHERE ID_USER = @id
         ORDER BY TITULO`,
        { id: user.ID }
      );
      return res.json(rows.map((r) => ({
        id: r.ID,
        titulo: r.TITULO,
        categoria: r.CATEGORIA || '',
        url: r.URL || '',
        usuarioEnc: r.USUARIO_ENC || '',
        senhaEnc: r.SENHA_ENC || '',
        notasEnc: r.NOTAS_ENC || '',
        createdAt: r.CREATED_AT,
        updatedAt: r.UPDATED_AT
      })));
    } catch (err) {
      console.error('Erro cofre/items:', err);
      return res.status(500).json({ message: 'Erro ao listar itens do cofre.' });
    }
  }
});
