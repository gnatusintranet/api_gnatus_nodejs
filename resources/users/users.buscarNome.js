module.exports = app => ({
  verb: 'get',
  route: '/nomeUser',
  //anonymous: true,
  handler: async (req, res) => {
    const { Mssql } = app.services;

    if (!req.user || !Array.isArray(req.user) || req.user.length === 0) {
        console.error("Erro: req.user não está no formato esperado:", req.user);
        return res.status(401).json({ message: "Usuário não autenticado ou dados inválidos." });
    }

    try {
        const userId = req.user[0].ID;
        
        console.log(userId)

        const sql = `
            SELECT NOME, MATRICULA 
            FROM TAB_INTRANET_USR 
            WHERE ATIVO = 1 AND ID = ${userId}
        `;

        const data = await Mssql.connectAndQuery(sql); 
      
        if (data && data.length > 0) {
            return res.json(data[0]);
        } else {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }
    } catch (error) {
        console.error("Erro ao buscar dados do usuário na rota /nomeUser:", error);
        return res.status(500).json({ message: "Erro interno do servidor ao buscar dados do usuário." });
    }
  }
});