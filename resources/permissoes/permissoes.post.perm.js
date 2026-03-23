module.exports = app => ({
  verb: 'post',
  route: '/add/permissao',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const newPerm = req.body || {};

    const norm = v =>
      (v === undefined || v === null)
        ? ''
        : String(v).replace(/'/g, "''");

    if (!newPerm.ID_PERMISSAO
      || !newPerm.NOME
      || !newPerm.MODULO
    ) {
      return res.status(400).json({ message: 'Ocorreu um erro ao criar permissão. Tente novamente mais tarde.' });
    }

    try {
      const query = `
        BEGIN TRANSACTION;

        INSERT INTO TAB_INTRANET_PERMISSOES
        (
          ID_PERMISSAO,
          NOME,
          MODULO
        )
        VALUES
        (
          ${newPerm.ID_PERMISSAO},
          '${norm(newPerm.NOME)}',
          '${norm(newPerm.MODULO)}'
        );

        DECLARE @NEW_ID INT = SCOPE_IDENTITY();

        COMMIT TRANSACTION;

        SELECT @NEW_ID AS ID;
      `;

      const result = await Mssql.connectAndQuery(query);

      const idnewPerm =
        Array.isArray(result) && result.length > 0 && result[0].ID
          ? result[0].ID
          : (result?.recordset?.[0]?.ID ?? null);

      return res.status(201).json({
        message: 'Permissão criada com sucesso!',
        id: idnewPerm
      });

    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
});