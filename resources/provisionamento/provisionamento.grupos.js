// Lista grupos de segurança do AD.

const checarPerm = async (Pg, idUser) => {
  const r = await Pg.connectAndQuery(
    `SELECT id_permissao FROM tab_intranet_usr_permissoes
      WHERE id_user = @id AND id_permissao IN (0, 1029)`,
    { id: idUser }
  );
  return r.length > 0;
};

module.exports = (app) => ({
  verb: 'get',
  route: '/grupos',

  handler: async (req, res) => {
    const { Pg, Ad } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) {
      return res.status(403).json({ message: 'Sem permissão (1029 - Provisionamento).' });
    }

    try {
      const grupos = await Ad.listGroups();
      return res.json({ total: grupos.length, grupos });
    } catch (err) {
      console.error('Erro listGroups:', err);
      return res.status(502).json({ message: 'Falha ao consultar AD: ' + err.message });
    }
  }
});
