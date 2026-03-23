let jwt = require('jsonwebtoken')

let secret = 'o2sQDall2J45uljaz02OEsoz2ejPsf2cYkUbIU8ba1H6sQzOOe'

module.exports = app => {
  return {
    generate: payload => {
      return jwt.sign(payload, secret)
    },
    verify: token => {
      return jwt.verify(token, secret)
    }
  }
}
