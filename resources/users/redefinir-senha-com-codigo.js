// resources/users/redefinir-senha-com-codigo.js
const bcrypt = require('bcryptjs');

module.exports = (app) => ({
    verb: 'post',
    route: '/redefinir-senha-com-codigo',
    anonymous: true,
    handler: async (req, res) => {
        const { Mssql } = app.services;
        const { email, codigo, novaSenha } = req.body;
        if (!email || !codigo || !novaSenha) return res.status(400).json({ message: 'Todos os campos são obrigatórios' });

        try {
            // CORREÇÃO: Usando Mssql.connectAndQuery diretamente
            const codeResult = await Mssql.connectAndQuery(
                `SELECT Codigo, DataExpiracao FROM TAB_VERIFICACAO_INTRANET WHERE Email = @email`,
                { email }
            );

            if (codeResult.length === 0 || codeResult[0].Codigo !== codigo || new Date() > new Date(codeResult[0].DataExpiracao)) {
                return res.status(400).json({ message: 'Código inválido ou expirado. Por favor, solicite um novo.' });
            }

            const senhaHash = bcrypt.hashSync(novaSenha, 10);

            await Mssql.connectAndQuery(
                `UPDATE TAB_INTRANET_USR SET SENHA = @senha WHERE EMAIL = @email AND ATIVO = 1`,
                { senha: senhaHash, email }
            );

            await Mssql.connectAndQuery(
                `DELETE FROM TAB_VERIFICACAO_INTRANET WHERE Email = @email`,
                { email }
            );

            return res.json({ message: 'Senha atualizada com sucesso!' });
        } catch (error) {
            console.error("Erro ao redefinir senha:", error);
            return res.status(500).json({ message: 'Erro ao atualizar senha' });
        }
    }
});