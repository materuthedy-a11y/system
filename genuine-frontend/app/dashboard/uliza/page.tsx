'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useBusinessProfileStore } from '@/store/businessProfileStore';
import { History, Loader2, MessageSquarePlus, Send, Trash2, X } from 'lucide-react';
import { copilotAPI, type ChatMessage, type ChatResult, type ConversationSummary } from '@/lib/api/copilot';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { AssistantResponse } from '@/components/uliza/ChatMessageContent';
import { AskAttachmentPicker } from '@/components/uliza/AskAttachmentPicker';

const surface = 'rounded-2xl border border-[#e1e6dd] bg-white shadow-sm dark:border-white/10 dark:bg-[#191c19]';
type UiMessage = ChatMessage & Partial<Pick<ChatResult, 'sources' | 'followUps' | 'dataPeriod' | 'facts'>>;

export default function UlizaPage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('rules-engine');
  const brand = useBusinessProfileStore((s) => s.brand);
  const [logoFailed, setLogoFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshConversations = () =>
    void copilotAPI.conversations().then(setConversations).catch(() => undefined);

  useEffect(() => {
    void copilotAPI.status().then((s) => setProvider(s.provider)).catch(() => undefined);
    void copilotAPI.suggestions().then((s) => setSuggestions(s.suggestions)).catch(() => undefined);
    refreshConversations();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim() || (files.length ? 'Please analyze the attached file(s).' : '');
    if (!message || loading) return;
    setInput('');
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await copilotAPI.chat(message, history, files, activeConvId);
      const { answer, ...metadata } = res;
      setMessages((m) => [...m, { role: 'assistant', content: answer, ...metadata }]);
      if (res.conversationId) setActiveConvId(res.conversationId);
      refreshConversations();
      if (res.followUps?.length) setSuggestions(res.followUps);
    } catch (e) {
      notify.error(getApiError(e, 'Ask could not answer — please try again'));
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput('');
    setFiles([]);
    setActiveConvId(undefined);
    setShowHistory(false);
  };

  const openConversation = async (id: string) => {
    try {
      const conv = await copilotAPI.conversation(id);
      setMessages(conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })));
      setActiveConvId(conv.id);
      setShowHistory(false);
    } catch {
      notify.error('Could not load that conversation');
    }
  };

  const removeConversation = async (id: string) => {
    try {
      await copilotAPI.deleteConversation(id);
      if (activeConvId === id) newChat();
      refreshConversations();
    } catch {
      notify.error('Could not delete that conversation');
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AskAvatar logoUrl={brand?.logoUrl} name={brand?.name} size={22} logoFailed={logoFailed} onError={() => setLogoFailed(true)} />
          <div>
            <h1 className="text-lg font-bold text-[#1d241d] dark:text-white">Ask</h1>
            <p className="text-xs text-[#687064] dark:text-white/55">
              Ask · your business assistant · {provider === 'rules-engine' ? 'offline mode' : 'AI mode'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={newChat} title="New chat"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#d9dfd5] text-[#4c554c] transition hover:bg-[#f1f4ee] dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
            <MessageSquarePlus size={16} />
          </button>
          <button type="button" onClick={() => setShowHistory((v) => !v)} title="Chat history"
            className={`grid h-9 w-9 place-items-center rounded-xl border transition ${showHistory ? 'border-emerald-700 bg-emerald-800 text-white dark:bg-emerald-700' : 'border-[#d9dfd5] text-[#4c554c] hover:bg-[#f1f4ee] dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5'}`}>
            <History size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 gap-4">
      {showHistory && (
        <aside className={`${surface} flex w-full max-w-xs shrink-0 flex-col overflow-hidden`} aria-label="Chat history">
          <div className="flex items-center justify-between border-b border-[#e6e9e2] px-4 py-3 dark:border-white/10">
            <span className="text-sm font-semibold text-[#303a30] dark:text-white">Chats</span>
            <button type="button" onClick={() => setShowHistory(false)} aria-label="Close history"
              className="grid h-7 w-7 place-items-center rounded-lg text-[#687064] hover:bg-[#f1f4ee] dark:text-white/55 dark:hover:bg-white/5">
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {conversations.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[#687064] dark:text-white/45">
                No saved chats yet — send a message and it will appear here.
              </p>
            )}
            {conversations.map((c) => (
              <div key={c.id}
                className={`group flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition ${c.id === activeConvId ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'text-[#4c554c] hover:bg-[#f1f4ee] dark:text-white/70 dark:hover:bg-white/5'}`}>
                <button type="button" onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 truncate text-left">
                  {c.title}
                </button>
                <button type="button" onClick={() => void removeConversation(c.id)} aria-label={`Delete ${c.title}`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#687064] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-white/45 dark:hover:bg-red-950/40">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      <section className={`${surface} flex min-w-0 flex-1 flex-col overflow-hidden`} aria-label="Chat">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <AskAvatar logoUrl={brand?.logoUrl} name={brand?.name} size={40} />
              <div>
                <p className="font-semibold text-[#303a30] dark:text-white">Hello!</p>
                <p className="mt-1 max-w-sm text-sm text-[#687064] dark:text-white/55">
                  Ask me anything about your sales, stock, expenses, customers or cash flow — I answer from your real business data.
                </p>
              </div>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-white/15 dark:bg-white/5 dark:text-emerald-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[85%] ${
                m.role === 'user'
                  ? 'whitespace-pre-wrap bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'border border-[#e6e9e2] bg-[#f7f8f5] text-[#2b332b] dark:border-white/10 dark:bg-white/[0.05] dark:text-white/90'
              }`}>
                {m.role === 'assistant' ? (
                  <AssistantResponse
                    answer={m.content}
                    facts={m.facts}
                    sources={m.sources}
                    dataPeriod={m.dataPeriod}
                    followUps={m.followUps}
                    onFollowUp={(question) => void send(question)}
                  />
                ) : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-[#e6e9e2] bg-[#f7f8f5] px-4 py-2.5 text-sm text-[#687064] dark:border-white/10 dark:bg-white/[0.05] dark:text-white/55">
                <Loader2 size={15} className="animate-spin" /> Ask is looking up your data…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="space-y-2 border-t border-[#e6e9e2] p-3 dark:border-white/10"
        >
          <AskAttachmentPicker files={files} onChange={setFiles} disabled={loading} />
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your business…"
              aria-label="Message Ask"
              maxLength={2000}
              className="min-h-11 flex-1 rounded-xl border border-[#d9dfd5] bg-white px-4 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white"
            />
            <button type="submit" disabled={loading || (!input.trim() && !files.length)} aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white transition hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-700">
              <Send size={17} />
            </button>
          </div>
        </form>
      </section>
      </div>
    </main>
  );
}


function AskAvatar({ logoUrl, name, size, logoFailed, onError }: { logoUrl?: string | null; name?: string | null; size: number; logoFailed?: boolean; onError?: () => void }) {
  const letter = (name || 'B').trim().charAt(0).toUpperCase();
  const px = Math.round(size * 2.2);
  if (logoUrl && !logoFailed) {
    return (
      <span className="relative block overflow-hidden rounded-2xl bg-emerald-800 shadow-sm" style={{ width: px, height: px }}>
        <Image src={logoUrl} alt={name || 'Business'} width={px} height={px} unoptimized onError={onError} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="grid place-items-center rounded-2xl bg-emerald-800 font-bold text-white shadow-sm dark:bg-emerald-700" style={{ width: px, height: px, fontSize: Math.max(14, Math.round(size * 0.8)) }}>
      {letter}
    </span>
  );
}
