/**
 * Utilitaires de test : base MongoDB en mémoire + application Express.
 * Les variables d'environnement sont fixées AVANT de charger l'application.
 */
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.LOG_LEVEL = 'error';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const createApp = require('../app');

let mongod;

/** Démarre MongoDB en mémoire et retourne l'application. */
async function setup() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  return createApp();
}

/** Arrête proprement la base. */
async function teardown() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

/** Vide toutes les collections entre deux tests. */
async function clearDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
}

/**
 * Inscrit un utilisateur et retourne son access token et son cookie de refresh.
 * @returns {Promise<{token:string, cookie:string, user:object}>}
 */
async function registerUser(app, email = `u${Date.now()}${Math.random()}@test.fr`) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password123', firstName: 'Test' })
    .expect(201);
  return {
    token: res.body.accessToken,
    cookie: res.headers['set-cookie'].find(c => c.startsWith('refreshToken=')).split(';')[0],
    user: res.body.user,
    body: res.body,
  };
}

/** Accès brut à une collection (pour vérifier ce qui est réellement stocké). */
const raw = (name) => mongoose.connection.db.collection(name);

/** URI de la base de test (pour les scripts lancés en sous-processus). */
const getUri = () => mongod.getUri();

module.exports = { getUri, setup, teardown, clearDb, registerUser, raw, request };
