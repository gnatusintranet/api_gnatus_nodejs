// resources/users/redefinir-senha-com-codigo.js
const bcrypt = require('bcryptjs');

module.exports = (app) => ({
    verb: 'post',
    route: '/redefinir-senha-com-codigo',
    anonymous: true,
    handler: async (req, res) => {
        const { Pg } = app.services;
        const { email, codigo, novaSenha } = req.body;
        if (!email || !codigo || !novaSenha) return res.status(400).json({ message: 'Todos os campos são obrigatórios' });

        try {
            // CORREÇÃO: Usando Pg.connectAndQuery diretamente
            const codeResult = await Pg.connectAndQuery(
                `SELECT Codigo, DataExpiracao FROM tab_verificacao_intranet WHERE Email = @email`,
                { email }
            );

            if (codeResult.length === 0 || codeResult[0].Codigo !== codigo || new Date() > new Date(codeResult[0].DataExpiracao)) {
                return res.status(400).json({ message: 'Código inválido ou expirado. Por favor, solicite um novo.' });
            }

            const senhaHash = bcrypt.hashSync(novaSenha, 10);

            await Pg.connectAndQuery(
                `UPDATE tab_intranet_usr SET SENHA = @senha WHERE EMAIL = @email AND ativo = true`,
                { senha: senhaHash, email }
            );

            await Pg.connectAndQuery(
                `DELETE FROM tab_verificacao_intranet WHERE Email = @email`,
                { email }
            );

            return res.json({ message: 'Senha atualizada com sucesso!' });
        } catch (error) {
            console.error("Erro ao redefinir senha:", error);
            return res.status(500).json({ message: 'Erro ao atualizar senha' });
        }
    }
});