// Cria uma aula dentro de um curso. Mesma regra de dono/admin.
// POST /universidade/curso/:cursoId/aula
// Body: { titulo, conteudoUrl, descricao?, tipo?, duracaoMin?, ordem?, obrigatoria? }

const trim = (v) => v == null ? null : String(v).trim();
const { ehInstrutor, ehAdmin } = require('./_perms');

const TIPOS = ['video', 'pdf', 'slide', 'link', 'texto'];

module.exports = (app) => ({
  verb: 'post',
  route: '/curso/:cursoId/aula',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await ehInstrutor(Pg, user.ID))) return res.status(403).json({ message: 'Sem permissao.' });

    const cursoId = Number(req.params.cursoId);
    if (!Number.isInteger(cursoId) || cursoId <= 0) return res.status(400).json({ message: 'cursoId invalido.' });

    const c = await Pg.connectAndQuery(`SELECT instrutor_id FROM tab_uni_curso WHERE id = @id`, { id: cursoId });
    if (!c.length) return res.status(404).json({ message: 'Curso nao encontrado.' });
    if (Number(c[0].instrutor_id) !== Number(user.ID) && !(await ehAdmin(Pg, user.ID))) {
      return res.status(403).json({ message: 'Voce nao pode editar este curso.' });
    }

    const titulo = trim(req.body?.titulo);
    const conteudoUrl = trim(req.body?.conteudoUrl);
    if (!titulo || !conteudoUrl) return res.status(400).json({ message: 'titulo e conteudoUrl obrigatorios.' });
    if (!/^https?:\/\//i.test(conteudoUrl)) {
      return res.status(400).json({ message: 'conteudoUrl deve comecar com http:// ou https://' });
    }
    const tipo = TIPOS.includes(req.body?.tipo) ? req.body.tipo : 'video';

    // Calcula proxima ordem se nao informada
    let ordem = req.body?.ordem != null ? Number(req.body.ordem) : null;
    if (ordem == null) {
      const max = await Pg.connectAndQuery(
        `SELECT COALESCE(MAX(ordem), 0) AS m FROM tab_uni_aula WHERE curso_id = @id`,
        { id: cursoId }
      );
      ordem = Number(max[0].m || 0) + 1;
    }

    try {
      const ins = await Pg.connectAndQuery(`
        INSERT INTO tab_uni_aula (curso_id, ordem, titulo, descricao, conteudo_url, tipo, duracao_min, obrigatoria)
        VALUES (@cid, @ord, @tit, @desc, @url, @tipo, @dur, @obr)
        RETURNING id`,
        {
          cid: cursoId, ord: ordem, tit: titulo,
          desc: trim(req.body?.descricao), url: conteudoUrl, tipo,
          dur: req.body?.duracaoMin != null ? Number(req.body.duracaoMin) : 0,
          obr: req.body?.obrigatoria !== false
        }
      );
      return res.json({ ok: true, id: ins[0].id });
    } catch (err) {
      console.error('Erro universidade/aula POST:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
