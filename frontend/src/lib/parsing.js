/**
 * Parsing robuste des montants et dates de relevés bancaires (formats FR/EN).
 */

/**
 * Parse un montant quel que soit le format (FR « 1 234,56 » / EN « 1,234.56 »).
 * Stratégie : le séparateur décimal est le dernier ',' ou '.' rencontré ;
 * l'autre symbole est considéré comme séparateur de milliers et supprimé.
 * @returns {number} NaN si non interprétable.
 */
export function parseAmount(raw) {
  if (raw == null) return NaN;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim().replace(/[\s\u00A0\u202F€$£]/g, "");
  if (s === "" || s === "-") return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * Parse une date de relevé en ISO (YYYY-MM-DD). Gère ISO, DD/MM/YYYY,
 * DD-MM-YYYY, DD.MM.YYYY et DD/MM/YY. Renvoie null si illisible.
 */
export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);          // ISO
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);              // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);            // DD/MM/YY
  if (m) return `20${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
