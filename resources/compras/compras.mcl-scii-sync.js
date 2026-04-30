// Sincroniza expectativas do Boletim Focus do BCB.
//
// API Olinda BCB:
//   IPCA mensal:   ExpectativaMercadoMensais?$filter=Indicador eq 'IPCA'
//   IGP-M mensal:  ExpectativaMercadoMensais?$filter=Indicador eq 'IGP-M'
//   Cambio mensal: ExpectativasMercadoTrimestrais? (cambio nao tem mensal direto)
//                  -> usar fim de mes do ExpectativasMercadoSelic ou aproximacao
//                  Por simplicidade, usamos ExpectativaMercadoMensais com indicador 'Câmbio'
//                  (BCB tem essa serie tb).
//
// Pra cada (indicador, competencia), salva apenas a EXPECTATIVA MAIS RECENTE
// publicada (filtro DataReferencia = ultima do periodo).
//
// Body: { meses?: 12 } (default — quantos meses futuros pegar)

const INDICADORES = [
  { codigo: 'IPCA',   nomeBcb: 'IPCA' },
  { codigo: 'IGPM',   nomeBcb: 'IGP-M' },
  { codigo: 'CAMBIO', nomeBcb: 'Câmbio' }   // BCB usa "Câmbio" com acento
];

// Pega expectativas mensais via OData
const buscarFocusMensal = async (indicadorBcb, dataInicialISO) => {
  const baseUrl = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativaMercadoMensais';
  const filter = `Indicador eq '${indicadorBcb}' and Data ge '${dataInicialISO}'`;
  const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$orderby=Data desc&$format=json&$top=5000`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Focus ${indicadorBcb} retornou HTTP ${r.status}: ${body.slice(0, 200)}`);
  }
  const json = await r.json();
  return json.value || [];
};

const competenciaMes = (datRef) => {
  // datRef vem como "MM/YYYY" no Focus mensal
  if (!datRef) return null;
  const m = String(datRef).match(/^(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[2]}-${m[1]}-01`;
};

module.exports = (app) => ({
  verb: 'post',
  route: '/mcl/scii/sync-bcb',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    // Pega ultimos 90 dias de publicacoes — mais que suficiente pra cobrir as 12m forward
    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 90);
    const inicioISO = inicio.toISOString().slice(0, 10);

    try {
      const totais = {};
      for (const ind of INDICADORES) {
        const rows = await buscarFocusMensal(ind.nomeBcb, inicioISO);

        // Pra cada (DataReferencia, BaseCalculo), salva. Se ja existe igual, ignora.
        let inseridos = 0, atualizados = 0;
        for (const r of rows) {
          const comp = competenciaMes(r.DataReferencia);
          if (!comp) continue;

          const datPub = r.Data ? r.Data.slice(0, 10) : null;
          if (!datPub) continue;

          const params = {
            ind: ind.codigo,
            comp,
            pub: datPub,
            mediana: r.Mediana ?? null,
            media: r.Media ?? null,
            min: r.Minimo ?? null,
            max: r.Maximo ?? null,
            dp: r.DesvioPadrao ?? null,
            cv: r.CoeficienteVariacao ?? null,
            base: r.baseCalculo ?? r.BaseCalculo ?? 0
          };
          const result = await Pg.connectAndQuery(
            `INSERT INTO tab_mcl_scii
               (indicador, competencia, data_publicacao, mediana, media, minimo, maximo, desvio_padrao, coeficiente_variacao, base_calculo)
             VALUES (@ind, @comp, @pub, @mediana, @media, @min, @max, @dp, @cv, @base)
             ON CONFLICT (indicador, competencia, data_publicacao, base_calculo) DO NOTHING
             RETURNING id`,
            params
          );
          if (result.length > 0) inseridos++;
          else atualizados++;
        }
        totais[ind.codigo] = { inseridos, ignorados: atualizados, totalRecebido: rows.length };
      }

      return res.json({ ok: true, totais, sincronizadoEm: new Date().toISOString() });
    } catch (err) {
      console.error('Erro mcl/scii/sync-bcb:', err);
      return res.status(502).json({ message: 'Erro ao sincronizar Focus: ' + err.message });
    }
  }
});
