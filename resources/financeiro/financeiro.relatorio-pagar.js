// GET /financeiro/relatorio-pagar?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&fornecedor=...
// Réplica do relatório PHP legado "RELATÓRIO DE CONTAS A PAGAR":
// títulos do CP (SE2) com SALDO > 0 e VENCIMENTO no período, filial 01. 27 colunas
// (joins p/ tipo, natureza, portador, conta contábil, centro de custo, fornecedor).
// Fantasia = E2_NOMFOR, Razão Social = SA2.A2_NOME (exatamente como o legado).
// Backend devolve JSON; o XLSX (2 abas Parametros + Dados) é montado no frontend.

// Financeiro / Contas a Pagar = perm 8001 (mesma da tela).
const requirePerm = (app) => require('../../middlewares/requirePerm')(app)([8001, 0]);
const { ehConexao, MSG_INDISPONIVEL } = require('../../services/protheusErro');
const trim = (v) => String(v == null ? '' : v).trim();
const toNumber = (v) => Number(v || 0);
const toProtheusDate = (iso) => { const s = String(iso || '').replace(/-/g, '').slice(0, 8); return /^\d{8}$/.test(s) ? s : null; };

module.exports = (app) => ({
  verb: 'get',
  route: '/relatorio-pagar',
  middlewares: [requirePerm(app)],

  handler: async (req, res) => {
    const { Protheus } = app.services;
    const dtInicio = toProtheusDate(req.query.inicio);
    const dtFim = toProtheusDate(req.query.fim);
    if (!dtInicio || !dtFim) return res.status(400).json({ message: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD).' });

    // Filtro extra opcional de fornecedor (o legado não tinha — só estreita o resultado).
    const params = { inicio: dtInicio, fim: dtFim };
    const conds = [];
    if (req.query.fornecedor) {
      params.fornecedor = String(req.query.fornecedor).toUpperCase();
      conds.push(`AND (UPPER(SA2.A2_NOME) LIKE '%' + @fornecedor + '%' OR RTRIM(SE2.E2_FORNECE) = @fornecedor OR RTRIM(SE2.E2_NOMFOR) LIKE '%' + @fornecedor + '%')`);
    }

    const sql = `
      SELECT
        RTRIM(SE2.E2_FILIAL)   Filial,
        RTRIM(SE2.E2_PREFIXO)  Prefixo,
        RTRIM(SE2.E2_NUM)      Numero,
        RTRIM(SE2.E2_PARCELA)  Parcela,
        RTRIM(SE2.E2_TIPO)     CodTipo,
        RTRIM(SX5.X5_DESCRI)   Tipo,
        RTRIM(SE2.E2_NATUREZ)  CodNatureza,
        RTRIM(SED.ED_DESCRIC)  Natureza,
        RTRIM(SE2.E2_PORTADO)  CodPortador,
        RTRIM(SA6.A6_NOME)     Portador,
        RTRIM(SE2.E2_LOJA)     Loja,
        RTRIM(SE2.E2_FORNECE)  CodFornecedor,
        RTRIM(SE2.E2_NOMFOR)   Fantasia,
        RTRIM(SA2.A2_NOME)     RazaoSocial,
        SE2.E2_EMISSAO         Emissao,
        SE2.E2_VENCTO          Vencimento,
        SE2.E2_VENCREA         VenctoReal,
        (CASE WHEN SE2.E2_VENCREA < CONVERT(varchar, getdate(), 112) THEN 'VENCIDO' ELSE 'A VENCER' END) Vencido,
        datediff(DAY, getdate(), SE2.E2_VENCREA) Dias,
        SE2.E2_VALOR           Valor,
        SE2.E2_SALDO           Saldo,
        SE2.E2_BAIXA           DtBaixa,
        RTRIM(SE2.E2_HIST)     Historico,
        RTRIM(SE2.E2_CONTAD)   CodContabil,
        RTRIM(CT1.CT1_DESC01)  ContaContabil,
        RTRIM(SE2.E2_CCUSTO)   CodCusto,
        RTRIM(CTT.CTT_DESC01)  CentroCusto
      FROM dbo.SE2010 SE2 WITH (NOLOCK)
      LEFT JOIN dbo.SA2010 SA2 WITH (NOLOCK) ON (SE2.E2_FORNECE=SA2.A2_COD AND SE2.E2_LOJA=SA2.A2_LOJA AND SA2.D_E_L_E_T_<>'*')
      LEFT JOIN dbo.SX5010 SX5 WITH (NOLOCK) ON (SE2.E2_TIPO=SX5.X5_CHAVE AND SX5.X5_TABELA='05')
      LEFT JOIN dbo.SED010 SED WITH (NOLOCK) ON (SE2.E2_NATUREZ=SED.ED_CODIGO AND SED.D_E_L_E_T_<>'*')
      LEFT JOIN dbo.SA6010 SA6 WITH (NOLOCK) ON (SE2.E2_PORTADO=SA6.A6_COD AND SA6.D_E_L_E_T_<>'*')
      LEFT JOIN dbo.CT1010 CT1 WITH (NOLOCK) ON (SE2.E2_CONTAD=CT1.CT1_CONTA AND CT1.D_E_L_E_T_<>'*')
      LEFT JOIN dbo.CTT010 CTT WITH (NOLOCK) ON (SE2.E2_CCUSTO=CTT.CTT_CUSTO AND CTT.D_E_L_E_T_<>'*' AND CTT.CTT_FILIAL='01')
      WHERE SE2.E2_FILIAL='01' AND SE2.D_E_L_E_T_<>'*'
        AND SE2.E2_VENCTO >= @inicio AND SE2.E2_VENCTO <= @fim
        AND SE2.E2_SALDO > 0
        ${conds.join(' ')}
      ORDER BY SE2.E2_VENCTO, SE2.E2_NUM, SE2.E2_PARCELA`;

    try {
      const rows = await Protheus.connectAndQuery(sql, params);

      const dados = rows.map(r => ({
        filial: trim(r.Filial), prefixo: trim(r.Prefixo), numero: trim(r.Numero), parcela: trim(r.Parcela),
        codTipo: trim(r.CodTipo), tipo: trim(r.Tipo),
        codNatureza: trim(r.CodNatureza), natureza: trim(r.Natureza),
        codPortador: trim(r.CodPortador), portador: trim(r.Portador),
        loja: trim(r.Loja), codFornecedor: trim(r.CodFornecedor),
        fantasia: trim(r.Fantasia), razaoSocial: trim(r.RazaoSocial),
        emissao: trim(r.Emissao), vencimento: trim(r.Vencimento), venctoReal: trim(r.VenctoReal),
        vencido: trim(r.Vencido), dias: toNumber(r.Dias),
        valor: toNumber(r.Valor), saldo: toNumber(r.Saldo), dtBaixa: trim(r.DtBaixa),
        historico: trim(r.Historico),
        codContabil: trim(r.CodContabil), contaContabil: trim(r.ContaContabil),
        codCusto: trim(r.CodCusto), centroCusto: trim(r.CentroCusto)
      }));

      const totalSaldo = dados.reduce((s, d) => s + d.saldo, 0);
      return res.json({
        periodo: { inicio: dtInicio, fim: dtFim },
        totalRegistros: dados.length,
        totalSaldo: +totalSaldo.toFixed(2),
        geradoEm: new Date().toISOString(),
        dados
      });
    } catch (error) {
      console.error('Erro em financeiro/relatorio-pagar:', error.message);
      if (ehConexao(error)) return res.status(503).json({ message: MSG_INDISPONIVEL });
      return res.status(500).json({ message: 'Erro ao gerar relatório de contas a pagar: ' + error.message });
    }
  }
});
