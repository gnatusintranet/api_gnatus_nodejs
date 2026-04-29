// Remove um equipamento (devolve, perde, fim contrato).
// Marca como REMOVIDO com motivo + data + observacao.
//
// Body: { motivo, obs?, dataRemocao? }

const trim = (v) => v == null ? null : String(v).trim() || null;
const MOTIVOS = ['DEFEITO','PERDA','FIM_CONTRATO','UPGRADE','OUTRO'];

module.exports = (app) => ({
  verb: 'delete',
  route: '/equipamento/:id',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID inválido.' });

    const b = req.body || {};
    const motivo = String(b.motivo || '').toUpperCase();
    if (!MOTIVOS.includes(motivo)) {
      return res.status(400).json({ message: `motivo deve ser um de: ${MOTIVOS.join(', ')}` });
    }

    const obs = trim(b.obs);
    const dataRemocao = b.dataRemocao || new Date().toISOString().slice(0, 10);

    try {
      const r = await Pg.connectAndQuery(`
        UPDATE tab_equipamento_atual
           SET status = 'REMOVIDO',
               data_remocao = @data,
               motivo_remocao = @motivo,
               obs_remocao = @obs,
               atualizado_em = NOW()
         WHERE id = @id AND status = 'ATIVO'
         RETURNING id, status, data_remocao, motivo_remocao
      `, { id, data: dataRemocao, motivo, obs });

      if (r.length === 0) {
        return res.status(404).json({ message: 'Equipamento não encontrado ou não está ativo.' });
      }
      return res.json({ ok: true, equipamento: r[0] });
    } catch (err) {
      console.error('Erro rh/equipamento:remover:', err);
      return res.status(500).json({ message: 'Erro ao remover equipamento.' });
    }
  }
});
