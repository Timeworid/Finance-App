const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const { validate, categorySchema, categoryUpdateSchema } = require('../utils/validators');
const { writeLimiter } = require('../middleware/rateLimiter');

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

/**
 * GET /api/categories
 * Récupérer toutes les catégories de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.user.userId })
      .sort({ type: 1, name: 1 });

    res.json({
      categories,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des catégories',
    });
  }
});

/**
 * POST /api/categories
 * Créer une nouvelle catégorie
 */
router.post('/', writeLimiter, validate(categorySchema), async (req, res) => {
  try {
    const { name, type, color, budget, keywords } = req.body;

    // Vérifier si une catégorie avec ce nom existe déjà
    const existing = await Category.findOne({
      userId: req.user.userId,
      name: name.trim(),
    });

    if (existing) {
      return res.status(400).json({
        error: 'Une catégorie avec ce nom existe déjà',
      });
    }

    // Créer la catégorie
    const category = new Category({
      userId: req.user.userId,
      name: name.trim(),
      type,
      color,
      budget,
      keywords: keywords || [],
    });

    await category.save();

    res.status(201).json({
      message: 'Catégorie créée',
      category,
    });
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    res.status(500).json({
      error: 'Erreur lors de la création de la catégorie',
    });
  }
});

/**
 * PUT /api/categories/:id
 * Mettre à jour une catégorie
 */
router.put('/:id', writeLimiter, validate(categoryUpdateSchema), async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!category) {
      return res.status(404).json({
        error: 'Catégorie non trouvée',
      });
    }

    // Vérifier si le nouveau nom est déjà pris
    if (req.body.name && req.body.name !== category.name) {
      const existing = await Category.findOne({
        userId: req.user.userId,
        name: req.body.name.trim(),
        _id: { $ne: req.params.id },
      });

      if (existing) {
        return res.status(400).json({
          error: 'Une catégorie avec ce nom existe déjà',
        });
      }
    }

    // Mettre à jour les champs
    Object.keys(req.body).forEach(key => {
      category[key] = req.body[key];
    });

    await category.save();

    res.json({
      message: 'Catégorie mise à jour',
      category,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    res.status(500).json({
      error: 'Erreur lors de la mise à jour de la catégorie',
    });
  }
});

/**
 * DELETE /api/categories/:id
 * Supprimer une catégorie (et orpheliner les transactions)
 */
router.delete('/:id', writeLimiter, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!category) {
      return res.status(404).json({
        error: 'Catégorie non trouvée',
      });
    }

    // Orpheliner les transactions de cette catégorie
    await Transaction.updateMany(
      { category: req.params.id, userId: req.user.userId },
      { $set: { category: null } }
    );

    // Supprimer la catégorie
    await category.deleteOne();

    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression de la catégorie',
    });
  }
});

module.exports = router;
