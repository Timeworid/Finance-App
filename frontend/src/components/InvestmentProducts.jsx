import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, Percent, Calculator, X } from 'lucide-react';
import { investmentsAPI } from '../services/api';

const PRODUCT_TYPES = {
  LEP: { name: 'Livret Épargne Populaire', defaultRate: 6.0, ceiling: 10000, taxRate: 0 },
  LIVRET_JEUNE: { name: 'Livret Jeune', defaultRate: 4.5, ceiling: 1600, taxRate: 0 },
  PEL: { name: 'Plan Épargne Logement', defaultRate: 2.25, ceiling: 61200, taxRate: 30 },
  LIVRET_A: { name: 'Livret A', defaultRate: 3.0, ceiling: 22950, taxRate: 0 },
  COMPTE_TITRES: { name: 'Compte Titres', defaultRate: 0, ceiling: null, taxRate: 30 },
  EPARGNE_PILOTEE: { name: 'Épargne Financière Pilotée', defaultRate: 4.0, ceiling: null, taxRate: 30 },
  PEA_LIBRE: { name: 'PEA Gestion Libre', defaultRate: 0, ceiling: 150000, taxRate: 17.2 },
  PEA_PILOTE: { name: 'PEA Gestion Pilotée', defaultRate: 0, ceiling: 150000, taxRate: 17.2 },
  PER: { name: 'Plan Épargne Retraite', defaultRate: 3.5, ceiling: null, taxRate: 0 },
  ASSURANCE_VIE: { name: 'Assurance Vie', defaultRate: 3.0, ceiling: null, taxRate: 17.2 },
};

export default function InvestmentProducts() {
  const [products, setProducts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadProducts();
    loadSummary();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await investmentsAPI.getAll();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await investmentsAPI.getSummary();
      setSummary(data.summary);
    } catch (error) {
      console.error('Erreur chargement résumé:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await investmentsAPI.delete(id);
      await loadProducts();
      await loadSummary();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header avec résumé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border border-teal-500/20 p-6">
          <div className="text-sm text-teal-400 mb-1">Capital Total</div>
          <div className="text-3xl font-bold text-white">
            {(summary?.totalBalance || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 p-6">
          <div className="text-sm text-violet-400 mb-1">Versements Mensuels</div>
          <div className="text-3xl font-bold text-white">
            {(summary?.totalMonthlyContribution || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-sky-500/10 border border-blue-500/20 p-6">
          <div className="text-sm text-blue-400 mb-1">Nombre de Produits</div>
          <div className="text-3xl font-bold text-white">{summary?.totalProducts || 0}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mes Produits d'Investissement</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
        >
          <Plus size={16} />
          Ajouter un produit
        </button>
      </div>

      {/* Liste des produits */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <TrendingUp size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 mb-4">Aucun produit d'investissement</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-teal-400 hover:text-teal-300"
          >
            Ajouter votre premier produit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {products.map(product => (
            <ProductCard
              key={product._id}
              product={product}
              onDelete={handleDelete}
              onClick={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}

      {/* Modal d'ajout */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadProducts();
            loadSummary();
          }}
        />
      )}

      {/* Modal de détails */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

function ProductCard({ product, onDelete, onClick }) {
  const productType = PRODUCT_TYPES[product.type];
  const balance = parseFloat(product.balance) || 0;
  const monthlyContrib = parseFloat(product.monthlyContribution) || 0;

  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-teal-500/50 transition cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white mb-1">{product.name}</h3>
          <p className="text-sm text-slate-400">{productType?.name}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(product._id);
          }}
          className="text-slate-500 hover:text-rose-400 transition"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Solde actuel</span>
          <span className="font-semibold text-white">
            {balance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Taux d'intérêt</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <Percent size={12} />
            {product.interestRate}%
          </span>
        </div>
        {monthlyContrib > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Versement mensuel</span>
            <span className="text-teal-400">
              {monthlyContrib.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        )}
      </div>

      {product.ceiling && balance >= product.ceiling * 0.8 && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
          Proche du plafond ({((balance / product.ceiling) * 100).toFixed(0)}%)
        </div>
      )}
    </div>
  );
}

function AddProductModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'LIVRET_A',
    balance: '',
    interestRate: '',
    taxRate: '',
    managementFees: '0',
    managementFeesType: 'percentage',
    monthlyContribution: '0',
    broker: '',
    notes: '',
  });

  const selectedType = PRODUCT_TYPES[formData.type];

  useEffect(() => {
    if (selectedType) {
      setFormData(prev => ({
        ...prev,
        interestRate: selectedType.defaultRate.toString(),
        taxRate: selectedType.taxRate.toString(),
        ceiling: selectedType.ceiling,
      }));
    }
  }, [formData.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await investmentsAPI.create(formData);
      onSuccess();
    } catch (error) {
      console.error('Erreur création:', error);
      alert('Erreur lors de la création du produit');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Nouveau Produit d'Investissement</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Type de produit</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
                required
              >
                {Object.entries(PRODUCT_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>{value.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Nom personnalisé</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Mon Livret A BNP"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Solde actuel (€)</label>
              <input
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Versement mensuel (€)</label>
              <input
                type="number"
                step="0.01"
                value={formData.monthlyContribution}
                onChange={(e) => setFormData({ ...formData, monthlyContribution: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Taux d'intérêt (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Taux d'imposition (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Frais de gestion (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.managementFees}
                onChange={(e) => setFormData({ ...formData, managementFees: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Type de frais</label>
              <select
                value={formData.managementFeesType}
                onChange={(e) => setFormData({ ...formData, managementFeesType: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
              >
                <option value="percentage">% du capital</option>
                <option value="real_gains">% des plus-values</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Établissement</label>
              <input
                type="text"
                value={formData.broker}
                onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                placeholder="Ex: Boursorama, BNP Paribas..."
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-white hover:bg-teal-600"
            >
              Créer le produit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductDetailsModal({ product, onClose }) {
  const [projection, setProjection] = useState(null);
  const [years, setYears] = useState(10);

  useEffect(() => {
    loadProjection();
  }, [years]);

  const loadProjection = async () => {
    try {
      const data = await investmentsAPI.getProjection(product._id, years);
      setProjection(data.projection);
    } catch (error) {
      console.error('Erreur projection:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-slate-900 border border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <p className="text-sm text-slate-400">{PRODUCT_TYPES[product.type]?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Projection */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-slate-300">Projection sur</label>
            <select
              value={years}
              onChange={(e) => setYears(parseInt(e.target.value))}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1 text-white"
            >
              {[5, 10, 15, 20, 25, 30].map(y => (
                <option key={y} value={y}>{y} ans</option>
              ))}
            </select>
          </div>

          {projection && (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-400">Année</th>
                    <th className="px-4 py-3 text-right text-slate-400">Capital</th>
                    <th className="px-4 py-3 text-right text-slate-400">Versements</th>
                    <th className="px-4 py-3 text-right text-slate-400">Gains</th>
                    <th className="px-4 py-3 text-right text-slate-400">Frais</th>
                    <th className="px-4 py-3 text-right text-slate-400">Impôts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {projection.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-300">{row.year}</td>
                      <td className="px-4 py-2 text-right font-semibold text-white">
                        {row.balance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-400">
                        {row.contributions.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-400">
                        +{row.gains.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-2 text-right text-rose-400">
                        -{row.fees.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-2 text-right text-amber-400">
                        -{row.taxes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
