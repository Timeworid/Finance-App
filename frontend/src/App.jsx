/**
 * FinancePilot — Tableau de bord financier personnel (all-in-one, 100% local)
 * -----------------------------------------------------------------------------
 * Aucune donnée ne quitte le navigateur : tout est persisté localement via
 * l'API window.storage (avec repli mémoire si indisponible).
 *
 * Modules :
 *   1. Tableau de bord  — KPIs + évolution du solde + répartition + flux mensuels
 *   2. Transactions     — saisie, filtres, import CSV de relevés bancaires, export
 *   3. Catégories       — gestion + budgets + mots-clés d'auto-catégorisation
 *   4. Investissements  — suivi capital investi / valeur actuelle / rendement
 *   5. Simulateurs      — épargne (intérêts composés) & emprunt (amortissement)
 *
 * Optimisations : tous les calculs dérivés sont mémoïsés (useMemo) pour éviter
 * les recalculs au re-rendu ; les écritures en stockage sont « debouncées ».
 */

import { useState, useEffect, useMemo, useCallback, useReducer, useRef } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, Receipt, Tags, TrendingUp, Calculator, Landmark,
  Upload, Download, Plus, Trash2, Wallet, ArrowUpRight, ArrowDownRight,
  PiggyBank, Settings as SettingsIcon, X, Check, AlertTriangle, RotateCcw,
  FileDown, Database, Target, Percent, Calendar, ChevronLeft, ChevronRight, Layers,
  LogOut, User, Repeat, TrendingDown, Newspaper, Building2,
} from "lucide-react";

import InvestmentProducts from "./components/InvestmentProducts";
import RecurringCharges from "./components/RecurringCharges";
import StockPortfolio from "./components/StockPortfolio";

/* ===========================================================================
 * 1. PALETTE & FORMATTERS
 * ===========================================================================*/

// Palette alignée sur l'échelle Tailwind utilisée dans le JSX (cohérence visuelle).
const C = {
  positive: "#34d399", // emerald-400  → gains / revenus
  negative: "#fb7185", // rose-400     → pertes / dépenses
  accent:   "#2dd4bf", // teal-400     → marque / épargne
  warn:     "#fbbf24", // amber-400    → alertes / dette
  blue:     "#60a5fa", // blue-400
  violet:   "#a78bfa", // violet-400
  sky:      "#38bdf8", // sky-400
  grid:     "#1e293b", // slate-800
  axis:     "#64748b", // slate-500
};

// Palette de segments pour les catégories sans couleur explicite.
const SWATCHES = [C.blue, C.warn, C.violet, C.negative, C.sky, C.positive, C.accent, "#f472b6", "#facc15", "#818cf8"];

// Formatteurs FR mémoïsés au niveau module (créés une seule fois).
const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const num0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const fmtEur  = (v) => eur0.format(Number.isFinite(v) ? v : 0);
const fmtEur2 = (v) => eur2.format(Number.isFinite(v) ? v : 0);
const fmtPct  = (v) => pct1.format(Number.isFinite(v) ? v : 0);

// Date ISO (YYYY-MM-DD) → libellé court FR « 12 mars » / clé de mois « 2025-03 ».
const monthKey = (iso) => (iso || "").slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};

/* ===========================================================================
 * 2. PARSING ROBUSTE (montants & dates de relevés bancaires)
 * ===========================================================================*/

/**
 * Parse un montant quel que soit le format (FR « 1 234,56 » / EN « 1,234.56 »).
 * Stratégie : le séparateur décimal est le dernier ',' ou '.' rencontré ;
 * l'autre symbole est considéré comme séparateur de milliers et supprimé.
 * @returns {number} NaN si non interprétable.
 */
