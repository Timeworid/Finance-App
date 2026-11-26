/**
 * Gardes de routes basées sur la session.
 * L'access token étant en mémoire, il est absent après un rechargement : la session
 * est alors restaurée via le cookie httpOnly avant de décider de l'accès.
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { hasAccessToken, restoreSession } from '../services/api';

/**
 * Statut de session : 'checking' pendant la restauration, puis 'authenticated' ou 'anonymous'.
 * @returns {'checking'|'authenticated'|'anonymous'}
 */
export function useSessionStatus() {
  const [status, setStatus] = useState(hasAccessToken() ? 'authenticated' : 'checking');

  useEffect(() => {
    if (status !== 'checking') return undefined;
    let alive = true;
    restoreSession().then((ok) => {
      if (alive) setStatus(ok ? 'authenticated' : 'anonymous');
    });
    return () => { alive = false; };
  }, [status]);

  return status;
}

/** Écran neutre pendant la vérification (évite un flash de la page de connexion). */
function SessionCheck() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-500">
      Vérification de la session…
    </div>
  );
}

/** Route réservée aux utilisateurs connectés. */
export function PrivateRoute({ children }) {
  const status = useSessionStatus();
  if (status === 'checking') return <SessionCheck />;
  return status === 'authenticated' ? children : <Navigate to="/login" replace />;
}

/** Route publique (connexion, inscription) : redirige si déjà connecté. */
export function PublicRoute({ children }) {
  const status = useSessionStatus();
  if (status === 'checking') return <SessionCheck />;
  return status === 'authenticated' ? <Navigate to="/" replace /> : children;
}
