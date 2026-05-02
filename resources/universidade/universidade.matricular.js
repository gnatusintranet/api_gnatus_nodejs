// Matricula o usuario logado em um curso.
// POST /universidade/curso/:id/matricular

module.exports = (app) => ({
  verb: 'post',
  route: '/curso/:id/matricular',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID invalido.' });

    try {
      // Verifica se o curso existe e esta ativo+publico
      const c = await Pg.connectAndQuery(
        `SELECT id, ativo, publico FROM tab_uni_curso WHERE id = @id`, { id }
      );
      if (!c.length) return res.status(404).json({ message: 'Curso nao encontrado.' });
      if (!c[0].ativo) return res.status(409).json({ message: 'Curso inativo.' });
      if (!c[0].publico) return res.status(403).json({ message: 'Matricula apenas via admin.' });

      // Idempotente: se ja matriculado, retorna o existente
      const ex = await Pg.connectAndQuery(
        `SELECT id, status FROM tab_uni_matricula WHERE user_id = @uid AND curso_id = @id`,
        { uid: user.ID, id }
      );
      if (ex.length) {
        return res.json({ ok: true, matriculaId: ex[0].id, jaMatriculado: true });
      }

      const ins = await Pg.connectAndQuery(
        `INSERT INTO tab_uni_matricula (user_id, curso_id) VALUES (@uid, @id) RETURNING id`,
        { uid: user.ID, id }
      );
      return res.json({ ok: true, matriculaId: ins[0].id });
    } catch (err) {
      console.error('Erro universidade/matricular:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
