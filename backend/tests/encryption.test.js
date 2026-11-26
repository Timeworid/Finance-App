const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers'); // fixe ENCRYPTION_KEY
const enc = require('../utils/encryption');

test('chiffrement/déchiffrement aller-retour', () => {
  const c = enc.encrypt('CB: Carrefour 12/03');
  assert.ok(enc.isEncrypted(c));
  assert.equal(enc.decrypt(c), 'CB: Carrefour 12/03');
});

test('un texte contenant ":" n\'est pas considéré comme chiffré', () => {
  assert.equal(enc.isEncrypted('CB: Carrefour'), false);
  assert.equal(enc.isEncrypted('a:b:c'), false);
  assert.equal(enc.encryptIfNeeded('CB: Carrefour') !== 'CB: Carrefour', true);
});

test('encryptIfNeeded est idempotent', () => {
  const c = enc.encrypt('42');
  assert.equal(enc.encryptIfNeeded(c), c);
});

test('toNumber gère chiffré, clair et invalide', () => {
  assert.equal(enc.toNumber(enc.encryptNumber(-12.5)), -12.5);
  assert.equal(enc.toNumber('30.92'), 30.92);
  assert.equal(enc.toNumber('abc'), 0);
});

test('un authTag falsifié est rejeté', () => {
  const c = enc.encrypt('secret');
  const tampered = c.slice(0, -1) + (c.endsWith('0') ? '1' : '0');
  assert.throws(() => enc.decrypt(tampered), /Échec du déchiffrement/);
});

test('une clé invalide est refusée', () => {
  const saved = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = 'trop-courte';
  try {
    assert.throws(() => enc.assertEncryptionKey(), /ENCRYPTION_KEY invalide/);
  } finally {
    process.env.ENCRYPTION_KEY = saved;
  }
});
