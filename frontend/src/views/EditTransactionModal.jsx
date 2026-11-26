/**
 * Modale d'édition d'une transaction.
 */
import { useState } from "react";
import {
  X,
} from "lucide-react";
import { Field, inputCls, Btn } from "../components/ui";
import { parseAmount } from "../lib/parsing";
import { categoryIdOf } from "../lib/transactions";

export default function EditTransactionModal({ transaction, categories, dispatch, toast, onClose }) {
  const [form, setForm] = useState({
    date: transaction.date || new Date().toISOString().slice(0, 10),
    label: transaction.label || "",
    amount: Math.abs(transaction.amount).toString(),
    category: categoryIdOf(transaction.category) || "",
    sign: transaction.amount >= 0 ? "revenu" : "depense",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
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

    setSaving(true);
    try {
      await dispatch({
        type: "UPDATE_TX",
        tx: {
          id: transaction.id,
          date: form.date,
          label: form.label.trim(),
          amount: signed,
          category: form.category || null
        }
      });
      toast?.success("Transaction modifiée");
      onClose();
    } catch (error) {
      toast?.error("Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-200">Modifier la transaction</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Date">
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Libellé">
            <input
              className={inputCls}
              placeholder="Ex : Courses Lidl"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
          <Field label="Montant">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="Montant"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputCls}
              value={form.sign}
              onChange={(e) => setForm({ ...form, sign: e.target.value })}
            >
              <option value="depense">Dépense</option>
              <option value="revenu">Revenu</option>
            </select>
          </Field>
          <Field label="Catégorie">
            <select
              className={inputCls}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Non classé</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="flex gap-3 pt-2">
            <Btn variant="outline" className="flex-1" onClick={onClose}>Annuler</Btn>
            <Btn className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
