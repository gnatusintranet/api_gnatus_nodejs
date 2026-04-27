// Lista licenças (SKUs) M365 disponíveis no tenant.

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
  route: '/licencas-m365',

  handler: async (req, res) => {
    const { Pg, M365 } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) {
      return res.status(403).json({ message: 'Sem permissão (1029 - Provisionamento).' });
    }

    try {
      const licencas = await M365.listSkus();
      return res.json({ total: licencas.length, licencas });
    } catch (err) {
      console.error('Erro listSkus:', err);
      return res.status(502).json({ message: 'Falha ao consultar M365: ' + err.message });
    }
  }
});
