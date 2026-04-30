// SCII — Should Cost Inflation Index.
//
// Retorna projecao 12 meses a frente baseada nas expectativas mais recentes
// do Boletim Focus (BCB), aplicando os MESMOS PESOS do MCL pra calcular o
// indice projetado.
//
// Resposta:
//  - serie: lista de meses com indicador esperado (USD, IPCA, IGPM) e SCII calculado
//  - kpis: SCII medio, variacao esperada vs MCL atual
//  - tabela "realizado vs esperado": meses passados onde temos AMBOS Focus
//    (esperado de meses atras) e MCL realizado (do mes em si) — mede a
//    qualidade da projecao do Focus historicamente

module.exports = (app) => ({
  verb: 'get',
  route: '/mcl/scii',

  handler: async (req, res) => {
    const { Pg } = app.services;

    try {
      // 1) Pega config (pesos)
      const cfg = (await Pg.connectAndQuery(
        `SELECT peso_usd, peso_igpm, peso_ipca, base_competencia FROM tab_mcl_config WHERE id = 1`, {}
      ))[0] || { peso_usd: 0.5, peso_igpm: 0.3, peso_ipca: 0.2 };

      const pUsd  = Number(cfg.peso_usd);
      const pIgpm = Number(cfg.peso_igpm);
      const pIpca = Number(cfg.peso_ipca);

      // 2) Pega expectativa MAIS RECENTE pra cada (indicador, competencia futura)
      // Considera so meses futuros + 12 a frente
      const hoje = new Date();
      const hojePrimeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimPrev = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);

      const params = {
        ini: hojePrimeiro.toISOString().slice(0, 10),
        fim: fimPrev.toISOString().slice(0, 10)
      };

      const expRows = await Pg.connectAndQuery(`
        SELECT DISTINCT ON (indicador, competencia)
               indicador, competencia, mediana, data_publicacao
          FROM tab_mcl_scii
         WHERE competencia BETWEEN @ini AND @fim
         ORDER BY indicador, competencia, data_publicacao DESC
      `, params);

      if (expRows.length === 0) {
        return res.json({
          config: { pesoUsd: pUsd, pesoIgpm: pIgpm, pesoIpca: pIpca },
          aviso: 'Sem expectativas Focus carregadas. Use o botão "Atualizar Focus" pra puxar do BCB.',
          serie: [], kpis: null, comparacaoHistorico: []
        });
      }

      // 3) Reorganiza por competencia
      const map = new Map();   // comp -> { ipca, igpm, cambio, dataPub }
      expRows.forEach(r => {
        const comp = typeof r.competencia === 'string' ? r.competencia : r.competencia.toISOString().slice(0, 10);
        if (!map.has(comp)) map.set(comp, {});
        map.get(comp)[r.indicador] = Number(r.mediana || 0);
        map.get(comp).dataPub = r.data_publicacao;
      });

      // 4) Pega base do MCL pra normalizacao consistente
      const baseRow = (await Pg.connectAndQuery(
        `SELECT usd, igpm, ipca FROM tab_mcl_indices
          WHERE competencia <= @ini ORDER BY competencia DESC LIMIT 1`,
        { ini: hojePrimeiro.toISOString().slice(0, 10) }
      ))[0];

      // Pega MCL atual pra ter referencia
      const idxAll = await Pg.connectAndQuery(
        `SELECT competencia, usd, igpm, ipca FROM tab_mcl_indices
          WHERE competencia >= @base ORDER BY competencia`,
        { base: cfg.base_competencia ? new Date(cfg.base_competencia).toISOString().slice(0, 10) : '2026-01-01' }
      );
      let usdBaseHist = 1, igpmAcum = 100, ipcaAcum = 100, mclAtual = null;
      if (idxAll.length > 0) {
        usdBaseHist = Number(idxAll[0].usd) || 1;
        idxAll.forEach((r, i) => {
          if (i > 0) {
            igpmAcum *= (1 + Number(r.igpm || 0) / 100);
            ipcaAcum *= (1 + Number(r.ipca || 0) / 100);
          }
        });
        const ult = idxAll[idxAll.length - 1];
        const usdIdx = ult.usd ? (Number(ult.usd) / usdBaseHist) * 100 : 100;
        mclAtual = (usdIdx * pUsd) + (igpmAcum * pIgpm) + (ipcaAcum * pIpca);
      }

      // 5) Constroi serie projetada partindo do MCL atual
      // SCII_t = MCL_t-1 * (1 + variacao_esperada_t)
      // Como temos pesos: variacao = (var_USD * pUsd) + (var_IGPM * pIgpm) + (var_IPCA * pIpca)
      // USD: var % esperada = (cambio_esperado - usdAtual) / usdAtual
      // IGPM/IPCA: ja sao % de variacao mensal direto do Focus
      const usdAtual = idxAll.length > 0 ? Number(idxAll[idxAll.length - 1].usd) || 1 : 1;
      const sortedComps = Array.from(map.keys()).sort();
      let mclProj = mclAtual || 100;
      let igpmProjAcum = igpmAcum;
      let ipcaProjAcum = ipcaAcum;
      let usdProjAtual = usdAtual;

      const serie = sortedComps.map(comp => {
        const e = map.get(comp);
        const ipcaEsp = e.IPCA ?? 0;     // % variacao mensal esperada
        const igpmEsp = e.IGPM ?? 0;
        const cambioEsp = e.CAMBIO ?? null;  // valor absoluto esperado de USD/BRL

        // Atualiza projecao acumulada
        igpmProjAcum *= (1 + igpmEsp / 100);
        ipcaProjAcum *= (1 + ipcaEsp / 100);
        if (cambioEsp != null && cambioEsp > 0) usdProjAtual = cambioEsp;
        const usdIdxProj = (usdProjAtual / usdBaseHist) * 100;

        const sciiCalc = (usdIdxProj * pUsd) + (igpmProjAcum * pIgpm) + (ipcaProjAcum * pIpca);
        mclProj = sciiCalc;

        return {
          competencia: comp,
          label: ymToBR(comp),
          ipcaEsp: Number(ipcaEsp),
          igpmEsp: Number(igpmEsp),
          cambioEsp,
          usdIdxProj: Number(usdIdxProj.toFixed(2)),
          igpmAcumProj: Number(igpmProjAcum.toFixed(2)),
          ipcaAcumProj: Number(ipcaProjAcum.toFixed(2)),
          scii: Number(sciiCalc.toFixed(2))
        };
      });

      // 6) KPIs
      const sciiMedio = serie.length ? serie.reduce((s, x) => s + x.scii, 0) / serie.length : null;
      const sciiFinal = serie.length ? serie[serie.length - 1].scii : null;
      const variacaoEsperada = mclAtual && sciiFinal ? ((sciiFinal - mclAtual) / mclAtual) * 100 : null;

      const kpis = {
        mclAtual: mclAtual ? Number(mclAtual.toFixed(2)) : null,
        sciiMedio: sciiMedio ? Number(sciiMedio.toFixed(2)) : null,
        sciiFinal: sciiFinal ? Number(sciiFinal.toFixed(2)) : null,
        variacaoEsperadaPct: variacaoEsperada != null ? Number(variacaoEsperada.toFixed(2)) : null,
        horizonteMeses: serie.length
      };

      // 7) Comparacao historico: pra cada mes passado, pega expectativa publicada
      // ~30 dias antes vs valor realizado (do tab_mcl_indices)
      const hist = await Pg.connectAndQuery(`
        WITH expecPassada AS (
          SELECT DISTINCT ON (indicador, competencia)
                 indicador, competencia, mediana
            FROM tab_mcl_scii
           WHERE competencia < @hoje AND data_publicacao < competencia
           ORDER BY indicador, competencia, data_publicacao DESC
        )
        SELECT i.competencia,
               i.usd realUsd, i.igpm realIgpm, i.ipca realIpca,
               (SELECT mediana FROM expecPassada WHERE indicador = 'IPCA'   AND competencia = i.competencia) espIpca,
               (SELECT mediana FROM expecPassada WHERE indicador = 'IGPM'   AND competencia = i.competencia) espIgpm,
               (SELECT mediana FROM expecPassada WHERE indicador = 'CAMBIO' AND competencia = i.competencia) espCambio
          FROM tab_mcl_indices i
         WHERE i.competencia <= @hoje
         ORDER BY i.competencia DESC
         LIMIT 12
      `, { hoje: hojePrimeiro.toISOString().slice(0, 10) });

      const comparacaoHistorico = hist.map(h => {
        const comp = typeof h.competencia === 'string' ? h.competencia : h.competencia.toISOString().slice(0, 10);
        return {
          competencia: comp,
          label: ymToBR(comp),
          ipca:  { real: Number(h.realipca  ?? h.realIpca  ?? 0), esperado: h.espipca  ?? h.espIpca  != null ? Number(h.espipca  ?? h.espIpca)  : null },
          igpm:  { real: Number(h.realigpm  ?? h.realIgpm  ?? 0), esperado: h.espigpm  ?? h.espIgpm  != null ? Number(h.espigpm  ?? h.espIgpm)  : null },
          usd:   { real: Number(h.realusd   ?? h.realUsd   ?? 0), esperado: h.espcambio?? h.espCambio!= null ? Number(h.espcambio?? h.espCambio): null }
        };
      }).reverse();

      return res.json({
        config: { pesoUsd: pUsd, pesoIgpm: pIgpm, pesoIpca: pIpca },
        kpis, serie, comparacaoHistorico,
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro mcl/scii:', err);
      return res.status(500).json({ message: 'Erro ao calcular SCII: ' + err.message });
    }
  }
});

function ymToBR(d) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${meses[date.getMonth()]}/${date.getFullYear()}`;
}
