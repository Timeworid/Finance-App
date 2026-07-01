const mongoose = require('mongoose');
const { encrypt, decrypt, encryptNumber, decryptNumber } = require('../utils/encryption');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: [true, 'La date est requise'],
    index: true,
  },
  label: {
    type: String,
    required: [true, 'Le libellé est requis'],
    // Stocké chiffré
  },
  amount: {
    type: String, // Stocké chiffré (sera un nombre une fois déchiffré)
    required: [true, 'Le montant est requis'],
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index composé pour performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });

// Chiffrement avant sauvegarde
transactionSchema.pre('save', function() {
  // Chiffrer le label s'il n'est pas déjà chiffré
  if (this.isModified('label') && this.label && !this.label.includes(':')) {
    this.label = encrypt(this.label);
  }

  // Chiffrer le montant s'il n'est pas déjà chiffré
  if (this.isModified('amount')) {
    const amountStr = String(this.amount);
    if (!amountStr.includes(':')) {
      this.amount = encryptNumber(this.amount);
    }
  }
});

// Déchiffrement après lecture
transactionSchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc.label && doc.label.includes(':')) {
        doc.label = decrypt(doc.label);
      }
      if (doc.amount && String(doc.amount).includes(':')) {
        doc.amount = decryptNumber(doc.amount);
      }
    });
  }
});

transactionSchema.post('findOne', function(doc) {
  if (doc) {
    if (doc.label && doc.label.includes(':')) {
      doc.label = decrypt(doc.label);
    }
    if (doc.amount && String(doc.amount).includes(':')) {
      doc.amount = decryptNumber(doc.amount);
    }
  }
});

// Virtual pour obtenir la date au format ISO (pour le frontend)
transactionSchema.virtual('dateISO').get(function() {
  return this.date ? this.date.toISOString().slice(0, 10) : null;
});

// Inclure les virtuals dans les conversions JSON
transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);
