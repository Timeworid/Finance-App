/**
 * Tests de non-régression des bugs corrigés lors du découpage de App.jsx.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';

vi.mock('../services/api', async () => (await import('../test/mockApi')).buildApiMock());
const api = await import('../services/api');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

const loaded = () => waitFor(() => expect(screen.queryByText('Chargement…')).not.toBeInTheDocument());
const goTo = (user, label) =>
  user.click(within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(label) }));

describe('catégories peuplées par l\'API (objet au lieu d\'un identifiant)', () => {
  test('les dépenses sont bien rattachées à leur catégorie (budgets)', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await goTo(user, 'Catégories');
    // Courses = 120 + 80 € ce mois-ci ; avant le correctif : 0 €
    expect(screen.getByText(/Moyenne 200\s€/)).toBeInTheDocument();
  });

  test('le filtre par catégorie des transactions fonctionne', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await goTo(user, 'Transactions');
    const select = screen.getAllByRole('combobox').find((s) => within(s).queryByRole('option', { name: 'Toutes catégories' }));
    await user.selectOptions(select, 'cat-courses');
    expect(screen.getByText('Courses Lidl')).toBeInTheDocument();
    expect(screen.getByText('Carrefour')).toBeInTheDocument();
    expect(screen.queryByText('Salaire mensuel')).not.toBeInTheDocument();
  });
});

describe('import CSV', () => {
  test('les transactions importées sont enregistrées via l\'API (batch) puis rechargées', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await goTo(user, 'Transactions');
    await user.click(screen.getByRole('button', { name: /Importer un CSV/ }));

    const csv = 'Date;Libellé;Montant\n05/01/2026;LIDL PARIS;-23,40\n06/01/2026;CINEMA;-11,00\n';
    const file = new File([csv], 'releve.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"][accept=".csv,text/csv"]');
    await user.upload(input, file);

    const importBtn = await screen.findByRole('button', { name: /^Importer$/ });
    await waitFor(() => expect(importBtn).toBeEnabled());
    api.transactionsAPI.batchCreate.mockResolvedValueOnce({ imported: 2 });
    await user.click(importBtn);

    await waitFor(() => expect(api.transactionsAPI.batchCreate).toHaveBeenCalledTimes(1));
    const sent = api.transactionsAPI.batchCreate.mock.calls[0][0];
    expect(sent).toEqual([
      { date: '2026-01-05', label: 'LIDL PARIS', amount: -23.4, category: 'cat-courses' }, // auto-catégorisé (mot-clé « lidl »)
      { date: '2026-01-06', label: 'CINEMA', amount: -11, category: 'cat-loisirs' },
    ]);
    // Rechargement depuis le serveur pour obtenir les identifiants définitifs
    await waitFor(() => expect(api.transactionsAPI.getAll).toHaveBeenCalledTimes(2));
  });
});

describe('enveloppes : édition inline', () => {
  test('une seule sauvegarde après la frappe (debounce), affichage immédiat', async () => {
    renderApp();
    await loaded();
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Enveloppes/ }));

    vi.useFakeTimers();
    const nameInput = screen.getByDisplayValue('Livret A');
    for (const value of ['Livret', 'Livret B', 'Livret Bleu']) {
      fireEvent.change(nameInput, { target: { value } });
    }
    // L'affichage suit la frappe sans attendre le serveur
    expect(screen.getByDisplayValue('Livret Bleu')).toBeInTheDocument();
    expect(api.envelopesAPI.update).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(700); });
    expect(api.envelopesAPI.update).toHaveBeenCalledTimes(1);
    expect(api.envelopesAPI.update).toHaveBeenCalledWith('e1', expect.objectContaining({ name: 'Livret Bleu' }));
    vi.useRealTimers();
  });

  test('un nom vidé pendant la saisie n\'est pas envoyé (refusé par l\'API)', async () => {
    renderApp();
    await loaded();
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Enveloppes/ }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByDisplayValue('Livret A'), { target: { value: '' } });
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(api.envelopesAPI.update).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('chargement et données', () => {
  test('en cas d\'erreur de chargement, aucune donnée d\'exemple n\'est affichée', async () => {
    api.transactionsAPI.getAll.mockRejectedValueOnce(new Error('réseau'));
    const user = userEvent.setup();
    renderApp();
    await loaded();
    expect(await screen.findByText('Erreur de chargement des données')).toBeInTheDocument();
    await goTo(user, 'Transactions');
    // Anciennes données factices (« Salaire mensuel », « Loyer »…) : absentes
    expect(screen.queryByText('Loyer')).not.toBeInTheDocument();
    expect(screen.queryByText('Salaire mensuel')).not.toBeInTheDocument();
  });

  test('la modale « Données » ne propose plus d\'actions non persistées', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await user.click(screen.getAllByRole('button', { name: /Données & sauvegarde/ })[0]);
    expect(screen.getByText(/enregistrées sur le serveur/)).toBeInTheDocument();
    expect(screen.queryByText(/Tout effacer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/données d'exemple/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Restaurer une sauvegarde/)).not.toBeInTheDocument();
  });
});
