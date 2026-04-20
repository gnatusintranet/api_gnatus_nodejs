// Criptografia server-side para o backup da recovery key.
// Usa AES-256-GCM com chave em COFRE_BACKUP_KEY (env).
// Formato armazenado: JSON {iv, ct, tag} em base64.
//
// ATENÇÃO: este backup QUEBRA zero-knowledge. Quem tiver BD + COFRE_BACKUP_KEY
// consegue restaurar a recovery key de qualquer usuário. Mantém esta chave
// fora do repositório e protege o servidor.

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey() {
    const b64 = process.env.COFRE_BACKUP_KEY;
    if (!b64) throw new Error('COFRE_BACKUP_KEY não configurada.');
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error('COFRE_BACKUP_KEY deve ser 32 bytes (base64).');
    return key;
}

function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
        iv: iv.toString('base64'),
        ct: ct.toString('base64'),
        tag: tag.toString('base64')
    });
}

function decrypt(payloadJson) {
    const key = getKey();
    const { iv, ct, tag } = JSON.parse(payloadJson);
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const plain = Buffer.concat([
        decipher.update(Buffer.from(ct, 'base64')),
        decipher.final()
    ]);
    return plain.toString('utf8');
}

function hash(text) {
    return crypto.createHash('sha256').update(String(text)).digest('hex');
}

module.exports = { encrypt, decrypt, hash };
