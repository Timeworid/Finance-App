const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const User = require('../models/User');

// Algorithme imposé à la vérification : empêche toute confusion d'algorithme
const JWT_ALGORITHMS = ['HS256'];

/**
 * Middleware pour vérifier le JWT dans les requêtes
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers['authorization'];
    // Format attendu strict : "Bearer <token>"
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: 'Accès non autorisé - Token manquant',
      });
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: JWT_ALGORITHMS });

    // Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.userId).select('-password -refreshTokens').lean();

    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
      });
    }

    // Attacher les informations utilisateur à la requête
    req.user = {
      userId: String(user._id),
      email: user.email,
    };

    req.userDoc = user; // Objet utilisateur (lean, sans mot de passe ni tokens)

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token invalide',
      });
    }

    logger.error('Erreur d\'authentification', { error: error.message });
    return res.status(500).json({
      error: 'Erreur lors de la vérification du token',
    });
  }
};

/**
 * Middleware optionnel - n'échoue pas si pas de token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: JWT_ALGORITHMS });
    const user = await User.findById(decoded.userId).select('-password -refreshTokens').lean();

    if (user) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
      req.userDoc = user;
    }

    next();
  } catch (error) {
    // On ignore les erreurs en mode optionnel
    next();
  }
};

module.exports = {
  JWT_ALGORITHMS,
  authenticateToken,
  optionalAuth,
};
