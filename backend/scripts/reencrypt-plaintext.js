#!/usr/bin/env node
/**
 * Migration : chiffre les valeurs sensibles restées EN CLAIR en base.
 *
 * Causes historiques corrigées :
 *  - import CSV (insertMany ne déclenchait pas le hook de chiffrement)
 *  - modification des charges récurrentes / positions boursières (findOneAndUpdate)
 *  - libellés contenant ":" pris à tort pour des valeurs déjà chiffrées
 *
 * Usage : cd backend && npm run migrate:reencrypt            (applique)
 *         cd backend && npm run migrate:reencrypt -- --dry-run (simulation)
 *
 * Idempotent : les valeurs déjà chiffrées sont ignorées. Faire une sauvegarde avant
 * (scripts/backup-mongodb.sh).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { encrypt, isEncrypted, assertEncryptionKey } = require('../utils/encryption');

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

async function migrateCollection(db, name, fields, dryRun) {
  const collection = db.collection(name);
  // Ne lit que les documents ayant au moins un des champs renseigné
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  assertEncryptionKey();
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  let total = 0;
  for (const [name, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const n = await migrateCollection(db, name, fields, dryRun);
    total += n;
    console.log(`${name.padEnd(16)} ${n} document(s) ${dryRun ? 'à chiffrer' : 'chiffré(s)'}`);
  }
  console.log(`Total : ${total}${dryRun ? ' (simulation, rien n\'a été modifié)' : ''}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Échec de la migration :', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
