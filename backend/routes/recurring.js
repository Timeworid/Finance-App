const express = require('express');
const router = express.Router();
const RecurringItem = require('../models/RecurringItem');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Toutes les routes sont protégées
router.use(authenticateToken);

/**
 * GET /api/recurring
 * Récupérer tous les éléments récurrents
 */
router.get('/', async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = { userId: req.user.userId };

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const items = await RecurringItem.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      items,
      total: items.length,
    });
  } catch (error) {
    console.error('Erreur récupération éléments récurrents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * POST /api/recurring
 * Créer un nouvel élément récurrent
 */
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Le nom est requis'),
    body('type').isIn(['revenue', 'charge']).withMessage('Type invalide'),
    body('amount').isNumeric().withMessage('Le montant doit être un nombre'),
    body('frequency').isIn(['weekly', 'monthly', 'quarterly', 'yearly']).withMessage('Fréquence invalide'),
    body('category').notEmpty().withMessage('La catégorie est requise'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const item = new RecurringItem({
        ...req.body,
        userId: req.user.userId,
      });

      await item.save();

      res.status(201).json({
        success: true,
        message: 'Élément créé avec succès',
        item,
      });
    } catch (error) {
      console.error('Erreur création élément:', error);
      res.status(500).json({ error: 'Erreur lors de la création' });
    }
  }
);

/**
 * PUT /api/recurring/:id
 * Mettre à jour un élément
 */
router.put('/:id', async (req, res) => {
  try {
    const item = await RecurringItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    res.json({
      success: true,
      message: 'Élément mis à jour avec succès',
      item,
    });
  } catch (error) {
    console.error('Erreur mise à jour élément:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

/**
 * DELETE /api/recurring/:id
 * Supprimer un élément
 */
router.delete('/:id', async (req, res) => {
  try {
    const item = await RecurringItem.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!item) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    res.json({
      success: true,
      message: 'Élément supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur suppression élément:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * GET /api/recurring/summary
 * Obtenir un résumé des revenus et charges récurrents
 */
router.get('/summary/all', async (req, res) => {
  try {
    const items = await RecurringItem.find({
      userId: req.user.userId,
      isActive: true,
    });

    const summary = {
      revenues: {
        monthly: 0,
        yearly: 0,
        items: [],
      },
      charges: {
        monthly: 0,
        yearly: 0,
        items: [],
      },
      netMonthly: 0,
      netYearly: 0,
    };

    items.forEach(item => {
      const monthly = item.getMonthlyAmount();
      const yearly = item.getAnnualAmount();

      if (item.type === 'revenue') {
        summary.revenues.monthly += monthly;
        summary.revenues.yearly += yearly;
        summary.revenues.items.push({
          name: item.name,
          category: item.category,
          monthly,
          yearly,
        });
      } else {
        summary.charges.monthly += monthly;
        summary.charges.yearly += yearly;
        summary.charges.items.push({
          name: item.name,
          category: item.category,
          monthly,
          yearly,
        });
      }
    });

    summary.netMonthly = summary.revenues.monthly - summary.charges.monthly;
    summary.netYearly = summary.revenues.yearly - summary.charges.yearly;

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Erreur résumé éléments récurrents:', error);
    res.status(500).json({ error: 'Erreur lors du calcul du résumé' });
  }
});

module.exports = router;
