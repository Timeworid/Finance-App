const mongoose = require('mongoose');
const { encryptNumber, decryptNumber } = require('../utils/encryption');

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startBalance: {
    type: String, // Stocké chiffré
    default: '0',
  },
  monthlyCapacity: {
    type: String, // Stocké chiffré
    default: '1000',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index unique pour performance et contrainte d'unicité
settingsSchema.index({ userId: 1 }, { unique: true });

// Chiffrement avant sauvegarde
settingsSchema.pre('save', function() {
  // Chiffrer startBalance si pas déjà chiffré
  if (this.isModified('startBalance')) {
    const balanceStr = String(this.startBalance);
    if (!balanceStr.includes(':')) {
      this.startBalance = encryptNumber(this.startBalance);
    }
  }

  // Chiffrer monthlyCapacity si pas déjà chiffré
  if (this.isModified('monthlyCapacity')) {
    const capacityStr = String(this.monthlyCapacity);
    if (!capacityStr.includes(':')) {
      this.monthlyCapacity = encryptNumber(this.monthlyCapacity);
    }
  }

  this.updatedAt = new Date();
});

// Déchiffrement après lecture
settingsSchema.post('findOne', function(doc) {
  if (doc) {
    if (doc.startBalance && String(doc.startBalance).includes(':')) {
      doc.startBalance = decryptNumber(doc.startBalance);
    }
    if (doc.monthlyCapacity && String(doc.monthlyCapacity).includes(':')) {
      doc.monthlyCapacity = decryptNumber(doc.monthlyCapacity);
    }
  }
});

module.exports = mongoose.model('Settings', settingsSchema);
