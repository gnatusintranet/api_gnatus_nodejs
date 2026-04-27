// Lista os últimos termos de equipamento emitidos para um colaborador.
// Filtra por matrícula OU documento (CPF/CNPJ).

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
  verb: 'get',
  route: '/termo-historico',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) {
      return res.status(403).json({ message: 'Sem permissão (1027).' });
    }

    const matricula = trim(req.query.matricula);
    const documento = trim(req.query.documento);
    if (!matricula && !documento) {
      return res.status(400).json({ message: 'Informe matricula ou documento.' });
    }

    try {
      const where = [];
      const params = {};
      if (matricula) { where.push('matricula_protheus = @mat'); params.mat = matricula; }
      if (documento) { where.push('documento = @doc'); params.doc = documento; }

      const r = await Pg.connectAndQuery(
        `SELECT t.id, t.modo, t.matricula_protheus, t.nome, t.documento, t.cargo,
                t.marca, t.modelo, t.cor, t.novo, t.acessorios, t.condicoes,
                t.cidade, t.data_termo, t.criado_em,
                u.nome emissor_nome, u.email emissor_email
           FROM tab_termo_equipamento t
           LEFT JOIN tab_intranet_usr u ON u.id = t.id_emissor
          WHERE ${where.join(' OR ')}
          ORDER BY t.criado_em DESC
          LIMIT 50`,
        params
      );

      return res.json({
        total: r.length,
        historico: r.map(x => ({
          id: x.id,
          modo: x.modo,
          matriculaProtheus: x.matricula_protheus,
          nome: x.nome,
          documento: x.documento,
          cargo: x.cargo,
          equipamento: {
            marca: x.marca, modelo: x.modelo, cor: x.cor,
            novo: x.novo, acessorios: x.acessorios, condicoes: x.condicoes
          },
          cidade: x.cidade,
          dataTermo: x.data_termo,
          criadoEm: x.criado_em,
          emissor: { nome: x.emissor_nome, email: x.emissor_email }
        }))
      });
    } catch (err) {
      console.error('Erro histórico termo:', err);
      return res.status(500).json({ message: 'Erro ao consultar histórico: ' + err.message });
    }
  }
});
