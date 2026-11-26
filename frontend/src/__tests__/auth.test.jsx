/**
 * Session : access token en mémoire (jamais dans localStorage), restauration
 * via le cookie httpOnly au chargement, gardes de routes.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';

describe('services/api : access token en mémoire', () => {
  beforeEach(() => vi.resetModules());

  test('le token n\'est jamais écrit dans localStorage et est envoyé en Bearer', async () => {
    const mod = await import('../services/api');
    const api = mod.default;
    const seen = [];
    // Adaptateur factice : capture la requête au lieu de l'envoyer
    api.defaults.adapter = async (config) => {
      seen.push(config.headers.Authorization);
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    mod.setAccessToken('jeton-123');
    await api.get('/auth/me');
    expect(seen[0]).toBe('Bearer jeton-123');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(Object.values(localStorage).join('')).not.toContain('jeton-123');

    mod.clearSession();
    expect(mod.hasAccessToken()).toBe(false);
  });

  test('restoreSession : obtient un token via le cookie, ou échoue proprement', async () => {
    const mod = await import('../services/api');
    const post = vi.spyOn(axios, 'post');

    post.mockResolvedValueOnce({ data: { accessToken: 'restauré' } });
    expect(await mod.restoreSession()).toBe(true);
    expect(mod.hasAccessToken()).toBe(true);
    expect(post).toHaveBeenCalledWith('/api/auth/refresh', null, { withCredentials: true });

    mod.clearSession();
    post.mockRejectedValueOnce(Object.assign(new Error('401'), { response: { status: 401 } }));
    expect(await mod.restoreSession()).toBe(false);
    post.mockRestore();
  });

  test('refresh « single-flight » : un seul appel pour des restaurations simultanées', async () => {
    const mod = await import('../services/api');
    let resolve;
    const post = vi.spyOn(axios, 'post').mockReturnValue(new Promise((r) => { resolve = r; }));
    const both = Promise.all([mod.restoreSession(), mod.restoreSession()]);
    resolve({ data: { accessToken: 'x' } });
    expect(await both).toEqual([true, true]);
    expect(post).toHaveBeenCalledTimes(1);
    post.mockRestore();
  });
});

describe('gardes de routes', () => {
  beforeEach(() => vi.resetModules());

  /** Monte les routes avec un module api simulé. */
  async function mount(path, { hasToken, restores }) {
    vi.doMock('../services/api', () => ({
      hasAccessToken: () => hasToken,
      restoreSession: vi.fn().mockResolvedValue(restores),
    }));
    const { PrivateRoute, PublicRoute } = await import('../components/AuthGuards');
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<PrivateRoute><div>Espace privé</div></PrivateRoute>} />
          <Route path="/login" element={<PublicRoute><div>Page de connexion</div></PublicRoute>} />
        </Routes>
      </MemoryRouter>
    );
  }

  test('page rechargée avec un cookie valide : session restaurée, accès accordé', async () => {
    await mount('/', { hasToken: false, restores: true });
    expect(screen.getByText('Vérification de la session…')).toBeInTheDocument();
    expect(await screen.findByText('Espace privé')).toBeInTheDocument();
  });

  test('sans session : redirection vers la connexion', async () => {
    await mount('/', { hasToken: false, restores: false });
    expect(await screen.findByText('Page de connexion')).toBeInTheDocument();
  });

  test('déjà connecté sur /login : redirection vers l\'application', async () => {
    await mount('/login', { hasToken: true, restores: true });
    expect(await screen.findByText('Espace privé')).toBeInTheDocument();
  });
});
