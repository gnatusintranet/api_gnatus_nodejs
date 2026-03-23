const bcrypt = require('bcrypt');

const saltRounds = 10;

module.exports = () => {
  return {
    generate: (value) => {
      return new Promise((res, rej) => {
        bcrypt.hash(value, saltRounds, (err, hash) => {
          if (err) return rej(err);
          res(hash);
        });
      })
    },
    compare: (value, expected) => {
      return new Promise((res, rej) => {
        bcrypt.compare(value, expected, (err, result) => {
          if (err) return rej(err);
          res(result);
        });
      });
    }
  }
}
