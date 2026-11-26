/**
 * Vue « Enveloppes » : comptes d'épargne, plan mensuel et projection long terme.
 */
import { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  TrendingUp, Landmark, Plus, Trash2, PiggyBank, Percent,
} from "lucide-react";
import { Card, Kpi, inputCls, Btn, ChartTooltip, Empty } from "../components/ui";
import { projectEnvelopes } from "../lib/finance";
import { C, SWATCHES, num0, fmtEur, fmtPct } from "../lib/format";
import { uid } from "../lib/state";

// Plafonds réglementaires (0 = pas de plafond) pour signaler une enveloppe pleine.
const ENV_CAPS = { "Livret A": 22950, "Livret Jeune": 1600 };

// Horizons de projection proposés (en années).
const HORIZONS = [5, 10, 15, 20, 30];

const ENV_TYPES = ["Sécurisé", "Mixte", "Actions", "Pilotée", "Retraite", "Immobilier", "Autre"];

export default function Envelopes({ state, dispatch }) {
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
