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
import { useI18n } from '../context/I18nContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatNumber } from '../utils/formatters';
import type { LowStockAlert, ProductListItem } from '../types/api';

type SortKey = 'total_sales' | 'total_revenue' | 'total_net_profit' | 'rating' | 'total_stock';

export default function ProductsPage() {
  const toast = useToast();
  const { t } = useI18n();
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
      .catch((e) => toast.error(getErrorMessage(e, t('products.loading'))))
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
        <PageHeader title={t('products.title')} subtitle={t('common.loading')} />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('products.title')}
        subtitle={`${products.length} ${t('common.products_count')}`}
        icon={<Package size={20} />}
      />

      {/* Top sellers + Low stock alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-500" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('products.top_sellers')}</h3>
          </div>
          {topSellers.length === 0 ? (
            <EmptyState title={t('products.no_data')} />
          ) : (
            <ul className="space-y-2">
              {topSellers.map((p, i) => (
                <li key={p.id}>
                  <Link
                    to={`/products/${encodeURIComponent(p.id)}`}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[var(--text-primary)] text-sm truncate">{p.name}</p>
                        <p className="text-[var(--text-muted)] text-[11px]">{formatNumber(p.total_sales)} {t('products.units')}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-500 text-sm font-semibold">
                        {formatCurrency(p.total_net_profit)}
                      </p>
                      <p className="text-[var(--text-muted)] text-[10px]">{t('products.net_profit_lbl')}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-rose-500" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('products.low_stock_title')}</h3>
            <span className="ml-auto text-xs text-[var(--text-muted)]">{lowStock.length} {t('products.low_stock_warnings')}</span>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState title={t('products.low_stock_empty')} />
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {lowStock.map((a) => (
                <li
                  key={`${a.product_id}-${a.marketplace}`}
                  className={`p-2.5 rounded-lg border ${
                    a.urgency === 'kritik'
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/products/${encodeURIComponent(a.product_id)}`}
                      className="text-[var(--text-primary)] text-sm truncate hover:underline"
                    >
                      {a.product_name}
                    </Link>
                    <span className={`text-[10px] uppercase font-bold ${a.urgency === 'kritik' ? 'text-rose-500' : 'text-amber-500'}`}>
                      {a.urgency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[var(--text-muted)] text-xs">
                      {a.marketplace} · {a.stock} {t('products.units_short')}
                    </span>
                    <span className="text-[var(--text-secondary)] text-xs font-medium">
                      {a.days_until_stockout} {t('products.days_until_stockout')}
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
          <h3 className="text-[var(--text-primary)] font-semibold flex-1">{t('products.all_products')}</h3>
          <Input
            placeholder={t('products.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            fullWidth={false}
            className="w-64"
          />
          <div className="relative">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl pl-8 pr-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="">{t('products.all_categories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl pl-8 pr-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="total_sales">{t('products.sort_sales')}</option>
              <option value="total_revenue">{t('products.sort_revenue')}</option>
              <option value="total_net_profit">{t('products.sort_profit')}</option>
              <option value="rating">{t('products.sort_rating')}</option>
              <option value="total_stock">{t('products.sort_stock')}</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={t('products.empty')} description={t('products.empty_desc')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <th className="py-2 pl-2">{t('products.col_product')}</th>
                  <th className="py-2">{t('products.col_category')}</th>
                  <th className="py-2 text-center">{t('products.col_rating')}</th>
                  <th className="py-2 text-right">{t('products.col_sales')}</th>
                  <th className="py-2 text-right">{t('products.col_revenue')}</th>
                  <th className="py-2 text-right">{t('products.col_net_profit')}</th>
                  <th className="py-2 text-right">{t('products.col_unit_profit')}</th>
                  <th className="py-2 text-right">{t('products.col_stock')}</th>
                  <th className="py-2 text-center">{t('products.col_marketplace')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-color)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <td className="py-2.5 pl-2">
                      <Link
                        to={`/products/${encodeURIComponent(p.id)}`}
                        className="text-[var(--text-primary)] font-medium hover:text-indigo-600 dark:hover:text-indigo-300 max-w-[260px] truncate block"
                      >
                        {p.name}
                      </Link>
                      <p className="text-[var(--text-muted)] text-[10px]">{p.id}</p>
                    </td>
                    <td className="py-2.5 text-[var(--text-muted)] text-xs">{p.category}</td>
                    <td className="py-2.5 text-center text-amber-500 text-xs">
                      ⭐ {p.rating?.toFixed(1) || '—'}
                      <p className="text-[var(--text-muted)] text-[10px]">{formatNumber(p.review_count)}</p>
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-primary)]">{formatNumber(p.total_sales)}</td>
                    <td className="py-2.5 text-right text-[var(--text-primary)]">{formatCurrency(p.total_revenue)}</td>
                    <td className="py-2.5 text-right text-emerald-500 font-semibold">
                      {formatCurrency(p.total_net_profit)}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-secondary)]">{formatCurrency(p.avg_profit_per_item)}</td>
                    <td className="py-2.5 text-right text-[var(--text-secondary)]">{formatNumber(p.total_stock)}</td>
                    <td className="py-2.5 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:text-indigo-300">
                        {p.marketplace_count}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-right">
                      <Link
                        to={`/products/${encodeURIComponent(p.id)}`}
                        className="inline-flex p-1 rounded text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50"
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
