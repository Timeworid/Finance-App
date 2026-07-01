const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Chiffre un texte avec AES-256-GCM
 * @param {string} text - Texte en clair à chiffrer
 * @returns {string} Texte chiffré au format "iv:encrypted:authTag" (hex)
 */
function encrypt(text) {
  if (text === null || text === undefined) return text;

  const textStr = String(text);
  if (textStr === '') return '';

  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(textStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:encrypted:authTag (tous en hex)
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Déchiffre un texte chiffré avec AES-256-GCM
 * @param {string} ciphertext - Texte chiffré au format "iv:encrypted:authTag"
 * @returns {string} Texte en clair
 */
function decrypt(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return ciphertext;

  const cipherStr = String(ciphertext);
  if (cipherStr === '') return '';

  try {
    const parts = cipherStr.split(':');
    if (parts.length !== 3) {
      throw new Error('Format de chiffrement invalide');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;

    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Erreur de déchiffrement:', error.message);
    throw new Error('Échec du déchiffrement des données');
  }
}

/**
 * Chiffre un nombre
 * @param {number} num - Nombre à chiffrer
 * @returns {string} Nombre chiffré
 */
function encryptNumber(num) {
  if (num === null || num === undefined) return num;
  return encrypt(String(num));
}

/**
 * Déchiffre un nombre
 * @param {string} ciphertext - Nombre chiffré
 * @returns {number} Nombre déchiffré
 */
function decryptNumber(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return ciphertext;
  const decrypted = decrypt(ciphertext);
  return parseFloat(decrypted);
}

module.exports = {
  encrypt,
  decrypt,
  encryptNumber,
  decryptNumber,
};
