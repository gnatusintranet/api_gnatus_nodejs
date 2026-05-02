// Sync em massa: cria registros pra varias OPs de uma vez.
// POST /producao/registros/sync
// Body: { ops: [{ numero, filial, produto, descricao, quantidade, emissao, dataPrev }] }
//   ou: { todas: true, dias: 30, filial: '01' } -> sincroniza tudo que vier de ops-disponiveis
//
// Permissao 14002 (admin).

const trim = (v) => v == null ? null : String(v).trim();
const { ETAPAS } = require('./_etapas');

const checarPerm = async (Pg, idUser) => {
  const r = await Pg.connectAndQuery(
    `SELECT 1 FROM tab_intranet_usr_permissoes WHERE id_user = @id AND id_permissao IN (0, 14002)`,
    { id: idUser }
  );
  return r.length > 0;
};

function parseProtData(s) {
  s = String(s || '').trim();
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

module.exports = (app) => ({
  verb: 'post',
  route: '/registros/sync',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Nao autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) return res.status(403).json({ message: 'Sem permissao (14002).' });

    let ops = Array.isArray(req.body?.ops) ? req.body.ops : null;

    // Modo "todas": busca OPs disponiveis no Protheus
    if (req.body?.todas === true && !ops) {
      const dias = Math.min(Math.max(Number(req.body.dias || 30), 1), 365);
      const filial = trim(req.body.filial) || '01';
      const dt = new Date();
      dt.setDate(dt.getDate() - dias);
      const cutoff = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;

      const r = await Protheus.connectAndQuery(`
        SELECT RTRIM(c2.C2_NUM) numero, RTRIM(c2.C2_FILIAL) filial,
               RTRIM(c2.C2_PRODUTO) produto, RTRIM(sb1.B1_DESC) descricao,
               c2.C2_QUANT quantidade, c2.C2_EMISSAO emissao, c2.C2_DATPRF dataPrev
          FROM SC2010 c2 WITH (NOLOCK)
          LEFT JOIN SB1010 sb1 WITH (NOLOCK)
            ON sb1.B1_COD = c2.C2_PRODUTO AND sb1.D_E_L_E_T_ <> '*'
         WHERE c2.D_E_L_E_T_ <> '*'
           AND RTRIM(c2.C2_FILIAL) = @filial
           AND RTRIM(c2.C2_DATRF) = ''
           AND c2.C2_QUANT > c2.C2_QUJE
           AND c2.C2_EMISSAO >= @cutoff`,
        { filial, cutoff }
      );
      ops = r.map(o => ({
        numero: trim(o.numero), filial: trim(o.filial),
        produto: trim(o.produto), descricao: trim(o.descricao || ''),
        quantidade: Number(o.quantidade || 0),
        emissao: trim(o.emissao), dataPrev: trim(o.dataPrev)
      }));
    }

    if (!Array.isArray(ops) || !ops.length) {
      return res.status(400).json({ message: 'Forneca ops:[] ou todas:true.' });
    }

    let inseridos = 0, ignorados = 0;
    const erros = [];

    for (const op of ops) {
      const numero = trim(op.numero);
      const filial = trim(op.filial) || '01';
      if (!numero) { erros.push({ op, motivo: 'numero ausente' }); continue; }

      try {
        // Idempotencia: se ja existe, ignora
        const ex = await Pg.connectAndQuery(
          `SELECT id FROM tab_prod_registro WHERE op_filial = @f AND op_protheus = @op`,
          { f: filial, op: numero }
        );
        if (ex.length) { ignorados++; continue; }

        const ins = await Pg.connectAndQuery(`
          INSERT INTO tab_prod_registro
            (op_protheus, op_filial, produto_codigo, produto_descricao, quantidade,
             data_inicio_prev, data_termino_prev, criado_por, origem)
          VALUES (@op, @f, @prod, @desc, @qtd, @dini, @dterm, @uid, 'sync_protheus')
          RETURNING id`,
          {
            op: numero, f: filial,
            prod: trim(op.produto), desc: trim(op.descricao || ''),
            qtd: Number(op.quantidade || 0),
            dini: parseProtData(op.emissao),
            dterm: parseProtData(op.dataPrev),
            uid: user.ID
          }
        );
        const rid = ins[0].id;

        // Cria as 12 etapas
        for (const e of ETAPAS) {
          await Pg.connectAndQuery(
            `INSERT INTO tab_prod_registro_etapa (registro_id, etapa_codigo, etapa_nome, status)
             VALUES (@rid, @cod, @nome, 'pendente')`,
            { rid, cod: e.codigo, nome: e.nome }
          );
        }
        inseridos++;
      } catch (e) {
        erros.push({ op: numero, motivo: e.message });
      }
    }

    return res.json({ ok: true, inseridos, ignorados, totalEntrada: ops.length, erros });
  }
});
