const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Hash SHA-256 d'un refresh token : seul le hash est stocké en base,
 * une fuite de la base ne permet donc pas de réutiliser les sessions.
 * (SHA-256 suffit ici : le token est un secret aléatoire à haute entropie.)
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const refreshTokenSchema = new mongoose.Schema({
  // Hash SHA-256 du token (jamais le token en clair)
  token: {
    type: String,
    required: true,
  },
  // ATTENTION : pas de `expires` ici. Un index TTL sur un sous-document de tableau
  // supprime le document PARENT (l'utilisateur entier) à l'expiration.
  // Les sessions expirées sont purgées dans addRefreshToken().
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Format d\'email invalide'],
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
  },
  firstName: {
    type: String,
    trim: true,
    default: '',
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
  },
  refreshTokens: [refreshTokenSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index unique pour performance et contrainte d'unicité
userSchema.index({ email: 1 }, { unique: true });

// Hash le mot de passe avant la sauvegarde
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Ne pas renvoyer le mot de passe dans les réponses JSON et mapper _id vers id
userSchema.set('toJSON', {
  versionKey: false,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
    delete ret.refreshTokens;
  }
});

// Enregistre le hash d'un refresh token ; garde les 5 sessions les plus récentes (FIFO)
userSchema.methods.addRefreshToken = function(token) {
  // Purge des sessions expirées avant ajout
  const threshold = Date.now() - REFRESH_TOKEN_TTL_MS;
  this.refreshTokens = this.refreshTokens.filter(rt => rt.createdAt && rt.createdAt.getTime() > threshold);

  this.refreshTokens.push({ token: hashToken(token) });

  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
};

// Indique si le refresh token fait partie des sessions actives
userSchema.methods.hasRefreshToken = function(token) {
  const hashed = hashToken(token);
  return this.refreshTokens.some(rt => rt.token === hashed);
};

// Révoque un refresh token spécifique
userSchema.methods.removeRefreshToken = function(token) {
  const hashed = hashToken(token);
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== hashed);
};

module.exports = mongoose.model('User', userSchema);
