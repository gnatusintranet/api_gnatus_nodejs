// Atualiza pesos e mes base da config MCL.
// Body: { pesoUsd, pesoIgpm, pesoIpca, baseCompetencia (YYYY-MM-DD) }
// Pesos devem somar 1.0 (validado). Base muda referencial dos indices = 100.

module.exports = (app) => ({
  verb: 'put',
  route: '/mcl/config',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const b = req.body || {};
    const pesoUsd  = Number(b.pesoUsd);
    const pesoIgpm = Number(b.pesoIgpm);
    const pesoIpca = Number(b.pesoIpca);
    const baseComp = String(b.baseCompetencia || '').trim();

    if (![pesoUsd, pesoIgpm, pesoIpca].every(p => p >= 0 && p <= 1)) {
      return res.status(400).json({ message: 'Pesos devem estar entre 0 e 1.' });
    }
    const soma = pesoUsd + pesoIgpm + pesoIpca;
    if (Math.abs(soma - 1) > 0.01) {
      return res.status(400).json({ message: `Pesos devem somar 1 (atual: ${soma.toFixed(4)}).` });
    }
    if (baseComp && !/^\d{4}-\d{2}-\d{2}$/.test(baseComp)) {
      return res.status(400).json({ message: 'baseCompetencia deve ser YYYY-MM-DD.' });
    }
    const baseFinal = baseComp ? baseComp.slice(0, 7) + '-01' : null;

    try {
      const r = await Pg.connectAndQuery(
        `UPDATE tab_mcl_config
            SET peso_usd  = @pUsd,
                peso_igpm = @pIgpm,
                peso_ipca = @pIpca,
                base_competencia = COALESCE(@base, base_competencia),
                atualizado_por = @uid,
                atualizado_em  = NOW()
          WHERE id = 1
          RETURNING peso_usd, peso_igpm, peso_ipca, base_competencia, atualizado_em`,
        { pUsd: pesoUsd, pIgpm: pesoIgpm, pIpca: pesoIpca, base: baseFinal, uid: user.ID }
      );
      return res.json({ ok: true, config: r[0] });
    } catch (err) {
      console.error('Erro mcl/config:', err);
      return res.status(500).json({ message: 'Erro ao atualizar configuração.' });
    }
  }
});
