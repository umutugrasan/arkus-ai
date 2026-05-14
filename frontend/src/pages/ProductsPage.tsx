import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Search, AlertTriangle, Trophy, ChevronRight,
  ArrowUpDown, Filter,
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import GlassCard from '../components/shared/GlassCard';
import EmptyState from '../components/shared/EmptyState';
import { Skeleton } from '../components/shared/Skeleton';
import Input from '../components/ui/Input';
import { productService } from '../services';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatNumber } from '../utils/formatters';
import type { LowStockAlert, ProductListItem } from '../types/api';

type SortKey = 'total_sales' | 'total_revenue' | 'total_net_profit' | 'rating' | 'total_stock';

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [topSellers, setTopSellers] = useState<ProductListItem[]>([]);
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('total_sales');
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    Promise.all([
      productService.list(),
      productService.topSellers(5),
      productService.lowStock(15),
    ])
      .then(([list, top, low]) => {
        setProducts(list.products);
        setTopSellers(top.top_sellers);
        setLowStock(low.low_stock_alerts);
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Ürünler yüklenemedi')))
      .finally(() => setLoading(false));
  }, [toast]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
      );
    }
    if (category) list = list.filter((p) => p.category === category);
    list = [...list].sort((a, b) => (b[sort] as number) - (a[sort] as number));
    return list;
  }, [products, search, category, sort]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ürünler" subtitle="Yükleniyor…" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ürün Yönetimi"
        subtitle={`${products.length} ürün, tüm pazaryerlerinden`}
        icon={<Package size={20} />}
      />

      {/* Top sellers + Low stock alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-400" />
            <h3 className="text-slate-800 font-semibold">En Çok Satanlar</h3>
          </div>
          {topSellers.length === 0 ? (
            <EmptyState title="Veri yok" />
          ) : (
            <ul className="space-y-2">
              {topSellers.map((p, i) => (
                <li key={p.id}>
                  <Link
                    to={`/products/${encodeURIComponent(p.id)}`}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/40 hover:bg-white/80 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-800 text-sm truncate">{p.name}</p>
                        <p className="text-gray-500 text-[11px]">{formatNumber(p.total_sales)} satış</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 text-sm font-semibold">
                        {formatCurrency(p.total_net_profit)}
                      </p>
                      <p className="text-gray-500 text-[10px]">net kâr</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-rose-400" />
            <h3 className="text-slate-800 font-semibold">Stoku Kritik</h3>
            <span className="ml-auto text-xs text-gray-500">{lowStock.length} uyarı</span>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState title="Tebrikler, stok problemi yok 🎉" />
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {lowStock.map((a, i) => (
                <li
                  key={i}
                  className={`p-2.5 rounded-lg border ${
                    a.urgency === 'kritik'
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/products/${encodeURIComponent(a.product_id)}`}
                      className="text-slate-800 text-sm truncate hover:underline"
                    >
                      {a.product_name}
                    </Link>
                    <span className={`text-[10px] uppercase font-bold ${a.urgency === 'kritik' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {a.urgency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-500 text-xs">
                      {a.marketplace} · {a.stock} adet
                    </span>
                    <span className="text-gray-600 text-xs font-medium">
                      {a.days_until_stockout} günde tükenir
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Tüm ürünler */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="text-slate-800 font-semibold flex-1">Tüm Ürünler</h3>
          <Input
            placeholder="Ürün ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            fullWidth={false}
            className="w-64"
          />
          <div className="relative">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-gray-50 border border-gray-200/60 rounded-xl pl-8 pr-3 py-2.5 text-sm text-slate-800 outline-none"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-gray-50 border border-gray-200/60 rounded-xl pl-8 pr-3 py-2.5 text-sm text-slate-800 outline-none"
            >
              <option value="total_sales">Satışa göre</option>
              <option value="total_revenue">Ciroya göre</option>
              <option value="total_net_profit">Net kâra göre</option>
              <option value="rating">Puana göre</option>
              <option value="total_stock">Stok'a göre</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Eşleşen ürün yok" description="Filtre ya da aramayı değiştir." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="py-2 pl-2">Ürün</th>
                  <th className="py-2">Kategori</th>
                  <th className="py-2 text-center">Puan</th>
                  <th className="py-2 text-right">Satış</th>
                  <th className="py-2 text-right">Ciro</th>
                  <th className="py-2 text-right">Net Kâr</th>
                  <th className="py-2 text-right">Birim Kâr</th>
                  <th className="py-2 text-right">Stok</th>
                  <th className="py-2 text-center">Pazaryeri</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-200/60 hover:bg-white/30 transition-colors"
                  >
                    <td className="py-2.5 pl-2">
                      <Link
                        to={`/products/${encodeURIComponent(p.id)}`}
                        className="text-slate-800 font-medium hover:text-indigo-600 max-w-[260px] truncate block"
                      >
                        {p.name}
                      </Link>
                      <p className="text-gray-500 text-[10px]">{p.id}</p>
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{p.category}</td>
                    <td className="py-2.5 text-center text-amber-400 text-xs">
                      ⭐ {p.rating?.toFixed(1) || '—'}
                      <p className="text-gray-500 text-[10px]">{formatNumber(p.review_count)}</p>
                    </td>
                    <td className="py-2.5 text-right text-slate-200">{formatNumber(p.total_sales)}</td>
                    <td className="py-2.5 text-right text-slate-200">{formatCurrency(p.total_revenue)}</td>
                    <td className="py-2.5 text-right text-emerald-400 font-semibold">
                      {formatCurrency(p.total_net_profit)}
                    </td>
                    <td className="py-2.5 text-right text-gray-600">{formatCurrency(p.avg_profit_per_item)}</td>
                    <td className="py-2.5 text-right text-gray-600">{formatNumber(p.total_stock)}</td>
                    <td className="py-2.5 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                        {p.marketplace_count}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-right">
                      <Link
                        to={`/products/${encodeURIComponent(p.id)}`}
                        className="inline-flex p-1 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
                      >
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