function parseAmount(raw) {
  if (raw == null) return NaN;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim().replace(/[\s\u00A0\u202F€$£]/g, "");
  if (s === "" || s === "-") return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * Parse une date de relevé en ISO (YYYY-MM-DD). Gère ISO, DD/MM/YYYY,
 * DD-MM-YYYY, DD.MM.YYYY et DD/MM/YY. Renvoie null si illisible.
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);          // ISO
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);              // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);            // DD/MM/YY
  if (m) return `20${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* ===========================================================================
 * 3. CALCULS FINANCIERS (commentés, testables, sans effet de bord)
 * ===========================================================================*/

/**
 * Projection d'épargne avec intérêts composés et versements mensuels.
 * Formule mensuelle : balanceₘ = balanceₘ₋₁ · (1 + i) + versement
 *   i = taux annuel / 12 (taux périodique mensuel)
 * @returns {Array<{month, year, balance, contributed, interest}>}
 */
function projectSavings({ principal, monthly, annualRate, years }) {
  const i = annualRate / 100 / 12;
  const n = Math.round(years * 12);
  const out = [];
  let balance = principal;
  let contributed = principal;
  for (let m = 0; m <= n; m++) {
    if (m > 0) {
      balance = balance * (1 + i) + monthly;
      contributed += monthly;
    }
    out.push({
      month: m,
      year: +(m / 12).toFixed(2),
      balance,
      contributed,
      interest: balance - contributed, // part due aux intérêts cumulés
    });
  }
  return out;
}

/**
 * Mensualité d'un emprunt à amortissement constant (mensualités fixes).
 * Formule : M = P · [ i·(1+i)ⁿ ] / [ (1+i)ⁿ − 1 ]
 */
function loanMonthlyPayment(principal, annualRate, months) {
  const i = annualRate / 100 / 12;
  if (months <= 0) return 0;
  if (i === 0) return principal / months; // prêt à taux nul
  const f = Math.pow(1 + i, months);
  return (principal * i * f) / (f - 1);
}

/** Tableau d'amortissement complet d'un emprunt. */
function amortization(principal, annualRate, months) {
  const i = annualRate / 100 / 12;
  const M = loanMonthlyPayment(principal, annualRate, months);
  let balance = principal;
  const rows = [];
  let cumInterest = 0;
  for (let m = 1; m <= months; m++) {
    const interest = balance * i;
    const principalPaid = M - interest;
    balance = Math.max(0, balance - principalPaid);
    cumInterest += interest;
    rows.push({ month: m, payment: M, interest, principalPaid, cumInterest, balance });
  }
  return { rows, monthly: M, totalCost: M * months, totalInterest: M * months - principal };
}

/* ===========================================================================
 * 4. PERSISTANCE (window.storage + repli mémoire) + état initial
 * ===========================================================================*/

const STORAGE_KEY = "financepilot:state:v2";
const memStore = new Map(); // repli si window.storage absent (hors Claude.ai)

const Store = {
  async get(k) {
    if (typeof window !== "undefined" && window.storage) {
      try { return await window.storage.get(k); } catch { return null; }
    }
    return memStore.has(k) ? { key: k, value: memStore.get(k) } : null;
  },
  async set(k, v) {
    if (typeof window !== "undefined" && window.storage) {
      try { return await window.storage.set(k, v); } catch { /* on ignore : repli */ }
    }
    memStore.set(k, v);
    return { key: k, value: v };
  },
};

const uid = () => Math.random().toString(36).slice(2, 10);

/** Catégories par défaut (avec budgets indicatifs et mots-clés d'auto-tri). */
function defaultCategories() {
  return [
    { id: "c1", name: "Salaire",   color: C.positive, type: "revenu",  budget: 0,    keywords: ["salaire", "paie", "remuneration", "virement employeur"] },
    { id: "c2", name: "Logement",  color: C.blue,     type: "depense", budget: 1200, keywords: ["loyer", "edf", "engie", "habitation", "syndic"] },
    { id: "c3", name: "Courses",   color: C.warn,     type: "depense", budget: 450,  keywords: ["carrefour", "leclerc", "lidl", "auchan", "monoprix", "intermarche"] },
    { id: "c4", name: "Transport", color: C.violet,   type: "depense", budget: 150,  keywords: ["sncf", "essence", "total", "uber", "navigo", "ratp", "peage"] },
    { id: "c5", name: "Loisirs",   color: C.negative, type: "depense", budget: 200,  keywords: ["netflix", "spotify", "cinema", "steam", "restaurant", "bar"] },
    { id: "c6", name: "Santé",     color: C.sky,      type: "depense", budget: 80,   keywords: ["pharmacie", "medecin", "mutuelle", "labo"] },
    { id: "c7", name: "Épargne",   color: C.accent,   type: "depense", budget: 400,  keywords: ["virement epargne", "livret", "pel"] },
  ];
}

/** Génère ~6 mois de transactions d'exemple pour que les graphiques soient parlants. */
function sampleTransactions() {
  const tx = [];
  const now = new Date();
  const recurring = [
    { cat: "c1", label: "Salaire mensuel", amount: 2600, day: 2 },
    { cat: "c2", label: "Loyer",           amount: -950, day: 5 },
    { cat: "c2", label: "EDF",             amount: -65,  day: 8 },
    { cat: "c7", label: "Virement épargne", amount: -400, day: 3 },
    { cat: "c4", label: "Pass Navigo",     amount: -86,  day: 1 },
  ];
  const occasional = [
    { cat: "c3", label: "Carrefour" }, { cat: "c3", label: "Lidl" },
    { cat: "c5", label: "Restaurant" }, { cat: "c5", label: "Netflix" },
    { cat: "c6", label: "Pharmacie" }, { cat: "c4", label: "Essence Total" },
  ];
  for (let back = 5; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d.getFullYear(), mo = d.getMonth();
    recurring.forEach((r) => {
      const iso = new Date(y, mo, r.day).toISOString().slice(0, 10);
      tx.push({ id: uid(), date: iso, label: r.label, amount: r.amount, category: r.cat });
    });
    const count = 6 + Math.floor(Math.random() * 5);
    for (let k = 0; k < count; k++) {
      const o = occasional[Math.floor(Math.random() * occasional.length)];
      const day = 1 + Math.floor(Math.random() * 27);
      const base = o.cat === "c3" ? 35 : o.cat === "c5" ? 18 : 25;
      const amount = -(base + Math.floor(Math.random() * base));
      const iso = new Date(y, mo, day).toISOString().slice(0, 10);
      tx.push({ id: uid(), date: iso, label: o.label, amount, category: o.cat });
    }
  }
  return tx.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Plafonds réglementaires (0 = pas de plafond) pour signaler une enveloppe pleine.
const ENV_CAPS = { "Livret A": 22950, "Livret Jeune": 1600 };

/**
 * Enveloppes par défaut = tes comptes réels. Champs :
 *   balance         : valeur actuelle (€)
 *   expectedReturn  : rendement annuel net attendu (%) — éditable, hypothèse de projection
 *   monthly         : versement mensuel prévu (€) — sert au plan + à la projection
 * Les rendements sont des ordres de grandeur prudents, à ajuster selon ta situation.
 */
function sampleEnvelopes() {
  return [
    { id: uid(), name: "Livret A",       type: "Sécurisé",  balance: 12000, expectedReturn: 2.4, monthly: 100, color: C.accent },
    { id: uid(), name: "Livret Jeune",   type: "Sécurisé",  balance: 1600,  expectedReturn: 3.0, monthly: 0,   color: C.sky },
    { id: uid(), name: "Assurance vie",  type: "Mixte",     balance: 15000, expectedReturn: 3.5, monthly: 150, color: C.blue },
    { id: uid(), name: "PER",            type: "Retraite",  balance: 8000,  expectedReturn: 5.0, monthly: 150, color: C.violet },
    { id: uid(), name: "PEA",            type: "Actions",   balance: 14000, expectedReturn: 7.0, monthly: 200, color: C.positive },
    { id: uid(), name: "PEA piloté",     type: "Pilotée",   balance: 6000,  expectedReturn: 6.0, monthly: 100, color: "#f472b6" },
    { id: uid(), name: "Compte-titres",  type: "Actions",   balance: 9000,  expectedReturn: 7.0, monthly: 150, color: C.warn },
    { id: uid(), name: "Épargne pilotée", type: "Pilotée",  balance: 5000,  expectedReturn: 5.0, monthly: 100, color: "#818cf8" },
  ];
}

function initialState() {
  return {
    transactions: sampleTransactions(),
    categories: defaultCategories(),
    envelopes: sampleEnvelopes(),
    startBalance: 3200,      // solde de départ du compte courant (avant la 1re transaction listée)
    monthlyCapacity: 1000,   // capacité d'épargne mensuelle visée (pour le plan d'allocation)
    seeded: true,
  };
}

/**
 * Complète un état chargé/importé pour garantir la présence de tous les champs
 * attendus (compatibilité ascendante avec d'anciennes sauvegardes).
 */
function normalizeState(s) {
  if (!s || typeof s !== "object") return initialState();
  return {
    transactions: Array.isArray(s.transactions) ? s.transactions : [],
    categories: Array.isArray(s.categories) && s.categories.length ? s.categories : defaultCategories(),
    envelopes: Array.isArray(s.envelopes) ? s.envelopes : sampleEnvelopes(),
    startBalance: Number.isFinite(s.startBalance) ? s.startBalance : 0,
    monthlyCapacity: Number.isFinite(s.monthlyCapacity) ? s.monthlyCapacity : 1000,
    seeded: !!s.seeded,
  };
}

/* ===========================================================================
 * 5. REDUCER (toutes les mutations de données passent ici → état prévisible)
 * ===========================================================================*/

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "ADD_TX":
      return { ...state, transactions: [action.tx, ...state.transactions] };
    case "DELETE_TX":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case "IMPORT_TX":
      return { ...state, transactions: [...action.txs, ...state.transactions] };
    case "ADD_CAT":
      return { ...state, categories: [...state.categories, action.cat] };
    case "UPDATE_CAT":
      return { ...state, categories: state.categories.map((c) => (c.id === action.cat.id ? action.cat : c)) };
    case "DELETE_CAT":
      // Les transactions de la catégorie supprimée deviennent « non classées ».
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
    case "RESET_SAMPLE":
      return initialState();
    case "CLEAR_ALL":
      return { transactions: [], categories: defaultCategories(), envelopes: [], startBalance: 0, monthlyCapacity: 0, seeded: false };
    default:
      return state;
  }
}

/* ===========================================================================
 * 6. COMPOSANTS UI GÉNÉRIQUES
 * ===========================================================================*/

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-5 ${className}`}>
      {children}
    </div>
  );
}

