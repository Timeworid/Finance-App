const Joi = require('joi');

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

/**
 * Middleware de validation générique
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Retourner toutes les erreurs
      stripUnknown: true, // Supprimer les champs inconnus
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Erreur de validation',
        details: errors,
      });
    }

    // Remplacer req.body par les valeurs validées
    req.body = value;
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
  validate,
};
