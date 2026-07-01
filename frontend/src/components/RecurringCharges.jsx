import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Calendar, Repeat, X } from 'lucide-react';
import { recurringAPI } from '../services/api';

const FREQUENCIES = {
  weekly: { label: 'Hebdomadaire', multiplier: 52 },
  monthly: { label: 'Mensuel', multiplier: 12 },
  quarterly: { label: 'Trimestriel', multiplier: 4 },
  yearly: { label: 'Annuel', multiplier: 1 },
};

const CATEGORIES = {
  revenue: [
    'Salaire',
    'Revenus locatifs',
    'Dividendes',
    'Allocations',
    'Freelance',
    'Autre',
  ],
  charge: [
    'Loyer',
    'Électricité',
    'Gaz',
    'Eau',
    'Internet',
    'Téléphone',
    'Assurances',
    'Transports',
    'Abonnements',
    'Autre',
  ],
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Btn({ variant = 'primary', onClick, children, className = '', type = 'button' }) {
  const baseClasses = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-teal-500 text-white hover:bg-teal-600',
    outline: 'border border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${className}`}>
      {children}
    </div>
  );
}

export default function RecurringCharges() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    type: 'charge',
    amount: '',
    frequency: 'monthly',
    category: '',
    startDate: new Date().toISOString().split('T')[0],
    isActive: true,
  });

  useEffect(() => {
    loadItems();
    loadSummary();
  }, []);

  const loadItems = async () => {
    try {
      const data = await recurringAPI.getAll();
      setItems(data.items || []);
    } catch (error) {
      console.error('Erreur chargement éléments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await recurringAPI.getSummary();
      setSummary(data.summary);
    } catch (error) {
      console.error('Erreur chargement résumé:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        amount: parseFloat(formData.amount),
      };
      await recurringAPI.create(dataToSend);
      await loadItems();
      await loadSummary();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Erreur création élément:', error);
      alert('Erreur lors de la création');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet élément récurrent ?')) return;
    try {
      await recurringAPI.delete(id);
      await loadItems();
      await loadSummary();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const toggleActive = async (item) => {
    try {
      await recurringAPI.update(item._id, { isActive: !item.isActive });
      await loadItems();
      await loadSummary();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'charge',
      amount: '',
      frequency: 'monthly',
      category: '',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const revenues = items.filter((item) => item.type === 'revenue');
  const charges = items.filter((item) => item.type === 'charge');

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Revenus mensuels</p>
                <p className="mt-1 text-2xl font-bold text-emerald-400">
                  {formatAmount(summary.revenues.monthly)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatAmount(summary.revenues.yearly)} / an
                </p>
              </div>
              <div className="rounded-full bg-emerald-500/20 p-3">
                <TrendingUp size={24} className="text-emerald-400" />
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-rose-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Charges mensuelles</p>
                <p className="mt-1 text-2xl font-bold text-rose-400">
                  {formatAmount(summary.charges.monthly)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatAmount(summary.charges.yearly)} / an
                </p>
              </div>
              <div className="rounded-full bg-rose-500/20 p-3">
                <TrendingDown size={24} className="text-rose-400" />
              </div>
            </div>
          </Card>

          <Card className={`border-l-4 ${summary.netMonthly >= 0 ? 'border-teal-500' : 'border-amber-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Solde mensuel net</p>
                <p className={`mt-1 text-2xl font-bold ${summary.netMonthly >= 0 ? 'text-teal-400' : 'text-amber-400'}`}>
                  {formatAmount(summary.netMonthly)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatAmount(summary.netYearly)} / an
                </p>
              </div>
              <div className={`rounded-full ${summary.netMonthly >= 0 ? 'bg-teal-500/20' : 'bg-amber-500/20'} p-3`}>
                <Repeat size={24} className={summary.netMonthly >= 0 ? 'text-teal-400' : 'text-amber-400'} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-end">
        <Btn onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Ajouter un élément récurrent
        </Btn>
      </div>

      {/* Revenues Section */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-emerald-400">
          <TrendingUp size={20} />
          Revenus récurrents ({revenues.length})
        </h2>
        {revenues.length === 0 ? (
          <Card>
            <p className="text-center text-slate-500">Aucun revenu récurrent enregistré</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {revenues.map((item) => (
              <Card key={item._id} className={!item.isActive ? 'opacity-50' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-200">{item.name}</h3>
                      {!item.isActive && (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
                      <span className="font-medium text-emerald-400">{formatAmount(item.amount)}</span>
                      <span>•</span>
                      <span>{FREQUENCIES[item.frequency].label}</span>
                      <span>•</span>
                      <span>{item.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800"
                    >
                      {item.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Charges Section */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-rose-400">
          <TrendingDown size={20} />
          Charges récurrentes ({charges.length})
        </h2>
        {charges.length === 0 ? (
          <Card>
            <p className="text-center text-slate-500">Aucune charge récurrente enregistrée</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {charges.map((item) => (
              <Card key={item._id} className={!item.isActive ? 'opacity-50' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-200">{item.name}</h3>
                      {!item.isActive && (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
                      <span className="font-medium text-rose-400">{formatAmount(item.amount)}</span>
                      <span>•</span>
                      <span>{FREQUENCIES[item.frequency].label}</span>
                      <span>•</span>
                      <span>{item.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800"
                    >
                      {item.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Ajouter un élément récurrent" onClose={() => { setShowAddModal(false); resetForm(); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'revenue', category: '' })}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    formData.type === 'revenue'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp size={16} className="mx-auto mb-1" />
                  Revenu
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'charge', category: '' })}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    formData.type === 'charge'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <TrendingDown size={16} className="mx-auto mb-1" />
                  Charge
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Nom</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                placeholder="Ex: Salaire, Loyer, Netflix..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Montant (€)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Fréquence</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                >
                  {Object.entries(FREQUENCIES).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Catégorie</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
              >
                <option value="">Sélectionner une catégorie</option>
                {CATEGORIES[formData.type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Date de début</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Btn type="button" variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
                Annuler
              </Btn>
              <Btn type="submit" className="flex-1">
                Ajouter
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
