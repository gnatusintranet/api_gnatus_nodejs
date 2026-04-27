module.exports = app => ({
  verb: 'post',
  route: '/permissoes/toggle',
  handler: async (req, res) => {
    const { Pg } = app.services;
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
            FROM tab_intranet_usr_permissoes WITH (NOLOCK)
            WHERE ID_USER = ${idUser} AND ID_PERMISSAO = ${idPerm} AND MATRICULA = @matricula
          )
          BEGIN
            INSERT INTO tab_intranet_usr_permissoes (ID_USER, ID_PERMISSAO, MATRICULA)
            VALUES (${idUser}, ${idPerm}, @matricula);
          END
        END
        ELSE
        BEGIN
          DELETE FROM tab_intranet_usr_permissoes
          WHERE ID_USER = ${idUser} AND ID_PERMISSAO = ${idPerm} AND MATRICULA = @matricula;
        END
        COMMIT TRANSACTION;
      `;

      await Pg.connectAndQuery(query, { matricula: MATRICULA });
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
