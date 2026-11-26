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
