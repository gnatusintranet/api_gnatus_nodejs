// resources/users/enviar-codigo-reset.js

const { sendVerificationEmail } = require('../../services/emailService');
const { generateVerificationCode } = require('../../services/verificationService');

module.exports = (app) => ({
    verb: 'post',
    route: '/enviar-codigo-reset',
    anonymous: true,
    handler: async (req, res) => {
      const { Mssql } = app.services;
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email é obrigatório' });

      try {
        // CORREÇÃO: Usando Mssql.connectAndQuery diretamente
        const userResult = await Mssql.connectAndQuery(
          `SELECT ID FROM TAB_INTRANET_USR WHERE EMAIL = @email`,
          { email }
        );

        if (!userResult || userResult.length === 0) {
          return res.status(500).json({ message: 'O e-mail informado não foi encontrado.' });
        }

        const codigo = generateVerificationCode();
        const expireDate = new Date(Date.now() + 15 * 60 * 1000);

        await Mssql.connectAndQuery(`
          MERGE TAB_VERIFICACAO_INTRANET AS target
          USING (SELECT @email AS Email) AS source
          ON (target.Email = source.Email)
          WHEN MATCHED THEN
            UPDATE SET Codigo = @codigo, DataExpiracao = @dataExpiracao
          WHEN NOT MATCHED THEN
            INSERT (Email, Codigo, DataExpiracao) VALUES (@email, @codigo, @dataExpiracao);
        `, { email, codigo, dataExpiracao: expireDate });
        
        await sendVerificationEmail(email, codigo);
        return res.json({ message: 'Código enviado para o seu e-mail.' });
      } catch (error) {
        console.error("Erro ao enviar código:", error);
        return res.status(500).json({ message: 'Erro no servidor' });
      }
    }
});