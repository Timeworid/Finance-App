/**
 * Vue « Transactions » : saisie rapide, filtres, liste, export.
 */
import { useState, useMemo, useCallback } from "react";
import {
  Upload, Plus, Trash2, Edit2, X, Calendar,
} from "lucide-react";
import { Card, Field, inputCls, Btn, Empty, Modal } from "../components/ui";
import { fmtEur2 } from "../lib/format";
import { parseAmount } from "../lib/parsing";
import { uid } from "../lib/state";
import EditTransactionModal from "./EditTransactionModal";
import ImportModal from "./ImportModal";

export default function Transactions({ state, dispatch, toast }) {
  const { transactions, categories } = state;
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [filter, setFilter] = useState(""); // recherche libellé
  const [catFilter, setCatFilter] = useState("all");
  const [startDate, setStartDate] = useState(""); // date de début pour le filtre
  const [endDate, setEndDate] = useState(""); // date de fin pour le filtre
  const [importing, setImporting] = useState(false);
  const [editingTx, setEditingTx] = useState(null); // transaction en cours d'édition

  // Formulaire d'ajout rapide.
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), label: "", amount: "", category: categories[0]?.id || "", sign: "depense" });

  const addTx = useCallback(async () => {
    const amt = parseAmount(form.amount);
    if (!form.label.trim()) {
      toast?.error("Le libellé est requis");
      return;
    }
    if (Number.isNaN(amt)) {
      toast?.error("Montant invalide");
      return;
    }
    const signed = form.sign === "depense" ? -Math.abs(amt) : Math.abs(amt);
    try {
      await dispatch({ type: "ADD_TX", tx: { id: uid(), date: form.date, label: form.label.trim(), amount: signed, category: form.category || null } });
      setForm((f) => ({ ...f, label: "", amount: "" }));
      toast?.success("Transaction ajoutée");
    } catch (error) {
      // L'erreur est déjà gérée dans apiDispatch
    }
  }, [form, dispatch, toast]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return transactions
      .filter((t) => (catFilter === "all" ? true : t.category === (catFilter === "none" ? null : catFilter)))
      .filter((t) => !q || (t.label || "").toLowerCase().includes(q))
      .filter((t) => !startDate || t.date >= startDate)
      .filter((t) => !endDate || t.date <= endDate)
      .slice(0, 400); // borne d'affichage pour rester fluide
  }, [transactions, filter, catFilter, startDate, endDate]);

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
          <Field label="Montant"><input className={inputCls} inputMode="decimal" placeholder="Montant" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
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
                    <td className="py-2 pl-3 text-right flex items-center justify-end gap-1">
                      <button onClick={() => setEditingTx(t)} className="text-slate-600 hover:text-teal-400" title="Modifier">
                        <Edit2 size={15} />
                      </button>
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

      {/* Modal d'édition de transaction */}
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          categories={categories}
          dispatch={dispatch}
          toast={toast}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}
