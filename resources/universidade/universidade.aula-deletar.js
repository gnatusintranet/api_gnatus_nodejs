// Remove uma aula. DELETE /universidade/aula/:id

const { ehInstrutor, ehAdmin } = require('./_perms');

module.exports = (app) => ({
  verb: 'delete',
  route: '/aula/:id',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await ehInstrutor(Pg, user.ID))) return res.status(403).json({ message: 'Sem permissao.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID invalido.' });

    const ar = await Pg.connectAndQuery(`
      SELECT c.instrutor_id
        FROM tab_uni_aula a
        INNER JOIN tab_uni_curso c ON c.id = a.curso_id
       WHERE a.id = @id`, { id });
    if (!ar.length) return res.status(404).json({ message: 'Aula nao encontrada.' });
    if (Number(ar[0].instrutor_id) !== Number(user.ID) && !(await ehAdmin(Pg, user.ID))) {
      return res.status(403).json({ message: 'Voce nao pode editar este curso.' });
    }

    try {
      await Pg.connectAndQuery(`DELETE FROM tab_uni_aula WHERE id = @id`, { id });
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro universidade/aula DELETE:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
