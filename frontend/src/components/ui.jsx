/**
 * Composants d'interface génériques (cartes, champs, boutons, modale, badges).
 */
import { useEffect } from "react";
import {
  ArrowUpRight, ArrowDownRight, X,
} from "lucide-react";
import { fmtEur, fmtPct } from "../lib/format";

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-5 ${className}`}>
      {children}
    </div>
  );
}

// Carte d'indicateur clé (KPI) avec variation optionnelle.
export function Kpi({ icon: Icon, label, value, sub, tone = "slate", trend }) {
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
export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 " +
  "outline-none transition focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 placeholder:text-slate-600";

export function Btn({ children, onClick, variant = "primary", className = "", type = "button", disabled }) {
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
export function ChartTooltip({ active, payload, label, fmt = fmtEur }) {
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

/**
 * Badge de variation en pourcentage par rapport à une valeur de référence.
 * goodUp : true si une hausse est « positive » (revenus), false sinon (dépenses).
 */
export function DeltaBadge({ cur, prev, goodUp = true, label = "vs mois préc." }) {
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

export function Empty({ msg }) {
  return <div className="flex h-40 items-center justify-center text-sm text-slate-600">{msg}</div>;
}

export function Row({ label, value, strong, muted, tone }) {
  const cls = tone === "rose" ? "text-rose-400" : strong ? "text-teal-400" : muted ? "text-slate-500" : "text-slate-200";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium tabular-nums ${cls} ${strong ? "text-base" : ""}`}>{value}</span>
    </div>
  );
}

export function Modal({ title, children, onClose, wide }) {
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
