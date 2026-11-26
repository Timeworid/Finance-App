const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const { authenticateToken } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const validateObjectId = require('../middleware/validateObjectId');
const logger = require('../config/logger');
const { validate, assetSchema, assetUpdateSchema } = require('../utils/validators');

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);
router.param('id', validateObjectId);

/**
 * GET /api/assets
 * Récupérer tous les biens de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(assets);
  } catch (error) {
    logger.error('Erreur récupération biens', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la récupération des biens' });
  }
});

/**
 * POST /api/assets
 * Créer un bien (champs filtrés par liste blanche Joi, userId imposé côté serveur)
 */
router.post('/', writeLimiter, validate(assetSchema), async (req, res) => {
  try {
    const asset = new Asset({ ...req.body, userId: req.user.userId });
    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    logger.error('Erreur création bien', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la création du bien' });
  }
});

/**
 * PUT /api/assets/:id
 * Modifier un bien (find + save : déclenche le chiffrement des montants)
 */
router.put('/:id', writeLimiter, validate(assetUpdateSchema), async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, userId: req.user.userId });

    if (!asset) {
      return res.status(404).json({ error: 'Bien non trouvé' });
    }

    asset.set(req.body);
    await asset.save();
    res.json(asset);
  } catch (error) {
    logger.error('Erreur mise à jour bien', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la mise à jour du bien' });
  }
});

/**
 * DELETE /api/assets/:id
 * Supprimer un bien
 */
router.delete('/:id', writeLimiter, async (req, res) => {
  try {
    const asset = await Asset.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });

    if (!asset) {
      return res.status(404).json({ error: 'Bien non trouvé' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Erreur suppression bien', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la suppression du bien' });
  }
});

module.exports = router;
