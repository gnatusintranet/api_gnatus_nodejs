// Detalhe completo de 1 registro: header + 12 etapas + anexos.
// Inclui o catalogo de etapas (descricao, campos esperados, checklist, etc).

const { ETAPAS } = require('./_etapas');

module.exports = (app) => ({
  verb: 'get',
  route: '/registro/:id',

  handler: async (req, res) => {
    const { Pg } = app.services;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID invalido.' });

    try {
      const headRows = await Pg.connectAndQuery(`
        SELECT r.*, u.nome AS criado_por_nome
          FROM tab_prod_registro r
          LEFT JOIN tab_intranet_usr u ON u.id = r.criado_por
         WHERE r.id = @id`, { id });
      if (!headRows.length) return res.status(404).json({ message: 'Registro nao encontrado.' });

      const etapasRows = await Pg.connectAndQuery(`
        SELECT e.*, u.nome AS responsavel_nome_atual, u.email AS responsavel_email
          FROM tab_prod_registro_etapa e
          LEFT JOIN tab_intranet_usr u ON u.id = e.responsavel_id
         WHERE e.registro_id = @id
         ORDER BY e.etapa_codigo`, { id });

      const anexosRows = await Pg.connectAndQuery(`
        SELECT a.*, u.nome AS enviado_por_nome
          FROM tab_prod_registro_anexo a
          LEFT JOIN tab_intranet_usr u ON u.id = a.enviado_por
         WHERE a.registro_id = @id
         ORDER BY a.enviado_em DESC`, { id });

      // Junta etapa com metadata do catalogo
      const etapas = ETAPAS.map(meta => {
        const e = etapasRows.find(x => x.etapa_codigo === meta.codigo) || null;
        return {
          codigo: meta.codigo,
          nome: meta.nome,
          descricao: meta.descricao,
          camposEsperados: meta.campos,
          checklist: meta.checklist || null,
          armazens: meta.armazens || null,
          dados: e ? {
            id: e.id,
            status: e.status,
            responsavelId: e.responsavel_id,
            responsavelNome: e.responsavel_nome_atual || e.responsavel_nome,
            responsavelEmail: e.responsavel_email,
            dataExecucao: e.data_execucao,
            observacao: e.observacao,
            rncNumero: e.rnc_numero,
            dadosExtras: e.dados_extras || {},
            atualizadoEm: e.atualizado_em
          } : null
        };
      });

      return res.json({
        registro: headRows[0],
        etapas,
        anexos: anexosRows
      });
    } catch (err) {
      console.error('Erro producao/registro:', err);
      return res.status(500).json({ message: 'Erro ao carregar registro: ' + err.message });
    }
  }
});
