import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Package, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Product {
  id: string;
  name: string;
  category: string;
  marketplace_count: number;
  total_sales: number;
  total_revenue: number;
  total_net_profit: number;
}

interface LowStockAlert {
  product_id: string;
  product_name: string;
  marketplace: string;
  stock: number;
  daily_sales: number;
  days_until_stockout: number;
  urgency: 'kritik' | 'uyari';
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [topSellers, setTopSellers] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'top' | 'stock'>('list');

  useEffect(() => {
    Promise.all([
      productService.list(),
      productService.topSellers(),
      productService.lowStock(),
    ]).then(([p, ts, ls]) => {
      setProducts(p.products || []);
      setTopSellers(ts.top_sellers || []);
      setLowStock(ls.low_stock_alerts || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Ürünler yükleniyor..." size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="text-center bg-indigo-500/5">
          <p className="text-slate-400 text-xs mb-1">Toplam Ürün</p>
          <p className="text-2xl font-bold text-white">{products.length}</p>
        </GlassCard>
        <GlassCard className="text-center bg-emerald-500/5">
          <p className="text-slate-400 text-xs mb-1">En Çok Satan</p>
          <p className="text-lg font-bold text-emerald-400 truncate">{topSellers[0]?.name?.split(' ').slice(0, 2).join(' ')}</p>
        </GlassCard>
        <GlassCard className={`text-center ${lowStock.length > 0 ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/5'}`}>
          <p className="text-slate-400 text-xs mb-1">Düşük Stok Uyarısı</p>
          <p className={`text-2xl font-bold ${lowStock.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{lowStock.length}</p>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-800/40 rounded-xl p-1">
        {[
          { key: 'list', label: 'Tüm Ürünler', icon: Package },
          { key: 'top', label: 'En Çok Satanlar', icon: TrendingUp },
          { key: 'stock', label: `Düşük Stok (${lowStock.filter(a => a.urgency === 'kritik').length} Kritik)`, icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'list' | 'top' | 'stock')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* List Tab */}
      {tab === 'list' && (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Ürün Adı', 'Kategori', 'Pazaryeri', 'Satış', 'Gelir', 'Net Kâr', ''].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                    <td className="py-3 pr-4">
                      <p className="text-white font-medium text-sm truncate max-w-[200px]">{p.name}</p>
                      <p className="text-slate-500 text-xs">{p.id}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{p.category}</td>
                    <td className="py-3 pr-4">
                      <span className="text-indigo-400 font-medium text-xs">{p.marketplace_count} pazaryeri</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{formatNumber(p.total_sales)}</td>
                    <td className="py-3 pr-4 text-white font-medium">{formatCurrency(p.total_revenue)}</td>
                    <td className={`py-3 pr-4 font-medium ${p.total_net_profit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(p.total_net_profit)}
                    </td>
                    <td className="py-3"><ChevronRight size={14} className="text-slate-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Top Sellers Tab */}
      {tab === 'top' && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-4">En Çok Satan 10 Ürün</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topSellers.slice(0, 7).map(p => ({ name: p.name.split(' ').slice(0, 2).join(' '), Satış: p.total_sales, 'Net Kâr': p.total_net_profit / 1000 }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} width={120} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="Satış" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Low Stock Tab */}
      {tab === 'stock' && (
        <div className="space-y-3">
          {lowStock.length === 0 ? (
            <GlassCard className="text-center py-8">
              <p className="text-emerald-400 text-lg font-bold">✅ Tüm stoklar normal!</p>
              <p className="text-slate-400 text-sm mt-1">Düşük stok uyarısı bulunmuyor.</p>
            </GlassCard>
          ) : lowStock.map((a, i) => (
            <GlassCard key={i} className={`${a.urgency === 'kritik' ? 'border border-rose-500/30 bg-rose-500/5' : 'border border-yellow-500/30 bg-yellow-500/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${a.urgency === 'kritik' ? 'bg-rose-500/20' : 'bg-yellow-500/20'}`}>
                    <AlertTriangle size={16} className={a.urgency === 'kritik' ? 'text-rose-400' : 'text-yellow-400'} />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{a.product_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <MarketplaceBadge marketplace={a.marketplace} />
                      <span className="text-slate-400 text-xs">{a.stock} adet kaldı</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${a.urgency === 'kritik' ? 'text-rose-400' : 'text-yellow-400'}`}>{a.days_until_stockout} gün</p>
                  <p className="text-slate-400 text-xs">tükenmesine</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
