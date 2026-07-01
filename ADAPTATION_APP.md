# Guide d'adaptation App.jsx pour l'API

Le fichier `frontend/src/App.jsx` a été copié depuis `FinancePilot.jsx`. Il fonctionne actuellement en mode 100% local. Voici les modifications à apporter pour l'intégrer avec l'API backend.

## Modifications nécessaires

### 1. Ajouter les imports API (ligne 18, après les imports existants)

```javascript
import { useNavigate } from 'react-router-dom';
import {
  authAPI,
  transactionsAPI,
  categoriesAPI,
  envelopesAPI,
  settingsAPI
} from './services/api';
import { LogOut } from 'lucide-react';
```

### 2. Modifier le composant principal (après `export default function FinancePilot()`)

Ajouter au début de la fonction :

```javascript
const navigate = useNavigate();
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);

// Charger l'utilisateur depuis localStorage au montage
useEffect(() => {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    setUser(JSON.parse(storedUser));
  }
}, []);

// Fonction de déconnexion
const handleLogout = async () => {
  try {
    await authAPI.logout();
  } catch (error) {
    console.error('Erreur de déconnexion:', error);
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  }
};
```

### 3. Remplacer le chargement localStorage par API (chercher `useEffect` avec `Store.get`)

**AVANT** (lignes ~750-760) :
```javascript
useEffect(() => {
  (async () => {
    const item = await Store.get(STORAGE_KEY);
    if (item?.value) {
      const loaded = normalizeState(JSON.parse(item.value));
      dispatch({ type: "LOAD", payload: loaded });
    } else {
      dispatch({ type: "LOAD", payload: initialState() });
    }
    setReady(true);
  })();
}, []);
```

**APRÈS** :
```javascript
useEffect(() => {
  (async () => {
    try {
      // Charger toutes les données en parallèle
      const [txsRes, catsRes, envsRes, settingsRes] = await Promise.all([
        transactionsAPI.getAll(),
        categoriesAPI.getAll(),
        envelopesAPI.getAll(),
        settingsAPI.get(),
      ]);

      dispatch({
        type: "LOAD",
        payload: {
          transactions: txsRes.transactions || [],
          categories: catsRes.categories || [],
          envelopes: envsRes.envelopes || [],
          startBalance: settingsRes.settings?.startBalance || 0,
          monthlyCapacity: settingsRes.settings?.monthlyCapacity || 1000,
          seeded: true,
        },
      });
    } catch (error) {
      console.error('Erreur de chargement:', error);
      // Si erreur 401, rediriger vers login
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(true);
      setReady(true);
    }
  })();
}, [navigate]);
```

### 4. Supprimer la sauvegarde localStorage (chercher `useEffect` avec `Store.set`)

**SUPPRIMER** ce bloc (lignes ~770-780) :
```javascript
useEffect(() => {
  if (!ready) return;
  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(
    () => { Store.set(STORAGE_KEY, JSON.stringify(state)); },
    400
  );
  return () => clearTimeout(saveTimer.current);
}, [state, ready]);
```

### 5. Modifier les actions du reducer pour appeler l'API

#### ADD_TX (chercher `const addTx = useCallback`)

**AJOUTER** avant le dispatch :
```javascript
const addTx = useCallback(async () => {
  const amt = parseAmount(form.amount);
  if (!form.label.trim() || Number.isNaN(amt)) return;

  const signed = form.sign === "depense" ? -Math.abs(amt) : Math.abs(amt);

  const newTx = {
    id: uid(),
    date: form.date,
    label: form.label.trim(),
    amount: signed,
    category: form.category || null,
  };

  // Optimistic update
  dispatch({ type: "ADD_TX", tx: newTx });

  try {
    // Appel API
    await transactionsAPI.create({
      date: newTx.date,
      label: newTx.label,
      amount: newTx.amount,
      category: newTx.category,
    });
  } catch (error) {
    console.error('Erreur création transaction:', error);
    // Rollback si erreur
    dispatch({ type: "DELETE_TX", id: newTx.id });
  }

  setForm((f) => ({ ...f, label: "", amount: "" }));
}, [form, dispatch]);
```

#### DELETE_TX

Modifier toutes les suppressions :
```javascript
onClick={async () => {
  dispatch({ type: "DELETE_TX", id: t.id });
  try {
    await transactionsAPI.delete(t.id);
  } catch (error) {
    console.error('Erreur suppression:', error);
    // Recharger les données en cas d'erreur
  }
}}
```

#### Catégories (ADD_CAT, UPDATE_CAT, DELETE_CAT)

Même pattern :
- Dispatch optimiste
- Appel API
- Rollback si erreur

#### Envelopes et Settings

Même pattern.

### 6. Ajouter un bouton de déconnexion dans la nav

Chercher le header/nav (ligne ~850) et ajouter :

```javascript
<div className="flex items-center gap-4">
  {user && (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-sm">
        {user.firstName || user.email}
      </span>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <LogOut size={16} />
        Déconnexion
      </button>
    </div>
  )}
</div>
```

### 7. Afficher un loader pendant le chargement

Au début du render, ajouter :

```javascript
if (loading && !ready) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-400 mx-auto mb-4"></div>
        <p className="text-slate-400">Chargement de vos données...</p>
      </div>
    </div>
  );
}
```

## Alternative rapide : Mode hybride (optionnel)

Si vous préférez garder le mode local en attendant :

1. Ne faites PAS les modifications ci-dessus
2. L'app fonctionnera en mode local comme avant
3. Ajoutez juste le bouton de déconnexion qui vide le localStorage et redirige vers /login

## Vérification

Après modifications :
1. Démarrer le backend : `cd backend && npm run dev`
2. Démarrer le frontend : `cd frontend && npm run dev`
3. Accéder à http://localhost:3000
4. S'inscrire
5. Vérifier que les 7 catégories par défaut sont chargées
6. Créer une transaction
7. Vérifier dans MongoDB que c'est bien chiffré

## Fichier complet adapté disponible

Si vous voulez une version complètement adaptée, je peux la générer, mais elle fera ~1500 lignes. Il est plus simple de faire les modifications ci-dessus manuellement.
