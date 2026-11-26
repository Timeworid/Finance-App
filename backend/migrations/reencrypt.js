/**
 * Migration « reencrypt-plaintext-v1 » : chiffre les valeurs sensibles restées EN CLAIR.
 *
 * Causes historiques (corrigées) : import CSV via insertMany, modifications par
 * findOneAndUpdate (récurrents, bourse), libellés contenant « : » pris pour du chiffré.
 * Idempotente : les valeurs déjà chiffrées sont ignorées.
 */
const { encrypt, isEncrypted } = require('../utils/encryption');

// Collection → champs chiffrés
const ENCRYPTED_FIELDS = {
  transactions: ['label', 'amount'],
  recurringitems: ['amount'],
  stockpositions: ['averageBuyPrice'],
  assets: ['purchasePrice', 'currentValue'],
  envelopes: ['balance', 'monthly'],
  settings: ['startBalance', 'monthlyCapacity'],
};

const BATCH_SIZE = 500; // Écritures groupées : limite la mémoire et les allers-retours

/**
 * Chiffre les champs en clair d'une collection.
 * @returns {Promise<number>} nombre de documents (à) modifier
 */
async function migrateCollection(db, name, fields, dryRun) {
  const collection = db.collection(name);
  // Ne lit que les documents ayant au moins un des champs renseigné, et seulement ces champs
  const cursor = collection.find(
    { $or: fields.map(f => ({ [f]: { $nin: [null, ''] } })) },
    { projection: Object.fromEntries(fields.map(f => [f, 1])) }
  );

  let ops = [];
  let count = 0;

  for await (const doc of cursor) {
    const $set = {};
    for (const field of fields) {
      const value = doc[field];
      if (value !== null && value !== undefined && value !== '' && !isEncrypted(value)) {
        $set[field] = encrypt(String(value));
      }
    }
    if (Object.keys($set).length === 0) continue;

    count++;
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set } } });
    if (ops.length >= BATCH_SIZE) {
      if (!dryRun) await collection.bulkWrite(ops, { ordered: false });
      ops = [];
    }
  }
  if (ops.length > 0 && !dryRun) await collection.bulkWrite(ops, { ordered: false });

  return count;
}

/**
 * Exécute la migration sur toutes les collections concernées.
 * @param {import('mongodb').Db} db
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<Record<string, number>>} documents (à) chiffrer par collection
 */
async function reencryptPlaintext(db, { dryRun = false } = {}) {
  const result = {};
  for (const [name, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    result[name] = await migrateCollection(db, name, fields, dryRun);
  }
  return result;
}

module.exports = { id: 'reencrypt-plaintext-v1', run: reencryptPlaintext, reencryptPlaintext };
