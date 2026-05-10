import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { productService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [compare, setCompare] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([productService.getById(id), productService.compare(id)])
      .then(([p, c]) => { setProduct(p); setCompare(c); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="text-indigo-400 animate-spin" /></div>;
  if (!product) return <p className="text-slate-400 text-center py-20">Ürün bulunamadı.</p>;

  const listings = product.listings as Record<string, unknown>[];

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate('/products')} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} /> Ürünlere Dön
      </button>

      <GlassCard>
        <h2 className="text-white text-xl font-bold">{product.name as string}</h2>
        <p className="text-slate-400 text-sm mt-1">{product.category as string} • {product.id as string}</p>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <p className="text-slate-400 text-xs">Toplam Satış</p>
            <p className="text-white text-xl font-bold mt-1">{formatNumber(product.total_sales as number)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs">Toplam Gelir</p>
            <p className="text-white text-xl font-bold mt-1">{formatCurrency(product.total_revenue as number)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs">Net Kâr</p>
            <p className={`text-xl font-bold mt-1 ${(product.total_net_profit as number) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(product.total_net_profit as number)}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Pazaryeri Listingleri</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {['Pazaryeri', 'Fiyat', 'Maliyet', 'Stok', 'Satış/30g', 'Komisyon', 'Net Kâr/Adet', 'Marj', 'Puan'].map(h => (
                  <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {listings.map((l, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-3"><MarketplaceBadge marketplace={l.marketplace as string} /></td>
                  <td className="py-3 pr-3 text-white font-medium">{formatCurrency(l.price as number)}</td>
                  <td className="py-3 pr-3 text-slate-400">{formatCurrency(l.cost as number)}</td>
                  <td className="py-3 pr-3 text-slate-300">{formatNumber(l.stock as number)}</td>
                  <td className="py-3 pr-3 text-slate-300">{formatNumber(l.sales_30d as number)}</td>
                  <td className="py-3 pr-3 text-slate-400">{formatPercent(l.commission_rate as number)}</td>
                  <td className={`py-3 pr-3 font-medium ${(l.profit_per_item as number) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(l.profit_per_item as number)}</td>
                  <td className="py-3 pr-3 text-slate-300">{formatPercent(l.net_margin_pct as number)}</td>
                  <td className="py-3 pr-3 text-amber-400">⭐ {(l.rating as number)?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {compare && Boolean(compare.listings) && (
        <GlassCard className="border border-indigo-500/20">
          <h3 className="text-white font-semibold mb-2">Arbitraj Analizi</h3>
          <p className="text-slate-400 text-sm mb-3">En iyi: <span className="text-emerald-400 font-medium">{compare.best_marketplace as string}</span> — En kötü: <span className="text-rose-400 font-medium">{compare.worst_marketplace as string}</span></p>
          <div className="flex gap-4">
            <div className="glass-card p-3 flex-1 text-center bg-emerald-500/5">
              <p className="text-slate-400 text-xs">Adet Başına Fark</p>
              <p className="text-emerald-400 font-bold text-lg mt-1">{formatCurrency(compare.profit_gap_per_item as number)}</p>
            </div>
            <div className="glass-card p-3 flex-1 text-center bg-indigo-500/5">
              <p className="text-slate-400 text-xs">Aylık Fırsat</p>
              <p className="text-indigo-400 font-bold text-lg mt-1">{formatCurrency(compare.monthly_opportunity as number)}</p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
