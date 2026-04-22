// Limpa o bordero inteiro
module.exports = (app) => ({
  verb: 'delete',
  route: '/bordero',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    try {
      await Mssql.connectAndQuery(`DELETE FROM TAB_EXP_BORDERO`, {});
      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro expedicao/bordero-clear:', err);
      return res.status(500).json({ message: 'Erro ao limpar bordero.' });
    }
  }
});
