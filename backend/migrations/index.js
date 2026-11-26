/**
 * Migrations de données exécutées AUTOMATIQUEMENT au démarrage du backend.
 *
 * Chaque migration s'exécute une seule fois : un marqueur est enregistré dans la
 * collection `_migrations`. L'insertion du marqueur AVANT l'exécution sert de verrou
 * (index unique sur _id) : si plusieurs instances démarrent en même temps, une seule
 * exécute la migration. En cas d'échec, le marqueur est retiré pour réessayer au
 * prochain démarrage.
 */
const logger = require('../config/logger');

// Ordre d'exécution
const MIGRATIONS = [require('./reencrypt')];

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<string[]>} identifiants des migrations exécutées par cet appel
 */
async function runMigrations(db) {
  const markers = db.collection('_migrations');
  const executed = [];

  for (const migration of MIGRATIONS) {
    try {
      await markers.insertOne({ _id: migration.id, status: 'running', startedAt: new Date() });
    } catch (error) {
      if (error.code === 11000) continue; // déjà faite (ou en cours sur une autre instance)
      throw error;
    }

    try {
      logger.info(`Migration ${migration.id} : démarrage`);
      const result = await migration.run(db);
      await markers.updateOne(
        { _id: migration.id },
        { $set: { status: 'done', finishedAt: new Date(), result } }
      );
      logger.info(`Migration ${migration.id} : terminée`, { result });
      executed.push(migration.id);
    } catch (error) {
      await markers.deleteOne({ _id: migration.id }); // sera retentée au prochain démarrage
      logger.error(`Migration ${migration.id} : échec`, { error: error.message });
      throw error;
    }
  }

  return executed;
}

module.exports = { runMigrations, MIGRATIONS };
