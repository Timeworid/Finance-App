const express = require('express');
const router = express.Router();
const RecurringItem = require('../models/RecurringItem');
const { authenticateToken } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const validateObjectId = require('../middleware/validateObjectId');
const logger = require('../config/logger');
const { validate, recurringSchema, recurringUpdateSchema } = require('../utils/validators');

// Toutes les routes sont protégées
router.use(authenticateToken);
router.param('id', validateObjectId);

/**
 * GET /api/recurring
 * Récupérer tous les éléments récurrents
 */
router.get('/', async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = { userId: req.user.userId };

    // Filtre typé en chaîne : empêche l'injection d'opérateurs Mongo
    if (type === 'revenue' || type === 'charge') filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const items = await RecurringItem.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      items,
      total: items.length,
    });
  } catch (error) {
    logger.error('Erreur récupération éléments récurrents', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * POST /api/recurring
 * Créer un nouvel élément récurrent
 */
router.post('/', writeLimiter, validate(recurringSchema), async (req, res) => {
  try {
    // req.body filtré par liste blanche Joi ; userId imposé côté serveur
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
    logger.error('Erreur création élément', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

/**
 * PUT /api/recurring/:id
 * Mettre à jour un élément
 */
router.put('/:id', writeLimiter, validate(recurringUpdateSchema), async (req, res) => {
  try {
    // find + save (et non findOneAndUpdate) : déclenche le hook de chiffrement du montant
    const item = await RecurringItem.findOne({ _id: req.params.id, userId: req.user.userId });

    if (!item) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    item.set(req.body);
    await item.save();

    res.json({
      success: true,
      message: 'Élément mis à jour avec succès',
      item,
    });
  } catch (error) {
    logger.error('Erreur mise à jour élément', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

/**
 * DELETE /api/recurring/:id
 * Supprimer un élément
 */
router.delete('/:id', writeLimiter, async (req, res) => {
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
    logger.error('Erreur suppression élément', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * GET /api/recurring/summary/all
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
    logger.error('Erreur résumé éléments récurrents', { error: error.message });
    res.status(500).json({ error: 'Erreur lors du calcul du résumé' });
  }
});

module.exports = router;
