// Cria um snapshot anual do Standard Cost.
// Copia TODOS os produtos da SB1 (com B1_CUSTD > 0) pra tab_mcl_standard_cost
// junto com B2_CM1 (referencia) e o MCL vigente no momento.
//
// Body: { ano: 2026, observacao?: string, soComB1Custd?: true (default), tipos?: ['PA','PI'] }
// Versao auto-incrementa (1, 2, 3...) — permite re-snapshot.

const trim = (v) => v == null ? null : String(v).trim();

module.exports = (app) => ({
  verb: 'post',
  route: '/mcl/standard-cost/snapshot',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const ano = Number(req.body?.ano);
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2050) {
      return res.status(400).json({ message: 'ano obrigatório (2020-2050).' });
    }
    const observacao = trim(req.body?.observacao);
    const soComCustd = req.body?.soComB1Custd !== false;  // default true
    const tipos = Array.isArray(req.body?.tipos) ? req.body.tipos.map(t => String(t).toUpperCase()) : null;

    try {
      // 1) Calcula proxima versao
      const ult = await Pg.connectAndQuery(
        `SELECT COALESCE(MAX(versao), 0) maior FROM tab_mcl_standard_cost_meta WHERE ano = @ano`,
        { ano }
      );
      const versao = (ult[0]?.maior || 0) + 1;

      // 2) Pega o MCL atual (do mes mais recente disponivel) pra anexar como referencia
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
      let mclAtual = null, compMcl = null;
      if (idxRows.length > 0) {
        // Calculo simplificado pra anexar como referencia (igual /mcl/dashboard)
        const usdBase = Number(idxRows[0].usd) || 1;
        let igpmAcum = 100, ipcaAcum = 100;
        idxRows.forEach((r, i) => {
          if (i > 0) {
            igpmAcum *= (1 + Number(r.igpm || 0) / 100);
            ipcaAcum *= (1 + Number(r.ipca || 0) / 100);
          }
        });
        const ultimo = idxRows[idxRows.length - 1];
        const usdIdx = ultimo.usd ? (Number(ultimo.usd) / usdBase) * 100 : 100;
        mclAtual = (usdIdx * 0.5) + (igpmAcum * 0.3) + (ipcaAcum * 0.2);
        compMcl = typeof ultimo.competencia === 'string' ? ultimo.competencia : ultimo.competencia.toISOString().slice(0, 10);
      }

      // 3) Busca produtos do Protheus
      const tipoFilter = tipos && tipos.length
        ? `AND RTRIM(B1_TIPO) IN (${tipos.map((_, i) => `@t${i}`).join(',')})`
        : '';
      const tipoParams = {};
      if (tipos) tipos.forEach((t, i) => { tipoParams[`t${i}`] = t; });

      const sqlSb1 = `
        SELECT RTRIM(sb1.B1_COD)   material,
               RTRIM(sb1.B1_DESC)  descricao,
               RTRIM(sb1.B1_GRUPO) grupo,
               RTRIM(sb1.B1_TIPO)  tipo,
               RTRIM(sb1.B1_UM)    um,
               sb1.B1_CUSTD        custoPadrao,
               ISNULL(cm.cm1, 0)   custoMedioRef
          FROM SB1010 sb1 WITH (NOLOCK)
          LEFT JOIN (
            SELECT RTRIM(B2_COD) cod, MAX(B2_CM1) cm1
              FROM SB2010 WITH (NOLOCK)
             WHERE D_E_L_E_T_ <> '*' AND B2_FILIAL = '01'
             GROUP BY B2_COD
          ) cm ON cm.cod = RTRIM(sb1.B1_COD)
         WHERE sb1.D_E_L_E_T_ <> '*'
           ${soComCustd ? 'AND sb1.B1_CUSTD > 0' : ''}
           ${tipoFilter}
      `;
      const produtos = await Protheus.connectAndQuery(sqlSb1, tipoParams);

      if (produtos.length === 0) {
        return res.status(400).json({ message: 'Nenhum produto encontrado pra snapshot.' });
      }

      // 4) Insert em batch (chunks de 500 pra evitar payload grande)
      const CHUNK = 500;
      let inseridos = 0;
      let valorTotal = 0;
      for (let i = 0; i < produtos.length; i += CHUNK) {
        const slice = produtos.slice(i, i + CHUNK);
        const valuesSql = slice.map((_, k) => `(@a${k}, @v${k}, @m${k}, @d${k}, @g${k}, @t${k}, @u${k}, @cp${k}, @cm${k}, @mcl${k}, @cmp${k}, @uid${k})`).join(',');
        const params = {};
        slice.forEach((p, k) => {
          const cp = Number(p.custoPadrao || 0);
          valorTotal += cp;
          params[`a${k}`]   = ano;
          params[`v${k}`]   = versao;
          params[`m${k}`]   = String(p.material || '').trim();
          params[`d${k}`]   = String(p.descricao || '').trim() || null;
          params[`g${k}`]   = String(p.grupo || '').trim() || null;
          params[`t${k}`]   = String(p.tipo || '').trim() || null;
          params[`u${k}`]   = String(p.um || '').trim() || null;
          params[`cp${k}`]  = cp;
          params[`cm${k}`]  = Number(p.custoMedioRef || 0) || null;
          params[`mcl${k}`] = mclAtual;
          params[`cmp${k}`] = compMcl;
          params[`uid${k}`] = user.ID;
        });
        await Pg.connectAndQuery(
          `INSERT INTO tab_mcl_standard_cost
            (ano, versao, material, descricao, grupo, tipo, um, custo_padrao, custo_medio_ref, mcl_no_snapshot, competencia_mcl, criado_por)
           VALUES ${valuesSql}
           ON CONFLICT (ano, versao, material) DO NOTHING`,
          params
        );
        inseridos += slice.length;
      }

      // 5) Grava metadata
      await Pg.connectAndQuery(
        `INSERT INTO tab_mcl_standard_cost_meta
           (ano, versao, qtd_materiais, valor_total, observacao, criado_por)
         VALUES (@ano, @versao, @qtd, @vt, @obs, @uid)`,
        { ano, versao, qtd: inseridos, vt: valorTotal, obs: observacao, uid: user.ID }
      );

      return res.json({
        ok: true,
        ano, versao,
        materiaisInseridos: inseridos,
        valorTotalSomatorio: valorTotal,
        mclReferencia: mclAtual,
        competenciaMclReferencia: compMcl
      });
    } catch (err) {
      console.error('Erro mcl/standard-cost/snapshot:', err);
      return res.status(500).json({ message: 'Erro ao criar snapshot: ' + err.message });
    }
  }
});
