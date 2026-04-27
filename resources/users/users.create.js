const bcrypt = require('bcryptjs');

module.exports = (app) => ({
  verb: 'post',
  route: '/create',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;
    const { nome, email, senha, matricula, ativo, codigoProtheus, ramal } = req.body || {};

    if (!nome || !email || !senha || !matricula) {
      return res.status(400).json({ message: 'Nome, email, senha e matrícula são obrigatórios.' });
    }
    if (String(senha).length < 6) {
      return res.status(400).json({ message: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    // Valida código Protheus se fornecido — deve existir em SYS_USR
    const codProth = String(codigoProtheus || '').trim();
    if (codProth) {
      try {
        const v = await Protheus.connectAndQuery(
          `SELECT TOP 1 USR_ID FROM SYS_USR WHERE USR_ID = @cod`,
          { cod: codProth }
        );
        if (!v.length) return res.status(400).json({ message: `Código Protheus '${codProth}' não encontrado em SYS_USR.` });
      } catch (e) { console.warn('Não foi possível validar código Protheus:', e.message); }
    }

    try {
      const existente = await Pg.connectAndQuery(
        `SELECT ID, ATIVO FROM tab_intranet_usr WHERE EMAIL = @email`,
        { email }
      );
      if (existente.length > 0) {
        const inativo = !existente[0].ATIVO;
        return res.status(409).json({
          message: inativo
            ? `Já existe usuário com este e-mail (atualmente DESATIVADO). Localize-o na lista e clique em "Ativar".`
            : `Já existe um usuário ativo com este e-mail.`,
          existeId: existente[0].ID,
          existeAtivo: !inativo
        });
      }

      const senhaHash = bcrypt.hashSync(String(senha), 10);
      const ativoFlag = ativo === false ? false : true;

      const ramalTrim = String(ramal || '').trim().slice(0, 8) || null;

      const result = await Pg.connectAndQuery(
        `INSERT INTO tab_intranet_usr (nome, email, senha, matricula, ativo, codigo_protheus, ramal)
         VALUES (@nome, @email, @senha, @matricula, @ativo, @codProth, @ramal)
         RETURNING id`,
        { nome, email, senha: senhaHash, matricula, ativo: ativoFlag, codProth: codProth || null, ramal: ramalTrim }
      );

      return res.status(201).json({ ok: true, id: result[0]?.id });
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      return res.status(500).json({ message: 'Erro ao criar usuário.' });
    }
  }
});
