# Guide de migration - Suppression de l'onglet Investissements

## Contexte

L'onglet "Investissements" a été supprimé car il faisait doublon avec l'onglet "Enveloppes". Ce guide vous aide à migrer vos données si vous aviez des produits d'investissement enregistrés.

## Données affectées

Si vous aviez créé des produits d'investissement (LEP, PEL, PEA, Assurance Vie, etc.), ces données sont toujours présentes dans la base de données MongoDB mais ne sont plus accessibles via l'interface.

## Options de migration

### Option 1 : Utiliser l'onglet "Enveloppes" (Recommandé)

L'onglet "Enveloppes" offre les mêmes fonctionnalités que l'onglet Investissements :
- Suivi des soldes
- Projections sur plusieurs années
- Rendements attendus
- Versements mensuels

**Comment migrer :**
1. Allez dans l'onglet "Enveloppes"
2. Créez une nouvelle enveloppe pour chaque produit d'investissement
3. Renseignez les informations :
   - Nom : ex. "LEP", "PEL", "Assurance Vie"
   - Type : "Sécurisé" pour LEP/PEL, "Actions" pour PEA, etc.
   - Solde actuel
   - Rendement attendu (%)
   - Versement mensuel

### Option 2 : Exporter les données (Manuel)

Si vous souhaitez conserver une trace de vos anciens produits d'investissement :

**Via MongoDB directement :**
```bash
# Se connecter à MongoDB
mongosh

# Utiliser la base de données
use financepilot

# Exporter les produits d'investissement
db.investmentproducts.find({ userId: ObjectId("VOTRE_USER_ID") }).pretty()
```

### Option 3 : Restaurer temporairement l'onglet (Pour développeurs)

Si vous avez besoin d'accéder temporairement aux anciennes données :

1. Restaurer le fichier `backend/routes/investments.js` depuis l'historique Git
2. Restaurer le fichier `backend/models/InvestmentProduct.js`
3. Restaurer le fichier `frontend/src/components/InvestmentProducts.jsx`
4. Ajouter la route dans `backend/server.js`
5. Ajouter l'import dans `frontend/src/App.jsx`
6. Redémarrer l'application

## Nettoyage de la base de données (Optionnel)

Si vous êtes sûr de ne plus avoir besoin de ces données :

```bash
# Se connecter à MongoDB
mongosh

# Utiliser la base de données
use financepilot

# Supprimer la collection investmentproducts
db.investmentproducts.drop()
```

⚠️ **Attention** : Cette action est irréversible !

## Questions fréquentes

**Q : Pourquoi l'onglet a-t-il été supprimé ?**  
A : L'onglet Investissements faisait doublon avec l'onglet Enveloppes. Pour simplifier l'application et éviter la redondance, nous avons consolidé ces fonctionnalités dans un seul onglet.

**Q : Vais-je perdre mes données ?**  
A : Non, les données restent dans la base MongoDB. Elles ne sont simplement plus accessibles via l'interface. Vous pouvez les migrer manuellement vers l'onglet Enveloppes.

**Q : L'onglet Enveloppes offre-t-il les mêmes fonctionnalités ?**  
A : Oui, l'onglet Enveloppes permet de suivre vos comptes d'épargne avec projections, rendements et versements mensuels.

**Q : Et le nouvel onglet "Biens & Propriétés" ?**  
A : C'est un nouvel onglet pour inventorier vos biens physiques (voiture, immobilier, matériel, etc.). Il ne remplace pas l'onglet Investissements mais offre une nouvelle fonctionnalité complémentaire.

## Support

Si vous rencontrez des problèmes lors de la migration, ouvrez une issue sur GitHub avec les détails de votre situation.
