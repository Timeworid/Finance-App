import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Car, Home, Laptop, Sofa, Gem, Palette, Package } from "lucide-react";
import { assetsAPI } from "../services/api";
import { useToast } from "./Toast";

// Composants UI réutilisés du composant principal
function Card({ children, className = "" }) {
  return <div className={`rounded-xl bg-slate-900/50 p-6 shadow-lg backdrop-blur-sm border border-slate-800/50 ${className}`}>{children}</div>;
}

function Btn({ children, onClick, variant = "primary", className = "", type = "button", disabled }) {
  const baseClasses = "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50";
  const variantClasses = variant === "outline"
    ? "border border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800"
    : "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md hover:shadow-lg hover:from-teal-500 hover:to-cyan-500";
  return <button type={type} onClick={onClick} className={`${baseClasses} ${variantClasses} ${className}`} disabled={disabled}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      {children}
    </div>
  );
}

const CATEGORIES = [
  { value: 'vehicule', label: 'Véhicule', icon: Car },
  { value: 'immobilier', label: 'Immobilier', icon: Home },
  { value: 'electronique', label: 'Électronique', icon: Laptop },
  { value: 'mobilier', label: 'Mobilier', icon: Sofa },
  { value: 'bijoux', label: 'Bijoux', icon: Gem },
  { value: 'collection', label: 'Collection', icon: Palette },
  { value: 'autre', label: 'Autre', icon: Package },
];

function AssetsProperties() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [form, setForm] = useState({
    name: '',
    category: 'vehicule',
    currentValue: '',
    purchasePrice: '',
    purchaseDate: '',
    description: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const data = await assetsAPI.getAll();
      setAssets(data || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast('Erreur lors du chargement des biens', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAsset) {
        await assetsAPI.update(editingAsset.id, form);
        toast('Bien modifié avec succès', 'success');
      } else {
        await assetsAPI.create(form);
        toast('Bien créé avec succès', 'success');
      }
      await loadAssets();
      closeModal();
    } catch (error) {
      console.error('Error saving asset:', error);
      toast('Erreur lors de la sauvegarde du bien', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bien ?')) return;
    try {
      await assetsAPI.delete(id);
      toast('Bien supprimé avec succès', 'success');
      await loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast('Erreur lors de la suppression du bien', 'error');
    }
  };

  const openModal = (asset = null) => {
    if (asset) {
      setEditingAsset(asset);
      setForm({
        name: asset.name || '',
        category: asset.category || 'vehicule',
        currentValue: asset.currentValue || '',
        purchasePrice: asset.purchasePrice || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
        description: asset.description || '',
      });
    } else {
      setEditingAsset(null);
      setForm({
        name: '',
        category: 'vehicule',
        currentValue: '',
        purchasePrice: '',
        purchaseDate: '',
        description: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAsset(null);
    setForm({
      name: '',
      category: 'vehicule',
      currentValue: '',
      purchasePrice: '',
      purchaseDate: '',
      description: '',
    });
  };

  const fmtEur = (val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);

  const getCategoryIcon = (categoryValue) => {
    const cat = CATEGORIES.find(c => c.value === categoryValue);
    return cat ? cat.icon : Package;
  };

  const getCategoryLabel = (categoryValue) => {
    const cat = CATEGORIES.find(c => c.value === categoryValue);
    return cat ? cat.label : categoryValue;
  };

  const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(asset.currentValue) || 0), 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-600">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Biens & Propriétés</h2>
          <p className="text-sm text-slate-500 mt-1">
            Valeur totale : <span className="text-teal-400 font-semibold">{fmtEur(totalValue)}</span>
          </p>
        </div>
        <Btn onClick={() => openModal()}>
          <Plus size={16} className="mr-2" />
          Ajouter un bien
        </Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map(asset => {
          const Icon = getCategoryIcon(asset.category);
          return (
            <Card key={asset.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    <Icon size={20} className="text-teal-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100">{asset.name}</h3>
                    <p className="text-xs text-slate-500">{getCategoryLabel(asset.category)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(asset)}
                    className="text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Valeur actuelle</span>
                  <span className="text-teal-400 font-semibold">{fmtEur(asset.currentValue)}</span>
                </div>
                {asset.purchasePrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Prix d'achat</span>
                    <span className="text-slate-300">{fmtEur(asset.purchasePrice)}</span>
                  </div>
                )}
                {asset.purchaseDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Date d'achat</span>
                    <span className="text-slate-300">
                      {new Date(asset.purchaseDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                {asset.description && (
                  <p className="text-xs text-slate-500 mt-2 border-t border-slate-800 pt-2">
                    {asset.description}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {assets.length === 0 && (
        <Card className="p-12 text-center">
          <Package size={48} className="mx-auto text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">Aucun bien enregistré</h3>
          <p className="text-slate-600 mb-6">
            Commencez à inventorier vos biens : voiture, immobilier, matériel, etc.
          </p>
          <Btn onClick={() => openModal()}>
            <Plus size={16} className="mr-2" />
            Ajouter votre premier bien
          </Btn>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-6">
                {editingAsset ? 'Modifier le bien' : 'Ajouter un bien'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Nom du bien">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Voiture Tesla Model 3, MacBook Pro 2023..."
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                  />
                </Field>

                <Field label="Catégorie">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Valeur actuelle">
                    <input
                      type="number"
                      step="0.01"
                      value={form.currentValue}
                      onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                      placeholder="0.00"
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                  </Field>

                  <Field label="Prix d'achat (optionnel)">
                    <input
                      type="number"
                      step="0.01"
                      value={form.purchasePrice}
                      onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                  </Field>
                </div>

                <Field label="Date d'achat (optionnel)">
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                  />
                </Field>

                <Field label="Description (optionnel)">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Informations complémentaires..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-teal-500 focus:outline-none resize-none"
                  />
                </Field>

                <div className="flex gap-3 pt-4">
                  <Btn type="submit" className="flex-1">
                    {editingAsset ? 'Modifier' : 'Créer'}
                  </Btn>
                  <Btn type="button" variant="outline" onClick={closeModal} className="flex-1">
                    Annuler
                  </Btn>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AssetsProperties;
