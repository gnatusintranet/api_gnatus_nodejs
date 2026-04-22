// DRE Gerencial — regime competência por emissão.
//
// Receitas    : SF2010 + SD2010 com CFOP de venda no período
// Deduções    : impostos (SD2) + devoluções (SF1 + SD1 com CFOP de entrada por devolução)
// CMV         : SUM(SD2.D2_CUSTO1) nas linhas de venda
// Despesas    : SE2010 emitidas no período, agrupadas por natureza-pai (3 primeiros
//               caracteres do ED_CODIGO). Descrições vêm de SED010.
// Financeiro  : natureza prefixo '211'
// Impostos    : natureza prefixo '208'
//
// Todas as queries filtram D_E_L_E_T_ <> '*' e F_FILIAL = '01' e usam (NOLOCK).

const CFOPS_VENDA = ['5105','5106','5116','5117','5119','5405','5933',
                     '6105','6106','6107','6108','6109','6110','6116','6117',
                     '6119','6122','6123','6404','6933','5924','5907','5934','5914','6907'];

const CFOPS_DEVOLUCAO = ['1202','2202','1411','2411','1553','2553'];

// Classificação dos prefixos de natureza em linhas do DRE
const MAPA_DESPESAS = {
  '201': { ordem: 1, label: 'Matéria-Prima Nacional' },
  '202': { ordem: 2, label: 'Matéria-Prima Importada' },
  '203': { ordem: 3, label: 'Desembaraço Aduaneiro' },
  '204': { ordem: 4, label: 'Serviços Tomados' },
  '205': { ordem: 5, label: 'Despesas com Pessoal' },
  '206': { ordem: 6, label: 'Despesas Gerais' },
  '207': { ordem: 7, label: 'Despesas Administrativas' },
  '210': { ordem: 8, label: 'Investimentos' },
  '212': { ordem: 9, label: 'Sócios' },
  '213': { ordem: 10, label: 'Imobilizado/Consórcio' }
};
const GRUPO_FINANCEIRO = '211';
const GRUPO_IMPOSTOS   = '208';

const toN = (v) => Number(v || 0);
const trim = (v) => String(v || '').trim();

// Constrói a cláusula IN parametrizada
const buildInClause = (list, prefix) => {
  const keys = list.map((_, i) => `@${prefix}${i}`);
  const params = {};
  list.forEach((v, i) => { params[`${prefix}${i}`] = v; });
  return { sql: keys.join(','), params };
};

