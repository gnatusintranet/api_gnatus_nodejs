// PVA - Procurement Value Added.
//
// Calcula o valor agregado pelas compras: economia (ou perda) entre o custo
// padrao do snapshot e o vunit efetivamente pago em compras (SD1).
//
// Formula:
//   PVA_material = SUM((custo_padrao_snap - vunit_pago) * qtd_comprada)
//   Positivo = Compras NEGOCIOU ABAIXO DO STANDARD (savings real)
//   Negativo = pagou ACIMA do standard (custo extra)
//
// Query params:
//   ano: obrigatorio (ano do snapshot)
//   versao: opcional (default = ultima do ano)
//   inicio, fim: YYYYMMDD (default = ano atual)
//   topN: default 20 (top economias e perdas)

const trim = (v) => v == null ? null : String(v).trim();
const toN  = (v) => Number(v || 0);

module.exports = (app) => ({
  verb: 'get',
  route: '/mcl/pva',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;

    const ano = Number(req.query.ano);
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2050) {
      return res.status(400).json({ message: 'Parâmetro ano obrigatório (2020-2050).' });
    }
    const versaoQs = req.query.versao != null ? Number(req.query.versao) : null;
    const inicio = trim(req.query.inicio) || `${ano}0101`;
    const fim    = trim(req.query.fim)    || `${ano}1231`;
    const topN   = Math.min(Math.max(Number(req.query.topN || 20), 5), 100);

    if (!/^\d{8}$/.test(inicio) || !/^\d{8}$/.test(fim)) {
      return res.status(400).json({ message: 'inicio/fim devem ser YYYYMMDD.' });
    }

    try {
      // 1) Resolve versao do snapshot
      let versao = versaoQs;
      if (versao == null) {
        const v = await Pg.connectAndQuery(
          `SELECT MAX(versao) maior FROM tab_mcl_standard_cost_meta WHERE ano = @ano`, { ano }
        );
        versao = v[0]?.maior;
      }
      if (versao == null) {
        return res.status(404).json({ message: `Snapshot ${ano} não encontrado. Crie um na aba Standard Cost.` });
      }

      // 2) Pega Standard Cost do snapshot
      const scRows = await Pg.connectAndQuery(
        `SELECT material, descricao, grupo, custo_padrao
           FROM tab_mcl_standard_cost
          WHERE ano = @ano AND versao = @versao`,
        { ano, versao }
      );
      if (scRows.length === 0) {
        return res.json({ ano, versao, totais: null, mensal: [], topEconomias: [], topPerdas: [], aviso: 'Snapshot vazio.' });
      }

      const scMap = new Map();
      scRows.forEach(r => {
        scMap.set(trim(r.material), {
          descricao: trim(r.descricao),
          grupo: trim(r.grupo),
          custoPadrao: Number(r.custo_padrao)
        });
      });

      // 3) Busca compras do periodo (SD1+SF1) — vunit + qtd dos materiais do snapshot.
      // Estrategia: filtra SD1 primeiro por D1_EMISSAO (indexado) + D1_COD,
      // depois junta SF1 so pra excluir devolucao (F1_TIPO='D').
      // Batch pequeno (100) pra manter o IN list curto e o plano sano.
      const codigos = [...scMap.keys()];
      const BATCH = 100;
      const compras = [];
      for (let i = 0; i < codigos.length; i += BATCH) {
        const slice = codigos.slice(i, i + BATCH);
        const inCods = slice.map((_, k) => `@c${k}`).join(',');
        const params = { inicio, fim };
        slice.forEach((c, k) => { params[`c${k}`] = c; });

        const r = await Protheus.connectAndQuery(`
          SELECT RTRIM(sd1.D1_COD)  material,
                 SUBSTRING(sd1.D1_EMISSAO, 1, 6) mes,
                 SUM(sd1.D1_QUANT)  qtd,
                 SUM(sd1.D1_TOTAL)  total,
                 SUM(sd1.D1_QUANT * sd1.D1_VUNIT) somaVunit,
                 COUNT(*) qtdLancamentos
            FROM SD1010 sd1 WITH (NOLOCK)
           WHERE sd1.D_E_L_E_T_ <> '*'
             AND sd1.D1_FILIAL = '01'
             AND sd1.D1_EMISSAO BETWEEN @inicio AND @fim
             AND sd1.D1_QUANT > 0
             AND RTRIM(sd1.D1_TIPO) = 'N'
             AND sd1.D1_COD IN (${inCods})
           GROUP BY sd1.D1_COD, SUBSTRING(sd1.D1_EMISSAO, 1, 6)
        `, params);
        r.forEach(x => compras.push(x));
      }

      // 4) Calcula PVA por material e por mes
      const porMaterial = new Map();
      const porMes = new Map();
      let totalPva = 0, totalGastoReal = 0, totalGastoStandard = 0, qtdMaterialsComCompra = 0;

      compras.forEach(c => {
        const mat = trim(c.material);
        const mes = trim(c.mes);
        const qtd = toN(c.qtd);
        const totalReal = toN(c.total);
        const vunitMedio = qtd > 0 ? totalReal / qtd : 0;
        const sc = scMap.get(mat);
        if (!sc) return;

        const custoStandardEsperado = sc.custoPadrao * qtd;
        const pva = custoStandardEsperado - totalReal;  // positivo = saving

        // Por material (acumulado)
        if (!porMaterial.has(mat)) {
          porMaterial.set(mat, {
            material: mat,
            descricao: sc.descricao,
            grupo: sc.grupo,
            custoPadrao: sc.custoPadrao,
            qtdComprada: 0,
            totalGastoReal: 0,
            totalGastoStandard: 0,
            vunitMedio: 0,
            pva: 0
          });
        }
        const pm = porMaterial.get(mat);
        pm.qtdComprada += qtd;
        pm.totalGastoReal += totalReal;
        pm.totalGastoStandard += custoStandardEsperado;
        pm.pva += pva;

        // Por mes
        if (!porMes.has(mes)) porMes.set(mes, { mes, totalReal: 0, totalStandard: 0, pva: 0 });
        const pmes = porMes.get(mes);
        pmes.totalReal += totalReal;
        pmes.totalStandard += custoStandardEsperado;
        pmes.pva += pva;

        totalPva += pva;
        totalGastoReal += totalReal;
        totalGastoStandard += custoStandardEsperado;
      });

      // Calcula vunit medio por material
      porMaterial.forEach(m => { m.vunitMedio = m.qtdComprada > 0 ? m.totalGastoReal / m.qtdComprada : 0; });
      qtdMaterialsComCompra = porMaterial.size;

      const matsArr = Array.from(porMaterial.values());
      const topEconomias = matsArr.filter(m => m.pva > 0).sort((a, b) => b.pva - a.pva).slice(0, topN);
      const topPerdas    = matsArr.filter(m => m.pva < 0).sort((a, b) => a.pva - b.pva).slice(0, topN);

      const mensal = Array.from(porMes.values())
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map(m => ({
          ...m,
          label: `${m.mes.slice(4, 6)}/${m.mes.slice(0, 4)}`,
          pvaPct: m.totalStandard > 0 ? (m.pva / m.totalStandard) * 100 : 0
        }));

      return res.json({
        ano, versao,
        periodo: { inicio, fim },
        totais: {
          totalGastoReal: Number(totalGastoReal.toFixed(2)),
          totalGastoStandard: Number(totalGastoStandard.toFixed(2)),
          pvaTotal: Number(totalPva.toFixed(2)),
          pvaPct: totalGastoStandard > 0 ? Number((totalPva / totalGastoStandard * 100).toFixed(2)) : 0,
          qtdMateriais: qtdMaterialsComCompra,
          qtdComEconomia: matsArr.filter(m => m.pva > 0).length,
          qtdComPerda: matsArr.filter(m => m.pva < 0).length
        },
        mensal,
        topEconomias,
        topPerdas,
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro mcl/pva:', err);
      return res.status(500).json({ message: 'Erro ao calcular PVA: ' + err.message });
    }
  }
});
