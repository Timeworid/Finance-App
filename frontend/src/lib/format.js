/**
 * Palette de couleurs et formateurs (montants, pourcentages, mois) — sans dépendance React.
 */

// Palette alignée sur l'échelle Tailwind utilisée dans le JSX (cohérence visuelle).
export const C = {
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
export const SWATCHES = [C.blue, C.warn, C.violet, C.negative, C.sky, C.positive, C.accent, "#f472b6", "#facc15", "#818cf8"];

// Formatteurs FR mémoïsés au niveau module (créés une seule fois).
const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct1 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

export const num0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const fmtEur  = (v) => eur0.format(Number.isFinite(v) ? v : 0);

export const fmtEur2 = (v) => eur2.format(Number.isFinite(v) ? v : 0);

export const fmtPct  = (v) => pct1.format(Number.isFinite(v) ? v : 0);

// Date ISO (YYYY-MM-DD) → libellé court FR « 12 mars » / clé de mois « 2025-03 ».
export const monthKey = (iso) => (iso || "").slice(0, 7);

export const monthLabel = (key) => {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};