module.exports = (app) => ({
  verb: 'get',
  route: '/dre',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const inicio = trim(req.query.inicio); // YYYYMMDD
    const fim    = trim(req.query.fim);

    if (!/^\d{8}$/.test(inicio) || !/^\d{8}$/.test(fim)) {
      return res.status(400).json({ message: 'Parâmetros inicio/fim devem ser YYYYMMDD.' });
    }

    try {
      const filial = '01';

      // ---------- 1) Receita bruta + impostos + CMV (SD2 + SF2) ----------
      const vendaIn = buildInClause(CFOPS_VENDA, 'cv');
      const sqlReceita = `
        SELECT RTRIM(D2_CF) cfop,
               COUNT(*)        qtd,
               SUM(D2_TOTAL)   total,
               SUM(D2_VALICM)  icms,
               SUM(D2_VALIPI)  ipi,
               SUM(D2_VALIMP5) pis,
               SUM(D2_VALIMP6) cofins,
               SUM(D2_CUSTO1)  cmv,
               SUM(D2_DESCON)  desconto,
               SUM(D2_VALDEV)  valdev
          FROM SD2010 sd2 WITH (NOLOCK)
         INNER JOIN SF2010 sf2 WITH (NOLOCK)
            ON sf2.F2_FILIAL = sd2.D2_FILIAL
           AND sf2.F2_DOC    = sd2.D2_DOC
           AND sf2.F2_SERIE  = sd2.D2_SERIE
           AND sf2.F2_CLIENTE = sd2.D2_CLIENTE
           AND sf2.F2_LOJA    = sd2.D2_LOJA
           AND sf2.D_E_L_E_T_ <> '*'
         WHERE sd2.D_E_L_E_T_ <> '*'
           AND sd2.D2_FILIAL = @filial
           AND sd2.D2_EMISSAO BETWEEN @inicio AND @fim
           AND sf2.F2_EMISSAO BETWEEN @inicio AND @fim
           AND RTRIM(sd2.D2_CF) IN (${vendaIn.sql})
         GROUP BY sd2.D2_CF
         ORDER BY SUM(D2_TOTAL) DESC
      `;
      const receitaRows = await Protheus.connectAndQuery(sqlReceita, { filial, inicio, fim, ...vendaIn.params });

      const receitaBruta = { detalhes: [], total: 0 };
      let icms = 0, ipi = 0, pis = 0, cofins = 0, cmv = 0, desconto = 0, valdevLinha = 0;
      receitaRows.forEach(r => {
        const total = toN(r.total);
        receitaBruta.detalhes.push({ cfop: trim(r.cfop), qtd: toN(r.qtd), valor: total });
        receitaBruta.total += total;
        icms   += toN(r.icms);
        ipi    += toN(r.ipi);
        pis    += toN(r.pis);
        cofins += toN(r.cofins);
        cmv    += toN(r.cmv);
        desconto   += toN(r.desconto);
        valdevLinha += toN(r.valdev);
      });

      // ---------- 2) Devoluções (SF1 + SD1 CFOPs de entrada) ----------
      const devIn = buildInClause(CFOPS_DEVOLUCAO, 'cd');
      const sqlDev = `
        SELECT RTRIM(D1_CF) cfop, COUNT(*) qtd, SUM(D1_TOTAL) total
          FROM SD1010 sd1 WITH (NOLOCK)
         INNER JOIN SF1010 sf1 WITH (NOLOCK)
            ON sf1.F1_FILIAL = sd1.D1_FILIAL
           AND sf1.F1_DOC    = sd1.D1_DOC
           AND sf1.F1_SERIE  = sd1.D1_SERIE
           AND sf1.F1_FORNECE = sd1.D1_FORNECE
           AND sf1.F1_LOJA    = sd1.D1_LOJA
           AND sf1.D_E_L_E_T_ <> '*'
         WHERE sd1.D_E_L_E_T_ <> '*'
           AND sd1.D1_FILIAL = @filial
           AND sd1.D1_EMISSAO BETWEEN @inicio AND @fim
           AND sf1.F1_EMISSAO BETWEEN @inicio AND @fim
           AND RTRIM(sd1.D1_CF) IN (${devIn.sql})
         GROUP BY sd1.D1_CF
      `;
      const devRows = await Protheus.connectAndQuery(sqlDev, { filial, inicio, fim, ...devIn.params });
      const devolucoes = { total: 0, detalhes: [] };
      devRows.forEach(r => {
        const v = toN(r.total);
        devolucoes.detalhes.push({ cfop: trim(r.cfop), qtd: toN(r.qtd), valor: v });
        devolucoes.total += v;
      });

      // ---------- 3) Despesas (SE2) com descrição da natureza ----------
      const sqlDespesas = `
        SELECT RTRIM(se2.E2_NATUREZ) natureza,
               MAX(RTRIM(sed.ED_DESCRIC)) descricao,
               COUNT(*) qtd,
               SUM(se2.E2_VALOR) valor
          FROM SE2010 se2 WITH (NOLOCK)
          LEFT JOIN SED010 sed WITH (NOLOCK)
            ON sed.ED_CODIGO = se2.E2_NATUREZ
           AND sed.D_E_L_E_T_ <> '*'
         WHERE se2.D_E_L_E_T_ <> '*'
           AND se2.E2_FILIAL = @filial
           AND se2.E2_EMISSAO BETWEEN @inicio AND @fim
         GROUP BY se2.E2_NATUREZ
         ORDER BY SUM(se2.E2_VALOR) DESC
      `;
      const despesasRows = await Protheus.connectAndQuery(sqlDespesas, { filial, inicio, fim });

      // Agrupa por prefixo de 3 chars (natureza-pai)
      const gruposDespesas = {};      // { '201': { label, total, naturezas: [] } }
      let totalFinanceiro = 0;        // prefixo 211
      const detalhesFinanceiro = [];
      let totalImpostos = 0;          // prefixo 208
      const detalhesImpostos = [];
      const outrasDespesas = [];      // naturezas que não entram em nenhum grupo

      despesasRows.forEach(r => {
        const cod = trim(r.natureza);
        const descricao = trim(r.descricao) || '(sem descrição)';
        const valor = toN(r.valor);
        const qtd = toN(r.qtd);
        if (!cod || valor === 0) return;

        const pref = cod.slice(0, 3);

        if (pref === GRUPO_FINANCEIRO) {
          totalFinanceiro += valor;
          detalhesFinanceiro.push({ natureza: cod, descricao, qtd, valor });
          return;
        }
        if (pref === GRUPO_IMPOSTOS) {
          totalImpostos += valor;
          detalhesImpostos.push({ natureza: cod, descricao, qtd, valor });
          return;
        }

        if (MAPA_DESPESAS[pref]) {
          if (!gruposDespesas[pref]) {
            gruposDespesas[pref] = {
              codigo: pref,
              label: MAPA_DESPESAS[pref].label,
              ordem: MAPA_DESPESAS[pref].ordem,
              total: 0,
              naturezas: []
            };
          }
          gruposDespesas[pref].total += valor;
          gruposDespesas[pref].naturezas.push({ natureza: cod, descricao, qtd, valor });
        } else {
          outrasDespesas.push({ natureza: cod, descricao, qtd, valor });
        }
      });

      const gruposArr = Object.values(gruposDespesas).sort((a, b) => a.ordem - b.ordem);
      const totalDespesasOp = gruposArr.reduce((s, g) => s + g.total, 0);
      const totalOutras = outrasDespesas.reduce((s, n) => s + n.valor, 0);

      // ---------- 4) Consolidação DRE ----------
      const totalDeducoes = devolucoes.total + icms + pis + cofins + ipi;
      const receitaLiquida = receitaBruta.total - totalDeducoes;
      const lucroBruto = receitaLiquida - cmv;
      const ebit = lucroBruto - totalDespesasOp;
      const lucroLiquido = ebit - totalFinanceiro - totalImpostos - totalOutras;

      const pct = (v) => (receitaLiquida > 0 ? (v / receitaLiquida) * 100 : 0);

      return res.json({
        periodo: { inicio, fim },
        geradoEm: new Date().toISOString(),

        receitaBruta: { total: receitaBruta.total, detalhes: receitaBruta.detalhes },

        deducoes: {
          total: totalDeducoes,
          devolucoes: { total: devolucoes.total, detalhes: devolucoes.detalhes },
          icms, pis, cofins, ipi
        },

        receitaLiquida,

        cmv: { total: cmv },

        lucroBruto,
        margemBruta: pct(lucroBruto),

        despesasOperacionais: {
          total: totalDespesasOp,
          grupos: gruposArr
        },

        ebit,
        margemOperacional: pct(ebit),

        resultadoFinanceiro: { total: totalFinanceiro, detalhes: detalhesFinanceiro },
        impostosRecolher:    { total: totalImpostos,   detalhes: detalhesImpostos },
        outrasDespesas:      { total: totalOutras,     naturezas: outrasDespesas },

        lucroLiquido,
        margemLiquida: pct(lucroLiquido),

        // metadados úteis pro frontend
        descontoBruto: desconto
      });
    } catch (err) {
      console.error('Erro em gerencia/dre:', err);
      return res.status(500).json({ message: 'Erro ao montar DRE.' });
    }
  }
});
