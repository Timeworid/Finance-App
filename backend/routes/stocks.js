const express = require('express');
const router = express.Router();
const StockPosition = require('../models/StockPosition');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Toutes les routes sont protégées
router.use(authenticateToken);

/**
 * GET /api/stocks
 * Récupérer toutes les positions boursières
 */
router.get('/', async (req, res) => {
  try {
    const { type, account } = req.query;
    const filter = { userId: req.user.userId };

    if (type) filter.type = type;
    if (account) filter.account = account;

    const positions = await StockPosition.find(filter)
      .populate('account', 'name type')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      positions,
      total: positions.length,
    });
  } catch (error) {
    console.error('Erreur récupération positions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des positions' });
  }
});

/**
 * POST /api/stocks
 * Créer une nouvelle position
 */
router.post('/',
  [
    body('symbol').trim().notEmpty().withMessage('Le symbole est requis'),
    body('name').trim().notEmpty().withMessage('Le nom est requis'),
    body('type').isIn(['ETF', 'ACTION', 'CRYPTO']).withMessage('Type invalide'),
    body('quantity').isFloat({ min: 0 }).withMessage('La quantité doit être positive'),
    body('averageBuyPrice').isNumeric().withMessage('Le prix d\'achat doit être un nombre'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const position = new StockPosition({
        ...req.body,
        userId: req.user.userId,
      });

      await position.save();

      res.status(201).json({
        success: true,
        message: 'Position créée avec succès',
        position,
      });
    } catch (error) {
      console.error('Erreur création position:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la position' });
    }
  }
);

/**
 * PUT /api/stocks/:id
 * Mettre à jour une position
 */
router.put('/:id', async (req, res) => {
  try {
    const position = await StockPosition.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('account', 'name type');

    if (!position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    res.json({
      success: true,
      message: 'Position mise à jour avec succès',
      position,
    });
  } catch (error) {
    console.error('Erreur mise à jour position:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la position' });
  }
});

/**
 * DELETE /api/stocks/:id
 * Supprimer une position
 */
router.delete('/:id', async (req, res) => {
  try {
    const position = await StockPosition.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    res.json({
      success: true,
      message: 'Position supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur suppression position:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la position' });
  }
});

/**
 * GET /api/stocks/portfolio/summary
 * Obtenir un résumé du portefeuille
 */
router.get('/portfolio/summary', async (req, res) => {
  try {
    const positions = await StockPosition.find({ userId: req.user.userId })
      .populate('account', 'name type');

    const summary = {
      totalValue: 0,
      totalCost: 0,
      totalProfitLoss: 0,
      totalProfitLossPercentage: 0,
      byType: {},
      byAccount: {},
      positions: [],
    };

    positions.forEach(position => {
      const value = position.getTotalValue();
      const cost = position.getTotalCost();
      const profitLoss = position.getProfitLoss();
      const profitLossPercentage = position.getProfitLossPercentage();

      summary.totalValue += value;
      summary.totalCost += cost;
      summary.totalProfitLoss += profitLoss;

      // Par type
      if (!summary.byType[position.type]) {
        summary.byType[position.type] = {
          count: 0,
          value: 0,
          cost: 0,
          profitLoss: 0,
        };
      }
      summary.byType[position.type].count++;
      summary.byType[position.type].value += value;
      summary.byType[position.type].cost += cost;
      summary.byType[position.type].profitLoss += profitLoss;

      // Par compte
      if (position.account) {
        const accountId = position.account._id.toString();
        if (!summary.byAccount[accountId]) {
          summary.byAccount[accountId] = {
            name: position.account.name,
            type: position.account.type,
            count: 0,
            value: 0,
            cost: 0,
            profitLoss: 0,
          };
        }
        summary.byAccount[accountId].count++;
        summary.byAccount[accountId].value += value;
        summary.byAccount[accountId].cost += cost;
        summary.byAccount[accountId].profitLoss += profitLoss;
      }

      summary.positions.push({
        symbol: position.symbol,
        name: position.name,
        type: position.type,
        quantity: position.quantity,
        value,
        cost,
        profitLoss,
        profitLossPercentage,
      });
    });

    if (summary.totalCost > 0) {
      summary.totalProfitLossPercentage =
        ((summary.totalProfitLoss / summary.totalCost) * 100).toFixed(2);
    }

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Erreur résumé portefeuille:', error);
    res.status(500).json({ error: 'Erreur lors du calcul du résumé' });
  }
});

/**
 * POST /api/stocks/prices/update
 * Mettre à jour les prix actuels (en attendant API externe)
 */
router.post('/prices/update', async (req, res) => {
  try {
    const { updates } = req.body; // { symbol: price, ... }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Format de mise à jour invalide' });
    }

    const results = [];

    for (const [symbol, price] of Object.entries(updates)) {
      const updated = await StockPosition.updateMany(
        { userId: req.user.userId, symbol: symbol.toUpperCase() },
        { $set: { currentPrice: parseFloat(price) } }
      );

      results.push({ symbol, updated: updated.modifiedCount });
    }

    res.json({
      success: true,
      message: 'Prix mis à jour avec succès',
      results,
    });
  } catch (error) {
    console.error('Erreur mise à jour prix:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des prix' });
  }
});

module.exports = router;
