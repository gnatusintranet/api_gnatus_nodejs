const bcrypt = require('bcryptjs');

module.exports = (app) => ({
  verb: "post",
  route: "/login",
  anonymous: true,

  handler: async (req, res) => {
    const { Mssql, Jwt } = app.services;

    let { email, senha } = req.body;

    const tableName = "TAB_INTRANET_USR"; 
    const fields = ["ID", "NOME", "EMAIL", "SENHA", "ATIVO"]; 

    try {
      const user = await getUserByEmail(Mssql, tableName, fields, email);
      
      if (!user)
        return res.status(400).json({ message: "Usuário não encontrado" });
      
      const senhaHash = bcrypt.compareSync(senha, user.SENHA);
      
      if (!senhaHash)
        return res.status(400).json({ message: "Senha inválida" });
      
      const token = Jwt.generate({ id: user.ID, type: 'usuario' });
      
      
      return res.json({ token }); // Apenas retorna o token
    } catch (error) {
      console.error("Erro ao realizar a autenticação:", error);
      return res
        .status(500)
        .json({ message: "Erro ao realizar a autenticação" });
    }
  },
});


// Função para obter um usuário pelo email
async function getUserByEmail(Mssql, tableName, fields, email) {

  const query = `SELECT ${fields.join(
    ", "
  )} FROM ${tableName} WHERE EMAIL = '${email}' AND ATIVO = 1`;
  const params = {
    email: email,
  };

  try {
    const [user] = await Mssql.connectAndQuery(query, params);
    //console.log(user)
    // if (!user) {
    //   throw new Error("Usuário não encontrado");
    // }
    //console.log(user)
    return user;
  } catch (error) {
    throw error;
  }
}
