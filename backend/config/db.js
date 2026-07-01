const mongoose = require('mongoose');

/**
 * Connexion à MongoDB
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✓ MongoDB connecté avec succès');
  } catch (error) {
    console.error('✗ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
};

// Gestion des événements de connexion
mongoose.connection.on('connected', () => {
  console.log('Mongoose connecté à MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Erreur de connexion Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose déconnecté de MongoDB');
});

// Gestion de la fermeture propre
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Connexion MongoDB fermée suite à l\'arrêt de l\'application');
  process.exit(0);
});

module.exports = connectDB;
