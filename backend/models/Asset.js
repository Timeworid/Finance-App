const mongoose = require('mongoose');
const { encryptNumber, isEncrypted, toNumber } = require('../utils/encryption');

/**
 * Modèle pour les biens physiques (voiture, immobilier, électronique, etc.)
 */
const assetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom du bien est requis'],
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    enum: [
      'vehicule', // Voiture, moto, vélo
      'immobilier', // Appartement, maison, terrain
      'electronique', // Ordinateur, téléphone, TV
      'mobilier', // Meubles, décoration
      'bijoux', // Bijoux, montres
      'collection', // Oeuvres d'art, collections
      'autre',
    ],
  },
  purchaseDate: {
    type: Date,
    default: null,
  },
  purchasePrice: {
    type: String, // Chiffré
    default: '0',
  },
  currentValue: {
    type: String, // Chiffré - valeur estimée actuelle
    required: [true, 'La valeur actuelle est requise'],
  },
  description: {
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
assetSchema.index({ userId: 1 });
assetSchema.index({ userId: 1, category: 1 });

// Chiffrement avant sauvegarde
assetSchema.pre('save', function() {
  if (this.isModified('purchasePrice')) {
    const priceStr = String(this.purchasePrice);
    if (!isEncrypted(priceStr)) {
      this.purchasePrice = encryptNumber(this.purchasePrice);
    }
  }

  if (this.isModified('currentValue')) {
    const valueStr = String(this.currentValue);
    if (!isEncrypted(valueStr)) {
      this.currentValue = encryptNumber(this.currentValue);
    }
  }
});

// Mapper _id vers id pour le frontend ET déchiffrer
assetSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;

    // Déchiffrer les montants pour le JSON
    if (ret.purchasePrice !== null && ret.purchasePrice !== undefined) ret.purchasePrice = toNumber(ret.purchasePrice);
    if (ret.currentValue !== null && ret.currentValue !== undefined) ret.currentValue = toNumber(ret.currentValue);

    return ret;
  }
});

module.exports = mongoose.model('Asset', assetSchema);
