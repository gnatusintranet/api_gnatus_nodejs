// Dashboard MCL — calcula o indice composto e retorna serie + KPIs.
//
// Calculo:
//   MCL_t = (USD_t  * peso_usd  * 100/USD_base)
//         + ((1 + IGPM_t/100)^cumulativo * peso_igpm * 100)
//         + ((1 + IPCA_t/100)^cumulativo * peso_ipca * 100)
//
// Normalizacao: todos os 3 indices vao pra base 100 no mes da config
// (base_competencia). Pra USD, USD_base = cotacao do mes base.
// Pra IGPM/IPCA (ja sao % de variacao), acumula composto desde a base.
//
// KPIs: MCL atual, variacao % vs mes anterior, tendencia (alta/baixa).
//
// Filtros opcionais: ?inicio=YYYY-MM-DD &fim=YYYY-MM-DD
//                    ?pesoUsd=0.5 &pesoIgpm=0.3 &pesoIpca=0.2 (override pra simulacao)

const trim = (v) => String(v || '').trim();
const toN  = (v) => v == null ? null : Number(v);

module.exports = (app) => ({
  verb: 'get',
  route: '/mcl/dashboard',

  handler: async (req, res) => {
    const { Pg } = app.services;

    try {
      // 1) Pega config (pesos + base)
      const cfgRows = await Pg.connectAndQuery(
        `SELECT peso_usd, peso_igpm, peso_ipca, base_competencia FROM tab_mcl_config WHERE id = 1`,
        {}
      );
      const cfg = cfgRows[0] || { peso_usd: 0.5, peso_igpm: 0.3, peso_ipca: 0.2, base_competencia: '2026-01-01' };

      // Override pra simulacao (frontend envia novos pesos pra ver impacto sem persistir)
      const pesoUsd  = req.query.pesoUsd  != null ? Number(req.query.pesoUsd)  : Number(cfg.peso_usd);
      const pesoIgpm = req.query.pesoIgpm != null ? Number(req.query.pesoIgpm) : Number(cfg.peso_igpm);
      const pesoIpca = req.query.pesoIpca != null ? Number(req.query.pesoIpca) : Number(cfg.peso_ipca);
      const baseComp = req.query.baseComp ? new Date(String(req.query.baseComp)) : new Date(cfg.base_competencia);
      const baseCompISO = baseComp.toISOString().slice(0, 10);

      // 2) Pega indices ordenados por competencia
      const params = { base: baseCompISO };
      let condPeriodo = '';
      if (req.query.inicio) { params.inicio = String(req.query.inicio); condPeriodo += ' AND competencia >= @inicio'; }
      if (req.query.fim)    { params.fim    = String(req.query.fim);    condPeriodo += ' AND competencia <= @fim'; }

      const rows = await Pg.connectAndQuery(
        `SELECT competencia, usd, igpm, ipca, fonte, atualizado_em
           FROM tab_mcl_indices
          WHERE competencia >= @base ${condPeriodo}
          ORDER BY competencia`,
        params
      );

      if (rows.length === 0) {
        return res.json({
          config: { pesoUsd, pesoIgpm, pesoIpca, baseCompetencia: baseCompISO },
          aviso: 'Sem dados de índices no período. Use o botão "Atualizar índices" pra puxar do BCB.',
          serie: [], kpis: null, breakdown: null
        });
      }

      // 3) Normaliza pra base 100
      const usdBase = Number(rows[0].usd) || 1;
      let igpmAcum = 100, ipcaAcum = 100;
      const serie = rows.map((r, i) => {
        const usd = toN(r.usd);
        const igpmMes = toN(r.igpm) || 0;
        const ipcaMes = toN(r.ipca) || 0;

        // USD: indice = (USD_t / USD_base) * 100
        const usdIdx = usd != null ? (usd / usdBase) * 100 : null;
        // IGPM/IPCA: composto cumulativo desde base 100
        if (i > 0) {
          igpmAcum *= (1 + igpmMes / 100);
          ipcaAcum *= (1 + ipcaMes / 100);
        }

        const mcl = (usdIdx != null ? usdIdx * pesoUsd : 0)
                  + (igpmAcum * pesoIgpm)
                  + (ipcaAcum * pesoIpca);

        return {
          competencia: typeof r.competencia === 'string' ? r.competencia : r.competencia.toISOString().slice(0, 10),
          label: ymToBR(r.competencia),
          usd, igpm: igpmMes, ipca: ipcaMes,
          usdIdx: usdIdx != null ? Number(usdIdx.toFixed(2)) : null,
          igpmIdx: Number(igpmAcum.toFixed(2)),
          ipcaIdx: Number(ipcaAcum.toFixed(2)),
          mcl: Number(mcl.toFixed(2)),
          fonte: r.fonte
        };
      });

      // 4) KPIs
      const ultimo = serie[serie.length - 1];
      const anterior = serie.length >= 2 ? serie[serie.length - 2] : null;
      const variacao = anterior ? ((ultimo.mcl - anterior.mcl) / anterior.mcl) * 100 : null;
      const tendencia = variacao == null ? 'estavel' : variacao > 0.5 ? 'alta' : variacao < -0.5 ? 'baixa' : 'estavel';

      const kpis = {
        mclAtual: ultimo.mcl,
        competenciaAtual: ultimo.competencia,
        labelAtual: ultimo.label,
        variacaoMensalPct: variacao != null ? Number(variacao.toFixed(2)) : null,
        tendencia,
        usdAtual: ultimo.usd,
        igpmAcumAtual: ultimo.igpmIdx,
        ipcaAcumAtual: ultimo.ipcaIdx,
        // Comparativos vs base
        mclVsBase: Number((ultimo.mcl - 100).toFixed(2)),
        usdVsBase: ultimo.usdIdx != null ? Number((ultimo.usdIdx - 100).toFixed(2)) : null
      };

      // 5) Breakdown — contribuicao de cada componente no MCL atual
      const contribUsd = (ultimo.usdIdx || 0) * pesoUsd;
      const contribIgpm = ultimo.igpmIdx * pesoIgpm;
      const contribIpca = ultimo.ipcaIdx * pesoIpca;
      const totalContrib = contribUsd + contribIgpm + contribIpca || 1;
      const breakdown = [
        { componente: 'USD',   peso: pesoUsd,  valor: ultimo.usdIdx,  contribuicao: Number(contribUsd.toFixed(2)),  pctNoMcl: Number((contribUsd / totalContrib * 100).toFixed(2)) },
        { componente: 'IGP-M', peso: pesoIgpm, valor: ultimo.igpmIdx, contribuicao: Number(contribIgpm.toFixed(2)), pctNoMcl: Number((contribIgpm / totalContrib * 100).toFixed(2)) },
        { componente: 'IPCA',  peso: pesoIpca, valor: ultimo.ipcaIdx, contribuicao: Number(contribIpca.toFixed(2)), pctNoMcl: Number((contribIpca / totalContrib * 100).toFixed(2)) }
      ];

      return res.json({
        config: { pesoUsd, pesoIgpm, pesoIpca, baseCompetencia: baseCompISO },
        kpis,
        breakdown,
        serie,
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro mcl/dashboard:', err);
      return res.status(500).json({ message: 'Erro ao calcular MCL: ' + err.message });
    }
  }
});

// "2026-04-01" -> "abr/2026"
function ymToBR(d) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${meses[date.getMonth()]}/${date.getFullYear()}`;
}
