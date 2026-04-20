module.exports = (app) => ({
  verb: 'post',
  route: '/:id/toggle-active',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

    try {
      await Mssql.connectAndQuery(
        `UPDATE TAB_INTRANET_USR
         SET ATIVO = CASE WHEN ATIVO = 1 THEN 0 ELSE 1 END
         WHERE ID = @id`,
        { id }
      );
      const atual = await Mssql.connectAndQuery(
        `SELECT ATIVO FROM TAB_INTRANET_USR WHERE ID = @id`,
        { id }
      );
      return res.json({ ok: true, ativo: !!atual[0]?.ATIVO });
    } catch (err) {
      console.error('Erro ao alternar ativo:', err);
      return res.status(500).json({ message: 'Erro ao alternar status.' });
    }
  }
});
