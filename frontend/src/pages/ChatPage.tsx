import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare, Bot, User, Loader2 } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService } from '../services';
import type { ChatHistoryResponse } from '../types/api';

interface Message {
  id?: number;
  role: 'user' | 'ai';
  text: string;
  created_at?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    chatService.history(50).then((res: ChatHistoryResponse) => {
      const msgs: Message[] = (res.history || []).flatMap(h => [
        { id: h.id, role: 'user' as const, text: h.question, created_at: h.created_at },
        { id: h.id, role: 'ai' as const, text: h.answer, created_at: h.created_at },
      ]);
      setMessages(msgs.reverse());
      setHistoryLoaded(true);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (historyLoaded) scrollToBottom();
  }, [messages, historyLoaded]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || streaming) return;
    setInput('');
    setSending(true);

    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // SSE Streaming
    try {
      const token = localStorage.getItem('arkus_access_token') || '';
      const url = '/api/v1/chat/ask/stream';
      setStreaming(true);
      setStreamText('');

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream başlatılamadı');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.text) {
                accumulated += data.text;
                setStreamText(accumulated);
              }
              if (data.full_text) {
                accumulated = data.full_text;
                setStreamText(accumulated);
              }
            } catch {
              // Partial SSE chunks can split JSON lines; keep waiting for the next chunk.
            }
          }
        }
      }

      setMessages(prev => [...prev, { role: 'ai', text: accumulated }]);
    } catch {
      // Fallback: senkron ask
      try {
        const res = await chatService.ask(text);
        setMessages(prev => [...prev, { role: 'ai', text: res.answer, created_at: res.created_at }]);
      } catch {
        setMessages(prev => [...prev, { role: 'ai', text: '⚠️ Yanıt alınamadı. Lütfen tekrar deneyin.' }]);
      }
    } finally {
      setSending(false);
      setStreaming(false);
      setStreamText('');
      scrollToBottom();
      inputRef.current?.focus();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Sohbet geçmişini silmek istediğinizden emin misiniz?')) return;
    await chatService.clearHistory();
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) return <LoadingSpinner message="Sohbet geçmişi yükleniyor…" size="lg" />;

  const suggestions = [
    'En çok satan ürünüm hangisi?',
    'Kar marjımı nasıl artırabilirim?',
    'Hangi pazaryerinde daha kârlıyım?',
    'Stok uyarıları var mı?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Bot size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-slate-800 font-semibold">Arkus AI Danışman</h2>
            <p className="text-gray-500 text-xs">Mağazanızı analiz eden kişisel asistanınız</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-sm transition-all"
          >
            <Trash2 size={14} /> Temizle
          </button>
        )}
      </div>

      {/* Messages */}
      <GlassCard className="flex-1 overflow-y-auto mb-4 p-4 space-y-4">
        {messages.length === 0 && !streaming ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="p-4 bg-indigo-50 rounded-2xl">
              <MessageSquare size={40} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-slate-800 font-semibold mb-1">Nasıl yardımcı olabilirim?</h3>
              <p className="text-gray-500 text-sm">Mağazanız, ürünleriniz ve stratejiniz hakkında soru sorabilirsiniz.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left text-xs px-3 py-2 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-500/40 border border-gray-200 rounded-xl text-gray-600 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                  m.role === 'user' ? 'bg-indigo-50' : 'bg-violet-500/20'
                }`}>
                  {m.role === 'user' ? <User size={14} className="text-indigo-600" /> : <Bot size={14} className="text-violet-400" />}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-[#4a3f44] text-white rounded-tr-sm'
                    : 'bg-white/80 text-slate-200 rounded-tl-sm ai-response'
                }`}>
                  {m.role === 'ai' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  ) : m.text}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streaming && (
              <div className="flex gap-3 flex-row">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-violet-500/20">
                  <Bot size={14} className="text-violet-400" />
                </div>
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-white/80 text-slate-200 ai-response">
                  {streamText
                    ? <><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown><span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse" /></>
                    : <div className="flex gap-1 items-center text-gray-500"><Loader2 size={14} className="animate-spin" /> yazıyor…</div>
                  }
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </GlassCard>

      {/* Input */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sorunuzu yazın… (Enter gönder, Shift+Enter yeni satır)"
            rows={1}
            disabled={sending || streaming}
            className="w-full bg-gray-50 border border-gray-200 focus:border-[#4a3f44] text-slate-800 rounded-2xl px-4 py-3 text-sm resize-none outline-none transition-all disabled:opacity-50 placeholder:text-gray-500"
            style={{ minHeight: 48, maxHeight: 160 }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 160) + 'px';
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || streaming}
          className="flex-shrink-0 w-12 h-12 bg-[#4a3f44] hover:bg-[#6b6266] disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-[#4a3f44]/20"
        >
          {sending || streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
