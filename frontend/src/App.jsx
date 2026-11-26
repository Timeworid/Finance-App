/**
 * FinancePilot — application racine : mise en page, navigation et données.
 *
 * Les données financières (transactions, catégories, enveloppes, réglages) sont
 * gérées par le hook useFinanceData ; chaque vue vit dans src/views/.
 * Les vues « Biens », « Récurrents » et « Bourse » gèrent leurs propres données.
 */
import { useState, useMemo } from "react";
import {
  LayoutDashboard, Receipt, Tags, TrendingUp, Calculator, Landmark, Download, Wallet,
  Settings as SettingsIcon, FileDown, LogOut, User, Repeat, Building2, Sun, Moon,
} from "lucide-react";
import { authAPI } from "./services/api";
import { useTheme } from "./context/ThemeContext";
import { useToast } from "./components/Toast";
import { Btn, Modal } from "./components/ui";
import { download, exportTransactionsCSV } from "./lib/export";
import { useFinanceData } from "./hooks/useFinanceData";
import Dashboard from "./views/Dashboard";
import Transactions from "./views/Transactions";
import Categories from "./views/Categories";
import Envelopes from "./views/Envelopes";
import Simulators from "./views/Simulators";
import AssetsProperties from "./components/AssetsProperties";
import RecurringCharges from "./components/RecurringCharges";
import StockPortfolio from "./components/StockPortfolio";

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "categories", label: "Catégories", icon: Tags },
  { id: "envelopes", label: "Enveloppes", icon: Landmark },
  { id: "assets", label: "Biens & Propriétés", icon: Building2 },
  { id: "recurring", label: "Charges Récurrentes", icon: Repeat },
  { id: "stocks", label: "Bourse & ETF", icon: TrendingUp },
  { id: "simulators", label: "Simulateurs", icon: Calculator },
];

// Sous-titre affiché sous le titre de chaque vue
const SUBTITLES = {
  dashboard: "Vue d'ensemble de tes finances ce mois-ci",
  transactions: "Saisie, import de relevés et historique",
  categories: "Catégories, budgets et règles d'auto-classement",
  envelopes: "Tes comptes, ton plan d'épargne mensuel et la projection long terme",
  assets: "Inventaire de tes biens physiques : voiture, immobilier, matériel, etc.",
  recurring: "Suivi de tes revenus et charges récurrents mensuels/annuels",
  stocks: "Portefeuille d'actions, ETF et cryptomonnaies",
  simulators: "Projections d'épargne et simulation d'emprunt",
};

/** Lit l'utilisateur connecté depuis localStorage (JSON corrompu toléré). */
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

export default function FinancePilot() {
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const { state, dispatch: apiDispatch, ready, stockPositions } = useFinanceData(toast);
  const [view, setView] = useState("dashboard");
  const [showData, setShowData] = useState(false);

  const userEmail = useMemo(() => readStoredUser().email || "Utilisateur", []);

  // Déconnexion : révoque le refresh token côté serveur puis retourne à la connexion
  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      /* Même en cas d'erreur réseau, la session locale est nettoyée par authAPI.logout */
    }
    window.location.href = "/login";
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
                onClick={toggleTheme}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition"
                title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
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
              <p className="text-sm text-slate-500">{SUBTITLES[view]}</p>
            </div>
            <Btn variant="outline" onClick={() => setShowData(true)} className="lg:hidden"><SettingsIcon size={15} /></Btn>
          </header>

          {!ready ? (
            <div className="flex h-64 items-center justify-center text-slate-600">Chargement…</div>
          ) : (
            <>
              {view === "dashboard" && <Dashboard state={state} stockPositions={stockPositions} />}
              {view === "transactions" && <Transactions state={state} dispatch={apiDispatch} toast={toast} />}
              {view === "categories" && <Categories state={state} dispatch={apiDispatch} toast={toast} />}
              {view === "envelopes" && <Envelopes state={state} dispatch={apiDispatch} toast={toast} />}
              {view === "assets" && <AssetsProperties />}
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
              Tes données sont enregistrées sur le serveur (montants et libellés chiffrés).
              Tu peux en exporter une copie à tout moment.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Btn variant="outline" onClick={() => exportTransactionsCSV(state.transactions, state.categories)}>
                <FileDown size={15} /> Exporter les transactions (CSV)
              </Btn>
              <Btn variant="outline" onClick={() => download(JSON.stringify(state, null, 2), "financepilot-sauvegarde.json", "application/json")}>
                <Download size={15} /> Exporter toutes les données (JSON)
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}