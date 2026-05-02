// Meus cursos: tudo que estou matriculado, com progresso.
// GET /universidade/meus-cursos

module.exports = (app) => ({
  verb: 'get',
  route: '/meus-cursos',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });

    try {
      const rows = await Pg.connectAndQuery(`
        SELECT m.id AS matricula_id, m.status, m.percent_progresso,
               m.data_matricula, m.data_conclusao,
               c.id AS curso_id, c.codigo, c.titulo, c.descricao,
               c.capa_url, c.carga_horaria_h,
               cat.nome AS categoria_nome, cat.cor AS categoria_cor,
               (SELECT COUNT(*) FROM tab_uni_aula a WHERE a.curso_id = c.id) AS qtd_aulas
          FROM tab_uni_matricula m
          INNER JOIN tab_uni_curso c   ON c.id = m.curso_id
          LEFT  JOIN tab_uni_categoria cat ON cat.id = c.categoria_id
         WHERE m.user_id = @uid
         ORDER BY
           CASE m.status WHEN 'em_andamento' THEN 1 WHEN 'matriculado' THEN 2 WHEN 'concluido' THEN 3 ELSE 4 END,
           m.data_matricula DESC`,
        { uid: user.ID }
      );
      return res.json({ total: rows.length, cursos: rows });
    } catch (err) {
      console.error('Erro universidade/meus-cursos:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
