// Comparacao Standard Cost (snapshot) vs Custo Real atual + projecao via MCL.
//
// Pra cada material:
//   custo_padrao_snap  = SC do snapshot (custo_padrao da tab_mcl_standard_cost)
//   mcl_no_snap        = MCL no momento do snapshot
//   mcl_atual          = MCL atual (calculado live do dashboard)
//   custo_projetado    = custo_padrao_snap * (mcl_atual / mcl_no_snap)
//   custo_real         = SB1.B1_CUSTD atual (ou SB2.B2_CM1 se preferir)
//   desvio_pct         = (custo_real - custo_projetado) / custo_projetado * 100
//   desvio_valor       = custo_real - custo_projetado
//
// Resposta hierarquica: agrupa por grupo + lista de materiais.
//
// Query params: ?ano=YYYY (obrigatorio) &versao=N (default = ultima do ano)
//               &grupo=XXXX (filtro opcional)

const trim = (v) => v == null ? null : String(v).trim();

module.exports = (app) => ({
  verb: 'get',
  route: '/mcl/standard-cost/comparacao',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;
    const ano = Number(req.query.ano);
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2050) {
      return res.status(400).json({ message: 'Parâmetro ano obrigatório (2020-2050).' });
    }
    const versaoQs = req.query.versao != null ? Number(req.query.versao) : null;
    const grupoFiltro = trim(req.query.grupo);

    try {
      // 1) Resolve versao (ultima do ano se nao especificada)
      let versao = versaoQs;
      if (versao == null) {
        const v = await Pg.connectAndQuery(
          `SELECT MAX(versao) maior FROM tab_mcl_standard_cost_meta WHERE ano = @ano`,
          { ano }
        );
        versao = v[0]?.maior;
      }
      if (versao == null) {
        return res.status(404).json({ message: `Nenhum snapshot encontrado para o ano ${ano}.` });
      }

      // 2) Busca SC do snapshot
      const params = { ano, versao };
      let condGrupo = '';
      if (grupoFiltro) {
        params.grupo = grupoFiltro;
        condGrupo = ' AND grupo = @grupo';
      }
      const scRows = await Pg.connectAndQuery(`
        SELECT material, descricao, grupo, tipo, um,
               custo_padrao, custo_medio_ref, mcl_no_snapshot, competencia_mcl
          FROM tab_mcl_standard_cost
         WHERE ano = @ano AND versao = @versao ${condGrupo}
         ORDER BY grupo, material
      `, params);

      if (scRows.length === 0) {
        return res.json({ ano, versao, mclAtual: null, grupos: [], totais: null, aviso: 'Snapshot vazio.' });
      }

      // 3) Calcula MCL atual (replica logica simplificada de /mcl/dashboard)
      const cfgRow = await Pg.connectAndQuery(
        `SELECT base_competencia FROM tab_mcl_config WHERE id = 1`, {}
      );
      const baseComp = cfgRow[0]?.base_competencia
        ? new Date(cfgRow[0].base_competencia).toISOString().slice(0, 10)
        : '2026-01-01';
      const idxRows = await Pg.connectAndQuery(
        `SELECT competencia, usd, igpm, ipca FROM tab_mcl_indices
          WHERE competencia >= @base ORDER BY competencia`, { base: baseComp }
      );
      let mclAtual = null, compAtual = null;
      if (idxRows.length > 0) {
        const usdBase = Number(idxRows[0].usd) || 1;
        let igpmAcum = 100, ipcaAcum = 100;
        idxRows.forEach((r, i) => {
          if (i > 0) {
            igpmAcum *= (1 + Number(r.igpm || 0) / 100);
            ipcaAcum *= (1 + Number(r.ipca || 0) / 100);
          }
        });
        const ult = idxRows[idxRows.length - 1];
        const usdIdx = ult.usd ? (Number(ult.usd) / usdBase) * 100 : 100;
        mclAtual = (usdIdx * 0.5) + (igpmAcum * 0.3) + (ipcaAcum * 0.2);
        compAtual = typeof ult.competencia === 'string' ? ult.competencia : ult.competencia.toISOString().slice(0, 10);
      }

      // 4) Busca custo real atual (B1_CUSTD + B2_CM1) dos materiais do snapshot
      const codigos = [...new Set(scRows.map(r => trim(r.material)))];
      const custoAtual = new Map();
      const BATCH = 500;
      for (let i = 0; i < codigos.length; i += BATCH) {
        const slice = codigos.slice(i, i + BATCH);
        const inCods = slice.map((_, k) => `@c${k}`).join(',');
        const p = {};
        slice.forEach((c, k) => { p[`c${k}`] = c; });
        const r = await Protheus.connectAndQuery(`
          SELECT RTRIM(sb1.B1_COD) cod, sb1.B1_CUSTD custoPadrao, ISNULL(cm.cm1, 0) custoMedio
            FROM SB1010 sb1 WITH (NOLOCK)
            LEFT JOIN (
              SELECT RTRIM(B2_COD) cod, MAX(B2_CM1) cm1
                FROM SB2010 WITH (NOLOCK)
               WHERE D_E_L_E_T_ <> '*' AND B2_FILIAL = '01'
               GROUP BY B2_COD
            ) cm ON cm.cod = RTRIM(sb1.B1_COD)
           WHERE sb1.D_E_L_E_T_ <> '*' AND sb1.B1_COD IN (${inCods})
        `, p);
        r.forEach(x => custoAtual.set(trim(x.cod), {
          custoPadrao: Number(x.custoPadrao || 0),
          custoMedio: Number(x.custoMedio || 0)
        }));
      }

      // 5) Calcula comparacao por material + agrega por grupo
      const grupos = new Map();   // key = grupo
      let totalScSnap = 0, totalProjetado = 0, totalReal = 0;
      let materiaisComDesvio = 0;

      const materiais = scRows.map(r => {
        const mat = trim(r.material);
        const custoPadraoSnap = Number(r.custo_padrao || 0);
        const mclSnap = Number(r.mcl_no_snapshot || 0) || mclAtual;  // fallback
        const fatorMcl = mclSnap > 0 && mclAtual ? mclAtual / mclSnap : 1;
        const custoProjetado = custoPadraoSnap * fatorMcl;
        const atual = custoAtual.get(mat) || { custoPadrao: 0, custoMedio: 0 };
        const custoReal = atual.custoPadrao;  // usa B1_CUSTD como referencia
        const desvioValor = custoReal - custoProjetado;
        const desvioPct = custoProjetado > 0 ? (desvioValor / custoProjetado) * 100 : 0;

        if (Math.abs(desvioPct) >= 5) materiaisComDesvio++;
        totalScSnap += custoPadraoSnap;
        totalProjetado += custoProjetado;
        totalReal += custoReal;

        const item = {
          material: mat,
          descricao: trim(r.descricao),
          grupo: trim(r.grupo) || '—',
          tipo: trim(r.tipo),
          um: trim(r.um),
          custoPadraoSnap,
          mclNoSnapshot: mclSnap,
          custoProjetado,
          custoReal,
          custoMedioRefAtual: atual.custoMedio,
          desvioValor,
          desvioPct
        };

        // Agrega por grupo
        const grpKey = item.grupo;
        if (!grupos.has(grpKey)) {
          grupos.set(grpKey, {
            grupo: grpKey,
            qtdMateriais: 0,
            totalSnap: 0,
            totalProjetado: 0,
            totalReal: 0,
            materiais: []
          });
        }
        const g = grupos.get(grpKey);
        g.qtdMateriais += 1;
        g.totalSnap += custoPadraoSnap;
        g.totalProjetado += custoProjetado;
        g.totalReal += custoReal;
        g.materiais.push(item);

        return item;
      });

      const gruposArr = Array.from(grupos.values()).map(g => ({
        ...g,
        desvioValor: g.totalReal - g.totalProjetado,
        desvioPct: g.totalProjetado > 0 ? ((g.totalReal - g.totalProjetado) / g.totalProjetado) * 100 : 0
      })).sort((a, b) => b.totalReal - a.totalReal);

      return res.json({
        ano, versao,
        mclAtual: mclAtual ? Number(mclAtual.toFixed(2)) : null,
        competenciaMclAtual: compAtual,
        totais: {
          qtdMateriais: materiais.length,
          totalScSnap: Number(totalScSnap.toFixed(2)),
          totalProjetado: Number(totalProjetado.toFixed(2)),
          totalReal: Number(totalReal.toFixed(2)),
          desvioTotalValor: Number((totalReal - totalProjetado).toFixed(2)),
          desvioTotalPct: totalProjetado > 0 ? Number(((totalReal - totalProjetado) / totalProjetado * 100).toFixed(2)) : 0,
          materiaisComDesvio  // |desvio| >= 5%
        },
        grupos: gruposArr,
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro mcl/standard-cost/comparacao:', err);
      return res.status(500).json({ message: 'Erro ao calcular comparação: ' + err.message });
    }
  }
});
