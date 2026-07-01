const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Asset = require('../models/Asset');
const { authenticateToken } = require('../middleware/auth');

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

/**
 * GET /api/assets
 * Récupérer tous les biens de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des biens' });
  }
});

/**
 * POST /api/assets
 * Créer un nouveau bien
 */
router.post('/', [
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('category').isIn([
    'vehicule', 'immobilier', 'electronique', 'mobilier', 'bijoux', 'collection', 'autre'
  ]).withMessage('Catégorie invalide'),
  body('currentValue').isNumeric().withMessage('La valeur actuelle doit être un nombre'),
  body('purchasePrice').optional().isNumeric().withMessage('Le prix d\'achat doit être un nombre'),
  body('purchaseDate').optional().isISO8601().withMessage('Date d\'achat invalide'),
  body('description').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const asset = new Asset({
      userId: req.user.userId,
      name: req.body.name,
      category: req.body.category,
      currentValue: req.body.currentValue,
      purchasePrice: req.body.purchasePrice || 0,
      purchaseDate: req.body.purchaseDate || null,
      description: req.body.description || '',
    });

    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({ message: 'Erreur lors de la création du bien' });
  }
});

/**
 * PUT /api/assets/:id
 * Modifier un bien existant
 */
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide'),
  body('category').optional().isIn([
    'vehicule', 'immobilier', 'electronique', 'mobilier', 'bijoux', 'collection', 'autre'
  ]).withMessage('Catégorie invalide'),
  body('currentValue').optional().isNumeric().withMessage('La valeur actuelle doit être un nombre'),
  body('purchasePrice').optional().isNumeric().withMessage('Le prix d\'achat doit être un nombre'),
  body('purchaseDate').optional().isISO8601().withMessage('Date d\'achat invalide'),
  body('description').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const asset = await Asset.findOne({ _id: req.params.id, userId: req.user.userId });

    if (!asset) {
      return res.status(404).json({ message: 'Bien non trouvé' });
    }

    // Mise à jour des champs modifiés
    if (req.body.name !== undefined) asset.name = req.body.name;
    if (req.body.category !== undefined) asset.category = req.body.category;
    if (req.body.currentValue !== undefined) asset.currentValue = req.body.currentValue;
    if (req.body.purchasePrice !== undefined) asset.purchasePrice = req.body.purchasePrice;
    if (req.body.purchaseDate !== undefined) asset.purchaseDate = req.body.purchaseDate;
    if (req.body.description !== undefined) asset.description = req.body.description;

    await asset.save();
    res.json(asset);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du bien' });
  }
});

/**
 * DELETE /api/assets/:id
 * Supprimer un bien
 */
router.delete('/:id', async (req, res) => {
  try {
    const asset = await Asset.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });

    if (!asset) {
      return res.status(404).json({ message: 'Bien non trouvé' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du bien' });
  }
});

module.exports = router;
