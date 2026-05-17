import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Package, ArrowLeft, MessageSquare, Swords, ArrowLeftRight,
  Sparkles, ImageIcon, ShoppingBag, AlertTriangle,
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import GlassCard from '../components/shared/GlassCard';
import EmptyState from '../components/shared/EmptyState';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/shared/Skeleton';
import { productService } from '../services';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';
import type { ProductDetail, ProductImages } from '../types/api';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { t } = useI18n();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [images, setImages] = useState<ProductImages | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      productService.detail(id).catch((e) => {
        toast.error(getErrorMessage(e, t('productdetail.load_failed')));
        return null;
      }),
      productService.images(id).catch(() => null),
    ]).then(([d, im]) => {
      setProduct(d);
      setImages(im);
      setLoading(false);
    });
  }, [id, toast, t]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <EmptyState
        icon={<Package size={24} />}
        title={t('productdetail.not_found')}
        description={t('productdetail.not_found_desc').replace('{id}', String(id))}
        action={
          <Link to="/products">
            <Button variant="secondary" leftIcon={<ArrowLeft size={14} />}>{t('productdetail.back')}</Button>
          </Link>
        }
      />
    );
  }

  const stockoutDays = product.listings.map((l) => l.days_until_stockout);
  const minStockoutDays = stockoutDays.length ? Math.min(...stockoutDays) : null;
  const criticalStockout = minStockoutDays !== null && minStockoutDays < 7;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/products" className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-300">
        <ArrowLeft size={12} /> {t('productdetail.back')}
      </Link>

      <PageHeader
        title={product.name}
        subtitle={`${product.id} · ${product.category} · ${t('productdetail.in_marketplaces').replace('{n}', String(product.listings.length))}`}
        icon={<Package size={20} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/reviews/${encodeURIComponent(product.id)}`}>
              <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={14} />}>
                {t('productdetail.reviews')}
              </Button>
            </Link>
            <Link to={`/competitors/${encodeURIComponent(product.id)}`}>
              <Button variant="secondary" size="sm" leftIcon={<Swords size={14} />}>
                {t('productdetail.competitors')}
              </Button>
            </Link>
            <Link to={`/arbitrage/${encodeURIComponent(product.id)}`}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeftRight size={14} />}>
                {t('nav.arbitrage')}
              </Button>
            </Link>
            <Link to={`/listing-optimizer/${encodeURIComponent(product.id)}`}>
              <Button variant="secondary" size="sm" leftIcon={<Sparkles size={14} />}>
                {t('productdetail.optimize')}
              </Button>
            </Link>
            <Link to={`/image-analyzer/${encodeURIComponent(product.id)}`}>
              <Button variant="secondary" size="sm" leftIcon={<ImageIcon size={14} />}>
                {t('nav.image_analyzer')}
              </Button>
            </Link>
          </div>
        }
      />

      {/* Özet KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={t('dashboard.total_sales')} value={formatNumber(product.total_sales)} />
        <KPI label={t('dashboard.total_revenue')} value={formatCurrency(product.total_revenue)} />
        <KPI label={t('common.net_profit')} value={formatCurrency(product.total_net_profit)} positive={product.total_net_profit >= 0} />
        <KPI label={t('productdetail.unit_profit')} value={formatCurrency(product.avg_profit_per_item)} positive={product.avg_profit_per_item >= 0} />
      </div>

      {criticalStockout && (
        <div className="glass-card p-4 border border-rose-500/30 bg-rose-500/5 flex items-center gap-3">
          <AlertTriangle size={20} className="text-rose-500 shrink-0" />
          <div>
            <p className="text-rose-600 dark:text-rose-300 font-semibold text-sm">{t('productdetail.stock_warning')}</p>
            <p className="text-[var(--text-secondary)] text-xs">
              {t('productdetail.stock_warning_desc').replace('{n}', String(minStockoutDays))}
            </p>
          </div>
        </div>
      )}

      {/* Listings tablosu */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag size={16} className="text-indigo-600 dark:text-indigo-300" />
          <h3 className="text-[var(--text-primary)] font-semibold">{t('productdetail.listings')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="py-2 pl-2">{t('common.marketplace')}</th>
                <th className="py-2 text-right">{t('products.price')}</th>
                <th className="py-2 text-right">{t('productdetail.cost')}</th>
                <th className="py-2 text-right">{t('productdetail.net_unit')}</th>
                <th className="py-2 text-right">{t('common.margin')}</th>
                <th className="py-2 text-right">{t('productdetail.sales_30d')}</th>
                <th className="py-2 text-right">{t('products.stock')}</th>
                <th className="py-2 text-right">{t('productdetail.stockout')}</th>
                <th className="py-2 text-right">{t('financials.exp_commission')}</th>
                <th className="py-2 text-center">{t('products.rating')}</th>
              </tr>
            </thead>
            <tbody>
              {product.listings.map((l) => (
                <tr key={l.marketplace} className="border-b border-[var(--border-color)]">
                  <td className="py-2.5 pl-2">
                    <MarketplaceBadge marketplace={l.marketplace} />
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-primary)]">{formatCurrency(l.price)}</td>
                  <td className="py-2.5 text-right text-[var(--text-muted)]">{formatCurrency(l.cost)}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-500">
                    {formatCurrency(l.profit_per_item)}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-secondary)]">{formatPercent(l.net_margin_pct)}</td>
                  <td className="py-2.5 text-right text-[var(--text-primary)]">{formatNumber(l.sales_30d)}</td>
                  <td className="py-2.5 text-right text-[var(--text-secondary)]">{formatNumber(l.stock)}</td>
                  <td className={`py-2.5 text-right font-medium ${
                    l.days_until_stockout < 7 ? 'text-rose-500' :
                    l.days_until_stockout < 15 ? 'text-amber-500' : 'text-[var(--text-secondary)]'
                  }`}>
                    {l.days_until_stockout < 999 ? t('productdetail.days').replace('{n}', String(l.days_until_stockout)) : '—'}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-muted)] text-xs">
                    %{l.commission_rate?.toFixed(1)}
                  </td>
                  <td className="py-2.5 text-center text-amber-500 text-xs">
                    ⭐ {l.rating?.toFixed(1) || '—'}
                    <p className="text-[var(--text-muted)] text-[10px]">{formatNumber(l.review_count)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Görseller */}
      {images && images.images_by_marketplace.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={16} className="text-violet-500" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('productdetail.images')}</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {images.images_by_marketplace.map((g) => (
              <div key={g.marketplace} className="rounded-xl overflow-hidden border border-[var(--border-color)]">
                <div className="px-3 py-2 bg-[var(--bg-elevated)] flex items-center justify-between">
                  <MarketplaceBadge marketplace={g.marketplace} />
                  <span className="text-xs text-[var(--text-muted)]">{t('productdetail.image_count').replace('{n}', String(g.gallery.length))}</span>
                </div>
                <div className="aspect-square bg-[var(--bg-elevated)]">
                  <img
                    src={g.primary_image}
                    alt={`${product.name} - ${g.marketplace}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.src = `https://placehold.co/600x600?text=${encodeURIComponent(product.id)}`;
                      img.alt = `${product.name} - görsel yüklenemedi`;
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function KPI({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-1 ${
        positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-500' : 'text-rose-500'
      }`}>
        {value}
      </p>
    </div>
  );
}
