const mongoose = require('mongoose');
const logger = require('./logger');
const { runMigrations } = require('../migrations');

/**
 * Supprime l'ancien index TTL `refreshTokens.createdAt_1` s'il existe.
 * Cet index (créé par une version précédente) supprimait des comptes
 * utilisateurs entiers 7 jours après leur plus ancienne session.
 * Opération idempotente : sans effet si l'index est absent.
 */
async function dropLegacyUserTtlIndex() {
  try {
    const users = mongoose.connection.collection('users');
    const indexes = await users.indexes();
    if (indexes.some(idx => idx.name === 'refreshTokens.createdAt_1')) {
      await users.dropIndex('refreshTokens.createdAt_1');
      logger.warn('Index TTL dangereux refreshTokens.createdAt_1 supprimé');
    }
  } catch (error) {
    // Collection inexistante (base neuve) : rien à faire
    if (error.codeName !== 'NamespaceNotFound') {
      logger.error('Impossible de vérifier les index users', { error: error.message });
    }
  }
}

/**
 * Connexion à MongoDB
 * @param {string} [uri] - URI de connexion (par défaut MONGODB_URI)
 */
const connectDB = async (uri = process.env.MONGODB_URI) => {
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connecté avec succès');
    await dropLegacyUserTtlIndex();
    // Migrations de données automatiques (une seule exécution chacune, voir migrations/)
    await runMigrations(mongoose.connection.db);
  } catch (error) {
    logger.error('Erreur au démarrage (connexion MongoDB ou migration)', { error: error.message });
    process.exit(1);
  }
};

// Gestion des événements de connexion
mongoose.connection.on('error', (err) => {
  logger.error('Erreur de connexion Mongoose', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose déconnecté de MongoDB');
});

module.exports = connectDB;
module.exports.dropLegacyUserTtlIndex = dropLegacyUserTtlIndex;
