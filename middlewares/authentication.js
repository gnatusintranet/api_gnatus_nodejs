module.exports = (app) => {
  let { Jwt, Mysql, Pg } = app.services;

  return async (req, res, next) => {
    try {
      let token = null;

      // Verificar o token no header de autorização ou na query string
      if (req.headers.authorization && req.headers.authorization.split(" ")[0].toLowerCase() === "bearer") {
        token = req.headers.authorization.split(" ")[1];
      } else if (req.query && req.query.token) {
        token = req.query.token;
      }

      if (!token) return res.status(401).send("Invalid token");

      var decoded = Jwt.verify(token);

      if (!decoded?.id) return res.status(401).send("Invalid token");

      // Buscar o usuário com base no tipo de token
      if (decoded.type == "usuario") {
        req.user = await Pg.connectAndQuery(
          `select * from tab_intranet_usr WHERE ID = @id and ativo = true`,
          { id: decoded.id }
        );
      } else if (decoded.type == "motorista") {
        // console.log(req.user)
        req.user = await Mysql.queryOne(
          "select * from TAB_MOTORISTA where id = ? and ativo = 1",
          [decoded.id]
        );
      } else if (decoded.type == "eco_camarote") {
        req.user = await Mysql.queryOne(
          "select * from TAB_ECO_CAMAROTE_LOGIN_USR WHERE id = ? and ativo = 1",
          [decoded.id]
        );
      } else if (decoded.type == "franqueado") {
        // console.log(req.user)
        req.user = await Pg.connectAndQuery(
          `SELECT * FROM tab_intranet_usr_franqueado WHERE ID = @id AND ativo = true`,
          { id: decoded.id }
        );
      }
      
      else {
        return res.status(401).send("Invalid token");
      }

      if (!req.user) return res.status(401).send("Invalid token");

      next();
    } catch (err) {
      console.error("Error verifying token:", err);
      return res.status(401).send("Invalid token");
    }
  };
};
