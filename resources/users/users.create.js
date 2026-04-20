const bcrypt = require('bcryptjs');

module.exports = (app) => ({
  verb: 'post',
  route: '/create',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const { nome, email, senha, matricula, ativo } = req.body || {};

    if (!nome || !email || !senha || !matricula) {
      return res.status(400).json({ message: 'Nome, email, senha e matrícula são obrigatórios.' });
    }
    if (String(senha).length < 6) {
      return res.status(400).json({ message: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    try {
      // Checa e-mail duplicado
      const existente = await Mssql.connectAndQuery(
        `SELECT ID FROM TAB_INTRANET_USR WHERE EMAIL = @email`,
        { email }
      );
      if (existente.length > 0) {
        return res.status(409).json({ message: 'Já existe um usuário com este e-mail.' });
      }

      const senhaHash = bcrypt.hashSync(String(senha), 10);
      const ativoFlag = ativo === false ? 0 : 1;

      const result = await Mssql.connectAndQuery(
        `INSERT INTO TAB_INTRANET_USR (NOME, EMAIL, SENHA, MATRICULA, ATIVO)
         OUTPUT INSERTED.ID
         VALUES (@nome, @email, @senha, @matricula, @ativo)`,
        { nome, email, senha: senhaHash, matricula, ativo: ativoFlag }
      );

      return res.status(201).json({ ok: true, id: result[0]?.ID });
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      return res.status(500).json({ message: 'Erro ao criar usuário.' });
    }
  }
});
