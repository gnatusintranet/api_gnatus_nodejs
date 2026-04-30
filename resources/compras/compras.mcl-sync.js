// Sincroniza indices economicos do BCB (Banco Central) com a tab_mcl_indices.
//
// APIs publicas usadas (todas formato JSON, sem auth):
//   USD comercial venda (ultimo dia util)  -> serie 1
//   IGP-M variacao % mensal                 -> serie 189
//   IPCA variacao % mensal                  -> serie 433
//
// Endpoint: GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{N}/dados?formato=json&dataInicial=DD/MM/YYYY
// Resposta: [{ data: "DD/MM/YYYY", valor: "X.XX" }]
//
// Strategia:
// - Default: pega ultimos 24 meses (cobre simulacoes ate 2 anos)
// - Agrega USD diario pra fim de mes (pega ultima cotacao do mes)
// - IGPM e IPCA ja vem mensal
// - UPSERT por competencia (primeiro dia do mes)
// - fonte = 'BCB' (sobrescreve manuais? NAO — manuais ficam preservados)

const SERIES = { usd: 1, igpm: 189, ipca: 433 };

// Buscas do BCB. Retorna [{ data: 'DD/MM/YYYY', valor: 'X.XX' }]
const buscarBCB = async (serieId, dataInicialDDMMYYYY) => {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieId}/dados?formato=json&dataInicial=${dataInicialDDMMYYYY}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`BCB serie ${serieId} retornou HTTP ${r.status}`);
  return r.json();
};

const ddmmaaToDate = (s) => {
  const [d, m, y] = s.split('/');
  return new Date(Number(y), Number(m) - 1, Number(d));
};

const competenciaDe = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;   // primeiro dia do mes (ISO YYYY-MM-DD)
};

module.exports = (app) => ({
  verb: 'post',
  route: '/mcl/sync-bcb',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    // Default: ultimos 24 meses
    const meses = Math.min(Math.max(Number(req.body?.meses || 24), 1), 60);
    const inicio = new Date();
    inicio.setMonth(inicio.getMonth() - meses);
    const inicioStr = `${String(inicio.getDate()).padStart(2, '0')}/${String(inicio.getMonth() + 1).padStart(2, '0')}/${inicio.getFullYear()}`;

    try {
      const [usdRows, igpmRows, ipcaRows] = await Promise.all([
        buscarBCB(SERIES.usd,  inicioStr),
        buscarBCB(SERIES.igpm, inicioStr),
        buscarBCB(SERIES.ipca, inicioStr)
      ]);

      // Agrega USD por competencia (pega ultima cotacao do mes)
      const usdPorComp = new Map();
      usdRows.forEach(r => {
        const dt = ddmmaaToDate(r.data);
        const comp = competenciaDe(dt);
        // mantem o mais recente do mes
        const atual = usdPorComp.get(comp);
        if (!atual || ddmmaaToDate(atual.data) < dt) usdPorComp.set(comp, r);
      });

      // IGPM e IPCA ja vem 1 valor por mes — mapeia direto
      const igpmPorComp = new Map();
      igpmRows.forEach(r => igpmPorComp.set(competenciaDe(ddmmaaToDate(r.data)), Number(r.valor)));
      const ipcaPorComp = new Map();
      ipcaRows.forEach(r => ipcaPorComp.set(competenciaDe(ddmmaaToDate(r.data)), Number(r.valor)));

      // Conjunto de todas competencias
      const compsSet = new Set([
        ...usdPorComp.keys(),
        ...igpmPorComp.keys(),
        ...ipcaPorComp.keys()
      ]);
      const comps = [...compsSet].sort();

      let inseridos = 0, atualizados = 0;
      for (const comp of comps) {
        const usd  = usdPorComp.has(comp)  ? Number(usdPorComp.get(comp).valor) : null;
        const igpm = igpmPorComp.has(comp) ? igpmPorComp.get(comp) : null;
        const ipca = ipcaPorComp.has(comp) ? ipcaPorComp.get(comp) : null;

        // Preserva entries manuais (fonte = MANUAL): so atualiza se for BCB
        const r = await Pg.connectAndQuery(
          `INSERT INTO tab_mcl_indices (competencia, usd, igpm, ipca, fonte, atualizado_por)
           VALUES (@comp, @usd, @igpm, @ipca, 'BCB', @uid)
           ON CONFLICT (competencia) DO UPDATE SET
             usd  = CASE WHEN tab_mcl_indices.fonte = 'MANUAL' THEN tab_mcl_indices.usd  ELSE EXCLUDED.usd  END,
             igpm = CASE WHEN tab_mcl_indices.fonte = 'MANUAL' THEN tab_mcl_indices.igpm ELSE EXCLUDED.igpm END,
             ipca = CASE WHEN tab_mcl_indices.fonte = 'MANUAL' THEN tab_mcl_indices.ipca ELSE EXCLUDED.ipca END,
             atualizado_por = EXCLUDED.atualizado_por,
             atualizado_em  = NOW()
           RETURNING (xmax = 0) AS inserted`,
          { comp, usd, igpm, ipca, uid: user.ID }
        );
        if (r[0]?.inserted) inseridos++; else atualizados++;
      }

      return res.json({
        ok: true,
        meses,
        competenciasProcessadas: comps.length,
        inseridos,
        atualizados,
        ultimasCompetencias: comps.slice(-3)
      });
    } catch (err) {
      console.error('Erro mcl/sync-bcb:', err);
      return res.status(502).json({ message: 'Erro ao sincronizar com BCB: ' + err.message });
    }
  }
});
