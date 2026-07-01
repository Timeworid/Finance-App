const mongoose = require('mongoose');
const { encryptNumber, decryptNumber } = require('../utils/encryption');

const envelopeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    minlength: [1, 'Le nom doit contenir au moins 1 caractère'],
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
  },
  type: {
    type: String,
    required: [true, 'Le type est requis'],
    trim: true,
  },
  balance: {
    type: String, // Stocké chiffré
    required: [true, 'Le solde est requis'],
  },
  expectedReturn: {
    type: Number,
    default: 0,
    min: [-100, 'Le rendement ne peut pas être inférieur à -100%'],
    max: [1000, 'Le rendement ne peut pas dépasser 1000%'],
  },
  monthly: {
    type: String, // Stocké chiffré
    default: '0',
  },
  color: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Format de couleur invalide'],
    default: '#2dd4bf',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index pour performance
envelopeSchema.index({ userId: 1 });
envelopeSchema.index({ userId: 1, name: 1 });

// Chiffrement avant sauvegarde
envelopeSchema.pre('save', function() {
  // Chiffrer balance si pas déjà chiffré
  if (this.isModified('balance')) {
    const balanceStr = String(this.balance);
    if (!balanceStr.includes(':')) {
      this.balance = encryptNumber(this.balance);
    }
  }

  // Chiffrer monthly si pas déjà chiffré
  if (this.isModified('monthly')) {
    const monthlyStr = String(this.monthly);
    if (!monthlyStr.includes(':')) {
      this.monthly = encryptNumber(this.monthly);
    }
  }
});

// Déchiffrement après lecture
envelopeSchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc.balance && String(doc.balance).includes(':')) {
        doc.balance = decryptNumber(doc.balance);
      }
      if (doc.monthly && String(doc.monthly).includes(':')) {
        doc.monthly = decryptNumber(doc.monthly);
      }
    });
  }
});

envelopeSchema.post('findOne', function(doc) {
  if (doc) {
    if (doc.balance && String(doc.balance).includes(':')) {
      doc.balance = decryptNumber(doc.balance);
    }
    if (doc.monthly && String(doc.monthly).includes(':')) {
      doc.monthly = decryptNumber(doc.monthly);
    }
  }
});

module.exports = mongoose.model('Envelope', envelopeSchema);
