const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Category = require('../models/Category');
const Settings = require('../models/Settings');
const { validate, registerSchema, loginSchema } = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

/**
 * Génère un access token JWT (15 minutes)
 */
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Génère un refresh token JWT (7 jours)
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Catégories par défaut lors de l'inscription
 */
const defaultCategories = (userId) => [
  {
    userId,
    name: 'Salaire',
    type: 'revenu',
    color: '#34d399',
    budget: 0,
    keywords: ['salaire', 'paie', 'remuneration', 'virement employeur'],
  },
  {
    userId,
    name: 'Logement',
    type: 'depense',
    color: '#fb7185',
    budget: 1200,
    keywords: ['loyer', 'edf', 'eau', 'gaz', 'electricite'],
  },
  {
    userId,
    name: 'Courses',
    type: 'depense',
    color: '#fbbf24',
    budget: 450,
    keywords: ['carrefour', 'leclerc', 'auchan', 'lidl', 'aldi', 'courses'],
  },
  {
    userId,
    name: 'Transport',
    type: 'depense',
    color: '#60a5fa',
    budget: 150,
    keywords: ['essence', 'ratp', 'sncf', 'uber', 'parking'],
  },
  {
    userId,
    name: 'Loisirs',
    type: 'depense',
    color: '#a78bfa',
    budget: 200,
    keywords: ['cinema', 'restaurant', 'sport', 'vacances'],
  },
  {
    userId,
    name: 'Santé',
    type: 'depense',
    color: '#2dd4bf',
    budget: 80,
    keywords: ['pharmacie', 'medecin', 'dentiste', 'mutuelle'],
  },
  {
    userId,
    name: 'Épargne',
    type: 'depense',
    color: '#34d399',
    budget: 400,
    keywords: ['virement epargne', 'livret', 'assurance vie'],
  },
];

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: 'Cet email est déjà utilisé',
      });
    }

    // Créer l'utilisateur
    const user = new User({
      email,
      password, // Sera haché par le pre-save hook
      firstName: firstName || '',
      lastName: lastName || '',
    });

    await user.save();

    // Créer les catégories par défaut
    await Category.insertMany(defaultCategories(user._id));

    // Créer les settings par défaut
    await Settings.create({
      userId: user._id,
      startBalance: 0,
      monthlyCapacity: 1000,
    });

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Stocker le refresh token
    user.addRefreshToken(refreshToken);
    await user.save();

    // Envoyer le refresh token en cookie HTTP-only
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    res.status(201).json({
      message: 'Inscription réussie',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'inscription',
    });
  }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur
 */
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect',
      });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect',
      });
    }

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Stocker le refresh token
    user.addRefreshToken(refreshToken);
    await user.save();

    // Envoyer le refresh token en cookie HTTP-only
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      error: 'Erreur lors de la connexion',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Rafraîchir l'access token
 */
router.post('/refresh', async (req, res) => {
  try {
    // Récupérer le refresh token depuis le cookie ou le body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token manquant',
      });
    }

    // Vérifier le refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Vérifier que le token existe dans la DB
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
      });
    }

    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
    if (!tokenExists) {
      return res.status(401).json({
        error: 'Refresh token invalide',
      });
    }

    // Générer un nouveau access token
    const accessToken = generateAccessToken(user);

    res.json({
      accessToken,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Refresh token expiré',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Refresh token invalide',
      });
    }

    console.error('Erreur lors du refresh:', error);
    res.status(500).json({
      error: 'Erreur lors du rafraîchissement du token',
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion (supprime le refresh token)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      const user = await User.findById(req.user.userId);
      if (user) {
        user.removeRefreshToken(refreshToken);
        await user.save();
      }
    }

    // Supprimer le cookie
    res.clearCookie('refreshToken');

    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      error: 'Erreur lors de la déconnexion',
    });
  }
});

/**
 * GET /api/auth/me
 * Obtenir les informations de l'utilisateur connecté
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
      });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération du profil',
    });
  }
});

module.exports = router;
