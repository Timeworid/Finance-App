require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Connexion à MongoDB
connectDB();

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuré
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Logging HTTP requests
app.use(logger.httpLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security headers supplémentaires
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/envelopes', require('./routes/envelopes'));
app.use('/api/settings', require('./routes/settings'));

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl,
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée', {
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  // Ne pas exposer les détails en production
  const message = process.env.NODE_ENV === 'production'
    ? 'Une erreur est survenue'
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🌐 API disponible sur: http://localhost:${PORT}/api`);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('Promesse rejetée non gérée:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Exception non capturée:', err);
  process.exit(1);
});
