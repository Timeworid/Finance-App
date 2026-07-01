const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    minlength: [1, 'Le nom doit contenir au moins 1 caractère'],
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères'],
  },
  type: {
    type: String,
    required: [true, 'Le type est requis'],
    enum: {
      values: ['depense', 'revenu'],
      message: 'Le type doit être "depense" ou "revenu"',
    },
  },
  color: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Format de couleur invalide (utilisez #RRGGBB)'],
    default: '#60a5fa',
  },
  budget: {
    type: Number,
    default: 0,
    min: [0, 'Le budget ne peut pas être négatif'],
  },
  keywords: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index composé pour performance
categorySchema.index({ userId: 1, name: 1 });
categorySchema.index({ userId: 1, type: 1 });

// Nettoyer les mots-clés (trim, lowercase)
categorySchema.pre('save', function() {
  if (this.isModified('keywords') && Array.isArray(this.keywords)) {
    this.keywords = this.keywords
      .map(k => String(k).trim().toLowerCase())
      .filter(k => k.length > 0);
  }
});

// Mapper _id vers id pour le frontend
categorySchema.set('toJSON', {
  versionKey: false,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  }
});

module.exports = mongoose.model('Category', categorySchema);
