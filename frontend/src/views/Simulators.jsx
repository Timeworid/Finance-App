/**
 * Vue « Simulateurs » : épargne (intérêts composés) et emprunt (amortissement).
 */
import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Landmark, PiggyBank,
} from "lucide-react";
import { Card, Field, inputCls, Btn, ChartTooltip, Row } from "../components/ui";
import { projectSavings, amortization } from "../lib/finance";
import { C, num0, fmtEur, fmtEur2 } from "../lib/format";

export default function Simulators() {
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
