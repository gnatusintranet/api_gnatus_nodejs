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


    const id = parseInt(ID, 10);
    const idPermissao = parseInt(permissao.ID_PERMISSAO, 10);
    if (isNaN(id) || isNaN(idPermissao)) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    try {
      await Mssql.connectAndQuery(
        `UPDATE TAB_INTRANET_PERMISSOES
         SET [ID_PERMISSAO] = @idPermissao, [NOME] = @nome, [MODULO] = @modulo
         WHERE [ID] = @id`,
        { id, idPermissao, nome: permissao.NOME, modulo: permissao.MODULO }
      );
      return res.status(200).json({ message: 'Permissão atualizada com sucesso' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
});