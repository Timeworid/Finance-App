/**
 * Tests unitaires des modules purs (parsing, calculs financiers, état, export).
 */
import { describe, test, expect } from 'vitest';
import { parseAmount, parseDate } from '../lib/parsing';
import { projectSavings, loanMonthlyPayment, amortization, projectEnvelopes } from '../lib/finance';
import { reducer, emptyState } from '../lib/state';
import { categoryIdOf, normalizeTransaction } from '../lib/transactions';
import { csvCell, transactionsToCSV } from '../lib/export';
import { fmtEur, monthKey } from '../lib/format';

describe('parseAmount', () => {
  test.each([
    ['1 234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['-42,5 €', -42.5],
    ['1.234,00', 1234],
    [' 12 000,10', 12000.1],
    [12.3, 12.3],
  ])('%s → %s', (raw, expected) => {
    expect(parseAmount(raw)).toBeCloseTo(expected, 10);
  });

  test.each([[null], [''], ['-'], ['abc']])('%s → NaN', (raw) => {
    expect(parseAmount(raw)).toBeNaN();
  });
});

describe('parseDate', () => {
  test.each([
    ['2026-03-05', '2026-03-05'],
    ['5/3/2026', '2026-03-05'],
    ['05.03.2026', '2026-03-05'],
    ['05-03-26', '2026-03-05'],
  ])('%s → %s', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  test('date illisible → null', () => {
    expect(parseDate('pas une date')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('calculs financiers', () => {
  test('projectSavings : taux nul = somme des versements', () => {
    const series = projectSavings({ principal: 1000, monthly: 100, annualRate: 0, years: 1 });
    expect(series).toHaveLength(13);
    expect(series.at(-1).balance).toBe(2200);
    expect(series.at(-1).interest).toBe(0);
  });

  test('projectSavings : intérêts composés mensuels', () => {
    const last = projectSavings({ principal: 1000, monthly: 0, annualRate: 12, years: 1 }).at(-1);
    expect(last.balance).toBeCloseTo(1000 * 1.01 ** 12, 6);
  });

  test('loanMonthlyPayment : valeur de référence (200 000 € à 3 % sur 20 ans)', () => {
    expect(loanMonthlyPayment(200000, 3, 240)).toBeCloseTo(1109.2, 1);
    expect(loanMonthlyPayment(12000, 0, 12)).toBe(1000);
    expect(loanMonthlyPayment(1000, 3, 0)).toBe(0);
  });

  test('amortization : capital intégralement remboursé', () => {
    const { rows, totalInterest, totalCost } = amortization(10000, 5, 24);
    expect(rows).toHaveLength(24);
    expect(rows.at(-1).balance).toBeCloseTo(0, 6);
    expect(totalCost - totalInterest).toBeCloseTo(10000, 6);
  });

  test('projectEnvelopes : agrège les enveloppes par année', () => {
    const { rows, finals } = projectEnvelopes([
      { name: 'A', balance: 1000, monthly: 0, expectedReturn: 0, color: '#000' },
      { name: 'B', balance: 500, monthly: 100, expectedReturn: 0, color: '#fff' },
    ], 2);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ annee: 0, A: 1000, B: 500, Total: 1500 });
    expect(rows[2].Total).toBe(1500 + 2400);
    expect(finals.map((f) => f.name)).toEqual(['A', 'B']);
  });
});

describe('reducer', () => {
  const base = {
    ...emptyState(),
    categories: [{ id: 'c1', name: 'Courses' }],
    transactions: [{ id: 't1', category: 'c1', amount: -5 }, { id: 't2', category: null, amount: 3 }],
  };

  test('état initial vide (aucune donnée d\'exemple)', () => {
    expect(emptyState()).toEqual({ transactions: [], categories: [], envelopes: [], startBalance: 0, monthlyCapacity: 0 });
  });

  test('DELETE_CAT déclasse les transactions de la catégorie', () => {
    const s = reducer(base, { type: 'DELETE_CAT', id: 'c1' });
    expect(s.categories).toEqual([]);
    expect(s.transactions[0].category).toBeNull();
  });

  test('ADD / UPDATE / DELETE de transaction', () => {
    let s = reducer(base, { type: 'ADD_TX', tx: { id: 't3', amount: 1 } });
    expect(s.transactions[0].id).toBe('t3');
    s = reducer(s, { type: 'UPDATE_TX', tx: { id: 't3', amount: 9 } });
    expect(s.transactions[0].amount).toBe(9);
    s = reducer(s, { type: 'DELETE_TX', id: 't3' });
    expect(s.transactions.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  test('action inconnue : état inchangé (même référence)', () => {
    expect(reducer(base, { type: 'INCONNUE' })).toBe(base);
  });
});

describe('normalisation des transactions', () => {
  test('catégorie peuplée (objet API) → identifiant', () => {
    expect(categoryIdOf({ id: 'c1', name: 'Courses' })).toBe('c1');
    expect(categoryIdOf({ _id: 'c2' })).toBe('c2');
    expect(categoryIdOf('c3')).toBe('c3');
    expect(categoryIdOf(null)).toBeNull();
    expect(normalizeTransaction({ id: 't', category: { id: 'c1' } }).category).toBe('c1');
  });
});

describe('export CSV', () => {
  test('neutralise les formules Excel (injection CSV)', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+33 6')).toBe('"\'+33 6"');
    expect(csvCell('Lidl')).toBe('"Lidl"');
  });

  test('CSV FR : nom de catégorie, virgule décimale, type', () => {
    const csv = transactionsToCSV(
      [{ date: '2026-01-02', label: 'Lidl', amount: -12.5, category: 'c1' }, { date: '2026-01-03', label: 'Paie', amount: 100, category: null }],
      [{ id: 'c1', name: 'Courses' }]
    );
    expect(csv.split('\n')).toEqual([
      'Date;Libellé;Montant;Catégorie;Type',
      '2026-01-02;"Lidl";-12,5;"Courses";Dépense',
      '2026-01-03;"Paie";100;"";Revenu',
    ]);
  });
});

describe('formatage', () => {
  test('fmtEur tolère les valeurs non finies', () => {
    expect(fmtEur(NaN)).toBe(fmtEur(0));
    expect(monthKey('2026-03-15')).toBe('2026-03');
  });
});
