// Edita uma aula. PATCH /universidade/aula/:id

const trim = (v) => v == null ? null : String(v).trim();
const { ehInstrutor, ehAdmin } = require('./_perms');
const TIPOS = ['video', 'pdf', 'slide', 'link', 'texto'];

module.exports = (app) => ({
  verb: 'patch',
  route: '/aula/:id',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await ehInstrutor(Pg, user.ID))) return res.status(403).json({ message: 'Sem permissao.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID invalido.' });

    const ar = await Pg.connectAndQuery(`
      SELECT a.curso_id, c.instrutor_id
        FROM tab_uni_aula a
        INNER JOIN tab_uni_curso c ON c.id = a.curso_id
       WHERE a.id = @id`, { id });
    if (!ar.length) return res.status(404).json({ message: 'Aula nao encontrada.' });
    if (Number(ar[0].instrutor_id) !== Number(user.ID) && !(await ehAdmin(Pg, user.ID))) {
      return res.status(403).json({ message: 'Voce nao pode editar este curso.' });
    }

    const sets = [];
    const params = { id };
    const map = {
      titulo: 'titulo', descricao: 'descricao', conteudoUrl: 'conteudo_url',
      tipo: 'tipo', duracaoMin: 'duracao_min', ordem: 'ordem', obrigatoria: 'obrigatoria'
    };
    for (const [k, col] of Object.entries(map)) {
      if (k in req.body) {
        const v = req.body[k];
        sets.push(`${col} = @${k}`);
        if (k === 'duracaoMin' || k === 'ordem') params[k] = Number(v);
        else if (k === 'obrigatoria') params[k] = !!v;
        else if (k === 'tipo') params[k] = TIPOS.includes(v) ? v : 'video';
        else if (k === 'conteudoUrl') {
          const u = trim(v);
          if (!/^https?:\/\//i.test(u)) return res.status(400).json({ message: 'URL invalida.' });
          params[k] = u;
        } else params[k] = trim(v);
      }
    }
    if (!sets.length) return res.status(400).json({ message: 'Nada a atualizar.' });

    try {
      await Pg.connectAndQuery(`UPDATE tab_uni_aula SET ${sets.join(', ')} WHERE id = @id`, params);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro universidade/aula PATCH:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
