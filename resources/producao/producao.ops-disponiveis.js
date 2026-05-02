// Lista OPs abertas no Protheus (SC2) que AINDA NAO tem registro na intranet.
// GET /producao/ops-disponiveis?dias=30&filial=01
//
// Filtros:
//   - SC2.D_E_L_E_T_ <> '*'
//   - C2_DATRF = '' (OP nao encerrada)
//   - C2_QUANT > C2_QUJE (nao totalmente produzida)
//   - C2_EMISSAO nos ultimos N dias

const trim = (v) => v == null ? null : String(v).trim();

module.exports = (app) => ({
  verb: 'get',
  route: '/ops-disponiveis',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;

    const dias = Math.min(Math.max(Number(req.query.dias || 30), 1), 365);
    const filial = trim(req.query.filial) || '01';

    // Calcula data de corte no formato YYYYMMDD
    const dt = new Date();
    dt.setDate(dt.getDate() - dias);
    const cutoff = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;

    try {
      // Pega OPs abertas no Protheus
      const opsProtheus = await Protheus.connectAndQuery(`
        SELECT RTRIM(c2.C2_NUM)     numero,
               RTRIM(c2.C2_FILIAL)  filial,
               RTRIM(c2.C2_PRODUTO) produto,
               RTRIM(sb1.B1_DESC)   descricao,
               c2.C2_QUANT          quantidade,
               c2.C2_QUJE           jaProduzido,
               c2.C2_EMISSAO        emissao,
               c2.C2_DATPRF         dataPrev
          FROM SC2010 c2 WITH (NOLOCK)
          LEFT JOIN SB1010 sb1 WITH (NOLOCK)
            ON sb1.B1_COD = c2.C2_PRODUTO AND sb1.D_E_L_E_T_ <> '*'
         WHERE c2.D_E_L_E_T_ <> '*'
           AND RTRIM(c2.C2_FILIAL) = @filial
           AND RTRIM(c2.C2_DATRF) = ''
           AND c2.C2_QUANT > c2.C2_QUJE
           AND c2.C2_EMISSAO >= @cutoff
         ORDER BY c2.C2_EMISSAO DESC, c2.C2_NUM DESC`,
        { filial, cutoff }
      );

      if (!opsProtheus.length) {
        return res.json({ filial, dias, total: 0, ops: [] });
      }

      // Pega os numeros que ja tem registro na intranet
      const nums = opsProtheus.map(o => trim(o.numero));
      const params = { filial };
      const placeholders = nums.map((_, i) => { params[`n${i}`] = nums[i]; return `@n${i}`; }).join(',');
      const jaExistem = await Pg.connectAndQuery(
        `SELECT op_protheus FROM tab_prod_registro WHERE op_filial = @filial AND op_protheus IN (${placeholders})`,
        params
      );
      const setExistentes = new Set(jaExistem.map(r => r.op_protheus));

      // Filtra so as que ainda nao foram criadas
      const disponiveis = opsProtheus
        .filter(o => !setExistentes.has(trim(o.numero)))
        .map(o => ({
          numero: trim(o.numero),
          filial: trim(o.filial),
          produto: trim(o.produto),
          descricao: trim(o.descricao || ''),
          quantidade: Number(o.quantidade || 0),
          jaProduzido: Number(o.jaProduzido || 0),
          emissao: trim(o.emissao),
          dataPrev: trim(o.dataPrev)
        }));

      return res.json({
        filial, dias,
        totalProtheus: opsProtheus.length,
        jaCriadas: setExistentes.size,
        total: disponiveis.length,
        ops: disponiveis
      });
    } catch (err) {
      console.error('Erro producao/ops-disponiveis:', err);
      return res.status(500).json({ message: 'Erro ao listar OPs: ' + err.message });
    }
  }
});
