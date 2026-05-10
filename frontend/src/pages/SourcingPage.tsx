import { useEffect, useState } from 'react';
import { Brain, Bell, Plus, Trash2, Search } from 'lucide-react';
import { sourcingService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import { formatCurrency } from '../utils/formatters';

interface Supplier {
  name: string;
  product: string;
  current_price: number;
  discounted_price: number;
  min_order: number;
  shipping_days: number;
  discount_pct: number;
  has_discount: boolean;
}

interface Alert {
  id: string;
  product_name: string;
  target_price: number;
  supplier_name: string;
  status: string;
  created_at: string;
}

export default function SourcingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [alertForm, setAlertForm] = useState({ product_name: '', target_price: '', supplier_name: '' });
  const [tab, setTab] = useState<'suppliers' | 'alerts'>('suppliers');

  useEffect(() => {
    Promise.all([sourcingService.suppliers(), sourcingService.listAlerts()])
      .then(([s, a]) => {
        setSuppliers(s.suppliers || []);
        setAlerts(a.alerts || []);
      }).finally(() => setLoading(false));
  }, []);

  const handleAi = async () => {
    setAiLoading(true);
    try {
      const res = await sourcingService.opportunities();
      setAiAnalysis(res.ai_analysis || '');
    } finally { setAiLoading(false); }
  };

  const handleCreateAlert = async () => {
    if (!alertForm.product_name || !alertForm.target_price) return;
    await sourcingService.createAlert({
      product_name: alertForm.product_name,
      target_price: parseFloat(alertForm.target_price),
      supplier_name: alertForm.supplier_name,
    });
    const res = await sourcingService.listAlerts();
    setAlerts(res.alerts || []);
    setAlertForm({ product_name: '', target_price: '', supplier_name: '' });
  };

  const handleDeleteAlert = async (id: string) => {
    await sourcingService.deleteAlert(id);
    setAlerts(a => a.filter(x => x.id !== id));
  };

  const filtered = suppliers.filter(s =>
    search === '' ||
    s.product.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner message="Tedarikçi verileri yükleniyor..." size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="text-center bg-indigo-500/5">
          <p className="text-slate-400 text-xs">Toplam Tedarikçi</p>
          <p className="text-white text-2xl font-bold mt-1">{suppliers.length}</p>
        </GlassCard>
        <GlassCard className="text-center bg-emerald-500/5">
          <p className="text-slate-400 text-xs">İndirimli</p>
          <p className="text-emerald-400 text-2xl font-bold mt-1">{suppliers.filter(s => s.has_discount).length}</p>
        </GlassCard>
        <GlassCard className="text-center bg-amber-500/5">
          <p className="text-slate-400 text-xs">Aktif Alarm</p>
          <p className="text-amber-400 text-2xl font-bold mt-1">{alerts.length}</p>
        </GlassCard>
        <GlassCard className="text-center bg-violet-500/5">
          <p className="text-slate-400 text-xs">En İyi Fiyat</p>
          <p className="text-violet-400 text-sm font-bold mt-1 truncate">{suppliers.sort((a, b) => a.discounted_price - b.discounted_price)[0]?.name?.split(' ').slice(0, 2).join(' ')}</p>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1">
        <button onClick={() => setTab('suppliers')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'suppliers' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>
          <Search size={14} /> Tedarikçiler
        </button>
        <button onClick={() => setTab('alerts')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'alerts' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>
          <Bell size={14} /> Fiyat Alarmları ({alerts.length})
        </button>
      </div>

      {tab === 'suppliers' && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ürün veya tedarikçi ara..."
              className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <GlassCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    {['Tedarikçi', 'Ürün', 'Fiyat', 'İndirimli', 'Min. Sipariş', 'Teslimat', 'İndirim'].map(h => (
                      <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filtered.map((s, i) => (
                    <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${s.has_discount ? 'bg-emerald-500/3' : ''}`}>
                      <td className="py-3 pr-4 text-white font-medium text-sm">{s.name}</td>
                      <td className="py-3 pr-4 text-slate-300">{s.product}</td>
                      <td className="py-3 pr-4 text-slate-400">{formatCurrency(s.current_price)}</td>
                      <td className="py-3 pr-4 font-medium text-emerald-400">{formatCurrency(s.discounted_price)}</td>
                      <td className="py-3 pr-4 text-slate-300">{s.min_order} adet</td>
                      <td className="py-3 pr-4 text-slate-300">{s.shipping_days} gün</td>
                      <td className="py-3 pr-4">
                        {s.has_discount ? (
                          <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full">%{s.discount_pct} İNDİRİM</span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {tab === 'alerts' && (
        <>
          {/* Create Alert Form */}
          <GlassCard className="border border-indigo-500/15">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus size={16} /> Yeni Fiyat Alarmı</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                value={alertForm.product_name}
                onChange={e => setAlertForm(p => ({ ...p, product_name: e.target.value }))}
                placeholder="Ürün adı (ör: Bluetooth Kulaklık)"
                className="bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
              />
              <input
                type="number"
                value={alertForm.target_price}
                onChange={e => setAlertForm(p => ({ ...p, target_price: e.target.value }))}
                placeholder="Hedef fiyat (₺)"
                className="bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
              />
              <input
                value={alertForm.supplier_name}
                onChange={e => setAlertForm(p => ({ ...p, supplier_name: e.target.value }))}
                placeholder="Tedarikçi adı (isteğe bağlı)"
                className="bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <button
              onClick={handleCreateAlert}
              className="mt-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            >
              Alarm Oluştur
            </button>
          </GlassCard>

          {/* Alert List */}
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <GlassCard className="text-center py-8">
                <Bell size={32} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">Henüz fiyat alarmı oluşturulmadı.</p>
              </GlassCard>
            ) : alerts.map(a => (
              <GlassCard key={a.id} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{a.product_name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hedef: <span className="text-indigo-400 font-medium">₺{a.target_price}</span> {a.supplier_name && `• ${a.supplier_name}`}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">{a.status}</span>
                  <button onClick={() => handleDeleteAlert(a.id)} className="text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* AI */}
      {!aiAnalysis ? (
        <button
          onClick={handleAi}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-4 font-semibold text-sm transition-all"
        >
          {aiLoading ? <LoadingSpinner ai message="Tedarik fırsatları analiz ediliyor..." size="sm" /> : <><Brain size={18} /> 🤖 AI Tedarik Analizi Al</>}
        </button>
      ) : <AIResponseBox content={aiAnalysis} title="Tedarik Analizi" />}
    </div>
  );
}
