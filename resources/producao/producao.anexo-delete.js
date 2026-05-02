// Remove um anexo. DELETE /producao/registro/:id/anexo/:anexoId

const checarPerm = async (Pg, idUser) => {
  const r = await Pg.connectAndQuery(
    `SELECT 1 FROM tab_intranet_usr_permissoes WHERE id_user = @id AND id_permissao IN (0, 14001)`,
    { id: idUser }
  );
  return r.length > 0;
};

module.exports = (app) => ({
  verb: 'delete',
  route: '/registro/:id/anexo/:anexoId',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) return res.status(403).json({ message: 'Sem permissao (14001).' });

    const id = Number(req.params.id);
    const anexoId = Number(req.params.anexoId);
    if (!Number.isInteger(id) || !Number.isInteger(anexoId)) {
      return res.status(400).json({ message: 'IDs invalidos.' });
    }

    try {
      const r = await Pg.connectAndQuery(
        `DELETE FROM tab_prod_registro_anexo WHERE id = @aid AND registro_id = @rid RETURNING id`,
        { aid: anexoId, rid: id }
      );
      if (!r.length) return res.status(404).json({ message: 'Anexo nao encontrado.' });
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro producao/anexo DELETE:', err);
      return res.status(500).json({ message: 'Erro ao remover anexo: ' + err.message });
    }
  }
});
