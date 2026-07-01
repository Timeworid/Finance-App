# Changelog

## [2025-07-01] - Refonte majeure

### Ajouté
- ✨ Nouvel onglet "Biens & Propriétés" pour inventorier vos biens physiques
  - Catégories : Véhicule, Immobilier, Électronique, Mobilier, Bijoux, Collection, Autre
  - Champs : Nom, valeur actuelle, prix d'achat, date d'achat, description
  - Calcul automatique de la valeur totale du patrimoine physique
- 🚀 Scripts de gestion processus (`start.sh` et `stop.sh`)
  - Démarrage/arrêt propre du backend et frontend
  - Gestion automatique des ports et processus
  - Logs centralisés dans `backend.log` et `frontend.log`
- 📝 Documentation complète (README.md)

### Modifié
- 🔧 Correction du bug de double décryptage des montants
  - Suppression des hooks post-find dans tous les modèles
  - Décryptage uniquement via toJSON transform
  - Fix : Les montants s'affichent maintenant correctement après refresh
- 🏗️ Restructuration des imports API dans App.jsx
- 📊 Optimisation du calcul du patrimoine total dans le Dashboard

### Supprimé
- ❌ Onglet "Investissements" (redondant avec Enveloppes)
  - Suppression du modèle InvestmentProduct
  - Suppression des routes /api/investments
  - Suppression du composant InvestmentProducts.jsx
  - Migration conseillée : Utiliser l'onglet "Enveloppes" pour les produits d'épargne

### Sécurité
- 🔒 Correction d'index dupliqué dans le modèle Asset
- 🛡️ Validation renforcée des catégories pour RecurringItem

## [Précédent] - Version initiale

### Fonctionnalités de base
- Authentification JWT
- CRUD Transactions, Catégories, Enveloppes
- Dashboard avec KPIs
- Import CSV
- Chiffrement AES-256-GCM
