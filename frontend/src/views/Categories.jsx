/**
 * Vue « Catégories » : gestion, budgets et mots-clés d'auto-classement.
 */
import { useState, useMemo, useCallback } from "react";
import {
  Plus, Trash2, X, AlertTriangle, Calendar,
} from "lucide-react";
import { Card, Field, inputCls, Btn } from "../components/ui";
import { C, SWATCHES, fmtEur, fmtPct, monthKey } from "../lib/format";
import { parseAmount } from "../lib/parsing";
import { uid } from "../lib/state";

export default function Categories({ state, dispatch, toast }) {
  const { categories, transactions } = state;
  const [startDate, setStartDate] = useState(""); // date de début pour le filtre
  const [endDate, setEndDate] = useState(""); // date de fin pour le filtre

  // Dépenses cumulées par catégorie (avec filtre de date si appliqué)
  const spentByCat = useMemo(() => {
    const filteredTx = transactions.filter((t) => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
    const months = new Set(filteredTx.map((t) => monthKey(t.date)).filter(Boolean)).size || 1;
    const sums = {};
    filteredTx.forEach((t) => { if (t.amount < 0 && t.category) sums[t.category] = (sums[t.category] || 0) + -t.amount; });
    const avg = {};
    Object.keys(sums).forEach((k) => (avg[k] = sums[k] / months));
    return avg;
  }, [transactions, startDate, endDate]);

  const [draft, setDraft] = useState({ name: "", type: "depense", budget: "", color: SWATCHES[0], keywords: "" });

  const add = useCallback(async () => {
    if (!draft.name.trim()) {
      toast?.error("Le nom de la catégorie est requis");
      return;
    }
    try {
      await dispatch({ type: "ADD_CAT", cat: {
        id: uid(), name: draft.name.trim(), type: draft.type, color: draft.color,
        budget: parseAmount(draft.budget) || 0,
        keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      }});
      setDraft({ name: "", type: "depense", budget: "", color: SWATCHES[(SWATCHES.indexOf(draft.color) + 1) % SWATCHES.length], keywords: "" });
      toast?.success("Catégorie créée");
    } catch (error) {
      // Erreur déjà gérée
    }
  }, [draft, dispatch, toast]);

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

      {/* Filtre de période */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-300">Filtrer par période</span>
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-500" />
            <input
              type="date"
              className={`${inputCls} w-[140px]`}
              placeholder="Du"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Date de début"
            />
            <span className="text-xs text-slate-500">à</span>
            <input
              type="date"
              className={`${inputCls} w-[140px]`}
              placeholder="Au"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Date de fin"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-slate-500 hover:text-slate-300 transition"
                title="Réinitialiser les dates"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 ml-auto">
            {startDate || endDate ? "Période personnalisée" : "Toutes les transactions"}
          </span>
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
