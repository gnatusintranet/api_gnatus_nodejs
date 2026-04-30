// Lista snapshots disponiveis na tab_mcl_standard_cost_meta.
// Permite o frontend escolher qual ano/versao usar pra comparacao.

module.exports = (app) => ({
  verb: 'get',
  route: '/mcl/standard-cost/snapshots',

  handler: async (req, res) => {
    const { Pg } = app.services;
    try {
      const rows = await Pg.connectAndQuery(`
        SELECT m.ano, m.versao, m.qtd_materiais, m.valor_total, m.observacao,
               m.criado_em, u.nome AS criado_por_nome
          FROM tab_mcl_standard_cost_meta m
          LEFT JOIN tab_intranet_usr u ON u.id = m.criado_por
         ORDER BY m.ano DESC, m.versao DESC
      `, {});
      return res.json({
        snapshots: rows.map(r => ({
          ano: r.ano,
          versao: r.versao,
          qtdMateriais: r.qtd_materiais,
          valorTotal: Number(r.valor_total || 0),
          observacao: r.observacao,
          criadoPorNome: r.criado_por_nome,
          criadoEm: r.criado_em
        }))
      });
    } catch (err) {
      console.error('Erro mcl/standard-cost/snapshots:', err);
      return res.status(500).json({ message: 'Erro ao listar snapshots.' });
    }
  }
});
