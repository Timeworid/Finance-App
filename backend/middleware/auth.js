const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware pour vérifier le JWT dans les requêtes
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({
        error: 'Accès non autorisé - Token manquant',
      });
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');

    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
      });
    }

    // Attacher les informations utilisateur à la requête
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    req.userDoc = user; // Document complet si nécessaire

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

    console.error('Erreur d\'authentification:', error);
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
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');

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
  authenticateToken,
  optionalAuth,
};
