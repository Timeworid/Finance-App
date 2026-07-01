# Guide de finition - FinancePilot Backend + Frontend

## ✅ Ce qui est fait

### Backend (100% complet)
- Serveur Express sécurisé avec MongoDB
- 5 modèles Mongoose avec chiffrement AES-256
- Authentification JWT + refresh tokens
- 5 routes API complètes (Auth, Transactions, Categories, Envelopes, Settings)
- Validation Joi + Rate limiting + Sécurité OWASP
- Service API frontend

## 🚧 Ce qui reste à faire

### 1. Configuration Vite + Tailwind (15 min)

Créer `frontend/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

Créer `frontend/tailwind.config.js`:
```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Créer `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 2. Composants Auth (30 min)

Créer `frontend/src/components/Login.jsx` et `Register.jsx` (voir plan détaillé section 7.3).

Structure :
- Formulaire avec email + password
- Gestion erreurs
- Appel `authAPI.login()` ou `authAPI.register()`
- Stockage tokens dans localStorage
- Redirection vers `/`

### 3. Adaptation FinancePilot.jsx (2h)

**Modifications principales :**

1. **Remplacer le stockage local par API**
   - Supprimer tout code `window.storage` et `localStorage` pour l'état
   - Ajouter `useEffect` au montage pour charger données API
   - Exemple :
     ```jsx
     useEffect(() => {
       async function loadData() {
         const [txs, cats, envs, settings] = await Promise.all([
           transactionsAPI.getAll(),
           categoriesAPI.getAll(),
           envelopesAPI.getAll(),
           settingsAPI.get(),
         ]);
         dispatch({ type: 'LOAD', payload: {
           transactions: txs.transactions,
           categories: cats.categories,
           envelopes: envs.envelopes,
           startBalance: settings.settings.startBalance,
           monthlyCapacity: settings.settings.monthlyCapacity,
         }});
       }
       loadData();
     }, []);
     ```

2. **Remplacer les mutations par appels API**
   - ADD_TX : `await transactionsAPI.create(tx)` puis dispatch
   - DELETE_TX : `await transactionsAPI.delete(id)` puis dispatch
   - Idem pour categories, envelopes, settings
   - Pattern optimistic update :
     ```jsx
     dispatch({ type: 'ADD_TX', tx }); // Optimistic
     try {
       await transactionsAPI.create(tx);
     } catch (err) {
       dispatch({ type: 'ROLLBACK_TX', id: tx.id }); // Rollback si erreur
       showError(err.message);
     }
     ```

3. **Ajouter route guard**
   - Vérifier token au chargement
   - Si pas de token : rediriger vers `/login`
   - Afficher email user + bouton logout

4. **Gérer les erreurs API**
   - Toast notifications pour erreurs 401, 500, etc.
   - Retry automatique sur erreurs réseau

### 4. Router et point d'entrée (30 min)

Créer `frontend/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App';
import Login from './components/Login';
import Register from './components/Register';

// Route guard
function PrivateRoute({ children }) {
  const token = localStorage.getItem('accessToken');
  return token ? children : <Navigate to="/login" />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <PrivateRoute>
            <App />
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
```

Créer `frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FinancePilot</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### 5. Scripts package.json (5 min)

Mettre à jour `frontend/package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

Créer `package.json` racine pour scripts combinés:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run backend:dev\" \"npm run frontend:dev\"",
    "backend:dev": "cd backend && npm run dev",
    "frontend:dev": "cd frontend && npm run dev"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

## 🚀 Démarrage

### Prérequis
1. **MongoDB** doit tourner : `sudo systemctl start mongod`
2. Variables `.env` sont configurées dans `backend/.env`

### Lancement
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Ou depuis la racine (après install concurrently)
npm run dev
```

### Test manuel
1. Accéder `http://localhost:3000`
2. S'inscrire avec email/password
3. Vérifier que 7 catégories par défaut sont créées
4. Créer une transaction
5. Vérifier le chiffrement dans MongoDB :
   ```bash
   mongosh
   use financepilot
   db.transactions.findOne()
   # Les champs amount et label doivent être au format "iv:encrypted:authTag"
   ```

## 📊 Vérifications sécurité

- [ ] Mot de passe complexe requis (8+ chars, maj/min/chiffre)
- [ ] Refresh token en httpOnly cookie
- [ ] Rate limiting sur /login (5/15min)
- [ ] Champs sensibles chiffrés en DB
- [ ] Headers Helmet présents (CSP, HSTS en prod)
- [ ] CORS limité à FRONTEND_URL
- [ ] Pas de tokens/passwords dans les logs

## 🎯 Améliorations futures

1. **Migration données** : Bouton pour importer depuis ancienne version localStorage
2. **Websockets** : Sync temps réel multi-onglets (Socket.io)
3. **Tests** : Jest + Supertest pour les routes API
4. **CI/CD** : GitHub Actions pour tests automatiques
5. **Déploiement** : Docker Compose + Nginx reverse proxy
6. **RGPD** : Endpoint `DELETE /api/auth/account` pour suppression complète

## 📁 Structure finale

```
Finance-App/
├── backend/                  ✅ Complet
│   ├── config/
│   ├── models/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   ├── server.js
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/       🚧 À créer (Login, Register)
│   │   ├── services/         ✅ api.js créé
│   │   ├── App.jsx           🚧 À adapter (FinancePilot)
│   │   ├── main.jsx          🚧 À créer
│   │   └── index.css         🚧 À créer
│   ├── index.html            🚧 À créer
│   ├── vite.config.js        🚧 À créer
│   └── tailwind.config.js    🚧 À créer
├── FinancePilot.jsx          ⚠️ À déplacer dans frontend/src/App.jsx
└── package.json              🚧 Root package pour concurrently
```

## ⏱️ Estimation temps restant : 3-4h

- Config Vite + Tailwind : 15min
- Composants Auth : 30min
- Adaptation FinancePilot : 2h
- Router + point d'entrée : 30min
- Tests manuels : 30min
- Debug : 30min
