import axios from 'axios';

// Même origine par défaut : proxy Vite en dev, nginx en production (voir vite.config.js / nginx.conf)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Access token (durée de vie 15 min) gardé UNIQUEMENT en mémoire : un script
 * injecté (XSS) ne peut pas le lire depuis localStorage. Après un rechargement
 * de page, il est restauré via le refresh token (cookie httpOnly) : restoreSession().
 */
let accessToken = null;

/** Enregistre l'access token reçu à la connexion / inscription. */
export function setAccessToken(token) {
  accessToken = token || null;
}

/** Indique si une session est active en mémoire. */
export function hasAccessToken() {
  return accessToken !== null;
}

/**
 * Supprime les données de session locales.
 * Le refresh token n'est jamais accessible au JS : il vit dans un cookie httpOnly.
 */
export function clearSession() {
  accessToken = null;
  localStorage.removeItem('accessToken');  // Nettoyage des anciennes versions
  localStorage.removeItem('refreshToken'); // Nettoyage des anciennes versions
  localStorage.removeItem('user');
}

// Instance axios avec configuration par défaut
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Envoie le cookie httpOnly de refresh
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur de requête : ajouter le token d'authentification
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Refresh "single-flight" : si plusieurs requêtes reçoivent un 401 en même temps,
 * un seul appel /auth/refresh est effectué (le serveur fait tourner le refresh token,
 * des appels concurrents invalideraient la session).
 */
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true })
      .then(({ data }) => {
        accessToken = data.accessToken;
        return data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Restaure la session au chargement de la page (access token absent de la mémoire)
 * à partir du cookie httpOnly. Sans effet si une session est déjà active.
 * @returns {Promise<boolean>} true si l'utilisateur est authentifié
 */
export async function restoreSession() {
  if (accessToken) return true;
  try {
    await refreshAccessToken();
    return true;
  } catch {
    return false;
  }
}

// Routes pour lesquelles un 401 ne doit pas déclencher de refresh
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

// Intercepteur de réponse : gestion du refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = NO_REFRESH_PATHS.some((p) => originalRequest?.url?.includes(p));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Échec du refresh : session terminée
        clearSession();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ========== AUTH API ==========

export const authAPI = {
  /**
   * Inscription d'un nouvel utilisateur
   */
  register: async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    return data;
  },

  /**
   * Connexion d'un utilisateur
   */
  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
  },

  /**
   * Rafraîchissement du token
   */
  refresh: async () => ({ accessToken: await refreshAccessToken() }),

  /**
   * Déconnexion
   */
  logout: async () => {
    try {
      await api.post('/auth/logout'); // Révoque la session côté serveur
    } finally {
      clearSession();
    }
  },

  /**
   * Obtenir le profil utilisateur
   */
  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// ========== TRANSACTIONS API ==========

export const transactionsAPI = {
  /**
   * Récupérer toutes les transactions
   */
  getAll: async (params = {}) => {
    // Limite explicite : une seule page
    if (params.limit) {
      const { data } = await api.get('/transactions', { params });
      return data.transactions || [];
    }

    // Sinon : récupération de toutes les pages (le serveur plafonne à 1000 par page).
    // Avant, seules les 400 plus récentes étaient chargées.
    const PAGE_SIZE = 1000;
    const all = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data } = await api.get('/transactions', { params: { ...params, limit: PAGE_SIZE, offset } });
      const page = data.transactions || [];
      all.push(...page);
      if (page.length < PAGE_SIZE || all.length >= (data.total ?? 0)) break;
    }
    return all;
  },

  /**
   * Créer une nouvelle transaction
   */
  create: async (transaction) => {
    const { data } = await api.post('/transactions', transaction);
    return data.transaction;
  },

  /**
   * Import de transactions en masse
   */
  batchCreate: async (transactions) => {
    const { data } = await api.post('/transactions/batch', { transactions });
    return data;
  },

  /**
   * Modifier une transaction
   */
  update: async (id, updates) => {
    const { data } = await api.put(`/transactions/${id}`, updates);
    return data.transaction;
  },

  /**
   * Supprimer une transaction
   */
  delete: async (id) => {
    await api.delete(`/transactions/${id}`);
  },

  /**
   * Obtenir les statistiques
   */
  getStats: async () => {
    const { data } = await api.get('/transactions/stats');
    return data;
  },
};

