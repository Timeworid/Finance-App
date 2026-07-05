const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { authenticateToken } = require('../middleware/auth');
const { validate, transactionSchema, transactionBatchSchema } = require('../utils/validators');
const { writeLimiter, importLimiter } = require('../middleware/rateLimiter');

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

/**
 * GET /api/transactions
 * Récupérer toutes les transactions de l'utilisateur avec filtres
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 400,
      offset = 0,
      category,
      search,
      startDate,
      endDate,
    } = req.query;

    // Construction de la requête
    const query = { userId: req.user.userId };

    // Filtre par catégorie
    if (category) {
      if (category === 'none') {
        query.category = null;
      } else {
        query.category = category;
      }
    }

    // Filtre par date
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Filtre par recherche textuelle (sur le label une fois déchiffré)
    // Note: La recherche se fera après déchiffrement côté client pour l'instant
    // Pour une recherche côté serveur, il faudrait un index de recherche chiffré

    // Exécuter la requête
    const transactions = await Transaction.find(query)
      .populate('category', 'name color type')
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Filtre de recherche textuelle (après déchiffrement)
    let filtered = transactions;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = transactions.filter(t =>
        t.label && t.label.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      transactions: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
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
    console.error('Erreur lors de la création de la transaction:', error);
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
    const docs = transactions.map(t => ({
      userId: req.user.userId,
      date: new Date(t.date),
      label: t.label,
      amount: t.amount,
      category: t.category || null,
    }));

    const created = await Transaction.insertMany(docs);

    res.status(201).json({
      message: 'Transactions importées',
      imported: created.length,
    });
  } catch (error) {
    console.error('Erreur lors de l\'import de transactions:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'import de transactions',
    });
  }
});

/**
 * PUT /api/transactions/:id
 * Modifier une transaction
 */
router.put('/:id', writeLimiter, async (req, res) => {
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
    if (req.body.category && req.body.category !== '' && req.body.category !== null) {
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
      transaction.category = (req.body.category && req.body.category !== '') ? req.body.category : null;
    }

    await transaction.save();

    // Populate category avant de renvoyer
    await transaction.populate('category', 'name color type');

    res.json({
      message: 'Transaction mise à jour',
      transaction,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la transaction:', error);
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
    console.error('Erreur lors de la suppression de la transaction:', error);
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
    const transactions = await Transaction.find({
      userId: req.user.userId,
    });

    // Calculs statistiques simples
    const income = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = Math.abs(
      transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    const balance = income - expenses;

    res.json({
      income,
      expenses,
      balance,
      count: transactions.length,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des stats:', error);
    res.status(500).json({
      error: 'Erreur lors du calcul des statistiques',
    });
  }
});

module.exports = router;
