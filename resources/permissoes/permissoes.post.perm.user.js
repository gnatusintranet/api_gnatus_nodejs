module.exports = app => ({
  verb: 'post',
  route: '/permissoes/toggle',
  handler: async (req, res) => {
    const { Mssql } = app.services;
    const { ID_USER, ID_PERMISSAO, MATRICULA, ASSIGNED } = req.body;

    const idUser = Number(ID_USER);
    const idPerm = Number(ID_PERMISSAO);
    const assigned = Number(ASSIGNED);

    if (ID_USER == null || ID_PERMISSAO == null || MATRICULA == null || (assigned !== 0 && assigned !== 1)) {
      return res.status(400).json({ message: 'Ocorreu um erro ao atualizar permissões. Tente novamente mais tarde.' });
    }
    try {
      let query = `
        BEGIN TRANSACTION;
        IF (${assigned}) = 1
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM TAB_INTRANET_USR_PERMISSOES WITH (NOLOCK)
            WHERE ID_USER = ${idUser} AND ID_PERMISSAO = ${idPerm} AND MATRICULA = '${MATRICULA}'
          )
          BEGIN
            INSERT INTO TAB_INTRANET_USR_PERMISSOES (ID_USER, ID_PERMISSAO, MATRICULA)
            VALUES (${idUser}, ${idPerm}, '${MATRICULA}');
          END
        END
        ELSE
        BEGIN
          DELETE FROM TAB_INTRANET_USR_PERMISSOES
          WHERE ID_USER = ${idUser} AND ID_PERMISSAO = ${idPerm} AND MATRICULA = '${MATRICULA}';
        END
        COMMIT TRANSACTION;
      `;

      await Mssql.connectAndQuery(query);
      return res.status(200).json({
        message: 'Permissões atualizada com sucesso.',
        ID_USER: idUser,
        ID_PERMISSAO: idPerm,
        MATRICULA: MATRICULA,
        ASSIGNED: assigned
      });

    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
});
