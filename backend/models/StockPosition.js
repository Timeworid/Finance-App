const mongoose = require('mongoose');
const { encryptNumber, decryptNumber } = require('../utils/encryption');

/**
 * Modèle pour les positions boursières (Actions, ETF)
 */
const stockPositionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  symbol: {
    type: String,
    required: [true, 'Le symbole ticker est requis'],
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['ETF', 'ACTION', 'CRYPTO'],
  },
  quantity: {
    type: Number,
    required: [true, 'La quantité est requise'],
    min: 0,
  },
  averageBuyPrice: {
    type: String, // Chiffré - Prix moyen achat
    required: [true, 'Le prix moyen achat est requis'],
  },
  currentPrice: {
    type: Number, // Prix actuel (mis à jour via API)
    default: 0,
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD', 'GBP'],
  },
  account: {
    type: String, // Nom du compte (PEA, Compte titres, etc.)
    trim: true,
    default: '',
  },
  sector: {
    type: String,
    trim: true,
    default: '',
  },
  region: {
    type: String,
    trim: true,
    default: '',
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
  },
  dividendYield: {
    type: Number, // Rendement dividende annuel (%)
    default: 0,
    min: 0,
    max: 100,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index pour performance
stockPositionSchema.index({ userId: 1 });
stockPositionSchema.index({ userId: 1, symbol: 1 });
stockPositionSchema.index({ userId: 1, type: 1 });

// Chiffrement avant sauvegarde
stockPositionSchema.pre('save', function() {
  if (this.isModified('averageBuyPrice')) {
    const priceStr = String(this.averageBuyPrice);
    if (!priceStr.includes(':')) {
      this.averageBuyPrice = encryptNumber(this.averageBuyPrice);
    }
  }
});

// Méthodes utilitaires
stockPositionSchema.methods.getTotalValue = function() {
  return this.quantity * this.currentPrice;
};

stockPositionSchema.methods.getTotalCost = function() {
  const avgPrice = parseFloat(this.averageBuyPrice) || 0;
  return this.quantity * avgPrice;
};

stockPositionSchema.methods.getProfitLoss = function() {
  return this.getTotalValue() - this.getTotalCost();
};

stockPositionSchema.methods.getProfitLossPercentage = function() {
  const cost = this.getTotalCost();
  if (cost === 0) return 0;
  return ((this.getProfitLoss() / cost) * 100).toFixed(2);
};

// Mapper _id vers id pour le frontend ET déchiffrer
stockPositionSchema.set('toJSON', {
  versionKey: false,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;

    // Déchiffrer averageBuyPrice pour le JSON
    if (ret.averageBuyPrice && String(ret.averageBuyPrice).includes(':')) {
      ret.averageBuyPrice = decryptNumber(ret.averageBuyPrice);
    }
  }
});

module.exports = mongoose.model('StockPosition', stockPositionSchema);
