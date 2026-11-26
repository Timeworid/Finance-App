const mongoose = require('mongoose');

/**
 * Handler pour `router.param('id', validateObjectId)`.
 * Rejette en 400 les identifiants mal formés au lieu de laisser Mongoose
 * lever une CastError (qui finissait en erreur 500).
 */
function validateObjectId(req, res, next, id) {
  if (!mongoose.isValidObjectId(id) || String(id).length !== 24) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  next();
}

module.exports = validateObjectId;
