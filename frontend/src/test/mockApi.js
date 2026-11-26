/**
 * Fabrique de mocks pour services/api : données réalistes, telles que renvoyées
 * par le backend (transaction.category = objet peuplé {id, name, color, type}).
 */
import { vi } from 'vitest';

export const CATEGORIES = [
  { id: 'cat-salaire', name: 'Salaire', type: 'revenu', color: '#34d399', budget: 0, keywords: ['salaire'] },
  { id: 'cat-courses', name: 'Courses', type: 'depense', color: '#fbbf24', budget: 450, keywords: ['lidl', 'carrefour'] },
  { id: 'cat-loisirs', name: 'Loisirs', type: 'depense', color: '#a78bfa', budget: 200, keywords: ['cinema'] },
];

const pop = (id) => {
  const c = CATEGORIES.find((x) => x.id === id);
  return { id: c.id, name: c.name, color: c.color, type: c.type };
};

/** Transactions du mois courant (dates relatives pour que le tableau de bord les affiche). */
export function makeTransactions() {
  const now = new Date();
  const d = (day) => new Date(now.getFullYear(), now.getMonth(), day).toISOString().slice(0, 10);
  return [
    { id: 't1', date: d(2), label: 'Salaire mensuel', amount: 2600, category: pop('cat-salaire') },
    { id: 't2', date: d(3), label: 'Courses Lidl', amount: -120, category: pop('cat-courses') },
    { id: 't3', date: d(4), label: 'Carrefour', amount: -80, category: pop('cat-courses') },
    { id: 't4', date: d(5), label: 'Cinéma', amount: -25, category: pop('cat-loisirs') },
    { id: 't5', date: d(6), label: 'Divers', amount: -10, category: null },
  ];
}

export const ENVELOPES = [
  { id: 'e1', name: 'Livret A', type: 'Sécurisé', balance: 10000, expectedReturn: 2.4, monthly: 100, color: '#2dd4bf' },
];

/** Construit l'objet de mocks passé à vi.mock('../services/api'). */
export function buildApiMock() {
  return {
    clearSession: vi.fn(),
    authAPI: { logout: vi.fn().mockResolvedValue(undefined) },
    transactionsAPI: {
      getAll: vi.fn().mockResolvedValue(makeTransactions()),
      create: vi.fn(async (tx) => ({ id: 'new-tx', ...tx })),
      update: vi.fn(async (id, tx) => ({ id, ...tx })),
      delete: vi.fn().mockResolvedValue(undefined),
      batchCreate: vi.fn().mockResolvedValue({ imported: 0 }),
    },
    categoriesAPI: {
      getAll: vi.fn().mockResolvedValue(CATEGORIES),
      create: vi.fn(async (c) => ({ ...c, id: 'new-cat' })),
      update: vi.fn(async (id, c) => ({ ...c, id })),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    envelopesAPI: {
      getAll: vi.fn().mockResolvedValue(ENVELOPES),
      create: vi.fn(async (e) => ({ ...e, id: 'new-env' })),
      update: vi.fn(async (id, e) => ({ ...e, id })),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    settingsAPI: {
      get: vi.fn().mockResolvedValue({ startBalance: 1000, monthlyCapacity: 500 }),
      update: vi.fn().mockResolvedValue({}),
    },
    stocksAPI: {
      getAll: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn().mockResolvedValue({ totalValue: 0, totalCost: 0, totalProfitLoss: 0, positions: [] }),
      getPortfolioSummary: vi.fn().mockResolvedValue({ totalValue: 0, totalCost: 0, totalProfitLoss: 0, positions: [] }),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
    recurringAPI: {
      getAll: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn().mockResolvedValue({ revenues: { monthly: 0, yearly: 0, items: [] }, charges: { monthly: 0, yearly: 0, items: [] }, netMonthly: 0, netYearly: 0 }),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
    assetsAPI: { getAll: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
}
