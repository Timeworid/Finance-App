const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const logger = require('./config/logger');

/**
 * Construit l'application Express (sans écouter de port).
 * Séparé de server.js pour pouvoir être testé avec supertest.
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const isDev = process.env.NODE_ENV === 'development';

  // Derrière nginx / un load balancer : nécessaire pour que req.ip et
  // req.secure reflètent le vrai client (rate limiting par IP réelle).
  // TRUST_PROXY = nombre de proxys de confiance (défaut 1 en production, 0 sinon).
  const trustProxy = process.env.TRUST_PROXY ?? (isProd ? '1' : '0');
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.disable('x-powered-by');

  // En-têtes de sécurité (inclut X-Frame-Options, nosniff, HSTS…)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"], // API JSON : aucune ressource à charger
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));

  // Redirection HTTPS optionnelle (FORCE_HTTPS=true) : désactivée par défaut,
  // sinon boucle de redirection quand nginx sert l'application en HTTP.
  if (process.env.FORCE_HTTPS === 'true') {
    app.use((req, res, next) => {
      if (req.secure || req.path === '/health') return next();
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    });
  }

  // CORS : origines explicites uniquement
  const allowedOrigins = new Set(
    [
      ...(isProd ? [] : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']),
      ...(process.env.FRONTEND_URL || '').split(',').map(o => o.trim()),
    ].filter(Boolean)
  );

  app.use(cors({
    origin: (origin, callback) => {
      // Requêtes sans Origin (même origine via nginx, curl, healthchecks) : pas de CORS nécessaire
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      const err = new Error('Origine non autorisée par CORS');
      err.status = 403;
      return callback(err);
    },
    credentials: true,
  }));

  // Logging HTTP
  if (process.env.NODE_ENV !== 'test') app.use(logger.httpLogger);

  // Body parsing : 2 Mo suffisent pour 1000 transactions importées
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // Rate limiting global
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 300 : 1000,
    message: { error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => (req.method === 'GET' && isDev) || process.env.NODE_ENV === 'test',
  });
  app.use('/api/', globalLimiter);

  // Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/envelopes', require('./routes/envelopes'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/assets', require('./routes/assets'));
  app.use('/api/recurring', require('./routes/recurring'));
  app.use('/api/stocks', require('./routes/stocks'));

  // Santé : inclut l'état de la base (503 si déconnectée → healthcheck Docker pertinent)
  app.get('/health', (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? 'OK' : 'DEGRADED',
      database: dbUp ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Route 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });

  // Gestionnaire d'erreurs global
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // JSON malformé ou corps trop volumineux : erreurs client
    const status = err.status || err.statusCode || 500;

    if (status >= 500) {
      logger.error('Erreur non gérée', {
        error: err.message,
        stack: isProd ? undefined : err.stack,
        url: req.originalUrl,
        method: req.method,
      });
    }

    // Ne jamais exposer la pile ni les détails internes hors développement
    const message = status < 500 ? err.message : (isDev ? err.message : 'Une erreur est survenue');
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = createApp;
