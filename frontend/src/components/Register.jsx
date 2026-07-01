import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation mot de passe
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      setError('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      });

      // Stocker les tokens et l'utilisateur
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Rediriger vers le dashboard
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.details?.[0]?.message ||
        'Erreur lors de l\'inscription. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-2">
            FinancePilot
          </h1>
          <p className="text-slate-400">
            Créez votre compte sécurisé
          </p>
        </div>

        {/* Carte d'inscription */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Inscription</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Prénom et Nom */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-2">
                  Prénom
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                  placeholder="John"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-2">
                  Nom
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Adresse email *
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
                Mot de passe *
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-slate-500">
                Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
              </p>
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                Confirmer le mot de passe *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                placeholder="••••••••"
                autoComplete="new-password"
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
              className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3 font-semibold text-white hover:from-teal-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-teal-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
            >
              {loading ? 'Création du compte...' : 'Créer mon compte'}
            </button>
          </form>

          {/* Lien vers connexion */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Déjà un compte ?{' '}
              <Link
                to="/login"
                className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>

        {/* Info sécurité */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>🔒 Vos données sont chiffrées avec AES-256-GCM</p>
          <p className="mt-1">7 catégories par défaut seront créées automatiquement</p>
        </div>
      </div>
    </div>
  );
}
