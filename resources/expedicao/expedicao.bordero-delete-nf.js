// Remove todas as linhas de uma NF do bordero
const trim = (v) => String(v || '').trim();

module.exports = (app) => ({
  verb: 'delete',
  route: '/bordero/nf/:nfe',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const nfe = trim(req.params.nfe).toUpperCase();
    if (!nfe) return res.status(400).json({ message: 'NFe é obrigatória.' });
    try {
      await Mssql.connectAndQuery(
        `DELETE FROM TAB_EXP_BORDERO WHERE NOTAFISCAL = @nfe`, { nfe }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro expedicao/bordero-delete-nf:', err);
      return res.status(500).json({ message: 'Erro ao remover NF do bordero.' });
    }
  }
});
