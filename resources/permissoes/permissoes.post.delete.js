module.exports = app => ({
  verb: "post",
  route: "/delete/:ID",

 handler: async (req, res) => {
    const { Mssql } = app.services;
    const { ID } = req.params;

    const id = parseInt(ID, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ message: "ID inválido ou não informado." });
    }

    try {
      const result = await Mssql.connectAndQuery(
        `DELETE FROM TAB_INTRANET_PERMISSOES WHERE ID = @id`,
        { id }
      );
      if (result && result.rowsAffected && result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: "Permissão não encontrada." });
      }

      return res.status(200).json({ message: "Permissão excluída com sucesso." });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
});
