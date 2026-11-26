const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, clearDb, registerUser, raw, request } = require('./helpers');

let app;
before(async () => { app = await setup(); });
after(teardown);
beforeEach(clearDb);

test('inscription : refresh token uniquement en cookie httpOnly', async () => {
  const { body, cookie } = await registerUser(app);
  assert.ok(body.accessToken);
  assert.equal(body.refreshToken, undefined);
  assert.ok(cookie.startsWith('refreshToken='));
});

test('le refresh token est stocké haché en base', async () => {
  const { cookie, user } = await registerUser(app);
  const token = cookie.split('=')[1];
  const doc = await raw('users').findOne({});
  assert.equal(doc.refreshTokens.length, 1);
  assert.notEqual(doc.refreshTokens[0].token, token);
  assert.match(doc.refreshTokens[0].token, /^[0-9a-f]{64}$/);
  assert.equal(String(doc._id), String(user.id));
});

test('refresh : rotation puis détection de réutilisation', async () => {
  const { cookie } = await registerUser(app);

  const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
  assert.ok(first.body.accessToken);
  const newCookie = first.headers['set-cookie'].find(c => c.startsWith('refreshToken=')).split(';')[0];
  assert.notEqual(newCookie, cookie);

  // Réutilisation de l'ancien token → refus et révocation de toutes les sessions
  await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  await request(app).post('/api/auth/refresh').set('Cookie', newCookie).expect(401);
});

test('refresh sans cookie → 401 (le corps de requête est ignoré)', async () => {
  await request(app).post('/api/auth/refresh').send({ refreshToken: 'x' }).expect(401);
});

test('connexion : mauvais mot de passe et email inconnu → même 401', async () => {
  await registerUser(app, 'a@test.fr');
  const r1 = await request(app).post('/api/auth/login').send({ email: 'a@test.fr', password: 'Wrong1234' }).expect(401);
  const r2 = await request(app).post('/api/auth/login').send({ email: 'x@test.fr', password: 'Wrong1234' }).expect(401);
  assert.deepEqual(r1.body, r2.body);
});

test('déconnexion possible sans access token, et révoque la session', async () => {
  const { cookie } = await registerUser(app);
  await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(204);
  await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
});

test('/me exige un token Bearer valide', async () => {
  const { token } = await registerUser(app, 'me@test.fr');
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Authorization', 'Token abc').expect(401);
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(res.body.user.email, 'me@test.fr');
});

test('aucun index TTL sur la collection users (il supprimait les comptes)', async () => {
  await registerUser(app);
  const indexes = await raw('users').indexes();
  assert.equal(indexes.some(i => i.expireAfterSeconds !== undefined), false);
});
