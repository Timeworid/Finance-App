const mongoose = require('mongoose');
const { encryptNumber, decryptNumber } = require('../utils/encryption');

/**
 * Modèle pour les charges et revenus récurrents
 * (Abonnements, salaires, loyers, etc.)
 */
const recurringItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Le type est requis'],
    enum: ['revenue', 'charge'], // Revenu ou Charge
  },
  amount: {
    type: String, // Chiffré
    required: [true, 'Le montant est requis'],
  },
  frequency: {
    type: String,
    required: [true, 'La fréquence est requise'],
    enum: ['monthly', 'quarterly', 'yearly', 'weekly'],
  },
  category: {
    type: String,
    enum: [
      // Revenus
      'salaire', 'prime', 'allocation', 'pension', 'investissement', 'autre_revenu',
      // Charges
      'logement', 'energie', 'internet', 'telephone', 'assurance', 'transport',
      'abonnement_streaming', 'abonnement_presse', 'abonnement_sport', 'autre_charge',
    ],
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    default: null, // null = indéfini
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  dayOfMonth: {
    type: Number, // Jour du mois (1-31)
    min: 1,
    max: 31,
    default: 1,
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
recurringItemSchema.index({ userId: 1 });
recurringItemSchema.index({ userId: 1, type: 1 });
recurringItemSchema.index({ userId: 1, isActive: 1 });

// Chiffrement avant sauvegarde
recurringItemSchema.pre('save', function() {
  if (this.isModified('amount')) {
    const amountStr = String(this.amount);
    if (!amountStr.includes(':')) {
      this.amount = encryptNumber(this.amount);
    }
  }
});

// Méthodes utilitaires
recurringItemSchema.methods.getAnnualAmount = function() {
  const amount = parseFloat(this.amount) || 0;

  switch (this.frequency) {
    case 'weekly':
      return amount * 52;
    case 'monthly':
      return amount * 12;
    case 'quarterly':
      return amount * 4;
    case 'yearly':
      return amount;
    default:
      return 0;
  }
};

recurringItemSchema.methods.getMonthlyAmount = function() {
  return this.getAnnualAmount() / 12;
};

// Mapper _id vers id pour le frontend ET déchiffrer
recurringItemSchema.set('toJSON', {
  versionKey: false,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;

    // Déchiffrer amount pour le JSON
    if (ret.amount && String(ret.amount).includes(':')) {
      ret.amount = decryptNumber(ret.amount);
    }
  }
});

module.exports = mongoose.model('RecurringItem', recurringItemSchema);
