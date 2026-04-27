module.exports = app => ({
    verb: 'get',
    route: '/permissoes/:ID_USER',

    handler: async (req, res) => {
        const id = Number(req.params.ID_USER);
        if (!id || isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

        const { Pg } = app.services;
        try {
            const data = await Pg.connectAndQuery(`
                SELECT P.id,
                       P.id_permissao,
                       P.nome,
                       P.modulo,
                       CASE WHEN UP.id_permissao IS NULL THEN 0 ELSE 1 END AS assigned
                  FROM tab_intranet_permissoes P
                  LEFT JOIN tab_intranet_usr_permissoes UP
                    ON UP.id_permissao = P.id_permissao
                   AND UP.id_user = @id
                 ORDER BY P.modulo, P.nome
            `, { id });

            return res.json(data);
        } catch (error) {
            console.error('Erro listar permissoes do user:', error);
            return res.status(500).json({ message: error.message });
        }
    }
});
