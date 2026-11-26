const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { setup, teardown, raw, getUri } = require('./helpers');
const { isEncrypted, encrypt, decrypt } = require('../utils/encryption');

before(setup);
after(teardown);

test('la migration chiffre les valeurs en clair et ignore celles déjà chiffrées', async () => {
  const already = encrypt('-5');
  await raw('transactions').insertMany([
    { label: 'CB: Carrefour', amount: '-42.5' },
    { label: encrypt('ok'), amount: already },
  ]);

  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'reencrypt-plaintext.js')], {
    env: { ...process.env, MONGODB_URI: getUri() },
    stdio: 'pipe',
  });

  const docs = await raw('transactions').find({}).toArray();
  for (const d of docs) {
    assert.ok(isEncrypted(d.label));
    assert.ok(isEncrypted(d.amount));
  }
  assert.equal(decrypt(docs.find(d => d.amount !== already).label), 'CB: Carrefour');
  assert.equal(docs.find(d => d.amount === already).amount, already, 'valeur déjà chiffrée intacte');
});

const { runMigrations, MIGRATIONS } = require('../migrations');

test('migrations au démarrage : exécutées une seule fois (marqueur en base)', async () => {
  const db = require('mongoose').connection.db;
  await raw('_migrations').deleteMany({});
  await raw('transactions').deleteMany({});
  await raw('transactions').insertOne({ label: 'Clair: avant', amount: '-3' });

  const first = await runMigrations(db);
  assert.deepEqual(first, ['reencrypt-plaintext-v1']);
  const doc = await raw('transactions').findOne({});
  assert.ok(isEncrypted(doc.label) && isEncrypted(doc.amount));
  const marker = await raw('_migrations').findOne({ _id: 'reencrypt-plaintext-v1' });
  assert.equal(marker.status, 'done');
  assert.equal(marker.result.transactions, 1);

  // Deuxième démarrage : rien n'est ré-exécuté
  assert.deepEqual(await runMigrations(db), []);
});

test('migrations concurrentes : une seule instance exécute (verrou par marqueur)', async () => {
  const db = require('mongoose').connection.db;
  await raw('_migrations').deleteMany({});
  const [a, b] = await Promise.all([runMigrations(db), runMigrations(db)]);
  assert.equal(a.length + b.length, 1);
});

test('migration en échec : marqueur retiré pour réessayer au prochain démarrage', async () => {
  const db = require('mongoose').connection.db;
  await raw('_migrations').deleteMany({});
  const migration = MIGRATIONS[0];
  const original = migration.run;
  migration.run = async () => { throw new Error('panne simulée'); };
  try {
    await assert.rejects(runMigrations(db), /panne simulée/);
    assert.equal(await raw('_migrations').countDocuments(), 0);
  } finally {
    migration.run = original;
  }
  assert.deepEqual(await runMigrations(db), ['reencrypt-plaintext-v1']);
});
