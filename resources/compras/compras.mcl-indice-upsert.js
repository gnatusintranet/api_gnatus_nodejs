// Upsert manual de um indice mensal (override do BCB).
// Usado pra corrigir valores ou preencher meses sem dados.
// Body: { competencia: 'YYYY-MM-DD', usd?, igpm?, ipca? }

const trim = (v) => v == null ? null : String(v).trim();

module.exports = (app) => ({
  verb: 'post',
  route: '/mcl/indice',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const b = req.body || {};
    const comp = trim(b.competencia);
    if (!comp || !/^\d{4}-\d{2}-\d{2}$/.test(comp)) {
      return res.status(400).json({ message: 'competencia deve ser YYYY-MM-DD (ex: 2026-04-01).' });
    }
    // Forca dia 01 (regra: indices sao mensais)
    const competenciaMes = comp.slice(0, 7) + '-01';

    const usd  = b.usd  != null && b.usd  !== '' ? Number(b.usd)  : null;
    const igpm = b.igpm != null && b.igpm !== '' ? Number(b.igpm) : null;
    const ipca = b.ipca != null && b.ipca !== '' ? Number(b.ipca) : null;

    try {
      const r = await Pg.connectAndQuery(
        `INSERT INTO tab_mcl_indices (competencia, usd, igpm, ipca, fonte, atualizado_por)
         VALUES (@comp, @usd, @igpm, @ipca, 'MANUAL', @uid)
         ON CONFLICT (competencia) DO UPDATE SET
           usd  = COALESCE(EXCLUDED.usd,  tab_mcl_indices.usd),
           igpm = COALESCE(EXCLUDED.igpm, tab_mcl_indices.igpm),
           ipca = COALESCE(EXCLUDED.ipca, tab_mcl_indices.ipca),
           fonte = 'MANUAL',
           atualizado_por = EXCLUDED.atualizado_por,
           atualizado_em  = NOW()
         RETURNING competencia, usd, igpm, ipca, fonte`,
        { comp: competenciaMes, usd, igpm, ipca, uid: user.ID }
      );
      return res.json({ ok: true, indice: r[0] });
    } catch (err) {
      console.error('Erro mcl/indice:', err);
      return res.status(500).json({ message: 'Erro ao gravar índice.' });
    }
  }
});
