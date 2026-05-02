// Adiciona um anexo (URL do SharePoint) a um registro ou etapa.
// POST /producao/registro/:id/anexo
// Body: { titulo, url, tipo?, etapaCodigo? (1..12 ou null = global) }

const trim = (v) => v == null ? null : String(v).trim();

const checarPerm = async (Pg, idUser) => {
  const r = await Pg.connectAndQuery(
    `SELECT 1 FROM tab_intranet_usr_permissoes WHERE id_user = @id AND id_permissao IN (0, 14001)`,
    { id: idUser }
  );
  return r.length > 0;
};

module.exports = (app) => ({
  verb: 'post',
  route: '/registro/:id/anexo',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) return res.status(403).json({ message: 'Sem permissao (14001).' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID invalido.' });

    const titulo = trim(req.body?.titulo);
    const url = trim(req.body?.url);
    const tipo = trim(req.body?.tipo) || 'outros';
    const etapaCodigo = req.body?.etapaCodigo != null ? Number(req.body.etapaCodigo) : null;

    if (!titulo || !url) return res.status(400).json({ message: 'titulo e url obrigatorios.' });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ message: 'url deve comecar com http:// ou https://' });
    if (etapaCodigo != null && (!Number.isInteger(etapaCodigo) || etapaCodigo < 1 || etapaCodigo > 12)) {
      return res.status(400).json({ message: 'etapaCodigo invalido.' });
    }

    try {
      const reg = await Pg.connectAndQuery(`SELECT 1 FROM tab_prod_registro WHERE id = @id`, { id });
      if (!reg.length) return res.status(404).json({ message: 'Registro nao encontrado.' });

      const ins = await Pg.connectAndQuery(`
        INSERT INTO tab_prod_registro_anexo (registro_id, etapa_codigo, titulo, url, tipo, enviado_por)
        VALUES (@id, @ec, @tit, @url, @tipo, @uid)
        RETURNING id`,
        { id, ec: etapaCodigo, tit: titulo, url, tipo, uid: user.ID }
      );

      return res.json({ ok: true, id: ins[0].id });
    } catch (err) {
      console.error('Erro producao/anexo POST:', err);
      return res.status(500).json({ message: 'Erro ao adicionar anexo: ' + err.message });
    }
  }
});