// Carte d'indicateur clé (KPI) avec variation optionnelle.
function Kpi({ icon: Icon, label, value, sub, tone = "slate", trend }) {
  const toneMap = {
    slate: "text-slate-100", emerald: "text-emerald-400",
    rose: "text-rose-400", teal: "text-teal-400", amber: "text-amber-400",
  };
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon size={16} className="text-slate-500" />}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneMap[tone]}`}>{value}</div>
      {sub && (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          {trend === "up" && <ArrowUpRight size={14} className="text-emerald-400" />}
          {trend === "down" && <ArrowDownRight size={14} className="text-rose-400" />}
          <span>{sub}</span>
        </div>
      )}
    </Card>
  );
}

// Champ de saisie standardisé.
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 " +
  "outline-none transition focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 placeholder:text-slate-600";

function Btn({ children, onClick, variant = "primary", className = "", type = "button", disabled }) {
  const variants = {
    primary: "bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-40",
    ghost: "bg-slate-800 text-slate-200 hover:bg-slate-700",
    danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25",
    outline: "border border-slate-700 text-slate-300 hover:bg-slate-800",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

// Tooltip recharts personnalisé (cohérent avec le thème sombre).
function ChartTooltip({ active, payload, label, fmt = fmtEur }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      {label != null && <div className="mb-1 font-medium text-slate-300">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-medium text-slate-100">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ===========================================================================
 * 7. VUE — TABLEAU DE BORD
 * ===========================================================================*/

// Périodes d'affichage disponibles (en nombre de mois ; 0 = tout l'historique).
const PERIODS = [
  { label: "3 mois", months: 3 }, { label: "6 mois", months: 6 },
  { label: "1 an", months: 12 }, { label: "5 ans", months: 60 }, { label: "Tout", months: 0 },
];

function Dashboard({ state }) {
  const { transactions, categories, envelopes, startBalance } = state;
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [period, setPeriod] = useState(12);   // fenêtre des graphiques (mois)
  const [selMonth, setSelMonth] = useState(null); // mois analysé (null = dernier dispo)

  // --- Historique mensuel complet (revenus, dépenses, épargne, solde cumulé) ---
  const months = useMemo(() => {
    const byMonth = {};
    transactions.forEach((t) => {
      const k = monthKey(t.date);
      if (!k) return;
      if (!byMonth[k]) byMonth[k] = { income: 0, expense: 0 };
      if (t.amount >= 0) byMonth[k].income += t.amount;
      else byMonth[k].expense += -t.amount;
    });
    const keys = Object.keys(byMonth).sort();
    let running = startBalance;
    return keys.map((k) => {
      const f = byMonth[k];
      running += f.income - f.expense;
      return {
        key: k, mois: monthLabel(k),
        income: Math.round(f.income), expense: Math.round(f.expense),
        net: Math.round(f.income - f.expense), solde: Math.round(running),
      };
    });
  }, [transactions, startBalance]);

  // Mois effectivement analysé + mois précédent (pour la comparaison).
  const effKey = selMonth ?? (months.length ? months[months.length - 1].key : monthKey(new Date().toISOString()));
  const curIdx = months.findIndex((m) => m.key === effKey);
  const cur = curIdx >= 0 ? months[curIdx] : { income: 0, expense: 0, net: 0, solde: startBalance };
  const prev = curIdx > 0 ? months[curIdx - 1] : null;

  // Sous-ensemble visible selon la période choisie.
  const visible = useMemo(() => (period === 0 ? months : months.slice(-period)), [months, period]);
  const balanceSeries = useMemo(() => visible.map((m) => ({ mois: m.mois, solde: m.solde })), [visible]);
  const monthlyFlows = useMemo(() => visible.map((m) => ({ mois: m.mois, Revenus: m.income, Dépenses: m.expense })), [visible]);

  // Patrimoine = solde du mois analysé + valeur des enveloppes.
  const portfolio = useMemo(() => envelopes.reduce((s, e) => s + (e.balance || 0), 0), [envelopes]);
  const kpis = {
    balance: cur.solde, income: cur.income, expense: cur.expense, net: cur.net,
    savingsRate: cur.income > 0 ? cur.net / cur.income : 0,
    patrimoine: cur.solde + portfolio, portfolio,
  };

  // Répartition des dépenses du mois analysé.
  const breakdown = useMemo(() => {
    const sums = {};
    transactions.forEach((t) => {
      if (t.amount >= 0 || monthKey(t.date) !== effKey) return;
      const id = t.category || "none";
      sums[id] = (sums[id] || 0) + -t.amount;
    });
    return Object.entries(sums)
      .map(([id, value]) => ({ name: catById[id]?.name || "Non classé", value: Math.round(value), color: catById[id]?.color || C.axis }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, catById, effKey]);

  const totalExpenseMonth = breakdown.reduce((s, b) => s + b.value, 0);

  // Comparaison par catégorie : mois analysé vs mois précédent (top variations).
  const catCompare = useMemo(() => {
    if (!prev) return [];
    const sumFor = (key) => {
      const m = {};
      transactions.forEach((t) => {
        if (t.amount < 0 && monthKey(t.date) === key) { const id = t.category || "none"; m[id] = (m[id] || 0) + -t.amount; }
      });
      return m;
    };
    const a = sumFor(effKey), b = sumFor(prev.key);
    const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...ids]
      .map((id) => ({ name: catById[id]?.name || "Non classé", color: catById[id]?.color || C.axis, cur: Math.round(a[id] || 0), prev: Math.round(b[id] || 0), diff: Math.round((a[id] || 0) - (b[id] || 0)) }))
      .filter((r) => r.cur || r.prev)
      .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
      .slice(0, 6);
  }, [transactions, catById, effKey, prev]);

  // Variation en % d'une valeur par rapport au mois précédent (null si non calculable).
  const delta = (a, b) => (b ? (a - b) / Math.abs(b) : null);

  return (
    <div className="space-y-6">
      {/* --- Barre de contrôle : période (graphiques) + mois analysé --- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
          {PERIODS.map((p) => (
            <button key={p.label} onClick={() => setPeriod(p.months)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${period === p.months ? "bg-slate-800 text-teal-400" : "text-slate-400 hover:text-slate-200"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-slate-500" />
          <span className="text-xs text-slate-500">Mois analysé</span>
          <button onClick={() => curIdx > 0 && setSelMonth(months[curIdx - 1].key)} disabled={curIdx <= 0}
            className="rounded-md border border-slate-700 p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <select value={effKey} onChange={(e) => setSelMonth(e.target.value)} className={`${inputCls} py-1.5`}>
            {months.length === 0 && <option>—</option>}
            {months.map((m) => <option key={m.key} value={m.key}>{m.mois}</option>)}
          </select>
          <button onClick={() => curIdx >= 0 && curIdx < months.length - 1 && setSelMonth(months[curIdx + 1].key)} disabled={curIdx < 0 || curIdx >= months.length - 1}
            className="rounded-md border border-slate-700 p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* --- Bandeau KPI (mois analysé, avec variation vs mois précédent) --- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Wallet} label="Solde fin de mois" value={fmtEur(kpis.balance)} tone="teal"
          sub={<DeltaBadge cur={cur.solde} prev={prev?.solde} />} />
        <Kpi icon={ArrowUpRight} label="Revenus" value={fmtEur(kpis.income)} tone="emerald"
          sub={<DeltaBadge cur={cur.income} prev={prev?.income} />} />
        <Kpi icon={ArrowDownRight} label="Dépenses" value={fmtEur(kpis.expense)} tone="rose"
          sub={<DeltaBadge cur={cur.expense} prev={prev?.expense} goodUp={false} />} />
        <Kpi icon={PiggyBank} label="Épargne du mois" value={fmtEur(kpis.net)} tone={kpis.net >= 0 ? "emerald" : "rose"}
          sub={`Taux d'épargne ${fmtPct(kpis.savingsRate)}`} />
      </div>

      {/* --- Patrimoine + évolution du solde --- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 flex flex-col justify-center">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Patrimoine total</span>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-100">{fmtEur(kpis.patrimoine)}</div>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Comptes courants</span><span className="tabular-nums text-slate-200">{fmtEur(kpis.balance)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Enveloppes</span><span className="tabular-nums text-teal-400">{fmtEur(kpis.portfolio)}</span></div>
          </div>
        </Card>

        {/* Courbe d'évolution du solde — élément signature du dashboard */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Évolution du solde</h3>
            <span className="text-xs text-slate-500">{visible.length} mois affichés</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={balanceSeries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSolde" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="mois" tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => num0.format(v)} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke={C.axis} strokeDasharray="2 2" />
              <Area type="monotone" dataKey="solde" name="Solde" stroke={C.accent} strokeWidth={2} fill="url(#gradSolde)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* --- Répartition (mois analysé) + flux mensuels (période) --- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-200">Répartition des dépenses — {cur.mois || "—"}</h3>
          {breakdown.length === 0 ? (
            <Empty msg="Aucune dépense ce mois-ci." />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                    {breakdown.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-lg font-semibold tabular-nums text-slate-100">{fmtEur(totalExpenseMonth)}</span>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-1.5">
            {breakdown.slice(0, 5).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                <span className="text-slate-300">{b.name}</span>
                <span className="ml-auto tabular-nums text-slate-400">{fmtEur(b.value)}</span>
                <span className="w-10 text-right tabular-nums text-slate-500">{fmtPct(b.value / (totalExpenseMonth || 1))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="mb-4 text-sm font-semibold text-slate-200">Revenus vs dépenses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyFlows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="mois" tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => num0.format(v)} width={48} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenus" fill={C.positive} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dépenses" fill={C.negative} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* --- Comparaison mois analysé vs mois précédent --- */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-200">
          Comparaison — {cur.mois || "—"} {prev ? `vs ${prev.mois}` : ""}
        </h3>
        {!prev ? (
          <Empty msg="Aucun mois précédent à comparer pour ce mois." />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Synthèse des flux */}
            <div className="space-y-3">
              {[
                { k: "Revenus", a: cur.income, b: prev.income, good: true },
                { k: "Dépenses", a: cur.expense, b: prev.expense, good: false },
                { k: "Épargne", a: cur.net, b: prev.net, good: true },
              ].map((r) => (
                <div key={r.k} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{r.k}</span>
                    <DeltaBadge cur={r.a} prev={r.b} goodUp={r.good} label="" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-semibold tabular-nums text-slate-100">{fmtEur(r.a)}</span>
                    <span className="text-xs tabular-nums text-slate-600">avant {fmtEur(r.b)}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Top variations par catégorie */}
            <div className="lg:col-span-2">
              <p className="mb-2 text-xs text-slate-500">Principales variations de dépenses par catégorie</p>
              <div className="space-y-1.5">
                {catCompare.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="w-28 shrink-0 truncate text-slate-300">{r.name}</span>
                    <span className="tabular-nums text-slate-400">{fmtEur(r.cur)}</span>
                    <span className={`ml-auto inline-flex items-center gap-1 tabular-nums ${r.diff > 0 ? "text-rose-400" : r.diff < 0 ? "text-emerald-400" : "text-slate-500"}`}>
                      {r.diff > 0 ? <ArrowUpRight size={13} /> : r.diff < 0 ? <ArrowDownRight size={13} /> : null}
                      {r.diff > 0 ? "+" : ""}{fmtEur(r.diff)}
                    </span>
                  </div>
                ))}
                {catCompare.length === 0 && <p className="text-sm text-slate-600">Aucune dépense catégorisée sur ces deux mois.</p>}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Badge de variation en pourcentage par rapport à une valeur de référence.
 * goodUp : true si une hausse est « positive » (revenus), false sinon (dépenses).
 */
function DeltaBadge({ cur, prev, goodUp = true, label = "vs mois préc." }) {
  if (prev == null) return <span className="text-slate-500">—</span>;
  if (prev === 0) return <span className="text-slate-500">{cur === 0 ? "—" : "nouveau"}</span>;
  const d = (cur - prev) / Math.abs(prev);
  const up = d >= 0;
  const good = goodUp ? up : !up;
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {up ? "+" : ""}{fmtPct(d)} {label}
    </span>
  );
}

function Empty({ msg }) {
  return <div className="flex h-40 items-center justify-center text-sm text-slate-600">{msg}</div>;
}

/* ===========================================================================
 * 8. VUE — TRANSACTIONS (+ import CSV)
 * ===========================================================================*/

function Transactions({ state, dispatch }) {
  const { transactions, categories } = state;
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [filter, setFilter] = useState(""); // recherche libellé
  const [catFilter, setCatFilter] = useState("all");
  const [importing, setImporting] = useState(false);

  // Formulaire d'ajout rapide.
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), label: "", amount: "", category: categories[0]?.id || "", sign: "depense" });

  const addTx = useCallback(() => {
    const amt = parseAmount(form.amount);
    if (!form.label.trim() || Number.isNaN(amt)) return;
    const signed = form.sign === "depense" ? -Math.abs(amt) : Math.abs(amt);
    dispatch({ type: "ADD_TX", tx: { id: uid(), date: form.date, label: form.label.trim(), amount: signed, category: form.category || null } });
    setForm((f) => ({ ...f, label: "", amount: "" }));
  }, [form, dispatch]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return transactions
      .filter((t) => (catFilter === "all" ? true : t.category === (catFilter === "none" ? null : catFilter)))
      .filter((t) => !q || (t.label || "").toLowerCase().includes(q))
      .slice(0, 400); // borne d'affichage pour rester fluide
  }, [transactions, filter, catFilter]);

  return (
    <div className="space-y-5">
      {/* Saisie rapide */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Nouvelle transaction</h3>
          <Btn variant="outline" onClick={() => setImporting(true)}><Upload size={15} /> Importer un CSV</Btn>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Libellé"><input className={inputCls} placeholder="Ex : Courses Lidl" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Montant"><input className={inputCls} inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Sens">
            <select className={inputCls} value={form.sign} onChange={(e) => setForm({ ...form, sign: e.target.value })}>
              <option value="depense">Dépense</option>
              <option value="revenu">Revenu</option>
            </select>
          </Field>
          <Field label="Catégorie">
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Non classé</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="flex items-end"><Btn className="w-full" onClick={addTx}><Plus size={15} /> Ajouter</Btn></div>
        </div>
      </Card>

      {/* Filtres + liste */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Rechercher un libellé…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className={inputCls} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">Toutes catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Non classé</option>
          </select>
          <span className="text-xs text-slate-500">{filtered.length} ligne(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Libellé</th>
                <th className="py-2 pr-3 font-medium">Catégorie</th>
                <th className="py-2 pr-3 text-right font-medium">Montant</th>
                <th className="py-2 pl-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const cat = catById[t.category];
                return (
                  <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="py-2 pr-3 tabular-nums text-slate-400">{t.date}</td>
                    <td className="py-2 pr-3 text-slate-200">{t.label}</td>
                    <td className="py-2 pr-3">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                          style={{ background: `${cat.color}22`, color: cat.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />{cat.name}
                        </span>
                      ) : <span className="text-xs text-slate-600">Non classé</span>}
                    </td>
                    <td className={`py-2 pr-3 text-right font-medium tabular-nums ${t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {t.amount >= 0 ? "+" : ""}{fmtEur2(t.amount)}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <button onClick={() => dispatch({ type: "DELETE_TX", id: t.id })} className="text-slate-600 hover:text-rose-400" title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5}><Empty msg="Aucune transaction." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {importing && <ImportModal state={state} dispatch={dispatch} onClose={() => setImporting(false)} />}
    </div>
  );
}

/* --- Modale d'import CSV avec mappage de colonnes & auto-catégorisation --- */
function ImportModal({ state, dispatch, onClose }) {
  const { categories } = state;
  const [rows, setRows] = useState([]);     // lignes brutes du CSV
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({ date: "", label: "", amount: "", debit: "", credit: "" });
  const [mode, setMode] = useState("single"); // "single" (1 colonne montant) | "split" (débit/crédit)
  const [autoCat, setAutoCat] = useState(true);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  // Charge papaparse à la volée puis tente une détection automatique des colonnes.
  const onFile = useCallback(async (file) => {
    setError("");
    try {
      const Papa = (await import("papaparse")).default;
      Papa.parse(file, {
        header: true, skipEmptyLines: true, delimiter: "", // auto-détection du séparateur
        complete: (res) => {
          const hs = res.meta.fields || [];
          setHeaders(hs);
          setRows(res.data);
          // Heuristique de pré-mappage basée sur les noms de colonnes courants (FR).
          const find = (kw) => hs.find((h) => kw.some((k) => h.toLowerCase().includes(k))) || "";
          const debit = find(["débit", "debit"]);
          const credit = find(["crédit", "credit"]);
          setMap({
            date: find(["date"]),
            label: find(["libellé", "libelle", "label", "intitulé", "nature", "description"]),
            amount: find(["montant", "amount", "valeur"]),
            debit, credit,
          });
          setMode(debit && credit ? "split" : "single");
        },
        error: () => setError("Impossible de lire ce fichier CSV."),
      });
    } catch {
      setError("Le module de lecture CSV n'a pas pu être chargé.");
    }
  }, []);

  // Construit les transactions selon le mappage, puis les injecte dans l'état.
  const doImport = useCallback(() => {
    if (!map.date || !map.label) { setError("Sélectionne au moins les colonnes Date et Libellé."); return; }
    const out = [];
    rows.forEach((r) => {
      const date = parseDate(r[map.date]);
      const label = (r[map.label] || "").toString().trim();
      if (!date || !label) return;
      let amount;
      if (mode === "split") {
        const d = parseAmount(r[map.debit]); const c = parseAmount(r[map.credit]);
        amount = (Number.isNaN(c) ? 0 : Math.abs(c)) - (Number.isNaN(d) ? 0 : Math.abs(d));
      } else {
        amount = parseAmount(r[map.amount]);
      }
      if (Number.isNaN(amount) || amount === 0) return;
      // Auto-catégorisation : 1er match de mots-clés dans le libellé.
      let category = null;
      if (autoCat) {
        const low = label.toLowerCase();
        const hit = categories.find((cat) => (cat.keywords || []).some((k) => low.includes(k.toLowerCase())));
        if (hit) category = hit.id;
      }
      out.push({ id: uid(), date, label, amount, category });
    });
    if (out.length === 0) { setError("Aucune ligne valide détectée avec ce mappage."); return; }
    dispatch({ type: "IMPORT_TX", txs: out });
    onClose();
  }, [rows, map, mode, autoCat, categories, dispatch, onClose]);

  return (
    <Modal title="Importer un relevé CSV" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Btn variant="outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> Choisir un fichier .csv</Btn>
          <p className="mt-2 text-xs text-slate-500">
            Fonctionne avec la plupart des banques. Tu mappes les colonnes ci-dessous ; montants FR (« 1 234,56 ») et dates DD/MM/YYYY gérés automatiquement.
          </p>
        </div>

        {headers.length > 0 && (
          <>
            <div className="flex gap-2">
              <Btn variant={mode === "single" ? "primary" : "ghost"} onClick={() => setMode("single")}>Colonne « Montant »</Btn>
              <Btn variant={mode === "split" ? "primary" : "ghost"} onClick={() => setMode("split")}>Colonnes « Débit/Crédit »</Btn>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Colonne Date">
                <select className={inputCls} value={map.date} onChange={(e) => setMap({ ...map, date: e.target.value })}>
                  <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Colonne Libellé">
                <select className={inputCls} value={map.label} onChange={(e) => setMap({ ...map, label: e.target.value })}>
                  <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              {mode === "single" ? (
                <Field label="Colonne Montant">
                  <select className={inputCls} value={map.amount} onChange={(e) => setMap({ ...map, amount: e.target.value })}>
                    <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Colonne Débit">
                    <select className={inputCls} value={map.debit} onChange={(e) => setMap({ ...map, debit: e.target.value })}>
                      <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                  <Field label="Colonne Crédit">
                    <select className={inputCls} value={map.credit} onChange={(e) => setMap({ ...map, credit: e.target.value })}>
                      <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                </>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={autoCat} onChange={(e) => setAutoCat(e.target.checked)} className="accent-teal-500" />
              Catégoriser automatiquement via les mots-clés des catégories
            </label>

            {/* Aperçu des 5 premières lignes */}
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-800/40 text-slate-400">{headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-slate-800/60">
                      {headers.map((h) => <td key={h} className="px-2 py-1.5 text-slate-400">{String(r[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">{rows.length} ligne(s) détectée(s) dans le fichier.</p>
          </>
        )}

        {error && <p className="flex items-center gap-2 text-sm text-amber-400"><AlertTriangle size={15} /> {error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
          <Btn onClick={doImport} disabled={headers.length === 0}><Check size={15} /> Importer</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ===========================================================================
 * 9. VUE — CATÉGORIES
 * ===========================================================================*/

function Categories({ state, dispatch }) {
  const { categories, transactions } = state;

  // Dépenses cumulées par catégorie (tous mois) pour le suivi de budget mensuel moyen.
  const spentByCat = useMemo(() => {
    const months = new Set(transactions.map((t) => monthKey(t.date)).filter(Boolean)).size || 1;
    const sums = {};
    transactions.forEach((t) => { if (t.amount < 0 && t.category) sums[t.category] = (sums[t.category] || 0) + -t.amount; });
    const avg = {};
    Object.keys(sums).forEach((k) => (avg[k] = sums[k] / months));
    return avg;
  }, [transactions]);

  const [draft, setDraft] = useState({ name: "", type: "depense", budget: "", color: SWATCHES[0], keywords: "" });

  const add = useCallback(() => {
    if (!draft.name.trim()) return;
    dispatch({ type: "ADD_CAT", cat: {
      id: uid(), name: draft.name.trim(), type: draft.type, color: draft.color,
      budget: parseAmount(draft.budget) || 0,
      keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    }});
    setDraft({ name: "", type: "depense", budget: "", color: SWATCHES[(SWATCHES.indexOf(draft.color) + 1) % SWATCHES.length], keywords: "" });
  }, [draft, dispatch]);

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Nouvelle catégorie</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Nom"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex : Abonnements" /></Field>
          <Field label="Type">
            <select className={inputCls} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="depense">Dépense</option><option value="revenu">Revenu</option>
            </select>
          </Field>
          <Field label="Budget / mois"><input className={inputCls} inputMode="decimal" value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} placeholder="0" /></Field>
          <Field label="Couleur">
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {SWATCHES.map((s) => (
                <button key={s} onClick={() => setDraft({ ...draft, color: s })}
                  className={`h-6 w-6 rounded-full ring-2 transition ${draft.color === s ? "ring-white/70" : "ring-transparent"}`} style={{ background: s }} />
              ))}
            </div>
          </Field>
          <Field label="Mots-clés (virgule)"><input className={inputCls} value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="netflix, spotify" /></Field>
          <div className="flex items-end"><Btn className="w-full" onClick={add}><Plus size={15} /> Créer</Btn></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const spent = spentByCat[c.id] || 0;
          const ratio = c.budget > 0 ? spent / c.budget : 0;
          const over = ratio > 1;
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                  <div>
                    <div className="font-medium text-slate-100">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.type === "revenu" ? "Revenu" : "Dépense"}</div>
                  </div>
                </div>
                <button onClick={() => dispatch({ type: "DELETE_CAT", id: c.id })} className="text-slate-600 hover:text-rose-400"><Trash2 size={15} /></button>
              </div>

              {c.type === "depense" && c.budget > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Moyenne {fmtEur(spent)}</span>
                    <span className={over ? "text-rose-400" : "text-slate-500"}>Budget {fmtEur(c.budget)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, ratio * 100)}%`, background: over ? C.negative : c.color }} />
                  </div>
                  {over && <div className="mt-1 flex items-center gap-1 text-xs text-rose-400"><AlertTriangle size={12} /> Dépassement de {fmtPct(ratio - 1)}</div>}
                </div>
              )}

              {c.keywords?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.keywords.slice(0, 6).map((k, i) => <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{k}</span>)}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ===========================================================================
 * 10. VUE — ENVELOPPES (comptes d'épargne/investissement, plan & projection)
 * ===========================================================================*/

// Horizons de projection proposés (en années).
const HORIZONS = [5, 10, 15, 20, 30];

/**
 * Projette chaque enveloppe sur `years` années (intérêts composés + versement
 * mensuel propre), puis agrège par année pour le graphique empilé.
 * @returns {{ rows: Array, finals: Array }}
 *   rows   : [{ annee, <nomEnveloppe>: valeur, Total, Versé }]
 *   finals : [{ name, color, final, contributed, gain }]
 */
function projectEnvelopes(envelopes, years) {
  const per = envelopes.map((e) => ({
    e,
    series: projectSavings({ principal: e.balance || 0, monthly: e.monthly || 0, annualRate: e.expectedReturn || 0, years }),
  }));
  const rows = [];
  for (let y = 0; y <= years; y++) {
    const idx = y * 12;
    const row = { annee: y };
    let total = 0, contributed = 0;
    per.forEach(({ e, series }) => {
      const pt = series[Math.min(idx, series.length - 1)];
      row[e.name] = Math.round(pt.balance);
      total += pt.balance;
      contributed += pt.contributed;
    });
    row.Total = Math.round(total);
    row.Versé = Math.round(contributed);
    rows.push(row);
  }
  const finals = per.map(({ e, series }) => {
    const last = series[series.length - 1];
    return { name: e.name, color: e.color, final: last.balance, contributed: last.contributed, gain: last.balance - last.contributed };
  });
  return { rows, finals };
}

const ENV_TYPES = ["Sécurisé", "Mixte", "Actions", "Pilotée", "Retraite", "Immobilier", "Autre"];

function Envelopes({ state, dispatch }) {
  const { envelopes, monthlyCapacity } = state;
  const [horizon, setHorizon] = useState(20);

  // Helper : met à jour un champ d'une enveloppe (édition inline).
  const setField = useCallback((env, field, value) => {
    dispatch({ type: "UPDATE_ENV", env: { ...env, [field]: value } });
  }, [dispatch]);

  // Totaux courants.
  const totals = useMemo(() => {
    const balance = envelopes.reduce((s, e) => s + (e.balance || 0), 0);
    const monthly = envelopes.reduce((s, e) => s + (e.monthly || 0), 0);
    // Rendement moyen pondéré par les soldes.
    const wRet = balance > 0 ? envelopes.reduce((s, e) => s + (e.balance || 0) * (e.expectedReturn || 0), 0) / balance : 0;
    return { balance, monthly, wRet };
  }, [envelopes]);

  // Projection sur l'horizon choisi.
  const proj = useMemo(() => projectEnvelopes(envelopes, horizon), [envelopes, horizon]);
  const projFinal = proj.rows[proj.rows.length - 1] || { Total: 0, Versé: 0 };
  const projGain = (projFinal.Total || 0) - (projFinal.Versé || 0);

  // Donut d'allocation par enveloppe.
  const allocation = useMemo(
    () => envelopes.filter((e) => e.balance > 0).map((e) => ({ name: e.name, value: Math.round(e.balance), color: e.color })),
    [envelopes]
  );

  const remaining = monthlyCapacity - totals.monthly; // marge mensuelle non allouée

  const addEnv = useCallback(() => {
    dispatch({ type: "ADD_ENV", env: { id: uid(), name: "Nouvelle enveloppe", type: "Actions", balance: 0, expectedReturn: 5, monthly: 0, color: SWATCHES[envelopes.length % SWATCHES.length] } });
  }, [dispatch, envelopes.length]);

  return (
    <div className="space-y-5">
      {/* KPIs enveloppes */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Landmark} label="Valeur des enveloppes" value={fmtEur(totals.balance)} tone="teal" />
        <Kpi icon={PiggyBank} label="Versements / mois" value={fmtEur(totals.monthly)} />
        <Kpi icon={Percent} label="Rendement moyen pondéré" value={fmtPct(totals.wRet / 100)} tone="emerald" />
        <Kpi icon={TrendingUp} label={`Projeté à ${horizon} ans`} value={fmtEur(projFinal.Total)} tone="emerald"
          sub={`dont ${fmtEur(projGain)} d'intérêts`} />
      </div>

      {/* Gestion des enveloppes (édition inline) + allocation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Mes enveloppes</h3>
            <Btn variant="outline" onClick={addEnv}><Plus size={15} /> Ajouter</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-2 font-medium">Enveloppe</th>
                  <th className="py-2 px-2 font-medium">Type</th>
                  <th className="py-2 px-2 text-right font-medium">Solde</th>
                  <th className="py-2 px-2 text-right font-medium">% / an</th>
                  <th className="py-2 px-2 text-right font-medium">Verst/mois</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {envelopes.map((e) => {
                  const cap = ENV_CAPS[e.name];
                  const full = cap && e.balance >= cap;
                  return (
                    <tr key={e.id} className="border-b border-slate-800/60">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                          <input className={`${inputCls} w-36 py-1`} value={e.name} onChange={(ev) => setField(e, "name", ev.target.value)} />
                        </div>
                        {full && <span className="ml-4 text-[10px] text-amber-400">plafond atteint ({fmtEur(cap)})</span>}
                      </td>
                      <td className="py-1.5 px-2">
                        <select className={`${inputCls} py-1`} value={e.type} onChange={(ev) => setField(e, "type", ev.target.value)}>
                          {ENV_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input type="number" className={`${inputCls} w-24 py-1 text-right`} value={e.balance}
                          onChange={(ev) => setField(e, "balance", Number(ev.target.value) || 0)} />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input type="number" step="0.1" className={`${inputCls} w-16 py-1 text-right`} value={e.expectedReturn}
                          onChange={(ev) => setField(e, "expectedReturn", Number(ev.target.value) || 0)} />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input type="number" className={`${inputCls} w-20 py-1 text-right`} value={e.monthly}
                          onChange={(ev) => setField(e, "monthly", Number(ev.target.value) || 0)} />
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <button onClick={() => dispatch({ type: "DELETE_ENV", id: e.id })} className="text-slate-600 hover:text-rose-400"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
                {envelopes.length === 0 && <tr><td colSpan={6}><Empty msg="Aucune enveloppe. Ajoutes-en une." /></td></tr>}
              </tbody>
              {envelopes.length > 0 && (
                <tfoot>
                  <tr className="text-xs font-medium text-slate-300">
                    <td className="py-2 pr-2">Total</td><td />
                    <td className="py-2 px-2 text-right tabular-nums">{fmtEur(totals.balance)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-slate-500">{fmtPct(totals.wRet / 100)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtEur(totals.monthly)}</td><td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">Les valeurs (solde, %, versement) sont éditables directement dans le tableau. Le % est ton hypothèse de rendement annuel net.</p>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-200">Allocation actuelle</h3>
          {allocation.length === 0 ? <Empty msg="—" /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {allocation.map((a, i) => <Cell key={i} fill={a.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {allocation.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                    <span className="text-slate-300">{a.name}</span>
                    <span className="ml-auto tabular-nums text-slate-400">{fmtEur(a.value)}</span>
                    <span className="w-10 text-right tabular-nums text-slate-500">{fmtPct(a.value / (totals.balance || 1))}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Plan d'allocation mensuel */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Plan d'épargne mensuel</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Capacité d'épargne / mois</span>
            <input type="number" className={`${inputCls} w-28 py-1.5 text-right`} value={monthlyCapacity}
              onChange={(e) => dispatch({ type: "SET_CAPACITY", value: Number(e.target.value) || 0 })} />
          </div>
        </div>

        {/* Barre capacité vs versements alloués */}
        <div className="mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Alloué : <span className="tabular-nums text-slate-200">{fmtEur(totals.monthly)}</span></span>
            <span className={remaining < 0 ? "text-rose-400" : "text-emerald-400"}>
              {remaining < 0 ? `Dépassement de ${fmtEur(-remaining)}` : `Marge restante : ${fmtEur(remaining)}`}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, monthlyCapacity > 0 ? (totals.monthly / monthlyCapacity) * 100 : 0)}%`, background: remaining < 0 ? C.negative : C.accent }} />
          </div>
        </div>

        {/* Répartition par enveloppe (part du versement mensuel) */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {envelopes.filter((e) => e.monthly > 0).map((e) => (
            <div key={e.id} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="w-32 shrink-0 truncate text-sm text-slate-300">{e.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${totals.monthly > 0 ? (e.monthly / totals.monthly) * 100 : 0}%`, background: e.color }} />
              </div>
              <span className="w-16 shrink-0 text-right text-sm tabular-nums text-slate-400">{fmtEur(e.monthly)}</span>
            </div>
          ))}
          {envelopes.every((e) => !e.monthly) && <p className="text-sm text-slate-600">Renseigne un versement mensuel sur tes enveloppes pour bâtir ton plan.</p>}
        </div>
      </Card>

      {/* Projection long terme */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Projection du patrimoine</h3>
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
            {HORIZONS.map((h) => (
              <button key={h} onClick={() => setHorizon(h)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${horizon === h ? "bg-slate-800 text-teal-400" : "text-slate-400 hover:text-slate-200"}`}>
                {h} ans
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={proj.rows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="annee" tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} a`} />
            <YAxis tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${num0.format(v / 1000)}k`} width={42} />
            <Tooltip content={<ChartTooltip />} />
            {/* Aires empilées : une par enveloppe (composition du patrimoine) */}
            {envelopes.map((e) => (
              <Area key={e.id} type="monotone" dataKey={e.name} stackId="patrimoine" stroke={e.color} fill={e.color} fillOpacity={0.25} strokeWidth={1} />
            ))}
            {/* Ligne « total versé » en repère (capital sans rendement) */}
            <Area type="monotone" dataKey="Versé" stroke={C.axis} strokeDasharray="3 3" fill="none" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Tableau des valeurs finales par enveloppe */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3 font-medium">Enveloppe</th>
                <th className="py-2 px-3 text-right font-medium">Versé sur {horizon} ans</th>
                <th className="py-2 px-3 text-right font-medium">Valeur projetée</th>
                <th className="py-2 pl-3 text-right font-medium">Intérêts</th>
              </tr>
            </thead>
            <tbody>
              {proj.finals.map((f, i) => (
                <tr key={i} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />{f.name}</span></td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">{fmtEur(f.contributed)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-100">{fmtEur(f.final)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums text-emerald-400">+{fmtEur(f.gain)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-slate-200">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 px-3 text-right tabular-nums">{fmtEur(projFinal.Versé)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-teal-400">{fmtEur(projFinal.Total)}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-emerald-400">+{fmtEur(projGain)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">Projection à versements et rendements constants ; les rendements réels varient et ne sont pas garantis.</p>
      </Card>
    </div>
  );
}

/* ===========================================================================
 * 11. VUE — SIMULATEURS (épargne & emprunt)
 * ===========================================================================*/

function Simulators() {
  const [tab, setTab] = useState("epargne");
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Btn variant={tab === "epargne" ? "primary" : "ghost"} onClick={() => setTab("epargne")}><PiggyBank size={15} /> Épargne & intérêts composés</Btn>
        <Btn variant={tab === "emprunt" ? "primary" : "ghost"} onClick={() => setTab("emprunt")}><Landmark size={15} /> Emprunt</Btn>
      </div>
      {tab === "epargne" ? <SavingsSim /> : <LoanSim />}
    </div>
  );
}

/* --- Simulateur d'épargne avec 3 scénarios de rendement --- */
function SavingsSim() {
  const [p, setP] = useState({ principal: 5000, monthly: 300, rate: 5, years: 20 });
  // 3 scénarios de rendement annuel autour du taux saisi.
  const [scen, setScen] = useState({ low: 2, mid: 5, high: 8 });

  // Génère les 3 trajectoires et les fusionne sur l'axe temporel (par mois).
  const data = useMemo(() => {
    const mk = (r) => projectSavings({ principal: p.principal, monthly: p.monthly, annualRate: r, years: p.years });
    const low = mk(scen.low), mid = mk(scen.mid), high = mk(scen.high);
    return mid.map((row, idx) => ({
      annee: row.year,
      Pessimiste: Math.round(low[idx].balance),
      Réaliste: Math.round(mid[idx].balance),
      Optimiste: Math.round(high[idx].balance),
      Versé: Math.round(row.contributed),
    }));
  }, [p, scen]);

  const last = data[data.length - 1] || {};
  const contributed = p.principal + p.monthly * p.years * 12;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Hypothèses</h3>
        <Field label="Capital de départ"><input className={inputCls} type="number" value={p.principal} onChange={(e) => setP({ ...p, principal: +e.target.value })} /></Field>
        <Field label="Versement mensuel"><input className={inputCls} type="number" value={p.monthly} onChange={(e) => setP({ ...p, monthly: +e.target.value })} /></Field>
        <Field label="Durée (années)"><input className={inputCls} type="number" value={p.years} onChange={(e) => setP({ ...p, years: Math.max(1, +e.target.value) })} /></Field>
        <div className="border-t border-slate-800 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-400">Scénarios de rendement annuel (%)</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Bas"><input className={inputCls} type="number" step="0.5" value={scen.low} onChange={(e) => setScen({ ...scen, low: +e.target.value })} /></Field>
            <Field label="Moyen"><input className={inputCls} type="number" step="0.5" value={scen.mid} onChange={(e) => setScen({ ...scen, mid: +e.target.value })} /></Field>
            <Field label="Haut"><input className={inputCls} type="number" step="0.5" value={scen.high} onChange={(e) => setScen({ ...scen, high: +e.target.value })} /></Field>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div><div className="text-xs text-slate-500">Total versé</div><div className="text-lg font-semibold tabular-nums text-slate-200">{fmtEur(contributed)}</div></div>
          <div><div className="text-xs text-slate-500">Capital final (réaliste)</div><div className="text-lg font-semibold tabular-nums text-teal-400">{fmtEur(last.Réaliste)}</div></div>
          <div><div className="text-xs text-slate-500">Intérêts gagnés</div><div className="text-lg font-semibold tabular-nums text-emerald-400">{fmtEur((last.Réaliste || 0) - contributed)}</div></div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} /><stop offset="100%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="annee" tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)} a`} />
            <YAxis tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${num0.format(v / 1000)}k`} width={42} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Optimiste" stroke={C.positive} fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
            <Area type="monotone" dataKey="Réaliste" stroke={C.accent} fill="url(#gradMid)" strokeWidth={2.5} />
            <Area type="monotone" dataKey="Pessimiste" stroke={C.warn} fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
            <Area type="monotone" dataKey="Versé" stroke={C.axis} fill="none" strokeWidth={1.5} strokeDasharray="2 4" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* --- Simulateur d'emprunt avec tableau d'amortissement --- */
function LoanSim() {
  const [p, setP] = useState({ amount: 200000, rate: 3.5, years: 20 });
  const months = Math.round(p.years * 12);

  const sim = useMemo(() => amortization(p.amount, p.rate, months), [p, months]);

  // Sous-échantillonnage annuel pour la courbe (1 point/an → lisible et léger).
  const yearly = useMemo(() => {
    const out = [{ annee: 0, "Capital restant": Math.round(p.amount), "Intérêts cumulés": 0 }];
    for (let y = 1; y <= p.years; y++) {
      const r = sim.rows[Math.min(y * 12, sim.rows.length) - 1];
      if (r) out.push({ annee: y, "Capital restant": Math.round(r.balance), "Intérêts cumulés": Math.round(r.cumInterest) });
    }
    return out;
  }, [sim, p]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Paramètres du prêt</h3>
        <Field label="Montant emprunté (€)"><input className={inputCls} type="number" value={p.amount} onChange={(e) => setP({ ...p, amount: +e.target.value })} /></Field>
        <Field label="Taux annuel (%)"><input className={inputCls} type="number" step="0.1" value={p.rate} onChange={(e) => setP({ ...p, rate: +e.target.value })} /></Field>
        <Field label="Durée (années)"><input className={inputCls} type="number" value={p.years} onChange={(e) => setP({ ...p, years: Math.max(1, +e.target.value) })} /></Field>

        <div className="space-y-2 border-t border-slate-800 pt-3">
          <Row label="Mensualité" value={fmtEur2(sim.monthly)} strong />
          <Row label="Coût total" value={fmtEur(sim.totalCost)} />
          <Row label="Intérêts totaux" value={fmtEur(sim.totalInterest)} tone="rose" />
          <Row label="Taux d'endettement*" value={`${months} mensualités`} muted />
        </div>
        <p className="text-[11px] text-slate-600">*Compare la mensualité à ~33 % de tes revenus nets pour estimer ta capacité d'emprunt.</p>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Amortissement du capital</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={yearly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.blue} stopOpacity={0.3} /><stop offset="100%" stopColor={C.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradInt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.negative} stopOpacity={0.25} /><stop offset="100%" stopColor={C.negative} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="annee" tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} a`} />
            <YAxis tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${num0.format(v / 1000)}k`} width={42} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Capital restant" stroke={C.blue} fill="url(#gradCap)" strokeWidth={2.5} />
            <Area type="monotone" dataKey="Intérêts cumulés" stroke={C.negative} fill="url(#gradInt)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Row({ label, value, strong, muted, tone }) {
  const cls = tone === "rose" ? "text-rose-400" : strong ? "text-teal-400" : muted ? "text-slate-500" : "text-slate-200";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium tabular-nums ${cls} ${strong ? "text-base" : ""}`}>{value}</span>
    </div>
  );
}

/* ===========================================================================
 * 12. MODALE GÉNÉRIQUE
 * ===========================================================================*/

function Modal({ title, children, onClose, wide }) {
  // Fermeture par touche Échap (accessibilité clavier).
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ===========================================================================
 * 13. EXPORT / IMPORT DE DONNÉES
 * ===========================================================================*/

// Déclenche le téléchargement d'un contenu texte (avec BOM UTF-8 pour Excel FR).
function download(content, filename, type) {
  const blob = new Blob(["\uFEFF" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportTransactionsCSV(transactions, categories) {
  const catName = (id) => categories.find((c) => c.id === id)?.name || "";
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["Date", "Libellé", "Montant", "Catégorie", "Type"];
  const lines = transactions.map((t) =>
    [t.date, esc(t.label), String(t.amount).replace(".", ","), esc(catName(t.category)), t.amount >= 0 ? "Revenu" : "Dépense"].join(";")
  );
  download([header.join(";"), ...lines].join("\n"), "transactions.csv", "text/csv;charset=utf-8");
}

/* ===========================================================================
 * 14. APPLICATION RACINE
 * ===========================================================================*/

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "categories", label: "Catégories", icon: Tags },
  { id: "envelopes", label: "Enveloppes", icon: Landmark },
  { id: "investments", label: "Investissements", icon: Building2 },
  { id: "recurring", label: "Charges Récurrentes", icon: Repeat },
  { id: "stocks", label: "Bourse & ETF", icon: TrendingUp },
  { id: "simulators", label: "Simulateurs", icon: Calculator },
];

export default function FinancePilot() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [view, setView] = useState("dashboard");
  const [ready, setReady] = useState(false);
  const [showData, setShowData] = useState(false);
  const jsonRef = useRef(null);

  // Chargement initial depuis le stockage local (une seule fois).
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await Store.get(STORAGE_KEY);
      if (alive && r?.value) {
        try { dispatch({ type: "LOAD", payload: normalizeState(JSON.parse(r.value)) }); } catch { /* état par défaut conservé */ }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // Persistance « debouncée » : on n'écrit qu'après 400 ms d'inactivité.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return; // ne pas écraser le stockage avant le 1er chargement
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { Store.set(STORAGE_KEY, JSON.stringify(state)); }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready]);

  // Import d'une sauvegarde JSON complète.
  const importJSON = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && Array.isArray(data.transactions)) dispatch({ type: "LOAD", payload: normalizeState(data) });
      } catch { /* fichier invalide : on ignore silencieusement */ }
    };
    reader.readAsText(file);
  }, []);

  // Récupérer les infos utilisateur depuis localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userEmail = user.email || 'Utilisateur';

  // Fonction de déconnexion
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        {/* --- Navigation latérale (devient barre supérieure sur mobile) --- */}
        <aside className="border-b border-slate-800 lg:w-60 lg:border-b-0 lg:border-r">
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-slate-950">
                <Wallet size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">FinancePilot</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Pilotage sécurisé</div>
              </div>
            </div>
            {/* Profil utilisateur */}
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-2 border border-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-teal-400">
                <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-300 truncate">{userEmail}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                title="Déconnexion"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:pb-0">
            {NAV.map((n) => {
              const active = view === n.id;
              return (
                <button key={n.id} onClick={() => setView(n.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
                    active ? "bg-slate-800 text-teal-400" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}>
                  <n.icon size={17} /> {n.label}
                </button>
              );
            })}
          </nav>
          <div className="hidden px-3 pt-4 lg:block">
            <button onClick={() => setShowData(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-slate-200">
              <SettingsIcon size={17} /> Données & sauvegarde
            </button>
          </div>
        </aside>

        {/* --- Contenu principal --- */}
        <main className="flex-1 p-4 sm:p-6">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{NAV.find((n) => n.id === view)?.label}</h1>
              <p className="text-sm text-slate-500">
                {view === "dashboard" && "Vue d'ensemble de tes finances ce mois-ci"}
                {view === "transactions" && "Saisie, import de relevés et historique"}
                {view === "categories" && "Catégories, budgets et règles d'auto-classement"}
                {view === "envelopes" && "Tes comptes, ton plan d'épargne mensuel et la projection long terme"}
                {view === "investments" && "Gestion de tes produits bancaires : LEP, PEL, PEA, Assurance Vie, etc."}
                {view === "recurring" && "Suivi de tes revenus et charges récurrents mensuels/annuels"}
                {view === "stocks" && "Portefeuille d'actions, ETF et cryptomonnaies"}
                {view === "simulators" && "Projections d'épargne et simulation d'emprunt"}
              </p>
            </div>
            <Btn variant="outline" onClick={() => setShowData(true)} className="lg:hidden"><SettingsIcon size={15} /></Btn>
          </header>

          {!ready ? (
            <div className="flex h-64 items-center justify-center text-slate-600">Chargement…</div>
          ) : (
            <>
              {view === "dashboard" && <Dashboard state={state} />}
              {view === "transactions" && <Transactions state={state} dispatch={dispatch} />}
              {view === "categories" && <Categories state={state} dispatch={dispatch} />}
              {view === "envelopes" && <Envelopes state={state} dispatch={dispatch} />}
              {view === "investments" && <InvestmentProducts />}
              {view === "recurring" && <RecurringCharges />}
              {view === "stocks" && <StockPortfolio />}
              {view === "simulators" && <Simulators />}
            </>
          )}
        </main>
      </div>

      {/* --- Modale Données & sauvegarde --- */}
      {showData && (
        <Modal title="Données & sauvegarde" onClose={() => setShowData(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-400">
              Toutes tes données restent dans ce navigateur. Exporte-les régulièrement pour les sauvegarder ou les transférer.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Btn variant="outline" onClick={() => exportTransactionsCSV(state.transactions, state.categories)}>
                <FileDown size={15} /> Exporter les transactions (CSV)
              </Btn>
              <Btn variant="outline" onClick={() => download(JSON.stringify(state, null, 2), "financepilot-sauvegarde.json", "application/json")}>
                <Download size={15} /> Exporter la sauvegarde complète (JSON)
              </Btn>
              <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden"
                onChange={(e) => { e.target.files?.[0] && importJSON(e.target.files[0]); setShowData(false); }} />
              <Btn variant="outline" onClick={() => jsonRef.current?.click()}>
                <Upload size={15} /> Restaurer une sauvegarde (JSON)
              </Btn>
            </div>
            <div className="border-t border-slate-800 pt-3">
              <Btn variant="ghost" className="w-full" onClick={() => { dispatch({ type: "RESET_SAMPLE" }); setShowData(false); }}>
                <RotateCcw size={15} /> Recharger les données d'exemple
              </Btn>
              <Btn variant="danger" className="mt-2 w-full" onClick={() => { dispatch({ type: "CLEAR_ALL" }); setShowData(false); }}>
                <Trash2 size={15} /> Tout effacer (repartir de zéro)
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
