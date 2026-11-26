const Joi = require('joi');
const logger = require('../config/logger');

/**
 * Schémas de validation Joi pour toutes les entrées
 */

// Validation pour l'inscription
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Format d\'email invalide',
      'any.required': 'L\'email est requis',
    }),
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
      'string.max': 'Le mot de passe ne peut pas dépasser 100 caractères',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
      'any.required': 'Le mot de passe est requis',
    }),
  firstName: Joi.string()
    .trim()
    .max(50)
    .allow('')
    .optional(),
  lastName: Joi.string()
    .trim()
    .max(50)
    .allow('')
    .optional(),
});

// Validation pour la connexion
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Format d\'email invalide',
      'any.required': 'L\'email est requis',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Le mot de passe est requis',
    }),
});

// Validation pour une transaction
const transactionSchema = Joi.object({
  date: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'Format de date invalide',
      'any.required': 'La date est requise',
    }),
  label: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Le libellé doit contenir au moins 1 caractère',
      'string.max': 'Le libellé ne peut pas dépasser 200 caractères',
      'any.required': 'Le libellé est requis',
    }),
  amount: Joi.number()
    .required()
    .min(-999999999)
    .max(999999999)
    .messages({
      'number.base': 'Le montant doit être un nombre',
      'any.required': 'Le montant est requis',
    }),
  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .optional()
    .messages({
      'string.pattern.base': 'ID de catégorie invalide',
    }),
});

// Validation pour batch de transactions
const transactionBatchSchema = Joi.object({
  transactions: Joi.array()
    .items(transactionSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'Au moins une transaction est requise',
      'array.max': 'Maximum 1000 transactions par import',
      'any.required': 'Le tableau de transactions est requis',
    }),
});

// Validation pour une catégorie
const categorySchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Le nom doit contenir au moins 1 caractère',
      'string.max': 'Le nom ne peut pas dépasser 50 caractères',
      'any.required': 'Le nom est requis',
    }),
  type: Joi.string()
    .valid('depense', 'revenu')
    .required()
    .messages({
      'any.only': 'Le type doit être "depense" ou "revenu"',
      'any.required': 'Le type est requis',
    }),
  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .required()
    .messages({
      'string.pattern.base': 'Format de couleur invalide (utilisez #RRGGBB)',
      'any.required': 'La couleur est requise',
    }),
  budget: Joi.number()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Le budget ne peut pas être négatif',
    }),
  keywords: Joi.array()
    .items(Joi.string().trim())
    .default([]),
});

// Validation pour mise à jour d'une catégorie (tous les champs optionnels)
const categoryUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional(),
  type: Joi.string()
    .valid('depense', 'revenu')
    .optional(),
  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .optional(),
  budget: Joi.number()
    .min(0)
    .optional(),
  keywords: Joi.array()
    .items(Joi.string().trim())
    .optional(),
}).min(1); // Au moins un champ requis

// Validation pour une enveloppe
const envelopeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Le nom doit contenir au moins 1 caractère',
      'string.max': 'Le nom ne peut pas dépasser 100 caractères',
      'any.required': 'Le nom est requis',
    }),
  type: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Le type est requis',
    }),
  balance: Joi.number()
    .required()
    .min(-999999999)
    .max(999999999)
    .messages({
      'number.base': 'Le solde doit être un nombre',
      'any.required': 'Le solde est requis',
    }),
  expectedReturn: Joi.number()
    .min(-100)
    .max(1000)
    .default(0)
    .messages({
      'number.min': 'Le rendement ne peut pas être inférieur à -100%',
      'number.max': 'Le rendement ne peut pas dépasser 1000%',
    }),
  monthly: Joi.number()
    .min(-999999999)
    .max(999999999)
    .default(0)
    .messages({
      'number.base': 'Le versement mensuel doit être un nombre',
    }),
  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .optional()
    .messages({
      'string.pattern.base': 'Format de couleur invalide',
    }),
});

// Validation pour mise à jour d'une enveloppe
const envelopeUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
  type: Joi.string()
    .trim()
    .optional(),
  balance: Joi.number()
    .min(-999999999)
    .max(999999999)
    .optional(),
  expectedReturn: Joi.number()
    .min(-100)
    .max(1000)
    .optional(),
  monthly: Joi.number()
    .min(-999999999)
    .max(999999999)
    .optional(),
  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .optional(),
}).min(1);

// Validation pour les settings
const settingsSchema = Joi.object({
  startBalance: Joi.number()
    .min(-999999999)
    .max(999999999)
    .optional(),
  monthlyCapacity: Joi.number()
    .min(-999999999)
    .max(999999999)
    .optional(),
}).min(1);

// ObjectId MongoDB (24 caractères hex)
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// Bornes communes pour les montants (évite les valeurs absurdes / Infinity)
const money = Joi.number().min(-999999999).max(999999999);

// Mise à jour d'une transaction : mêmes règles que la création, champs optionnels
const transactionUpdateSchema = Joi.object({
  date: Joi.date().iso(),
  label: Joi.string().trim().min(1).max(200),
  amount: money,
  category: objectId.allow(null, ''),
}).min(1);

// Catégories autorisées pour les éléments récurrents (identiques au modèle)
const RECURRING_CATEGORIES = [
  'salaire', 'prime', 'allocation', 'pension', 'investissement', 'autre_revenu',
  'logement', 'energie', 'internet', 'telephone', 'assurance', 'transport',
  'abonnements', 'autre_charge',
];

