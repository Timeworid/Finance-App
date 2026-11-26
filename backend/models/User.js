const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Hash SHA-256 d'un refresh token : seul le hash est stocké en base,
 * une fuite de la base ne permet donc pas de réutiliser les sessions.
 * (SHA-256 suffit ici : le token est un secret aléatoire à haute entropie.)
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Session de rafraîchissement (« famille » de refresh tokens).
 * Chaque connexion crée une famille ; à chaque rotation, seul le hash du token
 * courant et celui du précédent sont conservés (stockage en O(sessions)).
 */
const refreshTokenSchema = new mongoose.Schema({
  // Identifiant de la famille (claim `fam` du refresh token JWT)
  family: {
    type: String,
    required: true,
  },
  // Hash SHA-256 du token courant (jamais le token en clair)
  token: {
    type: String,
    required: true,
  },
  // Hash du token précédent (toléré ROTATION_GRACE_MS après la rotation)
  previousToken: {
    type: String,
    default: null,
  },
  rotatedAt: {
    type: Date,
    default: null,
  },
  // ATTENTION : pas de `expires` ici. Un index TTL sur un sous-document de tableau
  // supprime le document PARENT (l'utilisateur entier) à l'expiration.
  // Les sessions expirées sont purgées dans addRefreshSession().
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
});

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours d'inactivité max
const MAX_SESSIONS = 5;

/**
 * Période de grâce après rotation : deux onglets qui rafraîchissent en même temps
 * présentent le même token ; le second ne doit pas être pris pour un vol.
 */
const ROTATION_GRACE_MS = 30 * 1000;

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

// Ouvre une nouvelle session (famille) ; garde les MAX_SESSIONS plus récentes
userSchema.methods.addRefreshSession = function(family, token) {
  const threshold = Date.now() - REFRESH_TOKEN_TTL_MS;
  this.refreshTokens = this.refreshTokens.filter(rt => rt.family && rt.lastUsedAt && rt.lastUsedAt.getTime() > threshold);

  this.refreshTokens.push({ family, token: hashToken(token) });

  if (this.refreshTokens.length > MAX_SESSIONS) {
    this.refreshTokens = this.refreshTokens.slice(-MAX_SESSIONS);
  }
};

/**
 * Évalue un refresh token présenté (dont la signature JWT a déjà été vérifiée).
 * @param {string} family - claim `fam`
 * @param {string} token
 * @returns {{status: 'current'|'grace'|'reused'|'unknown', session?: object}}
 *  - current : token courant de la session → rotation
 *  - grace   : token précédent, tourné il y a < 30 s (onglets concurrents) → toléré
 *  - reused  : ancien token de la famille → vol probable, la session doit être révoquée
 *  - unknown : session inexistante (déconnectée, expirée ou révoquée)
 */
userSchema.methods.checkRefreshToken = function(family, token) {
  const session = this.refreshTokens.find(rt => rt.family === family);
  if (!session) return { status: 'unknown' };

  const hashed = hashToken(token);
  if (session.token === hashed) return { status: 'current', session };

  const inGrace = session.previousToken === hashed &&
    session.rotatedAt && Date.now() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS;
  return { status: inGrace ? 'grace' : 'reused', session };
};

/**
 * Rotation ATOMIQUE : le token courant devient le précédent, uniquement si la session
 * contient encore `oldToken` comme token courant (mise à jour conditionnelle MongoDB).
 * Deux requêtes concurrentes ne peuvent donc pas tourner la même session deux fois.
 * @returns {Promise<boolean>} false si une autre requête a tourné la session entre-temps
 */
userSchema.statics.rotateRefreshToken = async function(userId, family, oldToken, newToken) {
  const now = new Date();
  const res = await this.updateOne(
    { _id: userId, refreshTokens: { $elemMatch: { family, token: hashToken(oldToken) } } },
    {
      $set: {
        'refreshTokens.$.previousToken': hashToken(oldToken),
        'refreshTokens.$.token': hashToken(newToken),
        'refreshTokens.$.rotatedAt': now,
        'refreshTokens.$.lastUsedAt': now,
      },
    }
  );
  return res.modifiedCount === 1;
};

// Révoque une session (déconnexion, ou réutilisation détectée)
userSchema.methods.removeRefreshSession = function(family) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.family !== family);
};

module.exports = mongoose.model('User', userSchema);
