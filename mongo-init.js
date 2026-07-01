// Script d'initialisation MongoDB
// Exécuté automatiquement au premier démarrage du container

db = db.getSiblingDB('financepilot');

// Créer un utilisateur applicatif
db.createUser({
  user: 'financepilot_user',
  pwd: process.env.MONGO_APP_PASSWORD || 'changeme_app',
  roles: [
    {
      role: 'readWrite',
      db: 'financepilot',
    },
  ],
});

// Créer les indexes pour performance
db.users.createIndex({ email: 1 }, { unique: true });
db.transactions.createIndex({ userId: 1, date: -1 });
db.transactions.createIndex({ userId: 1 });
db.categories.createIndex({ userId: 1 });
db.categories.createIndex({ userId: 1, name: 1 });
db.envelopes.createIndex({ userId: 1 });
db.envelopes.createIndex({ userId: 1, name: 1 });
db.settings.createIndex({ userId: 1 }, { unique: true });

print('✓ MongoDB initialized successfully for FinancePilot');
