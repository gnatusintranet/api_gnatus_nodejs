// Cria um novo registro a partir de uma OP do Protheus.
// Body: { op: '00875601001', filial?: '01', numerosSerie?: ['0000000004'] }
//
// Busca a OP em SC2010 (cabecalho) + SB1010 (descricao do produto).
// Se ja existir registro pra essa (filial, op), retorna 409.

const trim = (v) => String(v || '').trim();
const { ETAPAS } = require('./_etapas');

const checarPerm = async (Pg, idUser, perm) => {
  const r = await Pg.connectAndQuery(
    `SELECT 1 FROM tab_intranet_usr_permissoes WHERE id_user = @id AND id_permissao IN (0, @perm)`,
    { id: idUser, perm }
  );
  return r.length > 0;
};

module.exports = (app) => ({
  verb: 'post',
  route: '/registro',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await checarPerm(Pg, user.ID, 14001))) {
      return res.status(403).json({ message: 'Sem permissao (14001).' });
    }

    const op = trim(req.body?.op);
    const filial = trim(req.body?.filial) || '01';
    const series = Array.isArray(req.body?.numerosSerie)
      ? req.body.numerosSerie.map(s => trim(s)).filter(Boolean)
      : [];

    if (!op) return res.status(400).json({ message: 'Parametro op obrigatorio.' });

    try {
      // Busca dados da OP no Protheus
      const sc2 = await Protheus.connectAndQuery(`
        SELECT TOP 1
               RTRIM(c2.C2_NUM)     numero,
               RTRIM(c2.C2_FILIAL)  filial,
               RTRIM(c2.C2_PRODUTO) produto,
               RTRIM(sb1.B1_DESC)   descricao,
               c2.C2_QUANT          quantidade,
               c2.C2_QUJE           jaProduzido,
               c2.C2_EMISSAO        emissao,
               c2.C2_DATPRF         dataPrev,
               c2.C2_DATRF          dataFim
          FROM SC2010 c2 WITH (NOLOCK)
          LEFT JOIN SB1010 sb1 WITH (NOLOCK)
            ON sb1.B1_COD = c2.C2_PRODUTO AND sb1.D_E_L_E_T_ <> '*'
         WHERE c2.D_E_L_E_T_ <> '*'
           AND RTRIM(c2.C2_FILIAL) = @filial
           AND RTRIM(c2.C2_NUM)    = @op
      `, { op, filial });

      if (!sc2.length) {
        return res.status(404).json({ message: `OP ${op} (filial ${filial}) nao encontrada no Protheus.` });
      }

      const op0 = sc2[0];

      // Verifica se ja existe registro
      const ex = await Pg.connectAndQuery(
        `SELECT id FROM tab_prod_registro WHERE op_filial = @f AND op_protheus = @op`,
        { f: trim(op0.filial), op: trim(op0.numero) }
      );
      if (ex.length) {
        return res.status(409).json({ message: `Ja existe registro pra essa OP (id=${ex[0].id}).`, registroId: ex[0].id });
      }

      // Cria header
      const ins = await Pg.connectAndQuery(`
        INSERT INTO tab_prod_registro
          (op_protheus, op_filial, produto_codigo, produto_descricao, quantidade,
           numeros_serie, data_inicio_prev, data_termino_prev, criado_por, origem)
        VALUES
          (@op, @f, @prod, @desc, @qtd, @ns, @dini, @dterm, @uid, 'manual')
        RETURNING id`,
        {
          op: trim(op0.numero), f: trim(op0.filial),
          prod: trim(op0.produto), desc: trim(op0.descricao || ''),
          qtd: Number(op0.quantidade || 0),
          ns: series.length ? series : null,
          dini: parseProtData(op0.emissao),
          dterm: parseProtData(op0.dataPrev),
          uid: user.ID
        }
      );

      const registroId = ins[0].id;

      // Cria as 12 etapas em estado pendente
      for (const e of ETAPAS) {
        await Pg.connectAndQuery(`
          INSERT INTO tab_prod_registro_etapa (registro_id, etapa_codigo, etapa_nome, status)
          VALUES (@rid, @cod, @nome, 'pendente')`,
          { rid: registroId, cod: e.codigo, nome: e.nome }
        );
      }

      return res.json({ ok: true, id: registroId });
    } catch (err) {
      console.error('Erro producao/registro POST:', err);
      return res.status(500).json({ message: 'Erro ao criar registro: ' + err.message });
    }
  }
});

// Protheus retorna data como 'YYYYMMDD' (8 chars) ou vazio
function parseProtData(s) {
  s = String(s || '').trim();
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}
