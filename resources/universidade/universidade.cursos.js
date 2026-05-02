// Catalogo de cursos. Lista cursos ATIVOS + PUBLICOS pra qualquer usuario logado.
// Alem disso retorna se o user logado ja esta matriculado.
// GET /universidade/cursos?categoria=1&busca=...

const trim = (v) => v == null ? null : String(v).trim();

module.exports = (app) => ({
  verb: 'get',
  route: '/cursos',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];

    const filtros = ['c.ativo = true', 'c.publico = true'];
    const params = { uid: user?.ID || 0 };

    const cat = req.query.categoria != null ? Number(req.query.categoria) : null;
    if (cat) { filtros.push('c.categoria_id = @cat'); params.cat = cat; }

    const busca = trim(req.query.busca);
    if (busca) {
      filtros.push('(c.titulo ILIKE @busca OR c.descricao ILIKE @busca OR c.codigo ILIKE @busca)');
      params.busca = `%${busca}%`;
    }

    try {
      const rows = await Pg.connectAndQuery(`
        SELECT c.id, c.codigo, c.titulo, c.descricao, c.capa_url,
               c.carga_horaria_h, c.criado_em,
               cat.id AS categoria_id, cat.nome AS categoria_nome, cat.cor AS categoria_cor,
               c.instrutor_nome,
               (SELECT COUNT(*) FROM tab_uni_aula a WHERE a.curso_id = c.id) AS qtd_aulas,
               (SELECT COUNT(*) FROM tab_uni_matricula m WHERE m.curso_id = c.id) AS qtd_matriculados,
               m.id AS minha_matricula_id, m.status AS minha_status, m.percent_progresso AS meu_progresso
          FROM tab_uni_curso c
          LEFT JOIN tab_uni_categoria cat ON cat.id = c.categoria_id
          LEFT JOIN tab_uni_matricula m   ON m.curso_id = c.id AND m.user_id = @uid
         WHERE ${filtros.join(' AND ')}
         ORDER BY c.criado_em DESC`,
        params
      );
      return res.json({ total: rows.length, cursos: rows });
    } catch (err) {
      console.error('Erro universidade/cursos:', err);
      return res.status(500).json({ message: 'Erro: ' + err.message });
    }
  }
});
