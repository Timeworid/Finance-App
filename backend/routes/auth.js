const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();
const logger = require('../config/logger');
const User = require('../models/User');
const Category = require('../models/Category');
const Settings = require('../models/Settings');
const { validate, registerSchema, loginSchema } = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken, JWT_ALGORITHMS } = require('../middleware/auth');

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/**
 * Hash bcrypt factice : comparé quand l'email n'existe pas, pour que le temps
 * de réponse soit identique et ne révèle pas quels emails sont inscrits.
 */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

/**
 * Options du cookie de refresh.
 * - httpOnly : inaccessible au JavaScript (protection XSS)
 * - secure   : activé en production, sauf COOKIE_SECURE=false (déploiement HTTP local)
 * - path     : envoyé uniquement aux routes d'authentification
 */
function refreshCookieOptions() {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/auth',
  };
}

/**
 * Génère un access token JWT (15 minutes)
 */
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
}

/**
 * Génère un refresh token JWT (7 jours).
 * - `fam` : famille (session) à laquelle appartient le token ;
 * - `jwtid` aléatoire : unicité même pour deux tokens émis à la même seconde.
 */
function generateRefreshToken(user, family) {
  return jwt.sign(
    { userId: user._id, fam: family },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d', algorithm: 'HS256', jwtid: crypto.randomUUID() }
  );
}

/** Place le refresh token dans le cookie httpOnly. */
function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions(), maxAge: REFRESH_TTL_MS });
}

/**
 * Ouvre une session (nouvelle famille) : access token + refresh token en cookie.
 * Le refresh token n'est jamais renvoyé dans le corps de la réponse.
 * @returns {Promise<string>} access token
 */
async function startSession(res, user) {
  const family = crypto.randomUUID();
  const refreshToken = generateRefreshToken(user, family);
  user.addRefreshSession(family, refreshToken);
  await user.save();
  setRefreshCookie(res, refreshToken);
  return generateAccessToken(user);
}

/**
 * Réponse publique d'un utilisateur (aucun champ sensible).
 */
const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
});

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
    const existingUser = await User.exists({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: 'Cet email est déjà utilisé',
      });
    }

    // Créer l'utilisateur (mot de passe haché par le hook pre-save)
    const user = new User({
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
    });
    await user.save();

    // Catégories et settings par défaut, en parallèle
    await Promise.all([
      Category.insertMany(defaultCategories(user._id)),
      Settings.create({ userId: user._id, startBalance: 0, monthlyCapacity: 1000 }),
    ]);

    const accessToken = await startSession(res, user);

    res.status(201).json({
      message: 'Inscription réussie',
      user: publicUser(user),
      accessToken,
    });
  } catch (error) {
    // Course entre deux inscriptions simultanées : index unique sur l'email
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    logger.error('Erreur lors de l\'inscription', { error: error.message });
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

    const user = await User.findOne({ email: email.toLowerCase() });

    // Comparaison systématique (hash factice si l'utilisateur n'existe pas) : temps constant
    const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !isMatch) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect',
      });
    }

    const accessToken = await startSession(res, user);

    res.json({
      message: 'Connexion réussie',
      user: publicUser(user),
      accessToken,
    });
  } catch (error) {
    logger.error('Erreur lors de la connexion', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la connexion',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Rafraîchit l'access token avec ROTATION du refresh token (familles de tokens) :
 * - token courant → nouveau couple de tokens, l'ancien devient « précédent » ;
 * - token précédent dans les 30 s (onglets concurrents) → nouvel access token,
 *   cookie inchangé (le navigateur détient déjà le token courant) ;
 * - tout autre token de la famille → réutilisation (vol probable) : session révoquée.
 */
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];

  if (!refreshToken) {
    return res.status(401).json({
      error: 'Refresh token manquant',
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: JWT_ALGORITHMS });

    let user = decoded.fam ? await User.findById(decoded.userId) : null;
    let { status } = user ? user.checkRefreshToken(decoded.fam, refreshToken) : { status: 'unknown' };

    if (status === 'current') {
      const newRefreshToken = generateRefreshToken(user, decoded.fam);
      if (await User.rotateRefreshToken(user._id, decoded.fam, refreshToken, newRefreshToken)) {
        setRefreshCookie(res, newRefreshToken);
        return res.json({ accessToken: generateAccessToken(user) });
      }
      // Une requête concurrente a tourné la session entre la lecture et l'écriture :
      // relecture, le token est alors normalement « précédent » (période de grâce).
      user = await User.findById(decoded.userId);
      ({ status } = user ? user.checkRefreshToken(decoded.fam, refreshToken) : { status: 'unknown' });
    }

    if (status === 'grace') {
      return res.json({ accessToken: generateAccessToken(user) });
    }

    if (status === 'reused') {
      user.removeRefreshSession(decoded.fam);
      await user.save();
      logger.warn('Réutilisation de refresh token détectée, session révoquée', { userId: String(user._id) });
    }

    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    return res.status(401).json({ error: 'Refresh token invalide' });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
      return res.status(401).json({
        error: 'Refresh token invalide ou expiré',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    logger.error('Erreur lors du refresh', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors du rafraîchissement du token',
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion : révoque le refresh token du cookie.
 * Ne requiert pas d'access token valide (sinon impossible de se déconnecter après expiration).
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];

    if (refreshToken) {
      // decode (sans vérifier l'expiration) : seul l'identifiant est utile pour révoquer
      const decoded = jwt.decode(refreshToken);
      const user = decoded?.userId && decoded?.fam ? await User.findById(decoded.userId) : null;
      // Seul un token courant ou précédent de la session permet de la fermer
      if (user && ['current', 'grace'].includes(user.checkRefreshToken(decoded.fam, refreshToken).status)) {
        user.removeRefreshSession(decoded.fam);
        await user.save();
      }
    }

    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).send();
  } catch (error) {
    logger.error('Erreur lors de la déconnexion', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la déconnexion',
    });
  }
});

/**
 * GET /api/auth/me
 * Obtenir les informations de l'utilisateur connecté
 * (le middleware a déjà chargé le document, inutile de refaire une requête)
 */
router.get('/me', authenticateToken, (req, res) => {
  const user = req.userDoc;
  res.json({
    user: {
      ...publicUser(user),
      createdAt: user.createdAt,
    },
  });
});

module.exports = router;
