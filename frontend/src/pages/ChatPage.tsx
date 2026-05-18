import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare, Bot, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService } from '../services';
import { useI18n } from '../context/I18nContext';
import { streamSSE } from '../utils/streaming';
import { pageVariants, staggerContainer, staggerItem } from '../utils/motion';
import type { ChatHistoryResponse } from '../types/api';

interface Message {
  id?: number;
  role: 'user' | 'ai';
  text: string;
  created_at?: string;
}

export default function ChatPage() {
  const { t } = useI18n();
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

    setStreaming(true);
    setStreamText('');
    let accumulated = '';
    let streamFailed = false;

    try {
      await streamSSE(
        chatService.askStreamUrl(),
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamText(accumulated);
          },
          onDone: (data) => {
            const full = typeof data.full_text === 'string' ? data.full_text : '';
            if (full) accumulated = full;
            if (data.error) streamFailed = true;
          },
          onError: () => {
            streamFailed = true;
          },
        },
        { method: 'POST', body: { message: text } },
      );

      if (streamFailed && !accumulated) {
        const res = await chatService.ask(text);
        setMessages(prev => [...prev, { role: 'ai', text: res.answer, created_at: res.created_at }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: accumulated || t('chat.error_response') }]);
      }
    } catch {
      try {
        const res = await chatService.ask(text);
        setMessages(prev => [...prev, { role: 'ai', text: res.answer, created_at: res.created_at }]);
      } catch {
        setMessages(prev => [...prev, { role: 'ai', text: t('chat.error_response') }]);
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
    if (!confirm(t('chat.clear_confirm'))) return;
    await chatService.clearHistory();
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) return <LoadingSpinner message={t('chat.loading')} size="lg" />;

  const suggestions = [
    t('chat.suggestion_1'),
    t('chat.suggestion_2'),
    t('chat.suggestion_3'),
    t('chat.suggestion_4'),
  ];

  return (
    <motion.div
      className="flex flex-col h-[calc(100dvh-7rem)]"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[var(--accent)]/10 rounded-xl ring-1 ring-[var(--accent)]/15">
            <Bot size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-[var(--text-primary)] font-semibold">{t('chat.title')}</h2>
            <p className="text-[var(--text-muted)] text-xs">{t('chat.subtitle')}</p>
          </div>
        </div>
        <AnimatePresence>
          {messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl text-sm transition-all"
            >
              <Trash2 size={14} /> {t('chat.clear')}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Messages */}
      <motion.div variants={staggerItem} className="flex-1 min-h-0 overflow-hidden">
        <GlassCard className="flex flex-col h-full p-4">
          <div className="flex-1 overflow-y-auto space-y-4">
            {messages.length === 0 && !streaming ? (
            <motion.div
              className="flex flex-col items-center justify-center h-full gap-6 text-center"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={staggerItem} className="p-5 bg-[var(--accent)]/10 rounded-2xl ring-1 ring-[var(--accent)]/15">
                <MessageSquare size={40} className="text-[var(--accent)]" />
              </motion.div>
              <motion.div variants={staggerItem}>
                <h3 className="text-[var(--text-primary)] font-semibold mb-1">{t('chat.empty_title')}</h3>
                <p className="text-[var(--text-muted)] text-sm">{t('chat.empty_desc')}</p>
              </motion.div>
              <motion.div variants={staggerItem} className="grid grid-cols-2 gap-2 w-full max-w-md">
                {suggestions.map((s, idx) => (
                  <motion.button
                    key={s}
                    variants={staggerItem}
                    custom={idx}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left text-xs px-3 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/40 border border-[var(--border-strong)] rounded-xl text-[var(--text-secondary)] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    whileHover={{ y: -1, transition: { duration: 0.15 } }}
                  >
                    {s}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ring-1 ${
                      m.role === 'user'
                        ? 'bg-[var(--accent)]/10 ring-[var(--accent)]/20'
                        : 'bg-[var(--accent)]/15 ring-[var(--accent)]/25'
                    }`}>
                      {m.role === 'user'
                        ? <User size={14} className="text-[var(--accent)]" />
                        : <Bot size={14} className="text-[var(--accent)]" />}
                    </div>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${
                      m.role === 'user'
                        ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)] rounded-tr-sm'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-tl-sm ai-response border border-[var(--border-color)]'
                    }`}>
                      {m.role === 'ai' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                      ) : m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Streaming message */}
              <AnimatePresence>
                {streaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3 flex-row"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/25">
                      <Bot size={14} className="text-[var(--accent)]" />
                    </div>
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] ai-response border border-[var(--border-color)] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                      {streamText
                        ? <><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown><span className="inline-block w-2 h-4 bg-[var(--accent)] ml-0.5 animate-pulse rounded-sm" /></>
                        : <div className="flex gap-1 items-center text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> {t('ai.writing')}</div>
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
          </div>
          <div ref={messagesEndRef} />
        </GlassCard>
      </motion.div>

      {/* Input */}
      <motion.div variants={staggerItem} className="flex gap-3 items-end mt-4">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            disabled={sending || streaming}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text-primary)] rounded-2xl px-4 py-3 text-sm resize-none outline-none transition-all disabled:opacity-50 placeholder:text-[var(--text-muted)] shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            style={{ minHeight: 48, maxHeight: 160 }}
            onInput={e => {
              const ta = e.target as HTMLTextAreaElement;
              ta.style.height = 'auto';
              ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
            }}
          />
        </div>
        <motion.button
          onClick={handleSend}
          disabled={!input.trim() || sending || streaming}
          className="flex-shrink-0 w-12 h-12 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-40 text-[var(--accent-fg)] rounded-2xl flex items-center justify-center transition-all shadow-[0_4px_20px_rgba(74,63,68,0.25)]"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          {sending || streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
