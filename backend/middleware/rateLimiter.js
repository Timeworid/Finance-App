const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Désactivé en environnement de test (sinon les suites de tests se bloquent)
const skipInTest = () => process.env.NODE_ENV === 'test';

/**
 * Clé de limitation : l'utilisateur authentifié si disponible, sinon l'IP.
 * Évite qu'un réseau partagé (NAT, entreprise) bloque tous ses utilisateurs.
 * ipKeyGenerator normalise les IPv6 (regroupement /56) pour empêcher le contournement.
 */
const userOrIpKey = (req) => (req.user?.userId ? `user:${req.user.userId}` : ipKeyGenerator(req.ip));

/**
 * Rate limiter strict pour les routes d'authentification :
 * 5 échecs par 15 minutes et par IP. Les connexions réussies ne sont pas comptées,
 * pour ne pas bloquer un utilisateur légitime qui se reconnecte.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
});

/**
 * Rate limiter pour les opérations d'écriture (POST, PUT, DELETE) :
 * 200 requêtes par 15 minutes et par utilisateur.
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  message: {
    error: 'Trop de modifications. Veuillez ralentir.',
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: (req) => req.method === 'GET' || skipInTest(),
});

/**
 * Rate limiter pour les imports CSV : 10 imports par heure et par utilisateur.
 */
const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: {
    error: 'Trop d\'imports. Veuillez attendre avant de réessayer.',
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: skipInTest,
});

module.exports = {
  authLimiter,
  writeLimiter,
  importLimiter,
};
