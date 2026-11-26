/**
 * Vue « Tableau de bord » : KPIs, évolution du solde, répartition et flux mensuels.
 */
import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  Wallet, ArrowUpRight, ArrowDownRight, PiggyBank, Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, Kpi, inputCls, ChartTooltip, DeltaBadge, Empty } from "../components/ui";
import { C, num0, fmtEur, fmtPct, monthKey, monthLabel } from "../lib/format";

// Périodes d'affichage disponibles (en nombre de mois ; 0 = tout l'historique).
const PERIODS = [
  { label: "3 mois", months: 3 }, { label: "6 mois", months: 6 },
  { label: "1 an", months: 12 }, { label: "5 ans", months: 60 }, { label: "Tout", months: 0 },
];

export default function Dashboard({ state, stockPositions = [] }) {
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

  // Patrimoine = solde du mois analysé + valeur des enveloppes + bourse.
  const portfolio = useMemo(() => envelopes.reduce((s, e) => s + (e.balance || 0), 0), [envelopes]);
  const stocksTotal = useMemo(() => {
    if (!Array.isArray(stockPositions)) return 0;
    return stockPositions.reduce((s, p) => s + (p.quantity * p.currentPrice || 0), 0);
  }, [stockPositions]);
  const kpis = {
    balance: cur.solde, income: cur.income, expense: cur.expense, net: cur.net,
    savingsRate: cur.income > 0 ? cur.net / cur.income : 0,
    patrimoine: cur.solde + portfolio + stocksTotal,
    portfolio,
    stocksTotal,
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
            {kpis.stocksTotal > 0 && <div className="flex justify-between"><span className="text-slate-400">Bourse & ETF</span><span className="tabular-nums text-violet-400">{fmtEur(kpis.stocksTotal)}</span></div>}
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
