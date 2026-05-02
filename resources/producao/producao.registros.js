// Lista registros historicos do produto.
// Filtros (querystring): status, fase, op, produto, responsavel, busca

const trim = (v) => v == null ? null : String(v).trim();

module.exports = (app) => ({
  verb: 'get',
  route: '/registros',

  handler: async (req, res) => {
    const { Pg } = app.services;

    const filtros = [];
    const params = {};

    const status = trim(req.query.status);
    if (status) { filtros.push('r.status = @status'); params.status = status; }

    const fase = req.query.fase != null ? Number(req.query.fase) : null;
    if (fase) { filtros.push('r.fase_atual = @fase'); params.fase = fase; }

    const op = trim(req.query.op);
    if (op) { filtros.push('r.op_protheus ILIKE @op'); params.op = `%${op}%`; }

    const produto = trim(req.query.produto);
    if (produto) { filtros.push('r.produto_codigo ILIKE @produto'); params.produto = `%${produto}%`; }

    const responsavel = req.query.responsavel != null ? Number(req.query.responsavel) : null;
    if (responsavel) {
      filtros.push('EXISTS (SELECT 1 FROM tab_prod_registro_etapa e WHERE e.registro_id = r.id AND e.responsavel_id = @resp)');
      params.resp = responsavel;
    }

    const busca = trim(req.query.busca);
    if (busca) {
      filtros.push('(r.op_protheus ILIKE @busca OR r.produto_codigo ILIKE @busca OR r.produto_descricao ILIKE @busca OR EXISTS (SELECT 1 FROM unnest(r.numeros_serie) ns WHERE ns ILIKE @busca))');
      params.busca = `%${busca}%`;
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 10), 500);

    try {
      const rows = await Pg.connectAndQuery(`
        SELECT r.id, r.op_protheus, r.op_filial, r.produto_codigo, r.produto_descricao,
               r.quantidade, r.numeros_serie, r.data_inicio_prev, r.data_termino_prev,
               r.fase_atual, r.status, r.origem, r.criado_em, r.atualizado_em,
               u.nome AS criado_por_nome,
               (SELECT COUNT(*) FROM tab_prod_registro_etapa e WHERE e.registro_id = r.id AND e.status = 'aprovado') AS etapas_concluidas,
               (SELECT COUNT(*) FROM tab_prod_registro_etapa e WHERE e.registro_id = r.id AND e.status = 'reprovado') AS etapas_reprovadas
          FROM tab_prod_registro r
          LEFT JOIN tab_intranet_usr u ON u.id = r.criado_por
          ${where}
          ORDER BY r.atualizado_em DESC
          LIMIT ${limit}
      `, params);

      return res.json({
        total: rows.length,
        registros: rows
      });
    } catch (err) {
      console.error('Erro producao/registros:', err);
      return res.status(500).json({ message: 'Erro ao listar registros: ' + err.message });
    }
  }
});
