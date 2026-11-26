/**
 * Export de données (téléchargement de fichiers, CSV des transactions).
 */

/**
 * Déclenche le téléchargement d'un contenu texte (avec BOM UTF-8 pour Excel FR).
 * @param {string} content
 * @param {string} filename
 * @param {string} type - type MIME
 */
export function download(content, filename, type) {
  const blob = new Blob(["﻿" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Échappe une cellule CSV (séparateur « ; ») :
 * - guillemets doublés et cellule entre guillemets ;
 * - neutralisation des formules (=, +, -, @, tabulation, retour chariot en tête) :
 *   un libellé bancaire comme « =HYPERLINK(...) » ne doit pas s'exécuter dans Excel.
 * @param {*} value
 * @returns {string}
 */
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Construit le CSV des transactions (format FR : « ; » et virgule décimale).
 * @param {Array<{date:string,label:string,amount:number,category:string|null}>} transactions
 * @param {Array<{id:string,name:string}>} categories
 * @returns {string}
 */
export function transactionsToCSV(transactions, categories) {
  // Index id → nom : O(1) par ligne au lieu d'un parcours des catégories
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const header = ["Date", "Libellé", "Montant", "Catégorie", "Type"];
  const lines = transactions.map((t) =>
    [
      t.date,
      csvCell(t.label),
      String(t.amount).replace(".", ","),
      csvCell(names.get(t.category) || ""),
      t.amount >= 0 ? "Revenu" : "Dépense",
    ].join(";")
  );
  return [header.join(";"), ...lines].join("\n");
}

/** Télécharge le CSV des transactions. */
export function exportTransactionsCSV(transactions, categories) {
  download(transactionsToCSV(transactions, categories), "transactions.csv", "text/csv;charset=utf-8");
}
