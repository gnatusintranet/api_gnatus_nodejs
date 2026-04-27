// Busca usuários no AD + M365 para tela de desligamento.
// Combina os dois resultados (correlaciona por UPN/mail).

const trim = (v) => String(v || '').trim();

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
  route: '/buscar-usuarios',

  handler: async (req, res) => {
    const { Pg, Ad, M365 } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) {
      return res.status(403).json({ message: 'Sem permissão (1029 - Provisionamento).' });
    }

    const q = trim(req.query.q);
    if (!q || q.length < 3) {
      return res.status(400).json({ message: 'Busca precisa ter pelo menos 3 caracteres.' });
    }

    // Busca em paralelo nos dois lados — não bloqueia se um falhar
    const [m365, ad] = await Promise.allSettled([
      M365.searchUsers(q),
      Ad.findUser(q)
    ]);

    const m365Users = m365.status === 'fulfilled' ? m365.value : [];
    const adUser = ad.status === 'fulfilled' ? ad.value : null;
    const erros = [];
    if (m365.status === 'rejected') erros.push('M365: ' + m365.reason.message);
    if (ad.status === 'rejected') erros.push('AD: ' + ad.reason.message);

    // Combina: cada user do M365 vira uma linha; tenta correlacionar com AD pelo UPN/mail
    const lista = m365Users.map(u => {
      const ehMesmo = adUser && (
        adUser.upn?.toLowerCase() === u.upn?.toLowerCase() ||
        adUser.mail?.toLowerCase() === u.mail?.toLowerCase()
      );
      return {
        m365Id: u.id,
        nome: u.nome,
        upn: u.upn,
        mail: u.mail,
        cargo: u.cargo,
        departamento: u.departamento,
        m365Ativo: u.ativo,
        adDn: ehMesmo ? adUser.dn : null,
        adAtivo: ehMesmo ? adUser.ativo : null,
        sAMAccountName: ehMesmo ? adUser.sAMAccountName : null
      };
    });

    // Se AD encontrou e M365 NÃO trouxe (caso raro), inclui à parte
    if (adUser && !lista.some(l => l.adDn === adUser.dn)) {
      lista.push({
        m365Id: null, nome: adUser.displayName,
        upn: adUser.upn, mail: adUser.mail,
        cargo: '', departamento: '',
        m365Ativo: null,
        adDn: adUser.dn, adAtivo: adUser.ativo,
        sAMAccountName: adUser.sAMAccountName
      });
    }

    return res.json({ total: lista.length, usuarios: lista, erros });
  }
});
