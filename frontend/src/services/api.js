import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Instance axios avec configuration par défaut
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Pour les cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur de requête : ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur de réponse : gestion du refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si erreur 401 et pas déjà retryé
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Tenter de rafraîchir le token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        // Sauvegarder le nouveau access token
        localStorage.setItem('accessToken', data.accessToken);

        // Réessayer la requête originale avec le nouveau token
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Échec du refresh : déconnecter l'utilisateur
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
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
  refresh: async (refreshToken) => {
    const { data } = await api.post('/auth/refresh', { refreshToken });
    return data;
  },

  /**
   * Déconnexion
   */
  logout: async () => {
    await api.post('/auth/logout');
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
    const { data } = await api.get('/transactions', { params });
    return data.transactions || [];
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
