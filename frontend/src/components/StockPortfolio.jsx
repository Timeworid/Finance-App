import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, DollarSign, Percent, X } from 'lucide-react';
import { stocksAPI } from '../services/api';

const STOCK_TYPES = ['ETF', 'ACTION', 'CRYPTO'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
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

function Btn({ variant = 'primary', onClick, children, className = '', type = 'button', disabled = false }) {
  const baseClasses = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = {
    primary: 'bg-teal-500 text-white hover:bg-teal-600',
    outline: 'border border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
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

export default function StockPortfolio() {
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    type: 'ETF',
    quantity: '',
    averageBuyPrice: '',
    currentPrice: '',
    currency: 'EUR',
    sector: '',
    region: '',
    dividendYield: '',
    notes: '',
  });

  useEffect(() => {
    loadPositions();
    loadSummary();
  }, []);

  const loadPositions = async () => {
    try {
      const data = await stocksAPI.getAll();
      setPositions(data.positions || []);
    } catch (error) {
      console.error('Erreur chargement positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await stocksAPI.getSummary();
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
        quantity: parseFloat(formData.quantity),
        averageBuyPrice: parseFloat(formData.averageBuyPrice),
        currentPrice: parseFloat(formData.currentPrice) || 0,
        dividendYield: parseFloat(formData.dividendYield) || 0,
      };
      const newPosition = await stocksAPI.create(dataToSend);
      // Ajout optimiste local
      setPositions(prevPositions => [...prevPositions, newPosition.position || newPosition]);
      await loadSummary();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Erreur création position:', error);
      alert('Erreur lors de la création de la position');
      // Recharger en cas d'erreur
      await loadPositions();
    }
  };

  const handleDelete = async (position) => {
    if (!confirm('Supprimer cette position ?')) return;
    try {
      const positionId = position.id || position._id;
      // Suppression optimiste locale
      setPositions(prevPositions => prevPositions.filter(p => (p.id || p._id) !== positionId));
      await stocksAPI.delete(positionId);
      await loadSummary();
    } catch (error) {
      console.error('Erreur suppression:', error);
      // Recharger en cas d'erreur
      await loadPositions();
    }
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      name: '',
      type: 'ETF',
      quantity: '',
      averageBuyPrice: '',
      currentPrice: '',
      currency: 'EUR',
      sector: '',
      region: '',
      dividendYield: '',
      notes: '',
    });
  };

  const formatAmount = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'ETF':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'ACTION':
        return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'CRYPTO':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      default:
        return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Valeur totale</p>
                <p className="mt-1 text-2xl font-bold text-teal-400">
                  {formatAmount(summary.totalValue)}
                </p>
              </div>
              <div className="rounded-full bg-teal-500/20 p-3">
                <DollarSign size={24} className="text-teal-400" />
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-slate-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Coût total</p>
                <p className="mt-1 text-2xl font-bold text-slate-300">
                  {formatAmount(summary.totalCost)}
                </p>
              </div>
              <div className="rounded-full bg-slate-500/20 p-3">
                <DollarSign size={24} className="text-slate-400" />
              </div>
            </div>
          </Card>

          <Card className={`border-l-4 ${summary.totalProfitLoss >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">+/- Value</p>
                <p className={`mt-1 text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatAmount(summary.totalProfitLoss)}
                </p>
              </div>
              <div className={`rounded-full ${summary.totalProfitLoss >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'} p-3`}>
                {summary.totalProfitLoss >= 0 ? (
                  <TrendingUp size={24} className="text-emerald-400" />
                ) : (
                  <TrendingDown size={24} className="text-rose-400" />
                )}
              </div>
            </div>
          </Card>

          <Card className={`border-l-4 ${parseFloat(summary.totalProfitLossPercentage) >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Performance</p>
                <p className={`mt-1 text-2xl font-bold ${parseFloat(summary.totalProfitLossPercentage) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {summary.totalProfitLossPercentage}%
                </p>
              </div>
              <div className={`rounded-full ${parseFloat(summary.totalProfitLossPercentage) >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'} p-3`}>
                <Percent size={24} className={parseFloat(summary.totalProfitLossPercentage) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Btn variant="outline">
          <RefreshCw size={16} />
          Actualiser les prix
        </Btn>
        <Btn onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Ajouter une position
        </Btn>
      </div>

      {/* Positions Table */}
      <Card>
        <div className="overflow-x-auto">
          {positions.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p>Aucune position dans votre portefeuille</p>
              <p className="mt-2 text-sm">Ajoutez votre première action, ETF ou crypto</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-slate-800 text-left text-sm text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Ticker / Nom</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium text-right">Quantité</th>
                  <th className="pb-3 font-medium text-right">PRU</th>
                  <th className="pb-3 font-medium text-right">Prix actuel</th>
                  <th className="pb-3 font-medium text-right">Valeur</th>
                  <th className="pb-3 font-medium text-right">+/- Value</th>
                  <th className="pb-3 font-medium text-right">Performance</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {positions.map((position) => {
                  const totalValue = position.quantity * position.currentPrice;
                  const totalCost = position.quantity * parseFloat(position.averageBuyPrice);
                  const profitLoss = totalValue - totalCost;
                  const profitLossPercentage = totalCost > 0 ? ((profitLoss / totalCost) * 100).toFixed(2) : 0;

                  return (
                    <tr key={position._id} className="text-sm">
                      <td className="py-3">
                        <div>
                          <div className="font-semibold text-slate-200">{position.symbol}</div>
                          <div className="text-xs text-slate-500">{position.name}</div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${getTypeColor(position.type)}`}>
                          {position.type}
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-300">{position.quantity}</td>
                      <td className="py-3 text-right text-slate-300">
                        {formatAmount(parseFloat(position.averageBuyPrice), position.currency)}
                      </td>
                      <td className="py-3 text-right text-slate-300">
                        {formatAmount(position.currentPrice, position.currency)}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-200">
                        {formatAmount(totalValue, position.currency)}
                      </td>
                      <td className={`py-3 text-right font-semibold ${profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {profitLoss >= 0 ? '+' : ''}{formatAmount(profitLoss, position.currency)}
                      </td>
                      <td className={`py-3 text-right font-semibold ${profitLossPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {profitLossPercentage >= 0 ? '+' : ''}{profitLossPercentage}%
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDelete(position)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Distribution by Type */}
      {summary && summary.byType && Object.keys(summary.byType).length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-200">Répartition par type</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(summary.byType).map(([type, data]) => (
              <Card key={type}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${getTypeColor(type)}`}>
                      {type}
                    </span>
                    <p className="mt-2 text-xl font-bold text-slate-200">{formatAmount(data.value)}</p>
                    <p className={`mt-1 text-sm ${data.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {data.profitLoss >= 0 ? '+' : ''}{formatAmount(data.profitLoss)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <p>{data.count} position{data.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Position Modal */}
      {showAddModal && (
        <Modal title="Ajouter une position" onClose={() => { setShowAddModal(false); resetForm(); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {STOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    formData.type === type
                      ? `${getTypeColor(type)} border-2`
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Ticker *</label>
                <input
                  type="text"
                  required
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  placeholder="Ex: AAPL, BTC"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Nom *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  placeholder="Ex: Apple Inc."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Quantité *</label>
                <input
                  type="number"
                  required
                  step="0.00000001"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">PRU *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.averageBuyPrice}
                  onChange={(e) => setFormData({ ...formData, averageBuyPrice: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Prix actuel</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Devise</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Secteur</label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  placeholder="Ex: Tech"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Région</label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  placeholder="Ex: USA"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Rendement dividende (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.dividendYield}
                onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                placeholder="Informations complémentaires..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Btn type="button" variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
                Annuler
              </Btn>
              <Btn type="submit" className="flex-1">
                Ajouter la position
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
