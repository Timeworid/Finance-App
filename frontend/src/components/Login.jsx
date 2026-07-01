import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.login(form);

      // Stocker les tokens et l'utilisateur
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Rediriger vers le dashboard
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Erreur de connexion. Veuillez vérifier vos identifiants.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-2">
            FinancePilot
          </h1>
          <p className="text-slate-400">
            Gérez vos finances en toute sécurité
          </p>
        </div>

        {/* Carte de connexion */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                placeholder="votre@email.com"
                autoComplete="email"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
                {error}
              </div>
            )}

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3 font-semibold text-white hover:from-teal-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-teal-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Lien vers inscription */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Pas encore de compte ?{' '}
              <Link
                to="/register"
                className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </div>

        {/* Info sécurité */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>🔒 Connexion sécurisée avec chiffrement AES-256</p>
        </div>
      </div>
    </div>
  );
}
