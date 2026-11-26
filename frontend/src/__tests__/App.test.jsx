/**
 * Tests de caractérisation de l'application complète (écrits AVANT le découpage
 * de App.jsx, pour garantir que le comportement visible est conservé).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';

vi.mock('../services/api', async () => (await import('../test/mockApi')).buildApiMock());
const api = await import('../services/api');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('user', JSON.stringify({ email: 'test@exemple.fr' }));
});

/** Attend la fin du chargement initial. */
async function loaded() {
  await waitFor(() => expect(screen.queryByText('Chargement…')).not.toBeInTheDocument());
}

/** Navigue vers une vue via le menu latéral. */
async function goTo(user, label) {
  const nav = screen.getByRole('navigation');
  await user.click(within(nav).getByRole('button', { name: new RegExp(label) }));
}

describe('Application', () => {
  test('charge les données de l\'API et affiche le tableau de bord', async () => {
    renderApp();
    await loaded();
    expect(api.transactionsAPI.getAll).toHaveBeenCalledTimes(1);
    expect(api.categoriesAPI.getAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeInTheDocument();
    expect(screen.getByText('test@exemple.fr')).toBeInTheDocument();
  });

  test('chaque entrée du menu affiche la vue correspondante', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    for (const label of ['Transactions', 'Catégories', 'Enveloppes', 'Biens & Propriétés', 'Charges Récurrentes', 'Bourse & ETF', 'Simulateurs', 'Tableau de bord']) {
      await goTo(user, label);
      expect(screen.getByRole('heading', { level: 1, name: label })).toBeInTheDocument();
    }
  });

  test('liste les transactions chargées', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await goTo(user, 'Transactions');
    expect(screen.getByText('Courses Lidl')).toBeInTheDocument();
    expect(screen.getByText('Salaire mensuel')).toBeInTheDocument();
  });

  test('ajoute une dépense : appel API avec un montant négatif', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await goTo(user, 'Transactions');

    await user.type(screen.getByPlaceholderText('Ex : Courses Lidl'), 'Boulangerie');
    await user.type(screen.getByPlaceholderText('Montant'), '12,50');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));

    await waitFor(() => expect(api.transactionsAPI.create).toHaveBeenCalledTimes(1));
    const payload = api.transactionsAPI.create.mock.calls[0][0];
    expect(payload).toMatchObject({ label: 'Boulangerie', amount: -12.5 });
    expect(await screen.findByText('Boulangerie')).toBeInTheDocument();
  });

  test('simulateur : affiche une projection d\'épargne', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await goTo(user, 'Simulateurs');
    expect(screen.getAllByText(/€/).length).toBeGreaterThan(0);
  });

  test('déconnexion : révoque la session côté serveur', async () => {
    const user = userEvent.setup();
    renderApp();
    await loaded();
    await user.click(screen.getByTitle('Déconnexion'));
    await waitFor(() => expect(api.authAPI.logout).toHaveBeenCalledTimes(1));
  });
});
