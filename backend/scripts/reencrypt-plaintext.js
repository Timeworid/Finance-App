#!/usr/bin/env node
/**
 * Exécution MANUELLE de la migration de re-chiffrement.
 * Elle s'exécute déjà automatiquement au démarrage du backend (voir migrations/) ;
 * ce script sert au diagnostic (--dry-run) ou à une ré-exécution forcée.
 *
 * Usage : cd backend && npm run migrate:reencrypt              (applique)
 *         cd backend && npm run migrate:reencrypt -- --dry-run (simulation)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const { assertEncryptionKey } = require('../utils/encryption');
const { reencryptPlaintext } = require('../migrations/reencrypt');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  assertEncryptionKey();
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await reencryptPlaintext(mongoose.connection.db, { dryRun });
  let total = 0;
  for (const [name, n] of Object.entries(result)) {
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
