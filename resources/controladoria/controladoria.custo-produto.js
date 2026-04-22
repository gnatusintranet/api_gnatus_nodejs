// Custo de produto: explode estrutura SG1 (componentes diretos - 1 nível) +
// anexa última compra de cada componente (SD1 + SF1) com impostos + histórico
// de variação dos últimos N meses.
//
// Útil pra o time de engenharia / controladoria validar o custo teórico x real
// e identificar itens com variação de preço.

const trim = (v) => String(v || '').trim();
const toN  = (v) => Number(v || 0);

module.exports = (app) => ({
  verb: 'get',
  route: '/custo/:produto',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const produto = trim(req.params.produto).toUpperCase();
    const hoje = new Date();
    const hojeYmd = `${hoje.getFullYear()}${String(hoje.getMonth()+1).padStart(2,'0')}${String(hoje.getDate()).padStart(2,'0')}`;
    const histMeses = Math.min(Math.max(Number(req.query.histMeses || 12), 1), 36);
    const histIni = new Date(hoje.getFullYear(), hoje.getMonth() - histMeses, 1);
    const histIniYmd = `${histIni.getFullYear()}${String(histIni.getMonth()+1).padStart(2,'0')}01`;

    if (!produto) return res.status(400).json({ message: 'Código de produto é obrigatório.' });

    try {
      // 1) Dados do produto
      const prod = await Protheus.connectAndQuery(
        `SELECT TOP 1 RTRIM(B1_COD) cod, RTRIM(B1_DESC) descricao, RTRIM(B1_TIPO) tipo,
                RTRIM(B1_UM) um, B1_CUSTD custoPadrao, RTRIM(B1_POSIPI) ncm,
                RTRIM(B1_GRUPO) grupo, RTRIM(B1_PROC) tipoProc
           FROM SB1010 WITH (NOLOCK)
          WHERE D_E_L_E_T_ <> '*' AND B1_COD = @produto`,
        { produto }
      );
      if (!prod.length) return res.status(404).json({ message: 'Produto não encontrado.' });
      const p = prod[0];

      // 2) Estrutura (1 nível, componentes ativos pela validade G1_INI <= hoje <= G1_FIM)
      const estr = await Protheus.connectAndQuery(
        `SELECT RTRIM(sg1.G1_COMP) componente,
                RTRIM(sb1.B1_DESC) descricao,
                RTRIM(sb1.B1_TIPO) tipo,
                RTRIM(sb1.B1_UM)   um,
                sg1.G1_QUANT qtd,
                sg1.G1_PERDA perda,
                sg1.G1_INI   validIni,
                sg1.G1_FIM   validFim,
                sb1.B1_CUSTD custoPadrao
           FROM SG1010 sg1 WITH (NOLOCK)
           LEFT JOIN SB1010 sb1 WITH (NOLOCK)
             ON sb1.B1_COD = sg1.G1_COMP AND sb1.D_E_L_E_T_ <> '*'
          WHERE sg1.D_E_L_E_T_ <> '*'
            AND sg1.G1_COD = @produto
            AND sg1.G1_INI <= @hoje AND sg1.G1_FIM >= @hoje
          ORDER BY sg1.G1_COMP`,
        { produto, hoje: hojeYmd }
      );
      if (!estr.length) {
        return res.json({
          produto: {
            cod: trim(p.cod), descricao: trim(p.descricao), tipo: trim(p.tipo),
            um: trim(p.um), custoPadrao: toN(p.custoPadrao), ncm: trim(p.ncm),
            grupo: trim(p.grupo)
          },
          aviso: 'Produto não tem estrutura (SG1) válida cadastrada para hoje.',
          componentes: [],
          historicoAgregado: [],
          totais: { custoComponentes: 0, impostosTotal: 0, custoTotal: 0 },
          geradoEm: new Date().toISOString()
        });
      }

      const codigos = estr.map(e => trim(e.componente));

      // 3) Última compra de cada componente (SD1+SF1 com maior F1_EMISSAO)
      const inClause = codigos.map((_, i) => `@c${i}`).join(',');
      const paramsCompra = { };
      codigos.forEach((c, i) => { paramsCompra[`c${i}`] = c; });

      const ultCompra = await Protheus.connectAndQuery(
        `WITH ranked AS (
          SELECT RTRIM(sd1.D1_COD)     componente,
                 RTRIM(sd1.D1_DOC)     doc,
                 RTRIM(sd1.D1_SERIE)   serie,
                 RTRIM(sd1.D1_ITEM)    item,
                 RTRIM(sd1.D1_FORNECE) fornece,
                 RTRIM(sd1.D1_LOJA)    loja,
                 RTRIM(sa2.A2_NOME)    fornecedor,
                 RTRIM(sa2.A2_NREDUZ)  fornecedorFantasia,
                 sf1.F1_EMISSAO        emissao,
                 sd1.D1_QUANT          qtdComprada,
                 sd1.D1_VUNIT          vunit,
                 sd1.D1_TOTAL          total,
                 sd1.D1_VALICM         icms,
                 sd1.D1_VALIPI         ipi,
                 sd1.D1_VALIMP5        pis,
                 sd1.D1_VALIMP6        cofins,
                 sd1.D1_DESC           desconto,
                 RTRIM(sd1.D1_CF)      cfop,
                 ROW_NUMBER() OVER (PARTITION BY sd1.D1_COD ORDER BY sf1.F1_EMISSAO DESC, sd1.R_E_C_N_O_ DESC) rn
            FROM SD1010 sd1 WITH (NOLOCK)
           INNER JOIN SF1010 sf1 WITH (NOLOCK)
              ON sf1.F1_FILIAL  = sd1.D1_FILIAL
             AND sf1.F1_DOC     = sd1.D1_DOC
             AND sf1.F1_SERIE   = sd1.D1_SERIE
             AND sf1.F1_FORNECE = sd1.D1_FORNECE
             AND sf1.F1_LOJA    = sd1.D1_LOJA
             AND sf1.D_E_L_E_T_ <> '*'
             AND RTRIM(sf1.F1_TIPO) NOT IN ('D')
            LEFT JOIN SA2010 sa2 WITH (NOLOCK)
              ON sa2.A2_COD  = sd1.D1_FORNECE
             AND sa2.A2_LOJA = sd1.D1_LOJA
             AND sa2.D_E_L_E_T_ <> '*'
           WHERE sd1.D_E_L_E_T_ <> '*'
             AND sd1.D1_COD IN (${inClause})
             AND sd1.D1_QUANT > 0
        )
        SELECT * FROM ranked WHERE rn = 1`,
        paramsCompra
      );

      const mapUlt = new Map();
      ultCompra.forEach(u => mapUlt.set(trim(u.componente), u));

      // 4) Histórico de compras (últimas 12 meses) — para variação ao longo do tempo
      const paramsHist = { histIni: histIniYmd, ...paramsCompra };
      const hist = await Protheus.connectAndQuery(
        `SELECT RTRIM(sd1.D1_COD)     componente,
                RTRIM(sd1.D1_DOC)     doc,
                RTRIM(sd1.D1_SERIE)   serie,
                RTRIM(sd1.D1_FORNECE) fornece,
                RTRIM(sd1.D1_LOJA)    loja,
                RTRIM(sa2.A2_NREDUZ)  fornecedorFantasia,
                sf1.F1_EMISSAO        emissao,
                sd1.D1_QUANT          qtd,
                sd1.D1_VUNIT          vunit,
                sd1.D1_TOTAL          total
           FROM SD1010 sd1 WITH (NOLOCK)
          INNER JOIN SF1010 sf1 WITH (NOLOCK)
             ON sf1.F1_FILIAL  = sd1.D1_FILIAL
            AND sf1.F1_DOC     = sd1.D1_DOC
            AND sf1.F1_SERIE   = sd1.D1_SERIE
            AND sf1.F1_FORNECE = sd1.D1_FORNECE
            AND sf1.F1_LOJA    = sd1.D1_LOJA
            AND sf1.D_E_L_E_T_ <> '*'
            AND RTRIM(sf1.F1_TIPO) NOT IN ('D')
            AND sf1.F1_EMISSAO >= @histIni
           LEFT JOIN SA2010 sa2 WITH (NOLOCK)
             ON sa2.A2_COD  = sd1.D1_FORNECE
            AND sa2.A2_LOJA = sd1.D1_LOJA
            AND sa2.D_E_L_E_T_ <> '*'
          WHERE sd1.D_E_L_E_T_ <> '*'
            AND sd1.D1_COD IN (${inClause})
            AND sd1.D1_QUANT > 0
          ORDER BY sd1.D1_COD, sf1.F1_EMISSAO ASC`,
        paramsHist
      );

      // Agrupa histórico por componente
      const histByComp = {};
      hist.forEach(h => {
        const k = trim(h.componente);
        if (!histByComp[k]) histByComp[k] = [];
        histByComp[k].push({
          emissao: trim(h.emissao),
          doc: trim(h.doc),
          serie: trim(h.serie),
          fornecedor: trim(h.fornecedorFantasia),
          qtd: toN(h.qtd),
          vunit: toN(h.vunit),
          total: toN(h.total)
        });
      });

      // 5) Consolida componentes com custo real (via última compra vunit)
      let custoComponentes = 0;
      let impostosTotal    = 0;

      const componentes = estr.map(c => {
        const cod = trim(c.componente);
        const qtd = toN(c.qtd) + toN(c.qtd) * toN(c.perda); // aplica perda percentual ao qtd
        const u = mapUlt.get(cod);
        let ultimaCompra = null;
        let custoReal = toN(c.custoPadrao);
        let impostos = 0;

        if (u) {
          const vu     = toN(u.vunit);
          const qtdCp  = toN(u.qtdComprada);
          const icms   = toN(u.icms);
          const ipi    = toN(u.ipi);
          const pis    = toN(u.pis);
          const cofins = toN(u.cofins);
          const totalNF = toN(u.total);
          // impostos rateados para a quantidade necessária pelo BOM
          const impPorUnid = qtdCp > 0 ? (icms + ipi + pis + cofins) / qtdCp : 0;
          impostos = impPorUnid * qtd;
          custoReal = vu * qtd;

          ultimaCompra = {
            emissao: trim(u.emissao),
            nfDoc: trim(u.doc),
            nfSerie: trim(u.serie),
            fornecedorCod: trim(u.fornece),
            fornecedorLoja: trim(u.loja),
            fornecedor: trim(u.fornecedor),
            fornecedorFantasia: trim(u.fornecedorFantasia),
            qtdComprada: qtdCp,
            vunit: vu,
            totalItem: totalNF,
            icms, ipi, pis, cofins,
            desconto: toN(u.desconto),
            cfop: trim(u.cfop),
            impostoUnitario: impPorUnid
          };
        }

        const historico = histByComp[cod] || [];

        // Variação % entre primeira e última compra no período
        let variacao = null;
        if (historico.length >= 2) {
          const primeiro = historico[0].vunit;
          const ultimo   = historico[historico.length - 1].vunit;
          if (primeiro > 0) variacao = ((ultimo - primeiro) / primeiro) * 100;
        }

        custoComponentes += custoReal;
        impostosTotal    += impostos;

        return {
          componente: cod,
          descricao: trim(c.descricao),
          tipo: trim(c.tipo),
          um: trim(c.um),
          qtd: toN(c.qtd),
          perda: toN(c.perda),
          qtdComPerda: qtd,
          custoPadrao: toN(c.custoPadrao),
          custoReal,
          impostos,
          custoComImpostos: custoReal + impostos,
          ultimaCompra,
          historico,
          qtdHistorico: historico.length,
          variacaoPercentual: variacao
        };
      }).sort((a, b) => (b.custoReal || 0) - (a.custoReal || 0));

      // 6) Histórico agregado por mês (para gráfico)
      const aggMes = {};
      hist.forEach(h => {
        const ym = trim(h.emissao).slice(0, 6); // YYYYMM
        if (!aggMes[ym]) aggMes[ym] = { mes: ym, qtd: 0, valor: 0, nLancam: 0 };
        aggMes[ym].qtd    += toN(h.qtd);
        aggMes[ym].valor  += toN(h.total);
        aggMes[ym].nLancam += 1;
      });
      const historicoAgregado = Object.values(aggMes)
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map(m => ({
          mes: m.mes,
          label: `${m.mes.slice(4, 6)}/${m.mes.slice(0, 4)}`,
          qtd: m.qtd,
          valor: m.valor,
          vunitMedio: m.qtd > 0 ? m.valor / m.qtd : 0,
          lancamentos: m.nLancam
        }));

      return res.json({
        produto: {
          cod: trim(p.cod),
          descricao: trim(p.descricao),
          tipo: trim(p.tipo),
          um: trim(p.um),
          custoPadrao: toN(p.custoPadrao),
          ncm: trim(p.ncm),
          grupo: trim(p.grupo),
          tipoProc: trim(p.tipoProc)
        },
        componentes,
        totais: {
          custoComponentes,
          impostosTotal,
          custoTotal: custoComponentes + impostosTotal,
          diffDoCustoPadrao: (custoComponentes + impostosTotal) - toN(p.custoPadrao),
          qtdComponentes: componentes.length
        },
        historicoAgregado,
        parametros: { histMeses, histInicio: histIniYmd },
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro controladoria/custo:', err);
      return res.status(500).json({ message: 'Erro ao calcular custo.' });
    }
  }
});
