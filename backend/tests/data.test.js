const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, clearDb, registerUser, raw, request } = require('./helpers');
const { isEncrypted } = require('../utils/encryption');

let app;
let auth;
before(async () => { app = await setup(); });
after(teardown);
beforeEach(async () => {
  await clearDb();
  const { token } = await registerUser(app);
  auth = { Authorization: `Bearer ${token}` };
});

test('transaction avec ":" dans le libellé : chiffrée en base, lisible via l\'API', async () => {
  await request(app).post('/api/transactions').set(auth)
    .send({ date: '2026-01-05', label: 'CB: Carrefour', amount: -42.5 }).expect(201);

  const doc = await raw('transactions').findOne({});
  assert.ok(isEncrypted(doc.label));
  assert.ok(isEncrypted(doc.amount));

  const res = await request(app).get('/api/transactions').set(auth).expect(200);
  assert.equal(res.body.transactions[0].label, 'CB: Carrefour');
  assert.equal(res.body.transactions[0].amount, -42.5);
});

test('import CSV (batch) : données chiffrées en base', async () => {
  await request(app).post('/api/transactions/batch').set(auth).send({
    transactions: [
      { date: '2026-01-01', label: 'Salaire', amount: 2500 },
      { date: '2026-01-02', label: 'Loyer', amount: -900 },
    ],
  }).expect(201);

  const docs = await raw('transactions').find({}).toArray();
  assert.equal(docs.length, 2);
  for (const d of docs) {
    assert.ok(isEncrypted(d.label), 'libellé chiffré');
    assert.ok(isEncrypted(d.amount), 'montant chiffré');
  }
});

test('stats calculées sur les montants déchiffrés', async () => {
  await request(app).post('/api/transactions/batch').set(auth).send({
    transactions: [
      { date: '2026-01-01', label: 'Salaire', amount: 2500 },
      { date: '2026-01-02', label: 'Loyer', amount: -900 },
      { date: '2026-01-03', label: 'Courses', amount: -100 },
    ],
  }).expect(201);

  const res = await request(app).get('/api/transactions/stats').set(auth).expect(200);
  assert.deepEqual(
    { income: res.body.income, expenses: res.body.expenses, balance: res.body.balance, count: res.body.count },
    { income: 2500, expenses: 1000, balance: 1500, count: 3 }
  );
});

test('recherche : filtre sur libellés déchiffrés, total réel, pagination', async () => {
  const transactions = Array.from({ length: 5 }, (_, i) => ({
    date: `2026-01-0${i + 1}`, label: i % 2 ? 'Uber course' : 'Boulangerie', amount: -10,
  }));
  await request(app).post('/api/transactions/batch').set(auth).send({ transactions }).expect(201);

  const res = await request(app).get('/api/transactions?search=boulang&limit=2').set(auth).expect(200);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.transactions.length, 2);
});

test('limit plafonné et paramètres invalides refusés', async () => {
  await request(app).get('/api/transactions?limit=100000').set(auth).expect(400);
  await request(app).get('/api/transactions?category=abc').set(auth).expect(400);
});

test('identifiant mal formé → 400 (et non 500)', async () => {
  await request(app).put('/api/transactions/123').set(auth).send({ label: 'x' }).expect(400);
  await request(app).delete('/api/stocks/not-an-id').set(auth).expect(400);
});

test('PUT transaction validé', async () => {
  const created = await request(app).post('/api/transactions').set(auth)
    .send({ date: '2026-01-05', label: 'A', amount: 1 }).expect(201);
  const id = created.body.transaction.id;
  await request(app).put(`/api/transactions/${id}`).set(auth).send({ amount: 'abc' }).expect(400);
  const ok = await request(app).put(`/api/transactions/${id}`).set(auth).send({ amount: -3 }).expect(200);
  assert.equal(ok.body.transaction.amount, -3);
});

test('isolation : un utilisateur ne peut pas modifier les données d\'un autre', async () => {
  const created = await request(app).post('/api/transactions').set(auth)
    .send({ date: '2026-01-05', label: 'Privé', amount: 1 }).expect(201);
  const other = await registerUser(app);
  await request(app).put(`/api/transactions/${created.body.transaction.id}`)
    .set('Authorization', `Bearer ${other.token}`).send({ label: 'pirate' }).expect(404);
});