// ========== CATEGORIES API ==========

export const categoriesAPI = {
  /**
   * Récupérer toutes les catégories
   */
  getAll: async () => {
    const { data } = await api.get('/categories');
    return data.categories || [];
  },

  /**
   * Créer une nouvelle catégorie
   */
  create: async (category) => {
    const { data } = await api.post('/categories', category);
    return data.category;
  },

  /**
   * Mettre à jour une catégorie
   */
  update: async (id, updates) => {
    const { data } = await api.put(`/categories/${id}`, updates);
    return data.category;
  },

  /**
   * Supprimer une catégorie
   */
  delete: async (id) => {
    await api.delete(`/categories/${id}`);
  },
};

// ========== ENVELOPES API ==========

export const envelopesAPI = {
  /**
   * Récupérer toutes les enveloppes
   */
  getAll: async () => {
    const { data } = await api.get('/envelopes');
    return data.envelopes || [];
  },

  /**
   * Créer une nouvelle enveloppe
   */
  create: async (envelope) => {
    const { data } = await api.post('/envelopes', envelope);
    return data.envelope;
  },

  /**
   * Mettre à jour une enveloppe
   */
  update: async (id, updates) => {
    const { data } = await api.put(`/envelopes/${id}`, updates);
    return data.envelope;
  },

  /**
   * Supprimer une enveloppe
   */
  delete: async (id) => {
    await api.delete(`/envelopes/${id}`);
  },
};

// ========== SETTINGS API ==========

export const settingsAPI = {
  /**
   * Récupérer les settings
   */
  get: async () => {
    const { data } = await api.get('/settings');
    return data.settings || { startBalance: 0, monthlyCapacity: 1000 };
  },

  /**
   * Mettre à jour les settings
   */
  update: async (settings) => {
    const { data } = await api.put('/settings', settings);
    return data;
  },
};

// ========== RECURRING ITEMS API ==========

export const recurringAPI = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/recurring', { params });
    return data;
  },

  create: async (itemData) => {
    const { data } = await api.post('/recurring', itemData);
    return data;
  },

  update: async (id, itemData) => {
    const { data } = await api.put(`/recurring/${id}`, itemData);
    return data;
  },

  delete: async (id) => {
    const { data } = await api.delete(`/recurring/${id}`);
    return data;
  },

  getSummary: async () => {
    const { data } = await api.get('/recurring/summary/all');
    return data;
  },
};

// ========== ASSETS API ==========

export const assetsAPI = {
  getAll: async () => {
    const { data } = await api.get('/assets');
    return Array.isArray(data) ? data : [];
  },

  create: async (assetData) => {
    const { data } = await api.post('/assets', assetData);
    return data;
  },

  update: async (id, assetData) => {
    const { data } = await api.put(`/assets/${id}`, assetData);
    return data;
  },

  delete: async (id) => {
    const { data } = await api.delete(`/assets/${id}`);
    return data;
  },
};

// ========== STOCKS API ==========

export const stocksAPI = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/stocks', { params });
    return data;
  },

  create: async (positionData) => {
    const { data } = await api.post('/stocks', positionData);
    return data;
  },

  update: async (id, positionData) => {
    const { data } = await api.put(`/stocks/${id}`, positionData);
    return data;
  },

  delete: async (id) => {
    const { data } = await api.delete(`/stocks/${id}`);
    return data;
  },

  getSummary: async () => {
    const { data } = await api.get('/stocks/portfolio/summary');
    return data;
  },

  getPortfolioSummary: async () => {
    const { data } = await api.get('/stocks/portfolio/summary');
    return data;
  },

  updatePrices: async (updates) => {
    const { data } = await api.post('/stocks/prices/update', { updates });
    return data;
  },
};

export default api;
