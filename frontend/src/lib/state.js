/**
 * État applicatif des données financières et reducer.
 * Toutes les mutations passent par le reducer → état prévisible et testable.
 * Les données viennent exclusivement de l'API (aucune donnée d'exemple).
 */

/** Identifiant temporaire côté client (remplacé par l'id serveur après création). */
export const uid = () => Math.random().toString(36).slice(2, 10);

/** État vide avant le chargement des données de l'API. */
export function emptyState() {
  return {
    transactions: [],
    categories: [],
    envelopes: [],
    startBalance: 0,
    monthlyCapacity: 0,
  };
}

/**
 * Reducer des données financières.
 * @param {ReturnType<typeof emptyState>} state
 * @param {{type: string}} action
 */
export function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "SET_TXS":
      return { ...state, transactions: action.txs };
    case "ADD_TX":
      return { ...state, transactions: [action.tx, ...state.transactions] };
    case "UPDATE_TX":
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t)) };
    case "DELETE_TX":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case "ADD_CAT":
      return { ...state, categories: [...state.categories, action.cat] };
    case "UPDATE_CAT":
      return { ...state, categories: state.categories.map((c) => (c.id === action.cat.id ? action.cat : c)) };
    case "DELETE_CAT":
      // Les transactions de la catégorie supprimée deviennent « non classées » (comme côté serveur).
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        transactions: state.transactions.map((t) => (t.category === action.id ? { ...t, category: null } : t)),
      };
    case "ADD_ENV":
      return { ...state, envelopes: [...state.envelopes, action.env] };
    case "UPDATE_ENV":
      return { ...state, envelopes: state.envelopes.map((e) => (e.id === action.env.id ? action.env : e)) };
    case "DELETE_ENV":
      return { ...state, envelopes: state.envelopes.filter((e) => e.id !== action.id) };
    case "SET_CAPACITY":
      return { ...state, monthlyCapacity: action.value };
    case "SET_START":
      return { ...state, startBalance: action.value };
    default:
      return state;
  }
}
