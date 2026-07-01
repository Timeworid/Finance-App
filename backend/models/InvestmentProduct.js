const mongoose = require('mongoose');
const { encryptNumber, decryptNumber } = require('../utils/encryption');

/**
 * Modèle pour les produits d'investissement
 * Supporte : LEP, Livret Jeune, PEL, Livret A, Compte titres, PEA, PER, Assurance Vie
 */
const investmentProductSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom du produit est requis'],
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Le type de produit est requis'],
    enum: [
      'LEP', // Livret d'Épargne Populaire
      'LIVRET_JEUNE', // Livret Jeune
      'PEL', // Plan Épargne Logement
      'LIVRET_A', // Livret A
      'COMPTE_TITRES', // Compte titres ordinaire
      'EPARGNE_PILOTEE', // Compte épargne financière pilotée
      'PEA_LIBRE', // PEA en gestion libre
      'PEA_PILOTE', // PEA en gestion pilotée
      'PER', // Plan Épargne Retraite
      'ASSURANCE_VIE', // Assurance Vie
    ],
  },
  balance: {
    type: String, // Chiffré
    required: [true, 'Le solde est requis'],
  },
  interestRate: {
    type: Number, // Taux d'intérêt annuel (%)
    default: 0,
    min: 0,
    max: 100,
  },
  taxRate: {
    type: Number, // Taux d'imposition (%)
    default: 0,
    min: 0,
    max: 100,
  },
  managementFees: {
    type: Number, // Frais de gestion annuels (%)
    default: 0,
    min: 0,
    max: 10,
  },
  managementFeesType: {
    type: String,
    enum: ['percentage', 'real_gains'], // % du capital ou % des plus-values
    default: 'percentage',
  },
  monthlyContribution: {
    type: String, // Chiffré - Versement mensuel
    default: '0',
  },
  openingDate: {
    type: Date,
    default: Date.now,
  },
  ceiling: {
    type: Number, // Plafond réglementaire (si applicable)
    default: null,
  },
  accountingMode: {
    type: String,
    enum: ['comptable', 'realiste'], // Vue comptable ou plus-values réelles
    default: 'comptable',
  },
  broker: {
    type: String, // Nom du courtier/banque
    trim: true,
    default: '',
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
investmentProductSchema.index({ userId: 1 });
investmentProductSchema.index({ userId: 1, type: 1 });

// Chiffrement avant sauvegarde
investmentProductSchema.pre('save', function() {
  // Chiffrer balance si pas déjà chiffré
  if (this.isModified('balance')) {
    const balanceStr = String(this.balance);
    if (!balanceStr.includes(':')) {
      this.balance = encryptNumber(this.balance);
    }
  }

  // Chiffrer monthlyContribution si pas déjà chiffré
  if (this.isModified('monthlyContribution')) {
    const contributionStr = String(this.monthlyContribution);
    if (!contributionStr.includes(':')) {
      this.monthlyContribution = encryptNumber(this.monthlyContribution);
    }
  }
});

// Déchiffrement après lecture
investmentProductSchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc.balance && String(doc.balance).includes(':')) {
        doc.balance = decryptNumber(doc.balance);
      }
      if (doc.monthlyContribution && String(doc.monthlyContribution).includes(':')) {
        doc.monthlyContribution = decryptNumber(doc.monthlyContribution);
      }
    });
  }
});

investmentProductSchema.post('findOne', function(doc) {
  if (doc) {
    if (doc.balance && String(doc.balance).includes(':')) {
      doc.balance = decryptNumber(doc.balance);
    }
    if (doc.monthlyContribution && String(doc.monthlyContribution).includes(':')) {
      doc.monthlyContribution = decryptNumber(doc.monthlyContribution);
    }
  }
});

// Méthodes utilitaires
investmentProductSchema.methods.calculateProjection = function(years) {
  const balance = parseFloat(this.balance) || 0;
  const monthlyContrib = parseFloat(this.monthlyContribution) || 0;
  const rate = this.interestRate / 100;
  const taxRate = this.taxRate / 100;
  const mgmtFees = this.managementFees / 100;

  const projection = [];
  let currentBalance = balance;

  for (let year = 1; year <= years; year++) {
    // Versements annuels
    const annualContrib = monthlyContrib * 12;
    currentBalance += annualContrib;

    // Intérêts bruts
    const grossInterest = currentBalance * rate;

    // Frais de gestion
    let fees = 0;
    if (this.managementFeesType === 'percentage') {
      fees = currentBalance * mgmtFees;
    } else {
      fees = grossInterest * mgmtFees;
    }

    // Impôts sur les intérêts
    const taxes = grossInterest * taxRate;

    // Intérêts nets
    const netInterest = grossInterest - fees - taxes;

    currentBalance += netInterest;

    projection.push({
      year,
      balance: Math.round(currentBalance * 100) / 100,
      contributions: Math.round((balance + annualContrib * year) * 100) / 100,
      gains: Math.round((currentBalance - balance - annualContrib * year) * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      taxes: Math.round(taxes * 100) / 100,
    });
  }

  return projection;
};

module.exports = mongoose.model('InvestmentProduct', investmentProductSchema);
