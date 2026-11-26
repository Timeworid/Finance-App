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

/** Extrait le cookie de refresh d'une réponse (undefined si non renouvelé). */
const refreshCookieOf = (res) =>
  res.headers['set-cookie']?.find(c => c.startsWith('refreshToken=') && !c.startsWith('refreshToken=;'))?.split(';')[0];

test('refresh : rotation du token à chaque appel', async () => {
  const { cookie } = await registerUser(app);
  const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
  assert.ok(first.body.accessToken);
  const next = refreshCookieOf(first);
  assert.ok(next);
  assert.notEqual(next, cookie);
  await request(app).post('/api/auth/refresh').set('Cookie', next).expect(200);
});

test('refresh concurrents (deux onglets) : tolérés sans révoquer la session', async () => {
  const { cookie } = await registerUser(app);
  const [a, b] = await Promise.all([
    request(app).post('/api/auth/refresh').set('Cookie', cookie),
    request(app).post('/api/auth/refresh').set('Cookie', cookie),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 200]);
  // Un seul des deux renouvelle le cookie ; l'autre (période de grâce) le laisse intact
  const rotated = [refreshCookieOf(a), refreshCookieOf(b)].filter(Boolean);
  assert.equal(rotated.length, 1);
  // La session reste valide avec le nouveau token
  await request(app).post('/api/auth/refresh').set('Cookie', rotated[0]).expect(200);
});

test('réutilisation d\'un token tourné après la période de grâce → session révoquée', async () => {
  const { cookie } = await registerUser(app);
  const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
  const next = refreshCookieOf(res);

  // Simule l'écoulement de la période de grâce (31 s)
  await raw('users').updateOne({}, { $set: { 'refreshTokens.0.rotatedAt': new Date(Date.now() - 31_000) } });

  await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  // La session entière est révoquée : le token légitime ne fonctionne plus non plus
  await request(app).post('/api/auth/refresh').set('Cookie', next).expect(401);
});

test('un token plus ancien que le précédent est toujours détecté comme réutilisé', async () => {
  const { cookie: t0 } = await registerUser(app);
  const t1 = refreshCookieOf(await request(app).post('/api/auth/refresh').set('Cookie', t0).expect(200));
  const t2 = refreshCookieOf(await request(app).post('/api/auth/refresh').set('Cookie', t1).expect(200));
  // t0 n'est ni courant ni précédent → vol probable, même pendant la période de grâce
  await request(app).post('/api/auth/refresh').set('Cookie', t0).expect(401);
  await request(app).post('/api/auth/refresh').set('Cookie', t2).expect(401);
});

test('les sessions de différents appareils sont indépendantes', async () => {
  await registerUser(app, 'multi@test.fr');
  const login = () => request(app).post('/api/auth/login').send({ email: 'multi@test.fr', password: 'Password123' }).expect(200);
  const s1 = refreshCookieOf(await login());
  const s2 = refreshCookieOf(await login());
  await request(app).post('/api/auth/logout').set('Cookie', s1).expect(204);
  await request(app).post('/api/auth/refresh').set('Cookie', s1).expect(401);
  await request(app).post('/api/auth/refresh').set('Cookie', s2).expect(200);
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
