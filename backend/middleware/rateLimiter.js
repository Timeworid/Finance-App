const rateLimit = require('express-rate-limit');

/**
 * Rate limiter strict pour les routes d'authentification
 * 5 tentatives par 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requêtes max
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter pour les opérations d'écriture (POST, PUT, DELETE)
 * 50 requêtes par 15 minutes
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'Trop de modifications. Veuillez ralentir.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET', // Ne pas limiter les GET
});

/**
 * Rate limiter pour les imports CSV (plus restrictif)
 * 10 imports par heure
 */
const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: {
    error: 'Trop d\'imports. Veuillez attendre avant de réessayer.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  writeLimiter,
  importLimiter,
};
