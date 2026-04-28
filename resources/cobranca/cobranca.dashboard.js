// Dashboard de Cobrança — KPIs e agregações sobre titulos a receber.
//
// Conceitos:
// - "Faturado no período"   = titulos SE1 emitidos entre inicio/fim, com nota
//                             fiscal (E1_NUM preenchido) e excluindo RA/NCC.
// - "Vencido"               = saldo aberto cujo vencimento (E1_VENCREA) ja passou.
// - "Em aberto (no prazo)"  = saldo aberto cujo vencimento ainda nao chegou.
// - "Pago"                  = saldo zerado.
// - "Indice de inadimplencia" = vencido / faturadoTotal * 100, ambos no periodo.
//
// Filtros opcionais: cliente, uf, bu (C5_ZTIPO), formaPgto (E1_FORMAPG).

const trim = (v) => String(v || '').trim();
const toN  = (v) => Number(v || 0);

const FORMAS_PGTO = {
  '1': 'Cheque', '2': 'Dinheiro', '3': 'Cartão', '4': 'Boleto Bancário',
  '5': 'Não informado', '6': 'Financiamento', '7': 'Cartão BNDS',
  '8': 'Bonificação', '9': 'Consignado',
  'B': 'Antecipação Parcelada', 'A': 'Futuro Garantido', '': 'Não informado'
};
const descreverFormaPgto = (cod) => FORMAS_PGTO[cod] || `Forma ${cod}`;

const faixaAtraso = (dias) => {
  if (dias <= 0)   return null;                          // não vencido
  if (dias <= 15)  return { codigo: 'A_1_15',    label: '1-15 dias',  ordem: 1, cor: '#f5a500' };
  if (dias <= 30)  return { codigo: 'A_16_30',   label: '16-30 dias', ordem: 2, cor: '#e55a1a' };
  if (dias <= 60)  return { codigo: 'A_31_60',   label: '31-60 dias', ordem: 3, cor: '#c9302c' };
  if (dias <= 90)  return { codigo: 'A_61_90',   label: '61-90 dias', ordem: 4, cor: '#8a1f1b' };
  return             { codigo: 'A_90_MAIS', label: '90+ dias',   ordem: 5, cor: '#4a0e0e' };
};

