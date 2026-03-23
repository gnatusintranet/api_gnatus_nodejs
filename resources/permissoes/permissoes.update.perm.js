module.exports = app => ({
  verb: "post",
  route: "/edit/:ID",

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const { ID } = req.params;
    const permissao = req.body || {};


    const norm = v =>
      (v === undefined || v === null)
        ? ''
        : String(v).replace(/'/g, "''");

    if (!permissao.ID_PERMISSAO
      || !permissao.NOME
      || !permissao.MODULO
    ) {
      return res.status(400).json({ message: 'Ocorreu um erro ao atualizar permissão. Tente novamente mais tarde.' });
    }


    try {       
      await Mssql.connectAndQuery(
        `
      UPDATE TAB_INTRANET_PERMISSOES
      SET
      [ID_PERMISSAO]  = ${permissao.ID_PERMISSAO},
      [NOME] = '${norm(permissao.NOME)}',
      [MODULO] = '${norm(permissao.MODULO)}'

      WHERE [ID] = ${ID}
    `
      );
      return res.status(200).json({ message: 'Permissão atualizada com sucesso' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
});