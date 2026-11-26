const { assertEncryptionKey } = require('../utils/encryption');

/**
 * Secrets considérés comme non sûrs (valeurs d'exemple de la documentation).
 */
const WEAK_SECRETS = new Set([
  'votre_secret_jwt_super_securise',
  'votre_refresh_secret_super_securise',
  'changeme',
  'secret',
]);

/**
 * Valide la configuration au démarrage (fail-fast).
 * Mieux vaut refuser de démarrer qu'échouer à la première requête
 * ou tourner avec des secrets faibles.
 * @throws {Error} liste de toutes les erreurs de configuration
 */
function validateEnv() {
  const errors = [];

  if (!process.env.MONGODB_URI) errors.push('MONGODB_URI est requis');

  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[name];
    if (!value) errors.push(`${name} est requis`);
    else if (value.length < 32 || WEAK_SECRETS.has(value)) {
      errors.push(`${name} doit être un secret aléatoire d'au moins 32 caractères (voir scripts/generate-secrets.sh)`);
    }
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET et JWT_REFRESH_SECRET doivent être différents');
  }

  try {
    assertEncryptionKey();
  } catch (e) {
    errors.push(e.message);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n - ${errors.join('\n - ')}`);
  }
}

module.exports = { validateEnv };