// YYYYMMDD do primeiro dia do mês de "n meses atrás"
const ymdMesesAtras = (n) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}01`;
};

const ymdHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

module.exports = (app) => ({
  verb: 'get',
  route: '/dashboard',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const inicio = trim(req.query.inicio);
    const fim    = trim(req.query.fim);

    if (!/^\d{8}$/.test(inicio) || !/^\d{8}$/.test(fim)) {
      return res.status(400).json({ message: 'Parâmetros inicio/fim devem ser YYYYMMDD.' });
    }

    const filial = '01';
    const hoje = ymdHoje();

    // Filtros opcionais
    const params = { filial, inicio, fim, hoje, hist6: ymdMesesAtras(5) };
    const conds = [];

    if (req.query.cliente) {
      params.cliente = String(req.query.cliente).toUpperCase();
      conds.push(`AND (UPPER(sa1.A1_NOME) LIKE '%' + @cliente + '%' OR RTRIM(se1.E1_CLIENTE) = @cliente OR UPPER(RTRIM(se1.E1_NOMCLI)) LIKE '%' + @cliente + '%')`);
    }
    if (req.query.uf) {
      params.uf = String(req.query.uf).toUpperCase();
      conds.push(`AND RTRIM(sa1.A1_EST) = @uf`);
    }
    if (req.query.bu) {
      params.bu = String(req.query.bu).toUpperCase();
      conds.push(`AND RTRIM(sc5.C5_ZTIPO) = @bu`);
    }
    if (req.query.formaPgto) {
      params.formaPgto = String(req.query.formaPgto);
      conds.push(`AND RTRIM(se1.E1_FORMAPG) = @formaPgto`);
    }

    // Query principal: titulos faturados no periodo (com NF) + status atual
    const sqlPeriodo = `
      SELECT
        RTRIM(se1.E1_PREFIXO) prefixo,
        RTRIM(se1.E1_NUM)     numero,
        RTRIM(se1.E1_PARCELA) parcela,
        RTRIM(se1.E1_TIPO)    tipo,
        RTRIM(se1.E1_CLIENTE) clienteCod,
        RTRIM(se1.E1_LOJA)    clienteLoja,
        RTRIM(COALESCE(NULLIF(sa1.A1_NOME, ''), se1.E1_NOMCLI)) clienteNome,
        RTRIM(sa1.A1_EST)     uf,
        RTRIM(se1.E1_FORMAPG) formaPgto,
        RTRIM(sc5.C5_ZTIPO)   buCod,
        RTRIM(bu.X5_DESCRI)   buNome,
        se1.E1_EMISSAO        emissao,
        se1.E1_VENCREA        vencimento,
        se1.E1_VALOR          valor,
        se1.E1_SALDO          saldo,
        DATEDIFF(day, CONVERT(date, se1.E1_VENCREA, 112), GETDATE()) diasAtraso
      FROM SE1010 se1 WITH (NOLOCK)
      LEFT JOIN SA1010 sa1 WITH (NOLOCK)
        ON sa1.A1_COD = se1.E1_CLIENTE AND sa1.A1_LOJA = se1.E1_LOJA
       AND sa1.D_E_L_E_T_ <> '*'
      LEFT JOIN SC5010 sc5 WITH (NOLOCK)
        ON sc5.C5_FILIAL = se1.E1_FILIAL AND sc5.C5_NUM = se1.E1_PEDIDO
       AND sc5.D_E_L_E_T_ <> '*'
      LEFT JOIN SX5010 bu WITH (NOLOCK)
        ON bu.X5_FILIAL = '  ' AND bu.X5_TABELA = 'ZA'
       AND RTRIM(bu.X5_CHAVE) = RTRIM(sc5.C5_ZTIPO)
       AND bu.D_E_L_E_T_ <> '*'
      WHERE se1.D_E_L_E_T_ <> '*'
        AND se1.E1_FILIAL = @filial
        AND se1.E1_EMISSAO BETWEEN @inicio AND @fim
        AND RTRIM(se1.E1_TIPO) NOT IN ('RA','NCC')
        AND RTRIM(se1.E1_NUM) <> ''
        ${conds.join(' ')}
      ORDER BY se1.E1_EMISSAO DESC
    `;

    // Timeline mensal (últimos 6 meses, sempre — independe do filtro de período)
    const sqlTimeline = `
      SELECT
        SUBSTRING(se1.E1_EMISSAO, 1, 6) mes,
        SUM(se1.E1_VALOR) faturado,
        SUM(CASE WHEN se1.E1_SALDO > 0
                  AND DATEDIFF(day, CONVERT(date, se1.E1_VENCREA, 112), GETDATE()) > 0
                 THEN se1.E1_SALDO ELSE 0 END) vencido,
        COUNT(*) qtd
      FROM SE1010 se1 WITH (NOLOCK)
      LEFT JOIN SA1010 sa1 WITH (NOLOCK)
        ON sa1.A1_COD = se1.E1_CLIENTE AND sa1.A1_LOJA = se1.E1_LOJA
       AND sa1.D_E_L_E_T_ <> '*'
      LEFT JOIN SC5010 sc5 WITH (NOLOCK)
        ON sc5.C5_FILIAL = se1.E1_FILIAL AND sc5.C5_NUM = se1.E1_PEDIDO
       AND sc5.D_E_L_E_T_ <> '*'
      WHERE se1.D_E_L_E_T_ <> '*'
        AND se1.E1_FILIAL = @filial
        AND se1.E1_EMISSAO >= @hist6
        AND RTRIM(se1.E1_TIPO) NOT IN ('RA','NCC')
        AND RTRIM(se1.E1_NUM) <> ''
        ${conds.join(' ')}
      GROUP BY SUBSTRING(se1.E1_EMISSAO, 1, 6)
      ORDER BY mes
    `;

    try {
      const [rows, timelineRows] = await Promise.all([
        Protheus.connectAndQuery(sqlPeriodo, params),
        Protheus.connectAndQuery(sqlTimeline, params)
      ]);

      // Acumuladores
      let faturadoTotal = 0, abertoTotal = 0, vencidoTotal = 0, pagoTotal = 0;
      const clientesFaturados = new Set();
      const clientesInadimplentes = new Set();
      const porBu = {};
      const porForma = {};
      const porFaixa = {};
      const porCliente = {};   // pra ranking de inadimplentes

      rows.forEach(r => {
        const valor = toN(r.valor);
        const saldo = toN(r.saldo);
        const dias  = toN(r.diasAtraso);
        const buKey = trim(r.buCod) || '—';
        const buNome = trim(r.buNome) || (buKey === '—' ? 'Sem BU' : buKey);
        const formaKey = trim(r.formaPgto) || '';
        const formaLabel = descreverFormaPgto(formaKey);
        const cliKey = `${trim(r.clienteCod)}-${trim(r.clienteLoja)}`;
        const isVencido = saldo > 0 && dias > 0;
        const isAberto  = saldo > 0 && dias <= 0;
        const isPago    = saldo === 0;

        faturadoTotal += valor;
        clientesFaturados.add(cliKey);

        if (isPago)    pagoTotal    += valor;
        if (isAberto)  abertoTotal  += saldo;
        if (isVencido) {
          vencidoTotal += saldo;
          clientesInadimplentes.add(cliKey);
        }

        // Por BU
        if (!porBu[buKey]) porBu[buKey] = { bu: buKey, label: buNome, faturado: 0, vencido: 0, aberto: 0, qtd: 0 };
        porBu[buKey].faturado += valor;
        porBu[buKey].qtd += 1;
        if (isVencido) porBu[buKey].vencido += saldo;
        if (isAberto)  porBu[buKey].aberto  += saldo;

        // Por forma de pagamento
        if (!porForma[formaKey]) porForma[formaKey] = { codigo: formaKey, label: formaLabel, faturado: 0, vencido: 0, aberto: 0, qtd: 0 };
        porForma[formaKey].faturado += valor;
        porForma[formaKey].qtd += 1;
        if (isVencido) porForma[formaKey].vencido += saldo;
        if (isAberto)  porForma[formaKey].aberto  += saldo;

        // Faixas de atraso (só vencidos)
        const faixa = faixaAtraso(dias);
        if (isVencido && faixa) {
          if (!porFaixa[faixa.codigo]) {
            porFaixa[faixa.codigo] = { ...faixa, qtd: 0, valor: 0 };
          }
          porFaixa[faixa.codigo].qtd += 1;
          porFaixa[faixa.codigo].valor += saldo;
        }

        // Top inadimplentes
        if (isVencido) {
          if (!porCliente[cliKey]) {
            porCliente[cliKey] = {
              clienteCod: trim(r.clienteCod),
              clienteLoja: trim(r.clienteLoja),
              clienteNome: trim(r.clienteNome),
              uf: trim(r.uf),
              vencido: 0,
              qtdTitulos: 0,
              maiorAtraso: 0
            };
          }
          porCliente[cliKey].vencido    += saldo;
          porCliente[cliKey].qtdTitulos += 1;
          porCliente[cliKey].maiorAtraso = Math.max(porCliente[cliKey].maiorAtraso, dias);
        }
      });

      // Adiciona indice de inadimplencia em cada agregação
      const addIndice = (arr) => arr.map(o => ({
        ...o,
        indiceInadimplencia: o.faturado > 0 ? (o.vencido / o.faturado) * 100 : 0
      }));

      const porBuArr    = addIndice(Object.values(porBu)).sort((a, b) => b.faturado - a.faturado);
      const porFormaArr = addIndice(Object.values(porForma)).sort((a, b) => b.faturado - a.faturado);
      const porFaixaArr = Object.values(porFaixa).sort((a, b) => a.ordem - b.ordem);
      const topInadimplentes = Object.values(porCliente)
        .sort((a, b) => b.vencido - a.vencido)
        .slice(0, 15);

      const timelineMensal = timelineRows.map(r => {
        const mes = trim(r.mes);
        const faturado = toN(r.faturado);
        const vencido = toN(r.vencido);
        return {
          mes,
          label: `${mes.slice(4, 6)}/${mes.slice(0, 4)}`,
          faturado,
          vencido,
          indiceInadimplencia: faturado > 0 ? (vencido / faturado) * 100 : 0,
          qtd: toN(r.qtd)
        };
      });

      const indiceInadimplencia = faturadoTotal > 0 ? (vencidoTotal / faturadoTotal) * 100 : 0;
      const ticketMedio = clientesFaturados.size > 0 ? faturadoTotal / clientesFaturados.size : 0;

      return res.json({
        periodo: { inicio, fim, hoje },
        filtros: {
          cliente: req.query.cliente || null,
          uf: req.query.uf || null,
          bu: req.query.bu || null,
          formaPgto: req.query.formaPgto || null
        },
        kpis: {
          faturadoTotal,
          faturadoQtdTitulos: rows.length,
          aberto: abertoTotal,
          vencido: vencidoTotal,
          pago: pagoTotal,
          qtdClientesFaturados: clientesFaturados.size,
          qtdClientesInadimplentes: clientesInadimplentes.size,
          indiceInadimplencia,
          ticketMedio
        },
        porBu: porBuArr,
        porFormaPgto: porFormaArr,
        porFaixaAtraso: porFaixaArr,
        timelineMensal,
        topInadimplentes,
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro cobranca/dashboard:', err);
      return res.status(500).json({ message: 'Erro ao montar dashboard de cobrança.' });
    }
  }
});
