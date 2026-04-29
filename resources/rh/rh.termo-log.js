// Salva log de termo de responsabilidade emitido em tab_termo_equipamento.
// Não bloqueia o fluxo principal — termo continua sendo gerado via window.print().

const trim = (v) => String(v || '').trim();

const checarPerm = async (Pg, idUser) => {
  const r = await Pg.connectAndQuery(
    `SELECT id_permissao FROM tab_intranet_usr_permissoes
      WHERE id_user = @id AND id_permissao IN (0, 1027)`,
    { id: idUser }
  );
  return r.length > 0;
};

module.exports = (app) => ({
  verb: 'post',
  route: '/termo-log',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) {
      return res.status(403).json({ message: 'Sem permissão (1027).' });
    }

    const b = req.body || {};
    const modo = (trim(b.modo) || 'CLT').toUpperCase().slice(0, 3);
    const nome = trim(b.nome);
    const documento = trim(b.documento);
    if (!nome || !documento) {
      return res.status(400).json({ message: 'Nome e documento são obrigatórios.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';

    const dataTermo = trim(b.dataTermo) || new Date().toISOString().slice(0, 10);
    const params = {
      uid: user.ID, modo,
      mat: trim(b.matriculaProtheus) || null,
      nome, doc: documento,
      cargo: trim(b.cargo) || null,
      marca: trim(b.marca) || null,
      modelo: trim(b.modelo) || null,
      cor: trim(b.cor) || null,
      novo: typeof b.novo === 'boolean' ? b.novo : null,
      acess: trim(b.acessorios) || null,
      cond: trim(b.condicoes) || null,
      cidade: trim(b.cidade) || null,
      dt: dataTermo,
      ip
    };

    try {
      const r = await Pg.connectAndQuery(
        `INSERT INTO tab_termo_equipamento
           (id_emissor, modo, matricula_protheus, nome, documento, cargo,
            marca, modelo, cor, novo, acessorios, condicoes,
            cidade, data_termo, ip_origem)
         VALUES
           (@uid, @modo, @mat, @nome, @doc, @cargo,
            @marca, @modelo, @cor, @novo, @acess, @cond,
            @cidade, @dt, @ip)
         RETURNING id, criado_em`,
        params
      );
      const idTermo = r[0]?.id;

      // Tambem registra como equipamento ATIVO em poder do colaborador
      // (so se tem equipamento minimo: marca ou modelo). Permite controle
      // de tempo de uso e historico de defeitos. Idempotente — checa se ja
      // existe registro pra esse termo.
      let idEquipamento = null;
      if (idTermo && (params.marca || params.modelo)) {
        try {
          const eq = await Pg.connectAndQuery(
            `INSERT INTO tab_equipamento_atual (
               documento, nome, matricula_protheus, cargo,
               marca, modelo, cor, novo, acessorios, condicoes,
               data_entrega, status, id_termo_origem, registrado_por
             ) VALUES (
               @doc, @nome, @mat, @cargo,
               @marca, @modelo, @cor, @novo, @acess, @cond,
               @dt, 'ATIVO', @idTermo, @uid
             )
             ON CONFLICT DO NOTHING
             RETURNING id`,
            { ...params, idTermo }
          );
          idEquipamento = eq[0]?.id || null;
        } catch (e) {
          console.warn('Termo salvo, mas falhou registrar equipamento atual:', e.message);
        }
      }

      return res.json({ ok: true, id: idTermo, criadoEm: r[0]?.criado_em, idEquipamento });
    } catch (err) {
      console.error('Erro salvar termo log:', err);
      return res.status(500).json({ message: 'Erro ao salvar log: ' + err.message });
    }
  }
});
