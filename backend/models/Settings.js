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

// Mapper _id vers id pour le frontend ET déchiffrer les champs sensibles
settingsSchema.set('toJSON', {
  versionKey: false,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;

    // Déchiffrer les champs pour le JSON
    if (ret.startBalance && String(ret.startBalance).includes(':')) {
      ret.startBalance = decryptNumber(ret.startBalance);
    }
    if (ret.monthlyCapacity && String(ret.monthlyCapacity).includes(':')) {
      ret.monthlyCapacity = decryptNumber(ret.monthlyCapacity);
    }
  }
});

module.exports = mongoose.model('Settings', settingsSchema);
