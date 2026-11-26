const express = require('express');
const router = express.Router();
const StockPosition = require('../models/StockPosition');
const { authenticateToken } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const validateObjectId = require('../middleware/validateObjectId');
const logger = require('../config/logger');
const {
  validate,
  stockSchema,
  stockUpdateSchema,
  stockPricesSchema,
} = require('../utils/validators');

// Toutes les routes sont protégées
router.use(authenticateToken);
router.param('id', validateObjectId);

const VALID_TYPES = new Set(['ETF', 'ACTION', 'CRYPTO']);

/**
 * GET /api/stocks
 * Récupérer toutes les positions boursières
 */
router.get('/', async (req, res) => {
  try {
    const { type, account } = req.query;
    const filter = { userId: req.user.userId };

    // Filtres typés en chaîne : empêche l'injection d'opérateurs Mongo (?type[$ne]=x)
    if (typeof type === 'string' && VALID_TYPES.has(type)) filter.type = type;
    if (typeof account === 'string') filter.account = account;

    // `account` est un simple texte (nom du compte) : pas de populate
    const positions = await StockPosition.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      positions,
      total: positions.length,
    });
  } catch (error) {
    logger.error('Erreur récupération positions', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la récupération des positions' });
  }
});

/**
 * POST /api/stocks
 * Créer une nouvelle position (champs filtrés par liste blanche Joi)
 */
router.post('/', writeLimiter, validate(stockSchema), async (req, res) => {
  try {
    const position = new StockPosition({
      ...req.body,
      userId: req.user.userId, // Toujours imposé côté serveur
    });

    await position.save();

    res.status(201).json({
      success: true,
      message: 'Position créée avec succès',
      position,
    });
  } catch (error) {
    logger.error('Erreur création position', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la création de la position' });
  }
});

/**
 * PUT /api/stocks/:id
 * Mettre à jour une position.
 * find + save (et non findOneAndUpdate) pour déclencher le hook de chiffrement.
 */
router.put('/:id', writeLimiter, validate(stockUpdateSchema), async (req, res) => {
  try {
    const position = await StockPosition.findOne({ _id: req.params.id, userId: req.user.userId });

    if (!position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    // req.body ne contient que des champs autorisés (stripUnknown)
    position.set(req.body);
    await position.save();

    res.json({
      success: true,
      message: 'Position mise à jour avec succès',
      position,
    });
  } catch (error) {
    logger.error('Erreur mise à jour position', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la position' });
  }
});

/**
 * DELETE /api/stocks/:id
 * Supprimer une position
 */
router.delete('/:id', writeLimiter, async (req, res) => {
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
    logger.error('Erreur suppression position', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la suppression de la position' });
  }
});

/**
 * Crée un accumulateur vide pour les regroupements du résumé.
 * @returns {{count:number,value:number,cost:number,profitLoss:number}}
 */
const emptyBucket = () => ({ count: 0, value: 0, cost: 0, profitLoss: 0 });

/**
 * Ajoute une position à un accumulateur.
 */
function addToBucket(bucket, value, cost, profitLoss) {
  bucket.count++;
  bucket.value += value;
  bucket.cost += cost;
  bucket.profitLoss += profitLoss;
}

/**
 * GET /api/stocks/portfolio/summary
 * Obtenir un résumé du portefeuille (une seule passe O(n))
 */
router.get('/portfolio/summary', async (req, res) => {
  try {
    const positions = await StockPosition.find({ userId: req.user.userId });

    const summary = {
      totalValue: 0,
      totalCost: 0,
      totalProfitLoss: 0,
      totalProfitLossPercentage: 0,
      byType: {},
      byAccount: {},
      positions: [],
    };

    for (const position of positions) {
      // Le prix d'achat est déchiffré une seule fois par position
      const value = position.getTotalValue();
      const cost = position.getTotalCost();
      const profitLoss = value - cost;
      const profitLossPercentage = cost === 0 ? 0 : ((profitLoss / cost) * 100).toFixed(2);

      summary.totalValue += value;
      summary.totalCost += cost;
      summary.totalProfitLoss += profitLoss;

      summary.byType[position.type] ??= emptyBucket();
      addToBucket(summary.byType[position.type], value, cost, profitLoss);

      // Regroupement par nom de compte (champ texte libre)
      if (position.account) {
        summary.byAccount[position.account] ??= { name: position.account, ...emptyBucket() };
        addToBucket(summary.byAccount[position.account], value, cost, profitLoss);
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
    }

    if (summary.totalCost > 0) {
      summary.totalProfitLossPercentage =
        ((summary.totalProfitLoss / summary.totalCost) * 100).toFixed(2);
    }

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Erreur résumé portefeuille', { error: error.message });
    res.status(500).json({ error: 'Erreur lors du calcul du résumé' });
  }
});

/**
 * POST /api/stocks/prices/update
 * Mettre à jour les prix actuels — une seule requête bulkWrite au lieu de N updateMany.
 */
router.post('/prices/update', writeLimiter, validate(stockPricesSchema), async (req, res) => {
  try {
    const entries = Object.entries(req.body.updates);

    if (entries.length === 0) {
      return res.json({ success: true, message: 'Aucun prix à mettre à jour', results: [] });
    }

    const ops = entries.map(([symbol, price]) => ({
      updateMany: {
        filter: { userId: req.user.userId, symbol: symbol.toUpperCase() },
        update: { $set: { currentPrice: price } },
      },
    }));

    const result = await StockPosition.bulkWrite(ops, { ordered: false });

    res.json({
      success: true,
      message: 'Prix mis à jour avec succès',
      modified: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Erreur mise à jour prix', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la mise à jour des prix' });
  }
});

module.exports = router;
