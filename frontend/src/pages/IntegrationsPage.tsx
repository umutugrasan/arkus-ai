import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { storeService } from '../services';
import { useI18n } from '../context/I18nContext';
import type { StoreConnection, StoreConnectionsResponse } from '../types/api';

interface Toast { type: 'success' | 'error'; message: string }

const AVAILABLE_MP = ['trendyol', 'hepsiburada', 'amazon_tr', 'n11'];

const API_KEY_MARKETPLACE: Record<string, string> = {
  'demo-key-trendyol': 'trendyol',
  'TRY-DEMO-12345-ABCDE': 'trendyol',
  'demo-key-hepsiburada': 'hepsiburada',
  'HB-DEMO-67890-FGHIJ': 'hepsiburada',
  'demo-key-amazon_tr': 'amazon_tr',
  'AMZ-DEMO-13579-KLMNO': 'amazon_tr',
  'demo-key-n11': 'n11',
  'N11-DEMO-24680-PRSTU': 'n11',
};

const parseApiKeyInput = (value: string) => {
  const input = value.trim();
  const apiKey = Object.keys(API_KEY_MARKETPLACE).find((key) => input.includes(key)) || input;
  return { apiKey, marketplace: API_KEY_MARKETPLACE[apiKey] };
};

export default function IntegrationsPage() {
  const { t } = useI18n();
  const [connections, setConnections] = useState<StoreConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [newMP, setNewMP] = useState('trendyol');
  const [newApiKey, setNewApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // 2-tikli inline disconnect onayi: ilk tik state'i set eder, ikinci tik gercek aksiyonu calistirir
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshConnections = async () => {
    const res = await storeService.connections();
    setConnections(res);
  };

  useEffect(() => {
    refreshConnections().finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    const parsed = parseApiKeyInput(newApiKey);
    if (!parsed.apiKey) {
      showToast('error', t('integrations.api_key_required'));
      return;
    }

    const marketplace = parsed.marketplace || newMP;
    setConnecting(true);
    try {
      if (parsed.marketplace && parsed.marketplace !== newMP) {
        setNewMP(parsed.marketplace);
      }
      await storeService.connect(marketplace, parsed.apiKey);
      await refreshConnections();
      setNewApiKey('');
      showToast('success', t('integrations.connected_msg').replace('{mp}', marketplace));
    } catch {
      showToast('error', t('integrations.connect_failed'));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (mp: string) => {
    // Ilk tik: onay bekleme moduna gec, 4 sn icinde tekrar tiklanmazsa otomatik iptal
    if (confirmingDisconnect !== mp) {
      setConfirmingDisconnect(mp);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingDisconnect(null), 4000);
      return;
    }
    // Ikinci tik: gercek aksiyon
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDisconnect(null);
    try {
      await storeService.disconnect(mp);
      setConnections((prev) => prev ? {
        connections: prev.connections.filter((connection) => connection.marketplace !== mp),
      } : prev);
      await refreshConnections();
      showToast('success', t('integrations.disconnected_msg').replace('{mp}', mp));
    } catch {
      showToast('error', t('integrations.disconnect_failed'));
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await storeService.syncAll();
      await refreshConnections();
      showToast('success', t('integrations.sync_done'));
    } catch {
      showToast('error', t('integrations.sync_failed'));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingSpinner message={t('integrations.loading')} size="lg" />;

  const connList: StoreConnection[] = (connections?.connections || []).filter((connection) => connection.status === 'connected');
  const connectedMPs = connList.map((connection) => connection.marketplace);
  const selectableMarketplaces = AVAILABLE_MP.filter((marketplace) => !connectedMPs.includes(marketplace));

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-fade-in text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <PlugZap className="text-indigo-600 dark:text-indigo-300" size={24} />
            {t('integrations.title')}
          </h2>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            {t('integrations.subtitle')}
          </p>
        </div>
        <a
          href="/marketplace-portal.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-muted)] border border-[var(--border-strong)] text-[var(--text-secondary)] rounded-xl text-sm font-medium transition-all"
        >
          <ExternalLink size={15} />
          {t('integrations.dev_portal')}
        </a>
      </div>

      <GlassCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-44">
            <label className="text-[var(--text-muted)] text-xs block mb-1.5">{t('common.marketplace')}</label>
            <select
              value={newMP}
              onChange={(event) => setNewMP(event.target.value)}
              disabled={selectableMarketplaces.length === 0}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {selectableMarketplaces.map((marketplace) => (
                <option key={marketplace} value={marketplace}>{marketplace}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[var(--text-muted)] text-xs block mb-1.5">{t('integrations.api_key_label')}</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={newApiKey}
                onChange={(event) => setNewApiKey(event.target.value)}
                placeholder={t('integrations.api_key_placeholder')}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting || selectableMarketplaces.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            {connecting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t('integrations.connect')}
          </button>
        </div>
        {selectableMarketplaces.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm mt-3">{t('integrations.all_connected')}</p>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-[var(--text-primary)] font-semibold">{t('integrations.active_title')}</h3>
          <button
            onClick={handleSyncAll}
            disabled={syncing || connList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--bg-card)] hover:bg-[var(--bg-muted)] border border-[var(--border-strong)] text-[var(--text-secondary)] rounded-xl transition-all disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t('integrations.refresh')}
          </button>
        </div>

        {connList.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">{t('integrations.none_active')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {connList.map((connection) => (
              <div key={connection.marketplace} className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-color)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MarketplaceBadge marketplace={connection.marketplace} />
                    <p className="text-[var(--text-primary)] text-sm font-medium mt-3 truncate">
                      {connection.store_name || connection.marketplace}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">
                      {t('integrations.products_fetched').replace('{n}', String(connection.product_count ?? 0))}
                    </p>
                  </div>
                  <span className="text-emerald-500 text-xs font-semibold">{t('integrations.active')}</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-muted)] text-xs">{t('integrations.removes_data')}</span>
                  <button
                    onClick={() => handleDisconnect(connection.marketplace)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      confirmingDisconnect === connection.marketplace
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'text-rose-500 hover:bg-rose-500/10'
                    }`}
                  >
                    <Trash2 size={12} />
                    {confirmingDisconnect === connection.marketplace
                      ? t('integrations.confirm_remove') || 'Onayla'
                      : t('integrations.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
