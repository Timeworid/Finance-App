const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;      // Octets (format historique conservé pour compatibilité des données existantes)
const AUTH_TAG_LENGTH = 16; // Octets
const KEY_LENGTH = 32;      // AES-256 => 32 octets

/**
 * Format exact d'une valeur chiffrée : "iv:données:authTag" en hexadécimal.
 * - iv      : 32 caractères hex (16 octets)
 * - données : hex de longueur paire (éventuellement vide)
 * - authTag : 32 caractères hex (16 octets)
 * Remplace l'ancienne heuristique `includes(':')`, qui considérait à tort
 * tout texte contenant ":" (ex. "CB: Carrefour") comme déjà chiffré.
 */
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:(?:[0-9a-f]{2})*:[0-9a-f]{32}$/;

// Clé mise en cache : évite de reconstruire un Buffer à chaque (dé)chiffrement.
let cachedKey = null;
let cachedKeyHex = null;

/**
 * Retourne la clé de chiffrement validée (32 octets).
 * Recalculée uniquement si la variable d'environnement change (utile en tests).
 * @returns {Buffer}
 * @throws {Error} si la clé est absente ou invalide
 */
function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (cachedKey && hex === cachedKeyHex) return cachedKey;

  if (typeof hex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`ENCRYPTION_KEY invalide : ${KEY_LENGTH} octets attendus en hexadécimal (64 caractères)`);
  }
  cachedKey = Buffer.from(hex, 'hex');
  cachedKeyHex = hex;
  return cachedKey;
}

/**
 * Vérifie la clé au démarrage (fail-fast) plutôt qu'à la première requête.
 * @throws {Error} si la clé est invalide
 */
function assertEncryptionKey() {
  getKey();
}

/**
 * Indique si une valeur respecte strictement le format chiffré.
 * @param {*} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  return typeof value === 'string' && ENCRYPTED_PATTERN.test(value);
}

/**
 * Chiffre un texte avec AES-256-GCM
 * @param {string} text - Texte en clair à chiffrer
 * @returns {string} Texte chiffré au format "iv:encrypted:authTag" (hex)
 */
function encrypt(text) {
  if (text === null || text === undefined) return text;

  const textStr = String(text);
  if (textStr === '') return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(textStr, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Déchiffre un texte chiffré avec AES-256-GCM
 * @param {string} ciphertext - Texte chiffré au format "iv:encrypted:authTag"
 * @returns {string} Texte en clair
 * @throws {Error} si le format est invalide ou l'authentification échoue
 */
function decrypt(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return ciphertext;

  const cipherStr = String(ciphertext);
  if (cipherStr === '') return '';

  if (!isEncrypted(cipherStr)) {
    throw new Error('Format de chiffrement invalide');
  }

  try {
    const [ivHex, encryptedHex, authTagHex] = cipherStr.split(':');

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivHex, 'hex'),
      { authTagLength: AUTH_TAG_LENGTH }
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    // Ne jamais journaliser la valeur chiffrée ni la clé
    throw new Error('Échec du déchiffrement des données', { cause: error });
  }
}

/**
 * Chiffre une valeur seulement si elle ne l'est pas déjà (idempotent).
 * @param {*} value
 * @returns {*} valeur chiffrée, ou valeur d'origine si null/undefined/vide
 */
function encryptIfNeeded(value) {
  if (value === null || value === undefined) return value;
  return isEncrypted(value) ? value : encrypt(String(value));
}

/**
 * Déchiffre une valeur seulement si elle est chiffrée.
 * Les données historiques restées en clair sont renvoyées telles quelles.
 * @param {*} value
 * @returns {*}
 */
function decryptIfNeeded(value) {
  return isEncrypted(value) ? decrypt(value) : value;
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
  return parseFloat(decrypt(ciphertext));
}

/**
 * Convertit une valeur (chiffrée ou non) en nombre fini.
 * @param {*} value
 * @returns {number} 0 si la valeur n'est pas exploitable
 */
function toNumber(value) {
  const n = parseFloat(decryptIfNeeded(value));
  return Number.isFinite(n) ? n : 0;
}

module.exports = {
  encrypt,
  decrypt,
  encryptNumber,
  decryptNumber,
  encryptIfNeeded,
  decryptIfNeeded,
  isEncrypted,
  toNumber,
  assertEncryptionKey,
};
