// resources/users/enviar-codigo-reset.js

const { sendVerificationEmail } = require('../../services/emailService');
const { generateVerificationCode } = require('../../services/verificationService');

module.exports = (app) => ({
    verb: 'post',
    route: '/enviar-codigo-reset',
    anonymous: true,
    handler: async (req, res) => {
      const { Pg } = app.services;
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email é obrigatório' });

      try {
        // CORREÇÃO: Usando Pg.connectAndQuery diretamente
        const userResult = await Pg.connectAndQuery(
          `SELECT ID FROM tab_intranet_usr WHERE EMAIL = @email`,
          { email }
        );

        if (!userResult || userResult.length === 0) {
          return res.status(500).json({ message: 'O e-mail informado não foi encontrado.' });
        }

        const codigo = generateVerificationCode();
        const expireDate = new Date(Date.now() + 15 * 60 * 1000);

        // Postgres não tem MERGE assim — apaga código anterior e insere novo
        // (PK é composta por email+codigo, mas a lógica de negócio é "1 ativo por email")
        await Pg.connectAndQuery(
          `DELETE FROM tab_verificacao_intranet WHERE email = @email`,
          { email }
        );
        await Pg.connectAndQuery(
          `INSERT INTO tab_verificacao_intranet (email, codigo, data_expiracao)
           VALUES (@email, @codigo, @dataExpiracao)`,
          { email, codigo, dataExpiracao: expireDate }
        );
        
        await sendVerificationEmail(email, codigo);
        return res.json({ message: 'Código enviado para o seu e-mail.' });
      } catch (error) {
        console.error("Erro ao enviar código:", error);
        return res.status(500).json({ message: 'Erro no servidor' });
      }
    }
});