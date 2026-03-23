// services/verificationService.js

/**
 * Gera um código de verificação numérico de 6 dígitos.
 * @returns {string} O código de 6 dígitos como uma string.
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = { generateVerificationCode };