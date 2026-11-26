require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./config/logger');
const { validateEnv } = require('./config/env');
const connectDB = require('./config/db');
const createApp = require('./app');

// Refuser de démarrer avec une configuration invalide ou des secrets faibles
try {
  validateEnv();
} catch (error) {
  logger.error(error.message);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;

/**
 * Démarre la connexion MongoDB puis le serveur HTTP.
 */
async function start() {
  await connectDB();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Serveur démarré sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  /**
   * Arrêt propre : termine les requêtes en cours puis ferme MongoDB.
   * Un timer force la sortie si l'arrêt dépasse 10 s.
   */
  const shutdown = (signal) => {
    logger.info(`${signal} reçu, arrêt en cours…`);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    server.close(async () => {
      await mongoose.connection.close();
      logger.info('Serveur et connexion MongoDB fermés');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM')); // docker stop
  process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
}

// Une promesse rejetée non gérée laisse l'application dans un état incertain : on sort
// (le logger a déjà journalisé l'erreur ; Docker/systemd redémarre le processus).
process.on('unhandledRejection', () => process.exit(1));

start();
