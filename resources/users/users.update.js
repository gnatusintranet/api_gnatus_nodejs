const bcrypt = require('bcryptjs');

module.exports = (app) => ({
  verb: 'post',
  route: '/:id/update',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

    const { nome, email, senha, matricula, ativo } = req.body || {};
    if (!nome || !email || !matricula) {
      return res.status(400).json({ message: 'Nome, email e matrícula são obrigatórios.' });
    }

    try {
      // Checa se o e-mail não colide com outro usuário
      const duplicado = await Mssql.connectAndQuery(
        `SELECT ID FROM TAB_INTRANET_USR WHERE EMAIL = @email AND ID <> @id`,
        { email, id }
      );
      if (duplicado.length > 0) {
        return res.status(409).json({ message: 'Já existe outro usuário com este e-mail.' });
      }

      const ativoFlag = ativo === false ? 0 : 1;

      if (senha && String(senha).length >= 6) {
        const senhaHash = bcrypt.hashSync(String(senha), 10);
        await Mssql.connectAndQuery(
          `UPDATE TAB_INTRANET_USR
           SET NOME = @nome, EMAIL = @email, SENHA = @senha, MATRICULA = @matricula, ATIVO = @ativo
           WHERE ID = @id`,
          { id, nome, email, senha: senhaHash, matricula, ativo: ativoFlag }
        );
      } else {
        await Mssql.connectAndQuery(
          `UPDATE TAB_INTRANET_USR
           SET NOME = @nome, EMAIL = @email, MATRICULA = @matricula, ATIVO = @ativo
           WHERE ID = @id`,
          { id, nome, email, matricula, ativo: ativoFlag }
        );
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      return res.status(500).json({ message: 'Erro ao atualizar usuário.' });
    }
  }
});
