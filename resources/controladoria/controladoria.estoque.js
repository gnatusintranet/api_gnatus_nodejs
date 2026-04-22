// Valorização de estoque: saldo atual x custo médio (SB2.B2_CM1).
// Agrupa por armazém e tipo de produto; lista detalhe ordenado por valor.
const trim = (v) => String(v || '').trim();
const toN  = (v) => Number(v || 0);

module.exports = (app) => ({
  verb: 'get',
  route: '/estoque',

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const { tipo, armazem, busca } = req.query;

    const params = {};
    const conds  = [];
    if (tipo)    { params.tipo    = String(tipo).toUpperCase();    conds.push(`AND RTRIM(sb1.B1_TIPO) = @tipo`); }
    if (armazem) { params.armazem = String(armazem).toUpperCase(); conds.push(`AND RTRIM(sb2.B2_LOCAL) = @armazem`); }
    if (busca) {
      params.busca = String(busca).toUpperCase();
      conds.push(`AND (UPPER(sb1.B1_DESC) LIKE '%' + @busca + '%' OR sb2.B2_COD LIKE @busca + '%')`);
    }

    try {
      const sql = `
        SELECT RTRIM(sb2.B2_COD)   produto,
               RTRIM(sb1.B1_DESC)  descricao,
               RTRIM(sb1.B1_TIPO)  tipo,
               RTRIM(sb1.B1_UM)    um,
               RTRIM(sb2.B2_LOCAL) armazem,
               RTRIM(nnr.NNR_DESCRI) armazemDesc,
               sb2.B2_QATU  qatu,
               sb2.B2_CM1   cm1,
               sb2.B2_VATU1 valor,
               sb2.B2_RESERVA reserva,
               sb2.B2_QEMP  empenho
          FROM SB2010 sb2 WITH (NOLOCK)
          LEFT JOIN SB1010 sb1 WITH (NOLOCK)
            ON sb1.B1_COD = sb2.B2_COD AND sb1.D_E_L_E_T_ <> '*'
          LEFT JOIN NNR010 nnr WITH (NOLOCK)
            ON nnr.NNR_CODIGO = sb2.B2_LOCAL AND nnr.D_E_L_E_T_ <> '*'
         WHERE sb2.D_E_L_E_T_ <> '*'
           AND sb2.B2_QATU > 0
           ${conds.join(' ')}
      `;
      const rows = await Protheus.connectAndQuery(sql, params);

      const itens = rows.map(r => ({
        produto: trim(r.produto),
        descricao: trim(r.descricao),
        tipo: trim(r.tipo),
        um: trim(r.um),
        armazem: trim(r.armazem),
        armazemDesc: trim(r.armazemDesc),
        qatu: toN(r.qatu),
        cm1: toN(r.cm1),
        valor: toN(r.valor),
        reserva: toN(r.reserva),
        empenho: toN(r.empenho)
      })).sort((a, b) => b.valor - a.valor);

      // Agregações
      const porArmazem = new Map();
      const porTipo    = new Map();
      let totalValor = 0, totalQatu = 0;

      itens.forEach(i => {
        totalValor += i.valor;
        totalQatu  += i.qatu;
        const ka = i.armazem || '—';
        if (!porArmazem.has(ka)) porArmazem.set(ka, { armazem: ka, armazemDesc: i.armazemDesc, qtdProdutos: 0, qtdUnidades: 0, valor: 0 });
        const a = porArmazem.get(ka);
        a.qtdProdutos += 1;
        a.qtdUnidades += i.qatu;
        a.valor += i.valor;

        const kt = i.tipo || '—';
        if (!porTipo.has(kt)) porTipo.set(kt, { tipo: kt, qtdProdutos: 0, valor: 0 });
        const t = porTipo.get(kt);
        t.qtdProdutos += 1;
        t.valor += i.valor;
      });

      return res.json({
        totalValor, totalQatu, qtdRegistros: itens.length,
        porArmazem: Array.from(porArmazem.values()).sort((a,b) => b.valor - a.valor),
        porTipo:    Array.from(porTipo.values()).sort((a,b) => b.valor - a.valor),
        itens,
        geradoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro controladoria/estoque:', err);
      return res.status(500).json({ message: 'Erro ao consultar estoque.' });
    }
  }
});