// Champs d'un élément récurrent (liste blanche : userId & co. sont rejetés via stripUnknown)
const recurringFields = {
  name: Joi.string().trim().min(1).max(100),
  type: Joi.string().valid('revenue', 'charge'),
  amount: Joi.number().min(0).max(999999999),
  frequency: Joi.string().valid('weekly', 'monthly', 'quarterly', 'yearly'),
  category: Joi.string().valid(...RECURRING_CATEGORIES),
  startDate: Joi.date().iso().allow(null, ''),
  endDate: Joi.date().iso().allow(null, ''),
  isActive: Joi.boolean(),
  dayOfMonth: Joi.number().integer().min(1).max(31),
  notes: Joi.string().trim().max(500).allow(''),
};

const recurringSchema = Joi.object({
  ...recurringFields,
  name: recurringFields.name.required(),
  type: recurringFields.type.required(),
  amount: recurringFields.amount.required(),
  frequency: recurringFields.frequency.required(),
  category: recurringFields.category.required(),
});

const recurringUpdateSchema = Joi.object(recurringFields).min(1);

// Champs d'une position boursière (liste blanche)
const stockFields = {
  symbol: Joi.string().trim().min(1).max(20),
  name: Joi.string().trim().min(1).max(100),
  type: Joi.string().valid('ETF', 'ACTION', 'CRYPTO'),
  quantity: Joi.number().min(0).max(1e12),
  averageBuyPrice: Joi.number().min(0).max(1e12),
  currentPrice: Joi.number().min(0).max(1e12),
  currency: Joi.string().valid('EUR', 'USD', 'GBP'),
  account: Joi.string().trim().max(100).allow(''),
  sector: Joi.string().trim().max(100).allow(''),
  region: Joi.string().trim().max(100).allow(''),
  purchaseDate: Joi.date().iso().allow(null, ''),
  dividendYield: Joi.number().min(0).max(100),
  notes: Joi.string().trim().max(500).allow(''),
};

const stockSchema = Joi.object({
  ...stockFields,
  symbol: stockFields.symbol.required(),
  name: stockFields.name.required(),
  type: stockFields.type.required(),
  quantity: stockFields.quantity.required(),
  averageBuyPrice: stockFields.averageBuyPrice.required(),
});

const stockUpdateSchema = Joi.object(stockFields).min(1);

// Mise à jour des prix : { updates: { "CW8": 512.3, ... } } — 500 symboles max
const stockPricesSchema = Joi.object({
  updates: Joi.object()
    .pattern(Joi.string().trim().min(1).max(20), Joi.number().min(0).max(1e12))
    .max(500)
    .required(),
});

// Catégories de biens (identiques au modèle Asset)
const ASSET_CATEGORIES = ['vehicule', 'immobilier', 'electronique', 'mobilier', 'bijoux', 'collection', 'autre'];

// Champs d'un bien. Les champs facultatifs acceptent '' (formulaire vide) :
// '' est converti en « absent » (.empty('')), puis en valeur par défaut à la création.
const assetFields = {
  name: Joi.string().trim().min(1).max(100),
  category: Joi.string().valid(...ASSET_CATEGORIES),
  currentValue: Joi.number().min(0).max(1e12),
  purchasePrice: Joi.number().min(0).max(1e12).empty('').allow(null),
  purchaseDate: Joi.date().iso().empty('').allow(null),
  description: Joi.string().trim().max(1000).allow(''),
};

const assetSchema = Joi.object({
  ...assetFields,
  name: assetFields.name.required(),
  category: assetFields.category.required(),
  currentValue: assetFields.currentValue.required(),
  purchasePrice: assetFields.purchasePrice.default(0),
  purchaseDate: assetFields.purchaseDate.default(null),
  description: assetFields.description.default(''),
});

// Mise à jour : un champ facultatif vidé ('' ou null) est remis à sa valeur neutre
const assetUpdateSchema = Joi.object({
  ...assetFields,
  purchasePrice: Joi.number().min(0).max(1e12).allow(null, '').custom((v) => (v === '' || v === null ? 0 : v)),
  purchaseDate: Joi.date().iso().allow(null, '').custom((v) => (v === '' ? null : v)),
}).min(1);

// Paramètres de liste des transactions (query string)
const transactionQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(1000).default(400),
  offset: Joi.number().integer().min(0).default(0),
  category: Joi.alternatives().try(objectId, Joi.string().valid('none')),
  search: Joi.string().trim().max(100).allow(''),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
});

/**
 * Middleware de validation générique
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source] ?? {}, { // Express 5 : req.body peut être undefined
      abortEarly: false, // Retourner toutes les erreurs
      stripUnknown: true, // Supprimer les champs inconnus
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      // Ne jamais journaliser req.body : il peut contenir mots de passe et montants
      logger.warn('Validation error', { path: req.originalUrl, fields: errors.map(e => e.field) });

      return res.status(400).json({
        error: 'Erreur de validation',
        details: errors,
      });
    }

    // Express 5 : req.query est un getter en lecture seule → stockage dans req.validatedQuery
    if (source === 'query') req.validatedQuery = value;
    else req[source] = value;
    next();
  };
};

module.exports = {
  registerSchema,
  loginSchema,
  transactionSchema,
  transactionBatchSchema,
  categorySchema,
  categoryUpdateSchema,
  envelopeSchema,
  envelopeUpdateSchema,
  settingsSchema,
  transactionUpdateSchema,
  transactionQuerySchema,
  recurringSchema,
  recurringUpdateSchema,
  stockSchema,
  stockUpdateSchema,
  stockPricesSchema,
  assetSchema,
  assetUpdateSchema,
  validate,
};
