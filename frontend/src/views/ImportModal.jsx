/**
 * Modale d'import CSV de relevés bancaires (mapping des colonnes + auto-catégorisation).
 */
import { useState, useCallback, useRef } from "react";
import {
  Upload, Check, AlertTriangle,
} from "lucide-react";
import { Field, inputCls, Btn, Modal } from "../components/ui";
import { parseAmount, parseDate } from "../lib/parsing";
import { uid } from "../lib/state";

export default function ImportModal({ state, dispatch, onClose }) {
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
