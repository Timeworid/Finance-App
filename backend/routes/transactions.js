const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { authenticateToken } = require('../middleware/auth');
const {
  validate,
  transactionSchema,
  transactionBatchSchema,
  transactionUpdateSchema,
  transactionQuerySchema,
} = require('../utils/validators');
const { writeLimiter, importLimiter } = require('../middleware/rateLimiter');
const validateObjectId = require('../middleware/validateObjectId');
const logger = require('../config/logger');
const { encrypt, encryptNumber } = require('../utils/encryption');

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);
router.param('id', validateObjectId);

/**
 * GET /api/transactions
 * Récupérer toutes les transactions de l'utilisateur avec filtres
 */
router.get('/', validate(transactionQuerySchema, 'query'), async (req, res) => {
  try {
    // Paramètres validés et typés (limit plafonné à 1000 → pas de chargement massif)
    const { limit, offset, category, search, startDate, endDate } = req.validatedQuery;

    // Construction de la requête
    const query = { userId: req.user.userId };

    if (category) {
      query.category = category === 'none' ? null : category;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    let transactions;
    let total;

    if (search) {
      // Les libellés étant chiffrés, la recherche ne peut pas se faire en base :
      // on déchiffre puis on filtre AVANT de paginer, pour que limit/offset/total
      // portent sur les résultats réels (et non sur une page déjà tronquée).
      const searchLower = search.toLowerCase();
      const all = await Transaction.find(query)
        .populate('category', 'name color type')
        .sort({ date: -1 });

      const matches = all.filter(t => t.getLabel().toLowerCase().includes(searchLower));
      total = matches.length;
      transactions = matches.slice(offset, offset + limit);
    } else {
      // Sans recherche : pagination et comptage directement en base (en parallèle)
      [transactions, total] = await Promise.all([
        Transaction.find(query)
          .populate('category', 'name color type')
          .sort({ date: -1 })
          .skip(offset)
          .limit(limit),
        Transaction.countDocuments(query),
      ]);
    }

    res.json({
      transactions,
      total,
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des transactions', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la récupération des transactions',
    });
  }
});

/**
 * POST /api/transactions
 * Créer une nouvelle transaction
 */
router.post('/', writeLimiter, validate(transactionSchema), async (req, res) => {
  try {
    const { date, label, amount, category } = req.body;

    // Vérifier que la catégorie appartient à l'utilisateur si fournie
    if (category) {
      const cat = await Category.findOne({ _id: category, userId: req.user.userId });
      if (!cat) {
        return res.status(400).json({
          error: 'Catégorie invalide ou non autorisée',
        });
      }
    }

    // Créer la transaction
    const transaction = new Transaction({
      userId: req.user.userId,
      date: new Date(date),
      label,
      amount,
      category: category || null,
    });

    await transaction.save();

    // Populate category avant de renvoyer
    await transaction.populate('category', 'name color type');

    res.status(201).json({
      message: 'Transaction créée',
      transaction,
    });
  } catch (error) {
    logger.error('Erreur lors de la création de la transaction', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la création de la transaction',
    });
  }
});

/**
 * POST /api/transactions/batch
 * Import de transactions en masse (CSV)
 */
router.post('/batch', importLimiter, validate(transactionBatchSchema), async (req, res) => {
  try {
    const { transactions } = req.body;

    // Vérifier que toutes les catégories appartiennent à l'utilisateur
    const categoryIds = [...new Set(
      transactions
        .map(t => t.category)
        .filter(c => c !== null && c !== undefined)
    )];

    if (categoryIds.length > 0) {
      const userCategories = await Category.find({
        _id: { $in: categoryIds },
        userId: req.user.userId,
      });

      if (userCategories.length !== categoryIds.length) {
        return res.status(400).json({
          error: 'Une ou plusieurs catégories sont invalides',
        });
      }
    }

    // Créer toutes les transactions
    // insertMany ne déclenche PAS le hook pre('save') : chiffrement explicite ici,
    // sinon les transactions importées seraient stockées en clair.
    const docs = transactions.map(t => ({
      userId: req.user.userId,
      date: new Date(t.date),
      label: encrypt(t.label),
      amount: encryptNumber(t.amount),
      category: t.category || null,
    }));

    const created = await Transaction.insertMany(docs);

    res.status(201).json({
      message: 'Transactions importées',
      imported: created.length,
    });
  } catch (error) {
    logger.error('Erreur lors de l\'import de transactions', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de l\'import de transactions',
    });
  }
});

/**
 * PUT /api/transactions/:id
 * Modifier une transaction
 */
router.put('/:id', writeLimiter, validate(transactionUpdateSchema), async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction non trouvée',
      });
    }

    // Vérifier que la catégorie appartient à l'utilisateur si fournie et non vide
    if (req.body.category) {
      const cat = await Category.findOne({ _id: req.body.category, userId: req.user.userId });
      if (!cat) {
        return res.status(400).json({
          error: 'Catégorie invalide ou non autorisée',
        });
      }
    }

    // Mettre à jour les champs autorisés
    if (req.body.date !== undefined) transaction.date = new Date(req.body.date);
    if (req.body.label !== undefined) transaction.label = req.body.label;
    if (req.body.amount !== undefined) transaction.amount = req.body.amount;
    if (req.body.category !== undefined) {
      // Convertir chaîne vide en null
      transaction.category = req.body.category || null;
    }

    await transaction.save();

    // Populate category avant de renvoyer
    await transaction.populate('category', 'name color type');

    res.json({
      message: 'Transaction mise à jour',
      transaction,
    });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de la transaction', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la mise à jour de la transaction',
    });
  }
});

/**
 * DELETE /api/transactions/:id
 * Supprimer une transaction
 */
router.delete('/:id', writeLimiter, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction non trouvée',
      });
    }

    await transaction.deleteOne();

    res.status(204).send();
  } catch (error) {
    logger.error('Erreur lors de la suppression de la transaction', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la suppression de la transaction',
    });
  }
});

/**
 * GET /api/transactions/stats
 * Statistiques sur les transactions (pour le dashboard)
 */
router.get('/stats', async (req, res) => {
  try {
    // Projection minimale : seul le montant chiffré est nécessaire
    const transactions = await Transaction.find({ userId: req.user.userId }).select('amount');

    // Une seule passe, sur les montants DÉCHIFFRÉS (avant : comparaison de chaînes chiffrées → 0)
    let income = 0;
    let expenses = 0;
    for (const t of transactions) {
      const amount = t.getAmount();
      if (amount > 0) income += amount;
      else expenses -= amount;
    }

    res.json({
      income,
      expenses,
      balance: income - expenses,
      count: transactions.length,
    });
  } catch (error) {
    logger.error('Erreur lors du calcul des stats', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors du calcul des statistiques',
    });
  }
});

module.exports = router;
