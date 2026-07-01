const express = require('express');
const router = express.Router();
const Envelope = require('../models/Envelope');
const { authenticateToken } = require('../middleware/auth');
const { validate, envelopeSchema, envelopeUpdateSchema } = require('../utils/validators');
const { writeLimiter } = require('../middleware/rateLimiter');

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

/**
 * GET /api/envelopes
 * Récupérer toutes les enveloppes de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const envelopes = await Envelope.find({ userId: req.user.userId })
      .sort({ createdAt: 1 });

    res.json({
      envelopes,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des enveloppes:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des enveloppes',
    });
  }
});

/**
 * POST /api/envelopes
 * Créer une nouvelle enveloppe
 */
router.post('/', writeLimiter, validate(envelopeSchema), async (req, res) => {
  try {
    const { name, type, balance, expectedReturn, monthly, color } = req.body;

    // Créer l'enveloppe
    const envelope = new Envelope({
      userId: req.user.userId,
      name: name.trim(),
      type,
      balance,
      expectedReturn: expectedReturn || 0,
      monthly: monthly || 0,
      color: color || '#2dd4bf',
    });

    await envelope.save();

    res.status(201).json({
      message: 'Enveloppe créée',
      envelope,
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'enveloppe:', error);
    res.status(500).json({
      error: 'Erreur lors de la création de l\'enveloppe',
    });
  }
});

/**
 * PUT /api/envelopes/:id
 * Mettre à jour une enveloppe
 */
router.put('/:id', writeLimiter, validate(envelopeUpdateSchema), async (req, res) => {
  try {
    const envelope = await Envelope.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!envelope) {
      return res.status(404).json({
        error: 'Enveloppe non trouvée',
      });
    }

    // Mettre à jour les champs
    Object.keys(req.body).forEach(key => {
      envelope[key] = req.body[key];
    });

    await envelope.save();

    res.json({
      message: 'Enveloppe mise à jour',
      envelope,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'enveloppe:', error);
    res.status(500).json({
      error: 'Erreur lors de la mise à jour de l\'enveloppe',
    });
  }
});

/**
 * DELETE /api/envelopes/:id
 * Supprimer une enveloppe
 */
router.delete('/:id', writeLimiter, async (req, res) => {
  try {
    const envelope = await Envelope.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!envelope) {
      return res.status(404).json({
        error: 'Enveloppe non trouvée',
      });
    }

    await envelope.deleteOne();

    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'enveloppe:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression de l\'enveloppe',
    });
  }
});

module.exports = router;
