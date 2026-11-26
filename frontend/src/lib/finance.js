/**
 * Calculs financiers purs (intérêts composés, emprunts, projections d'enveloppes).
 */

/**
 * Projection d'épargne avec intérêts composés et versements mensuels.
 * Formule mensuelle : balanceₘ = balanceₘ₋₁ · (1 + i) + versement
 *   i = taux annuel / 12 (taux périodique mensuel)
 * @returns {Array<{month, year, balance, contributed, interest}>}
 */
export function projectSavings({ principal, monthly, annualRate, years }) {
  const i = annualRate / 100 / 12;
  const n = Math.round(years * 12);
  const out = [];
  let balance = principal;
  let contributed = principal;
  for (let m = 0; m <= n; m++) {
    if (m > 0) {
      balance = balance * (1 + i) + monthly;
      contributed += monthly;
    }
    out.push({
      month: m,
      year: +(m / 12).toFixed(2),
      balance,
      contributed,
      interest: balance - contributed, // part due aux intérêts cumulés
    });
  }
  return out;
}

/**
 * Mensualité d'un emprunt à amortissement constant (mensualités fixes).
 * Formule : M = P · [ i·(1+i)ⁿ ] / [ (1+i)ⁿ − 1 ]
 */
export function loanMonthlyPayment(principal, annualRate, months) {
  const i = annualRate / 100 / 12;
  if (months <= 0) return 0;
  if (i === 0) return principal / months; // prêt à taux nul
  const f = Math.pow(1 + i, months);
  return (principal * i * f) / (f - 1);
}

/** Tableau d'amortissement complet d'un emprunt. */
export function amortization(principal, annualRate, months) {
  const i = annualRate / 100 / 12;
  const M = loanMonthlyPayment(principal, annualRate, months);
  let balance = principal;
  const rows = [];
  let cumInterest = 0;
  for (let m = 1; m <= months; m++) {
    const interest = balance * i;
    const principalPaid = M - interest;
    balance = Math.max(0, balance - principalPaid);
    cumInterest += interest;
    rows.push({ month: m, payment: M, interest, principalPaid, cumInterest, balance });
  }
  return { rows, monthly: M, totalCost: M * months, totalInterest: M * months - principal };
}

/**
 * Projette chaque enveloppe sur `years` années (intérêts composés + versement
 * mensuel propre), puis agrège par année pour le graphique empilé.
 * @returns {{ rows: Array, finals: Array }}
 *   rows   : [{ annee, <nomEnveloppe>: valeur, Total, Versé }]
 *   finals : [{ name, color, final, contributed, gain }]
 */
export function projectEnvelopes(envelopes, years) {
  const per = envelopes.map((e) => ({
    e,
    series: projectSavings({ principal: e.balance || 0, monthly: e.monthly || 0, annualRate: e.expectedReturn || 0, years }),
  }));
  const rows = [];
  for (let y = 0; y <= years; y++) {
    const idx = y * 12;
    const row = { annee: y };
    let total = 0, contributed = 0;
    per.forEach(({ e, series }) => {
      const pt = series[Math.min(idx, series.length - 1)];
      row[e.name] = Math.round(pt.balance);
      total += pt.balance;
      contributed += pt.contributed;
    });
    row.Total = Math.round(total);
    row.Versé = Math.round(contributed);
    rows.push(row);
  }
  const finals = per.map(({ e, series }) => {
    const last = series[series.length - 1];
    return { name: e.name, color: e.color, final: last.balance, contributed: last.contributed, gain: last.balance - last.contributed };
  });
  return { rows, finals };
}
