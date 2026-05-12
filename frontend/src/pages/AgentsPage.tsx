import { useState, useEffect } from 'react';
import { Bot, Play, PlayCircle, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { agentService } from '../services';
import { formatDate } from '../utils/formatters';
import type { AgentStatus, AgentStatusResponse, RunAllAgentsResponse, AgentResult } from '../types/api';

const AGENT_LABELS: Record<string, { label: string; desc: string; icon: string }> = {
  sync_agent: { label: 'Mağaza Senkronizasyonu', desc: 'Tüm pazaryerlerinden ürün verilerini senkronize eder', icon: '🔄' },
  notification_agent: { label: 'Bildirim Ajanı', desc: 'Stok uyarıları, puan düşüşleri ve rakip fiyat değişimlerini tespit eder', icon: '🔔' },
  competitor_agent: { label: 'Rakip Takip Ajanı', desc: 'Rakip fiyat değişimlerini izler ve anlık snapshot alır', icon: '🕵️' },
  health_agent: { label: 'Sağlık Skoru Güncellemesi', desc: 'Mağaza sağlık skorunu yeniden hesaplar', icon: '💚' },
};

export default function AgentsPage() {
  const [agentList, setAgentList] = useState<AgentStatus[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runningOne, setRunningOne] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<RunAllAgentsResponse | null>(null);

  const fetchStatus = async () => {
    const res: AgentStatusResponse = await agentService.status();
    setAgentList(res.agents || []);
    setTotalAgents(res.total_agents || 0);
  };

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
  }, []);

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const res = await agentService.runAll();
      setLastRunResult(res);
      await fetchStatus();
    } finally { setRunningAll(false); }
  };

  const handleRunOne = async (name: string) => {
    setRunningOne(name);
    try {
      await agentService.runOne(name);
      await fetchStatus();
    } finally { setRunningOne(null); }
  };

  if (loading) return <LoadingSpinner message="Ajan durumu yükleniyor…" size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <GlassCard className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Bot size={20} className="text-violet-400" /> Otonom Ajanlar
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {totalAgents} ajan tanımlı · Mağazanızı otomatik izler ve günceller
            </p>
          </div>
          <button onClick={handleRunAll} disabled={runningAll || !!runningOne}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20">
            {runningAll ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
            {runningAll ? 'Çalışıyor…' : 'Tümünü Çalıştır'}
          </button>
        </div>
      </GlassCard>

      {/* Ajan Kartları */}
      <div className="grid md:grid-cols-2 gap-4">
        {agentList.map((agent) => {
          const cfg = AGENT_LABELS[agent.name] || { label: agent.name, desc: '', icon: '🤖' };
          const isThisRunning = runningOne === agent.name;

          return (
            <GlassCard key={agent.name} className="hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{cfg.icon}</div>
                  <div>
                    <p className="text-white font-semibold">{cfg.label}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{cfg.desc}</p>
                    {agent.last_run && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                        <Clock size={10} /> Son: {formatDate(agent.last_run)}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRunOne(agent.name)}
                  disabled={runningAll || !!runningOne}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {isThisRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Çalıştır
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Son Çalıştırma Sonuçları */}
      {lastRunResult && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" /> Son Pipeline Sonuçları
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-slate-800/40 rounded-xl text-center">
              <p className="text-white font-bold text-2xl">{lastRunResult.agents_run ?? 0}</p>
              <p className="text-slate-400 text-xs">Toplam Ajan</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-center">
              <p className="text-emerald-400 font-bold text-2xl">
                {(lastRunResult.results || []).filter(r => r.status === 'ok').length}
              </p>
              <p className="text-slate-400 text-xs">Başarılı</p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-center">
              <p className="text-rose-400 font-bold text-2xl">
                {(lastRunResult.results || []).filter(r => r.status === 'error').length}
              </p>
              <p className="text-slate-400 text-xs">Başarısız</p>
            </div>
          </div>
          <div className="space-y-2">
            {(lastRunResult.results || []).map((r: AgentResult, i: number) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${
                r.status === 'ok' ? 'bg-emerald-500/10' :
                r.status === 'error' ? 'bg-rose-500/10' : 'bg-amber-500/10'
              }`}>
                <div className="flex items-center gap-2">
                  {r.status === 'ok'
                    ? <CheckCircle2 size={14} className="text-emerald-400" />
                    : r.status === 'error'
                    ? <AlertCircle size={14} className="text-rose-400" />
                    : <AlertCircle size={14} className="text-amber-400" />}
                  <span className="text-white text-sm font-medium">
                    {AGENT_LABELS[r.agent]?.label || r.agent}
                  </span>
                </div>
                <span className="text-slate-400 text-xs">{r.items_processed} işlem</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
