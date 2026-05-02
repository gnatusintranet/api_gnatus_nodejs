// Dashboard de Producao - KPIs operacionais + funil das fases + listas operacionais.
// GET /producao/dashboard
//
// Retorna:
//   kpis: { opsAndamento, concluidasMes, atrasadas, proximasVencimento }
//   funil: [{ fase, nome, count }] — distribuicao das OPs em andamento por fase
//   atrasadas: [...registros com data_termino_prev < hoje, status='aberto']
//   proximas:  [...registros com data_termino_prev nos proximos 3 dias]
//   reprovadas: [...registros com pelo menos 1 etapa reprovada nos ultimos 7 dias]

const { ETAPAS } = require('./_etapas');

module.exports = (app) => ({
  verb: 'get',
  route: '/dashboard',

  handler: async (req, res) => {
    const { Pg } = app.services;

    try {
      // ============== KPIs ==============
      const kpisRows = await Pg.connectAndQuery(`
        SELECT
          (SELECT COUNT(*) FROM tab_prod_registro WHERE status = 'aberto') AS ops_andamento,
          (SELECT COUNT(*) FROM tab_prod_registro
            WHERE status = 'concluido'
              AND atualizado_em >= date_trunc('month', CURRENT_DATE)) AS concluidas_mes,
          (SELECT COUNT(*) FROM tab_prod_registro
            WHERE status = 'aberto'
              AND data_termino_prev IS NOT NULL
              AND data_termino_prev < CURRENT_DATE) AS atrasadas,
          (SELECT COUNT(*) FROM tab_prod_registro
            WHERE status = 'aberto'
              AND data_termino_prev IS NOT NULL
              AND data_termino_prev BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days') AS proximas_venc
      `, {});

      const kpis = {
        opsAndamento: Number(kpisRows[0].ops_andamento || 0),
        concluidasMes: Number(kpisRows[0].concluidas_mes || 0),
        atrasadas: Number(kpisRows[0].atrasadas || 0),
        proximasVencimento: Number(kpisRows[0].proximas_venc || 0)
      };

      // ============== Funil das fases (so OPs em andamento) ==============
      const funilRows = await Pg.connectAndQuery(`
        SELECT fase_atual AS fase, COUNT(*) AS qtd
          FROM tab_prod_registro
         WHERE status = 'aberto'
         GROUP BY fase_atual
         ORDER BY fase_atual
      `, {});

      const funilMap = new Map(funilRows.map(r => [Number(r.fase), Number(r.qtd)]));
      const funil = ETAPAS.map(e => ({
        fase: e.codigo,
        nome: e.nome,
        count: funilMap.get(e.codigo) || 0
      }));

      // ============== Atrasadas (lista) ==============
      const atrasadas = await Pg.connectAndQuery(`
        SELECT r.id, r.op_protheus, r.produto_codigo, r.produto_descricao,
               r.fase_atual, r.data_termino_prev, r.criado_em,
               (CURRENT_DATE - r.data_termino_prev) AS dias_atraso
          FROM tab_prod_registro r
         WHERE r.status = 'aberto'
           AND r.data_termino_prev IS NOT NULL
           AND r.data_termino_prev < CURRENT_DATE
         ORDER BY r.data_termino_prev ASC
         LIMIT 50
      `, {});

      // ============== Proximas do vencimento (3 dias) ==============
      const proximas = await Pg.connectAndQuery(`
        SELECT r.id, r.op_protheus, r.produto_codigo, r.produto_descricao,
               r.fase_atual, r.data_termino_prev,
               (r.data_termino_prev - CURRENT_DATE) AS dias_restantes
          FROM tab_prod_registro r
         WHERE r.status = 'aberto'
           AND r.data_termino_prev IS NOT NULL
           AND r.data_termino_prev BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
         ORDER BY r.data_termino_prev ASC
         LIMIT 50
      `, {});

      // ============== Reprovadas recentes (etapas reprovadas nos ultimos 7 dias) ==============
      const reprovadas = await Pg.connectAndQuery(`
        SELECT DISTINCT r.id, r.op_protheus, r.produto_codigo, r.produto_descricao,
               r.fase_atual,
               (SELECT MAX(e2.atualizado_em) FROM tab_prod_registro_etapa e2
                 WHERE e2.registro_id = r.id AND e2.status = 'reprovado') AS ultima_reprovacao
          FROM tab_prod_registro r
          INNER JOIN tab_prod_registro_etapa e ON e.registro_id = r.id
         WHERE e.status = 'reprovado'
           AND e.atualizado_em >= NOW() - INTERVAL '7 days'
         ORDER BY ultima_reprovacao DESC
         LIMIT 50
      `, {});

      // Anexa nome da fase nas listas
      const nomeFase = (cod) => ETAPAS.find(e => e.codigo === cod)?.nome || `Fase ${cod}`;
      const enriquecer = (arr) => arr.map(r => ({ ...r, fase_nome: nomeFase(Number(r.fase_atual)) }));

      return res.json({
        kpis,
        funil,
        atrasadas: enriquecer(atrasadas),
        proximas: enriquecer(proximas),
        reprovadas: enriquecer(reprovadas),
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro producao/dashboard:', err);
      return res.status(500).json({ message: 'Erro ao gerar dashboard: ' + err.message });
    }
  }
});