test('récurrent : modification chiffrée, userId non modifiable', async () => {
  const created = await request(app).post('/api/recurring').set(auth).send({
    name: 'Netflix', type: 'charge', amount: 13.49, frequency: 'monthly', category: 'abonnements',
  }).expect(201);
  const id = created.body.item.id;
  const before = await raw('recurringitems').findOne({});

  const res = await request(app).put(`/api/recurring/${id}`).set(auth)
    .send({ amount: 17.99, userId: '507f1f77bcf86cd799439011' }).expect(200);
  assert.equal(res.body.item.amount, 17.99);

  const after = await raw('recurringitems').findOne({});
  assert.ok(isEncrypted(after.amount), 'montant toujours chiffré après modification');
  assert.equal(String(after.userId), String(before.userId), 'userId inchangé');

  const summary = await request(app).get('/api/recurring/summary/all').set(auth).expect(200);
  assert.equal(summary.body.summary.charges.monthly, 17.99);
});

test('bourse : modification chiffrée et résumé par compte', async () => {
  const created = await request(app).post('/api/stocks').set(auth).send({
    symbol: 'cw8', name: 'MSCI World', type: 'ETF', quantity: 2, averageBuyPrice: 400, currentPrice: 500, account: 'PEA',
  }).expect(201);
  const id = created.body.position.id;

  await request(app).put(`/api/stocks/${id}`).set(auth).send({ averageBuyPrice: 450 }).expect(200);
  const doc = await raw('stockpositions').findOne({});
  assert.ok(isEncrypted(doc.averageBuyPrice));

  const summary = await request(app).get('/api/stocks/portfolio/summary').set(auth).expect(200);
  assert.equal(summary.body.summary.totalCost, 900);
  assert.equal(summary.body.summary.totalValue, 1000);
  assert.equal(summary.body.summary.byAccount.PEA.count, 1);

  await request(app).post('/api/stocks/prices/update').set(auth).send({ updates: { CW8: 550 } }).expect(200);
  const list = await request(app).get('/api/stocks').set(auth).expect(200);
  assert.equal(list.body.positions[0].currentPrice, 550);
});

test('settings renvoyés en nombres déchiffrés', async () => {
  await request(app).put('/api/settings').set(auth).send({ startBalance: 1234.5 }).expect(200);
  const res = await request(app).get('/api/settings').set(auth).expect(200);
  assert.equal(res.body.settings.startBalance, 1234.5);
  assert.equal(res.body.settings.monthlyCapacity, 1000);
});

test('/health indique l\'état de la base', async () => {
  const res = await request(app).get('/health').expect(200);
  assert.equal(res.body.database, 'connected');
});

test('biens : création avec champs facultatifs vides (formulaire) et chiffrement', async () => {
  const res = await request(app).post('/api/assets').set(auth).send({
    name: 'Vélo', category: 'vehicule', currentValue: '350', purchasePrice: '', purchaseDate: '', description: '',
  }).expect(201);
  assert.equal(res.body.currentValue, 350);
  assert.equal(res.body.purchasePrice, 0);
  assert.equal(res.body.purchaseDate, null);

  const doc = await raw('assets').findOne({});
  assert.ok(isEncrypted(doc.currentValue));

  // Mise à jour : userId ignoré, date vidée → null, valeur rechiffrée
  const upd = await request(app).put(`/api/assets/${res.body.id}`).set(auth)
    .send({ currentValue: 300, purchaseDate: '', userId: '507f1f77bcf86cd799439011' }).expect(200);
  assert.equal(upd.body.currentValue, 300);
  const after = await raw('assets').findOne({});
  assert.equal(String(after.userId), String(doc.userId));
  assert.ok(isEncrypted(after.currentValue));

  await request(app).post('/api/assets').set(auth).send({ name: 'X', category: 'fusée', currentValue: 1 }).expect(400);
});
