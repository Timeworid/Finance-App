// Script d'initialisation MongoDB
// Exécuté automatiquement au PREMIER démarrage du container (volume vide)

db = db.getSiblingDB('financepilot');

// Aucun mot de passe par défaut : échec explicite si la variable est absente
const appPassword = process.env.MONGO_APP_PASSWORD;
if (!appPassword) {
  throw new Error('MONGO_APP_PASSWORD doit être défini');
}

// Compte applicatif à droits restreints (lecture/écriture sur financepilot uniquement)
db.createUser({
  user: 'financepilot_user',
  pwd: appPassword,
  roles: [{ role: 'readWrite', db: 'financepilot' }],
});

// Les index sont créés par Mongoose au démarrage du backend (définis dans les modèles)
print('MongoDB initialisé pour FinancePilot');
