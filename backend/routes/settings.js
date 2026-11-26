const express = require('express');
const logger = require('../config/logger');
const router = express.Router();
const Settings = require('../models/Settings');
const { authenticateToken } = require('../middleware/auth');
const { validate, settingsSchema } = require('../utils/validators');
const { writeLimiter } = require('../middleware/rateLimiter');
const { toNumber } = require('../utils/encryption');

/**
 * Sérialise les settings avec des montants DÉCHIFFRÉS
 * (les champs du document contiennent la valeur chiffrée).
 */
const serializeSettings = (settings) => ({
  startBalance: toNumber(settings.startBalance),
  monthlyCapacity: toNumber(settings.monthlyCapacity),
  updatedAt: settings.updatedAt,
});

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

/**
 * GET /api/settings
 * Récupérer les settings de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.userId });

    // Créer les settings avec valeurs par défaut si inexistant
    if (!settings) {
      settings = new Settings({
        userId: req.user.userId,
        startBalance: 0,
        monthlyCapacity: 1000,
      });
      await settings.save();
    }

    res.json({
      settings: serializeSettings(settings),
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des settings', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la récupération des settings',
    });
  }
});

/**
 * PUT /api/settings
 * Mettre à jour les settings de l'utilisateur
 */
router.put('/', writeLimiter, validate(settingsSchema), async (req, res) => {
  try {
    const { startBalance, monthlyCapacity } = req.body;

    // Upsert (créer si n'existe pas, mettre à jour sinon)
    let settings = await Settings.findOne({ userId: req.user.userId });

    if (!settings) {
      settings = new Settings({ userId: req.user.userId });
    }

    // Mettre à jour les champs fournis
    if (startBalance !== undefined) {
      settings.startBalance = startBalance;
    }
    if (monthlyCapacity !== undefined) {
      settings.monthlyCapacity = monthlyCapacity;
    }

    await settings.save();

    res.json({
      message: 'Settings mis à jour',
      settings: serializeSettings(settings),
    });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour des settings', { error: error.message });
    res.status(500).json({
      error: 'Erreur lors de la mise à jour des settings',
    });
  }
});

module.exports = router;
