/**
 * Normalisation des transactions reçues de l'API.
 *
 * Le backend « peuple » la catégorie : `category` est un objet {id, name, color, type}.
 * Toute l'interface manipule des identifiants (filtres, regroupements, budgets) :
 * sans normalisation, les regroupements par catégorie utilisaient la clé "[object Object]".
 */

/**
 * Extrait l'identifiant d'une catégorie (objet peuplé, identifiant brut ou vide).
 * @param {object|string|null|undefined} cat
 * @returns {string|null}
 */
export function categoryIdOf(cat) {
  if (!cat) return null;
  if (typeof cat === "string") return cat;
  return cat.id || cat._id || null;
}

/**
 * Transaction API → transaction interface (category = identifiant).
 * @param {object} tx
 * @returns {object}
 */
export function normalizeTransaction(tx) {
  return { ...tx, category: categoryIdOf(tx.category) };
}
