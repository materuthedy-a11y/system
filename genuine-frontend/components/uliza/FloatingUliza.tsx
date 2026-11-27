'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useBusinessProfileStore } from '@/store/businessProfileStore';
import { Loader2, Send, X } from 'lucide-react';
import { copilotAPI, type ChatMessage, type ChatResult } from '@/lib/api/copilot';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { AssistantResponse } from './ChatMessageContent';
import { AskAttachmentPicker } from './AskAttachmentPicker';

const MAX_HISTORY = 10;
type UiMessage = ChatMessage & Partial<Pick<ChatResult, 'sources' | 'followUps' | 'dataPeriod' | 'facts'>>;

export function FloatingUliza() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('rules-engine');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [convId, setConvId] = useState<string | undefined>();
  const brand = useBusinessProfileStore((s) => s.brand);
  const [logoFailed, setLogoFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void copilotAPI.status().then((s) => setProvider(s.provider)).catch(() => undefined);
    void copilotAPI.suggestions().then((s) => setSuggestions(s.suggestions)).catch(() => undefined);
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, open]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim() || (files.length ? 'Please analyze the attached file(s).' : '');
    if (!message || loading) return;
    setInput('');
    const history = messages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await copilotAPI.chat(message, history, files, convId);
      const { answer, ...metadata } = res;
      setMessages((m) => [...m, { role: 'assistant', content: answer, ...metadata }]);
      if (res.conversationId) setConvId(res.conversationId);
      if (res.followUps?.length) setSuggestions(res.followUps);
    } catch (e) {
      notify.error(getApiError(e, 'Ask could not answer — please try again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Ask' : 'Open Ask assistant'}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-emerald-800 text-white shadow-lg shadow-emerald-900/25 transition hover:scale-105 hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:bottom-5 sm:right-5"
      >
        {open ? <X size={18} /> : <AskAvatar logoUrl={brand?.logoUrl} name={brand?.name} size={20} />}
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-amber-500 dark:border-[#191c19]" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Ask assistant"
          className="fixed bottom-20 right-4 z-50 flex h-[min(640px,75vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#e1e6dd] bg-white shadow-2xl dark:border-white/10 dark:bg-[#191c19] sm:bottom-20 sm:right-5"
        >
          <header className="flex items-center justify-between gap-2 border-b border-[#e6e9e2] px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <AskAvatar logoUrl={brand?.logoUrl} name={brand?.name} size={18} logoFailed={logoFailed} onError={() => setLogoFailed(true)} />
              <div>
                <p className="text-sm font-bold text-[#1d241d] dark:text-white">Ask</p>
                <p className="text-[11px] text-[#687064] dark:text-white/55">
                  {provider === 'rules-engine' ? 'Offline mode' : 'AI mode'} · data-grounded
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button type="button" title="New chat" aria-label="Start a new chat"
                  onClick={() => { setMessages([]); setInput(''); setFiles([]); setConvId(undefined); }}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#687064] hover:bg-[#f1f4ee] dark:text-white/55 dark:hover:bg-white/10">
                  New
                </button>
              )}
              <Link href="/dashboard/uliza" onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-white/10">
                Full page
              </Link>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <AskAvatar logoUrl={brand?.logoUrl} name={brand?.name} size={40} />
                <p className="text-sm font-semibold text-[#303a30] dark:text-white">Hello!</p>
                <p className="text-xs text-[#687064] dark:text-white/55">Ask me anything about your sales, stock, expenses or customers.</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {suggestions.slice(0, 4).map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-white/15 dark:bg-white/5 dark:text-emerald-200">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[85%] ${
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
                <div className="flex items-center gap-2 rounded-2xl border border-[#e6e9e2] bg-[#f7f8f5] px-3.5 py-2 text-[13px] text-[#687064] dark:border-white/10 dark:bg-white/[0.05] dark:text-white/55">
                  <Loader2 size={14} className="animate-spin" /> Looking up your data…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="space-y-1.5 border-t border-[#e6e9e2] p-2.5 dark:border-white/10">
            <AskAttachmentPicker files={files} onChange={setFiles} disabled={loading} />
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                aria-label="Message Ask"
                maxLength={2000}
                className="min-h-10 flex-1 rounded-xl border border-[#d9dfd5] bg-white px-3 text-[13px] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white"
              />
              <button type="submit" disabled={loading || (!input.trim() && !files.length)} aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white disabled:opacity-40 dark:bg-emerald-700">
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}


function AskAvatar({ logoUrl, name, size, logoFailed, onError }: { logoUrl?: string | null; name?: string | null; size: number; logoFailed?: boolean; onError?: () => void }) {
  const letter = (name || 'B').trim().charAt(0).toUpperCase();
  const px = Math.round(size * 2.4);
  if (logoUrl && !logoFailed) {
    return (
      <span className="relative block overflow-hidden rounded-full bg-emerald-800" style={{ width: px, height: px }}>
        <Image src={logoUrl} alt={name || 'Business'} width={px} height={px} unoptimized onError={onError} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="grid place-items-center rounded-full bg-emerald-800 font-bold text-white dark:bg-emerald-700" style={{ width: Math.round(size * 2.4), height: Math.round(size * 2.4), fontSize: Math.max(12, Math.round(size * 0.9)) }}>
      {letter}
    </span>
  );
}
