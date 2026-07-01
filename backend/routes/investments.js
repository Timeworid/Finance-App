const express = require('express');
const router = express.Router();
const InvestmentProduct = require('../models/InvestmentProduct');
const { authenticateToken } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// Toutes les routes sont protégées
router.use(authenticateToken);

/**
 * GET /api/investments
 * Récupérer tous les produits d'investissement de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const products = await InvestmentProduct.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      products,
      total: products.length,
    });
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

/**
 * GET /api/investments/:id
 * Récupérer un produit spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await InvestmentProduct.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

/**
 * POST /api/investments
 * Créer un nouveau produit d'investissement
 */
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Le nom est requis'),
    body('type').isIn([
      'LEP', 'LIVRET_JEUNE', 'PEL', 'LIVRET_A', 'COMPTE_TITRES',
      'EPARGNE_PILOTEE', 'PEA_LIBRE', 'PEA_PILOTE', 'PER', 'ASSURANCE_VIE'
    ]).withMessage('Type de produit invalide'),
    body('balance').isNumeric().withMessage('Le solde doit être un nombre'),
    body('interestRate').optional().isFloat({ min: 0, max: 100 }),
    body('taxRate').optional().isFloat({ min: 0, max: 100 }),
    body('managementFees').optional().isFloat({ min: 0, max: 10 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const product = new InvestmentProduct({
        ...req.body,
        userId: req.user.userId,
      });

      await product.save();

      res.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        product,
      });
    } catch (error) {
      console.error('Erreur création produit:', error);
      res.status(500).json({ error: 'Erreur lors de la création du produit' });
    }
  }
);

/**
 * PUT /api/investments/:id
 * Mettre à jour un produit
 */
router.put('/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('balance').optional().isNumeric(),
    body('interestRate').optional().isFloat({ min: 0, max: 100 }),
    body('taxRate').optional().isFloat({ min: 0, max: 100 }),
    body('managementFees').optional().isFloat({ min: 0, max: 10 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const product = await InvestmentProduct.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.userId },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      res.json({
        success: true,
        message: 'Produit mis à jour avec succès',
        product,
      });
    } catch (error) {
      console.error('Erreur mise à jour produit:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
    }
  }
);

/**
 * DELETE /api/investments/:id
 * Supprimer un produit
 */
router.delete('/:id', async (req, res) => {
  try {
    const product = await InvestmentProduct.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    res.json({
      success: true,
      message: 'Produit supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

/**
 * GET /api/investments/:id/projection
 * Calculer la projection de gains sur X années
 */
router.get('/:id/projection',
  [
    query('years').optional().isInt({ min: 1, max: 50 }).withMessage('Nombre d\'années invalide'),
  ],
  async (req, res) => {
    try {
      const product = await InvestmentProduct.findOne({
        _id: req.params.id,
        userId: req.user.userId,
      });

      if (!product) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      const years = parseInt(req.query.years) || 10;
      const projection = product.calculateProjection(years);

      res.json({
        success: true,
        projection,
      });
    } catch (error) {
      console.error('Erreur calcul projection:', error);
      res.status(500).json({ error: 'Erreur lors du calcul de la projection' });
    }
  }
);

/**
 * GET /api/investments/summary
 * Obtenir un résumé de tous les investissements
 */
router.get('/summary/all', async (req, res) => {
  try {
    const products = await InvestmentProduct.find({ userId: req.user.userId });

    const summary = {
      totalBalance: 0,
      totalMonthlyContribution: 0,
      byType: {},
      totalProducts: products.length,
    };

    products.forEach(product => {
      const balance = parseFloat(product.balance) || 0;
      const monthly = parseFloat(product.monthlyContribution) || 0;

      summary.totalBalance += balance;
      summary.totalMonthlyContribution += monthly;

      if (!summary.byType[product.type]) {
        summary.byType[product.type] = {
          count: 0,
          balance: 0,
          monthlyContribution: 0,
        };
      }

      summary.byType[product.type].count++;
      summary.byType[product.type].balance += balance;
      summary.byType[product.type].monthlyContribution += monthly;
    });

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Erreur résumé investissements:', error);
    res.status(500).json({ error: 'Erreur lors du calcul du résumé' });
  }
});

module.exports = router;
