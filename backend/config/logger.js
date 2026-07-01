const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, '../logs');

/**
 * Configuration du logger Winston
 * - Logs rotatifs quotidiens
 * - Niveau de log selon l'environnement
 * - Format JSON pour parsing facile
 * - Console output en développement
 */

// Format personnalisé
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format pour la console (développement)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0 && meta.stack) {
      msg += `\n${meta.stack}`;
    } else if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

// Transports
const transports = [];

// Console en développement
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    })
  );
}

// Fichiers rotatifs en production
if (process.env.NODE_ENV === 'production') {
  // Logs d'erreurs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: customFormat,
    })
  );

  // Tous les logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: customFormat,
    })
  );

  // Console minimale en production
  transports.push(
    new winston.transports.Console({
      format: customFormat,
      level: process.env.LOG_LEVEL || 'info',
    })
  );
}

// Créer le logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: customFormat,
  defaultMeta: {
    service: 'financepilot-api',
    env: process.env.NODE_ENV
  },
  transports,
  // Ne pas quitter sur erreur
  exitOnError: false,
});

/**
 * Middleware Express pour logger les requêtes HTTP
 */
logger.httpLogger = (req, res, next) => {
  const start = Date.now();

  // Logger la réponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Ajouter userId si authentifié (sans exposer de données sensibles)
    if (req.user && req.user.userId) {
      logData.userId = req.user.userId;
    }

    // Niveau de log selon le status
    if (res.statusCode >= 500) {
      logger.error('HTTP Request', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

/**
 * Logger les erreurs non catchées
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  // Laisser le process se terminer proprement
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

module.exports = logger;
