'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Lightbulb,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Copy,
  RefreshCw,
  Send,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { getApiError } from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  supportAPI,
  type FeedbackCategory,
  type FeedbackInboxItem,
  type FeedbackMessage,
  type FeedbackAgent,
  type FeedbackPriority,
  type FeedbackStatus,
  type FeedbackSubmission,
} from '@/lib/api/support';
import { notify } from '@/components/ui/AppToaster';
import { useAuthStore } from '@/store/authStore';
import { formatBusinessDateTime } from '@/lib/format/businessDate';

const statusStyles: Record<FeedbackStatus, string> = {
  OPEN: 'border-emerald-700 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600 dark:text-white',
  IN_PROGRESS: 'border-blue-700 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600 dark:text-white',
  WAITING_ON_USER: 'border-amber-700 bg-amber-500 text-[#332000] dark:border-amber-400 dark:bg-amber-400 dark:text-[#241700]',
  RESOLVED: 'border-emerald-800 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-700 dark:text-white',
  CLOSED: 'border-slate-600 bg-slate-600 text-white dark:border-slate-500 dark:bg-slate-600 dark:text-white',
};

const priorityStyles: Record<FeedbackPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  NORMAL: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  HIGH: 'bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200',
  URGENT: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
};

const categoryLabels: Record<FeedbackCategory, string> = {
  BUG: 'Problem',
  QUESTION: 'Question',
  IDEA: 'Idea',
};

function formatDate(value: string) {
  return formatBusinessDateTime(value);
}

function relativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function HelpFeedbackPage() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const canManageInbox = user?.permissions.includes('settings.edit') ?? false;
  const [category, setCategory] = useState<FeedbackCategory>('BUG');
  const [priority, setPriority] = useState<FeedbackPriority>('NORMAL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [pageContext, setPageContext] = useState('');
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [agents, setAgents] = useState<FeedbackAgent[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | 'ALL'>('ALL');
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [mySubmissions, setMySubmissions] = useState<FeedbackSubmission[]>([]);
  const [inbox, setInbox] = useState<FeedbackInboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const messagesViewport = useRef<HTMLDivElement>(null);
  const stickToLatestMessage = useRef(true);

  const conversations = useMemo(
    () => canManageInbox ? inbox : mySubmissions,
    [canManageInbox, inbox, mySubmissions],
  );
  const filteredConversations = useMemo(() => conversations.filter((item) => {
    const query = listSearch.trim().toLowerCase();
    const matchesSearch = !query || [item.subject, item.message, item.category, ticketNumber(item.id), isInboxItem(item) ? item.submitterName : ''].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'ALL' || item.status === statusFilter) && (priorityFilter === 'ALL' || item.priority === priorityFilter);
  }), [conversations, listSearch, statusFilter, priorityFilter]);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  const loadFeedback = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    if (!quiet) setError('');
    try {
      const [mine, all] = await Promise.all([
        supportAPI.mine(),
        canManageInbox ? supportAPI.inbox() : Promise.resolve(null),
      ]);
      setMySubmissions(mine);
      if (all) setInbox(all);
      if (canManageInbox) {
        try { setAgents(await supportAPI.agents()); }
        catch { setAgents([]); }
      }
      setRefreshError('');
      const available = (all ?? mine).filter((item) =>
        (statusFilter === 'ALL' || item.status === statusFilter)
        && (priorityFilter === 'ALL' || item.priority === priorityFilter),
      );
      const desktopLayout = window.matchMedia('(min-width: 1024px)').matches;
      if (available.length && !selectedId && desktopLayout) {
        setSelectedId(available[0].id);
      } else if (selectedId && !available.some((item) => item.id === selectedId)) {
        setSelectedId(desktopLayout ? available[0]?.id ?? null : null);
      }
      if (!available.length) setSelectedId(null);
    } catch (cause) {
      const message = getApiError(cause, 'Could not load conversations. Please try again.');
      if (quiet) setRefreshError(message);
      else setError(message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [canManageInbox, selectedId, statusFilter, priorityFilter]);

  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoadingThread(true);
    setThreadError('');
    try {
      const result = await supportAPI.messages(id);
      setMessages((current) => sameMessages(current, result) ? current : result);
    } catch (cause) {
      setThreadError(getApiError(cause, 'Could not load this conversation.'));
    } finally {
      if (!quiet) setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadFeedback(true), 20_000);
    return () => window.clearInterval(timer);
  }, [loadFeedback]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    const refresh = async (quiet: boolean) => {
      if (!quiet) setLoadingThread(true);
      setThreadError('');
      try {
        const result = await supportAPI.messages(selectedId);
          if (active) {
            setMessages((current) => sameMessages(current, result) ? current : result);
            setThreadError('');
          }
      } catch (cause) {
        if (active) setThreadError(getApiError(cause, 'Could not load this conversation.'));
      } finally {
        if (active && !quiet) setLoadingThread(false);
      }
    };
    void refresh(false);
    const timer = window.setInterval(() => void refresh(true), 12_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    const viewport = messagesViewport.current;
    if (viewport && stickToLatestMessage.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, selectedId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const created = await supportAPI.submit({
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        pagePath: pageContext.trim() || pathname || undefined,
      });
      setSubject('');
      setMessage('');
      setPageContext('');
      setPriority('NORMAL');
      setNewConversationOpen(false);
      stickToLatestMessage.current = true;
      setSelectedId(created.id);
      void loadFeedback(true);
    } catch (cause) {
      notify.error(getApiError(cause, 'Could not start a conversation. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setReplying(true);
    try {
      const created = await supportAPI.reply(selectedId, reply.trim());
      stickToLatestMessage.current = true;
      setMessages((current) => [...current, created]);
      setReply('');
      void loadFeedback(true);
    } catch (cause) {
      notify.error(getApiError(cause, 'Could not send your reply. Please try again.'));
    } finally {
      setReplying(false);
    }
  }

  async function changeStatus(id: string, value: string) {
    if (!canManageInbox || !isFeedbackStatus(value)) return;
    setUpdatingId(id);
    try {
      const updated = await supportAPI.updateStatus(id, value);
      setInbox((current) => current.map((item) => item.id === id ? updated : item));
      setMySubmissions((current) => current.map((item) => item.id === id ? { ...item, status: updated.status } : item));
      notify.success('Ticket status updated.');
    } catch (cause) {
      notify.error(getApiError(cause, 'Could not update conversation status.'));
    } finally {
      setUpdatingId(null);
    }
  }

  async function changePriority(id: string, value: string) {
    if (!canManageInbox || !isFeedbackPriority(value)) return;
    setUpdatingId(id);
    try {
      const updated = await supportAPI.updatePriority(id, value);
      setInbox((current) => current.map((item) => item.id === id ? updated : item));
      notify.success('Ticket priority updated.');
    } catch (cause) {
      notify.error(getApiError(cause, 'Could not update ticket priority.'));
    } finally {
      setUpdatingId(null);
    }
  }

  async function changeAssignee(id: string, userId: string) {
    if (!canManageInbox) return;
    setUpdatingId(id);
    try {
      const updated = await supportAPI.assign(id, userId || null);
      setInbox((current) => current.map((item) => item.id === id ? updated : item));
      notify.success(userId ? 'Ticket assigned.' : 'Ticket moved to the unassigned queue.');
    } catch (cause) {
      notify.error(getApiError(cause, 'Could not assign this ticket.'));
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyTicketNumber(id: string) {
    try {
      await navigator.clipboard.writeText(ticketNumber(id));
      notify.success('Ticket number copied.');
    } catch {
      notify.error('Could not copy the ticket number.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm shadow-amber-950/[0.03] sm:flex-row sm:items-center sm:justify-between sm:p-7 dark:border-white/[0.06] dark:bg-[#20211f]">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-200/70 text-amber-900 dark:bg-[#352c1a] dark:text-[#f5cc72]"><LifeBuoy size={22} /></span>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c24e00] dark:text-[#ffad66]">Workspace support</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#20211f] dark:text-[#f0f1ed]">Help desk</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#73766f] dark:text-[#afb5ac]">{canManageInbox ? 'Manage help requests from team members in this workspace.' : 'Create a ticket and get a reply from your business administrator. This inbox is private to your workspace.'}</p></div>
        </div>
        <button type="button" onClick={() => setNewConversationOpen(true)} className="feedback-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#343632] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c24e00] dark:bg-[#ffad66] dark:text-white dark:hover:bg-[#ffc28f]"><Plus size={17} />New ticket</button>
      </header>

      {newConversationOpen ? (
        <section className="rounded-3xl border border-[#dfe7bd] bg-white p-5 shadow-sm sm:p-7 dark:border-[#41473f] dark:bg-[#191d19]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c24e00] dark:text-[#ffad66]">New ticket</p><h2 className="mt-1 text-xl font-semibold text-[#20211f] dark:text-[#f0f1ed]">What do you need help with?</h2></div>
            <button type="button" onClick={() => setNewConversationOpen(false)} aria-label="Close new conversation form" className="rounded-xl p-2 text-[#73766f] hover:bg-[#f3f4ef] dark:text-[#e7e9e3] dark:hover:bg-[#262b25]"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-[#32352e] dark:text-[#dce1d7]">Topic
              <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm dark:border-[#3b423a] dark:bg-[#111510] dark:text-[#e7e9e3]">
                <option value="BUG">Report a problem</option><option value="QUESTION">Ask a question</option><option value="IDEA">Share an idea</option>
              </select>
            </label>
            <label className="text-sm font-medium text-[#32352e] dark:text-[#dce1d7]">Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as FeedbackPriority)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm dark:border-[#3b423a] dark:bg-[#111510] dark:text-[#e7e9e3]"><option value="LOW">Low · when convenient</option><option value="NORMAL">Normal · default</option><option value="HIGH">High · work is affected</option><option value="URGENT">Urgent · business is blocked</option></select>
            </label>
            <label className="text-sm font-medium text-[#32352e] dark:text-[#dce1d7]">Subject
              <input required maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A short summary" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm outline-none focus:border-[#c24e00] dark:border-[#3b423a] dark:bg-[#111510] dark:text-[#e7e9e3] dark:focus:border-[#ffad66]" />
            </label>
            <label className="text-sm font-medium text-[#32352e] dark:text-[#dce1d7] lg:col-span-2">Message
              <textarea required maxLength={5000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe the issue or ask your question…" className="mt-1.5 w-full resize-y rounded-xl border border-[#dfe2da] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c24e00] dark:border-[#3b423a] dark:bg-[#111510] dark:text-[#e7e9e3] dark:focus:border-[#ffad66]" />
              <span className="mt-1 block text-right text-xs text-[#858880] dark:text-[#c2c8bd]">{message.length}/5000</span>
            </label>
            <label className="text-sm font-medium text-[#32352e] dark:text-[#dce1d7] lg:col-span-2">Affected page or feature <span className="font-normal text-[#858880]">(optional · current page is attached if left blank)</span>
              <input maxLength={200} value={pageContext} onChange={(event) => setPageContext(event.target.value)} placeholder="e.g. Purchases → New purchase order" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm outline-none focus:border-[#c24e00] dark:border-[#3b423a] dark:bg-[#111510] dark:text-[#e7e9e3] dark:focus:border-[#ffad66]" />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
              <p className="flex items-start gap-2 text-xs leading-5 text-[#73766f] dark:text-[#afb5ac]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#c24e00]" />Never include passwords, access tokens, or payment card details.</p>
              <button type="submit" disabled={submitting} className="feedback-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white transition hover:bg-[#343632] disabled:cursor-wait disabled:opacity-60 dark:bg-[#ffad66] dark:text-white">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{submitting ? 'Starting…' : 'Start conversation'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid h-[min(72dvh,760px)] min-h-[420px] max-h-[760px] overflow-hidden rounded-3xl border border-[#e5e8df] bg-white shadow-sm lg:h-[min(70dvh,820px)] lg:min-h-[620px] lg:grid-cols-[330px_minmax(0,1fr)] dark:border-[#343a32] dark:bg-[#191d19]">
        <aside className={`flex min-h-0 flex-col border-b border-[#eceee8] lg:border-b-0 lg:border-r dark:border-[#343a32] ${selectedId ? 'hidden lg:flex' : ''}`}>
          <div className="flex shrink-0 items-center justify-between border-b border-[#eceee8] px-5 py-4 dark:border-[#343a32]">
            <div><h2 className="font-semibold text-[#20211f] dark:text-[#f0f1ed]">{canManageInbox ? 'Team tickets' : 'Your tickets'}</h2><p className="mt-0.5 text-xs text-[#858880] dark:text-[#c2c8bd]">{filteredConversations.length} of {conversations.length} shown</p></div>
            <button type="button" onClick={() => void loadFeedback()} aria-label="Refresh conversations" disabled={loading} className="rounded-xl p-2 text-[#73766f] transition hover:bg-[#f3f4ef] disabled:opacity-50 dark:text-[#e7e9e3] dark:hover:bg-[#262b25]"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          </div>
          <div className="shrink-0 space-y-2 border-b border-[#eceee8] p-3 dark:border-[#343a32]">
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f84]"/><input value={listSearch} onChange={(event) => setListSearch(event.target.value)} placeholder="Search tickets or ticket no." aria-label="Search tickets" className="min-h-10 w-full rounded-xl border border-[#dfe2da] bg-[#fafbf8] pl-9 pr-3 text-xs outline-none focus:border-[#c24e00] dark:border-[#3b423a] dark:bg-[#111510] dark:text-white"/></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor="ticket-status-filter">Filter tickets by status</label><select id="ticket-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FeedbackStatus | 'ALL')} className="min-h-9 rounded-lg border border-[#dfe2da] bg-white px-2 text-xs dark:border-[#3b423a] dark:bg-[#111510] dark:text-white"><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_ON_USER">Waiting for user</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select>
              <label className="sr-only" htmlFor="ticket-priority-filter">Filter tickets by priority</label><select id="ticket-priority-filter" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as FeedbackPriority | 'ALL')} className="min-h-9 rounded-lg border border-[#dfe2da] bg-white px-2 text-xs dark:border-[#3b423a] dark:bg-[#111510] dark:text-white"><option value="ALL">All priorities</option><option value="URGENT">Urgent</option><option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option></select>
            </div>
          </div>
          {refreshError ? <p role="status" className="border-b border-[#f0dfa9] bg-[#fffaf0] px-5 py-2 text-xs text-[#8d6412] dark:border-[#59451f] dark:bg-[#302817] dark:text-[#f1c66e]">Refresh paused: {refreshError}</p> : null}
          {loading ? <div className="flex h-44 items-center justify-center text-sm text-[#73766f]"><Loader2 size={17} className="mr-2 animate-spin" />Loading conversations…</div> : error ? (
            <div role="alert" className="m-4 rounded-xl border border-[#efd4cf] bg-[#fff8f6] p-4 text-sm text-[#a63832] dark:border-[#663631] dark:bg-[#2b1b19] dark:text-[#ffaaa0]"><div className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div><button type="button" onClick={() => void loadFeedback()} className="mt-3 font-semibold underline">Try again</button></div>
          ) : filteredConversations.length ? (
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredConversations.map((item) => <li key={item.id}>
                <button type="button" onClick={() => { stickToLatestMessage.current = true; setSelectedId(item.id); }} className={`w-full rounded-2xl p-3.5 text-left transition ${selectedId === item.id ? 'bg-[#f1f5dc] ring-1 ring-[#dce7a7] dark:bg-[#252b1a] dark:ring-[#414a24]' : 'hover:bg-[#f7f8f4] dark:hover:bg-[#222622]'}`}>
                  <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><CategoryIcon category={item.category} /><span className="truncate text-sm font-semibold text-[#30342e] dark:text-[#e7e9e3]">{item.subject}</span></div><ChevronRight size={15} className={`mt-0.5 shrink-0 text-[#9a9e95] transition ${selectedId === item.id ? 'translate-x-0.5 text-[#c24e00]' : ''}`} /></div>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs text-[#73766f] dark:text-[#afb5ac]">{canManageInbox && isInboxItem(item) ? `${item.submitterName} · ${item.assignedTo ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}` : 'Unassigned'}` : categoryLabels[item.category]}</span><span className="shrink-0 text-[11px] text-[#858880] dark:text-[#c2c8bd]">{relativeDate(item.updatedAt)}</span></div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5"><StatusBadge status={item.status} /><PriorityBadge priority={item.priority} /><span className="font-mono text-[10px] text-[#858880] dark:text-[#c2c8bd]">{ticketNumber(item.id)}</span></div>
                </button>
              </li>)}
            </ul>
          ) : <div className="px-5 py-8 sm:px-6 sm:py-10"><EmptyState title={conversations.length ? 'No matching tickets' : 'No tickets yet'} description={conversations.length ? 'Try changing your search or filters.' : 'Create a ticket and follow replies here.'} action={!conversations.length ? <button type="button" onClick={() => setNewConversationOpen(true)} className="inline-flex min-h-10 items-center rounded-lg bg-[#20211f] px-4 text-xs font-bold text-white transition hover:bg-[#343632] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffad66] dark:bg-[#ffad66] dark:text-[#20211f]">Create your first ticket</button> : undefined} /></div>}
        </aside>

        <div className={`flex min-h-0 min-w-0 flex-col ${!selectedId ? 'hidden lg:flex' : ''}`}>
          {selected ? <>
            <header className="flex min-w-0 flex-col gap-3 border-b border-[#eceee8] px-4 py-4 sm:px-6 dark:border-[#343a32]">
              <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Back to conversations" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#73766f] transition hover:bg-[#f3f4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c24e00] lg:hidden dark:text-[#e7e9e3] dark:hover:bg-[#262b25] dark:focus-visible:outline-[#ffad66]"><ArrowLeft size={18} /></button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                    <h2 className="min-w-0 flex-[1_1_100%] break-words text-base font-semibold leading-5 text-[#20211f] [overflow-wrap:anywhere] dark:text-[#f0f1ed] sm:flex-initial">{selected.subject}</h2>
                    <StatusBadge status={selected.status} /><PriorityBadge priority={selected.priority} />
                  </div>
                  <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#858880] dark:text-[#c2c8bd]"><span>{categoryLabels[selected.category]} · Started {formatDate(selected.createdAt)}</span><button type="button" onClick={() => void copyTicketNumber(selected.id)} className="inline-flex items-center gap-1 font-mono font-semibold text-[#7b4a00] hover:underline dark:text-[#ffca80]" title="Copy ticket number"><Copy size={12}/>{ticketNumber(selected.id)}</button></p>
                </div>
              </div>
              {canManageInbox ? <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                {isInboxItem(selected) ? <span className="col-span-2 min-w-0 break-words text-xs leading-5 text-[#73766f] dark:text-[#c2c8bd] sm:col-span-1 sm:truncate">{selected.submitterName} · {selected.submitterEmail}</span> : <span className="hidden sm:block" />}
                <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:flex-wrap sm:justify-end">
                  <label className="sr-only" htmlFor="conversation-status">Ticket status</label><select id="conversation-status" value={selected.status} disabled={updatingId === selected.id} onChange={(event) => void changeStatus(selected.id, event.target.value)} className={`min-h-10 min-w-0 w-full rounded-xl border px-2 text-xs font-semibold disabled:opacity-60 sm:w-auto sm:px-2.5 ${statusStyles[selected.status]}`}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_ON_USER">Waiting for user</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select>
                  <label className="sr-only" htmlFor="ticket-priority">Ticket priority</label><select id="ticket-priority" value={selected.priority} disabled={updatingId === selected.id} onChange={(event) => void changePriority(selected.id, event.target.value)} className={`min-h-10 min-w-0 w-full rounded-xl border-0 px-2 text-xs font-semibold disabled:opacity-60 sm:w-auto sm:px-2.5 ${priorityStyles[selected.priority]}`}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
                  <label className="sr-only" htmlFor="ticket-assignee">Assigned agent</label><select id="ticket-assignee" value={selected.assignedToId || ''} disabled={updatingId === selected.id} onChange={(event) => void changeAssignee(selected.id, event.target.value)} className="col-span-2 min-h-10 min-w-0 w-full rounded-xl border border-[#dfe2da] bg-white px-2.5 text-xs font-semibold sm:col-span-1 sm:w-auto sm:max-w-52 dark:border-[#3b423a] dark:bg-[#111510] dark:text-white"><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</option>)}</select>
                </div>
              </div> : null}
            </header>

            <div ref={messagesViewport} onScroll={(event) => {
              const node = event.currentTarget;
              stickToLatestMessage.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
            }} className="min-h-0 flex-1 overflow-y-auto bg-amber-50/80 px-4 py-5 sm:px-7 dark:bg-[#282317]">
              {selected.pagePath ? <div className="mx-auto mb-5 flex max-w-3xl items-start gap-2 rounded-xl border border-[#e8e9e5] bg-white px-3.5 py-3 text-xs text-[#73766f] dark:border-[#343a32] dark:bg-[#191d19] dark:text-[#afb5ac]"><CircleHelp size={15} className="mt-0.5 shrink-0 text-[#c24e00]" /><span><span className="font-semibold">Related page:</span> {selected.pagePath}</span></div> : null}
              {threadError ? <div role="alert" className="mx-auto mb-4 flex max-w-3xl items-start gap-2 rounded-xl border border-[#efd4cf] bg-[#fff8f6] p-3 text-sm text-[#a63832] dark:border-[#663631] dark:bg-[#2b1b19] dark:text-[#ffaaa0]"><AlertCircle size={16} className="mt-0.5 shrink-0" />{threadError}<button type="button" onClick={() => void loadThread(selected.id)} className="ml-auto shrink-0 font-semibold underline">Retry</button></div> : null}
              {loadingThread ? <div className="flex h-40 items-center justify-center text-sm text-[#73766f]"><Loader2 size={17} className="mr-2 animate-spin" />Loading messages…</div> : (
                <div className="mx-auto max-w-3xl space-y-5">
                  {messages.map((item) => {
                    const ownMessage = item.senderType === (canManageInbox ? 'ADMIN' : 'USER');
                    return <article key={item.id} className={`flex items-end gap-2.5 ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                      {!ownMessage ? <Avatar admin={item.senderType === 'ADMIN'} name={item.senderName} /> : null}
                      <div className={`max-w-[min(88%,620px)] ${ownMessage ? 'items-end' : 'items-start'}`}>
                        <div className={`mb-1 flex items-center gap-2 text-[11px] text-[#858880] dark:text-[#c2c8bd] ${ownMessage ? 'justify-end' : ''}`}>
                          <span className="font-semibold text-[#596057] dark:text-[#c2c8bd]">{ownMessage ? 'You' : item.senderType === 'ADMIN' ? 'Business admin' : item.senderName}</span><span>·</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                        </div>
                        <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${ownMessage ? 'rounded-br-md bg-emerald-700 text-white dark:bg-emerald-800 dark:text-white' : 'rounded-bl-md border border-[#e7e9e3] bg-white text-[#43483f] dark:border-[#343a32] dark:bg-[#202520] dark:text-[#e7e9e3]'}`}>{item.body}</div>
                      </div>
                      {ownMessage ? <Avatar admin={canManageInbox} name={user?.name || user?.firstName || 'You'} /> : null}
                    </article>;
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleReply} className="border-t border-[#eceee8] bg-white p-4 sm:px-6 sm:py-5 dark:border-[#343a32] dark:bg-[#191d19]">
              <label htmlFor="reply-message" className="sr-only">Write a reply</label>
              <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#dfe2da] bg-[#fafbf8] p-2 focus-within:border-[#9eb22d] focus-within:ring-2 focus-within:ring-[#ffad66]/25 dark:border-[#3b423a] dark:bg-[#111510] dark:focus-within:border-[#c24e00]">
                <textarea id="reply-message" rows={2} maxLength={5000} required value={reply} onChange={(event) => setReply(event.target.value)} placeholder={selected.status === 'RESOLVED' ? 'Reply to reopen this conversation…' : 'Write a message…'} className="max-h-36 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-[#30342e] outline-none placeholder:text-[#9a9e95] dark:text-[#e7e9e3]" />
                <button type="submit" disabled={replying || !reply.trim()} aria-label="Send reply" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition disabled:cursor-not-allowed ${replying || !reply.trim() ? 'bg-[#263326] text-white opacity-40 dark:bg-[#303630] dark:text-[#afb5ac]' : 'bg-[#ffad66] text-[#20211f] hover:bg-[#ffc28f] dark:bg-[#ffad66] dark:text-[#20211f] dark:hover:bg-[#ffc28f]'}`}><Send size={17} /></button>
              </div>
              <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-2 px-1"><p className="flex items-center gap-1.5 text-[11px] text-[#8a8f84] dark:text-[#c2c8bd]"><Clock3 size={12} />Messages refresh automatically</p><span className="text-[11px] text-[#9a9e95] dark:text-[#c2c8bd]">{reply.length}/5000</span></div>
            </form>
          </> : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#f1f5dc] text-[#c24e00] dark:bg-[#252b1a] dark:text-[#ffad66]"><MessageCircle size={27} /></span>
              <h2 className="mt-5 text-lg font-semibold text-[#30342e] dark:text-[#e7e9e3]">{loading ? 'Loading your inbox…' : 'Your support conversations'}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#73766f] dark:text-[#afb5ac]">{loading ? 'Please wait while we fetch your messages.' : 'Choose a conversation on the left, or start a new one. Admin replies will appear right here.'}</p>
              {!loading && !conversations.length ? <button type="button" onClick={() => setNewConversationOpen(true)} className="feedback-primary mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white dark:bg-[#ffad66] dark:text-white"><Plus size={16} />Start a conversation</button> : null}
            </div>
          )}
        </div>
      </section>

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-[#858880] dark:text-[#c2c8bd]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#c24e00] dark:text-[#ffad66]" />Conversations are visible only to you and authorized administrators in your business. Never send passwords or access tokens.</p>
    </div>
  );
}

function isFeedbackStatus(value: string): value is FeedbackStatus {
  return ['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'].includes(value);
}

function isFeedbackPriority(value: string): value is FeedbackPriority {
  return value === 'LOW' || value === 'NORMAL' || value === 'HIGH' || value === 'URGENT';
}

function ticketNumber(id: string) {
  return `HD-${id.slice(-10).toUpperCase()}`;
}

function isInboxItem(item: FeedbackSubmission | FeedbackInboxItem): item is FeedbackInboxItem {
  return 'submitterName' in item && typeof item.submitterName === 'string';
}

function sameMessages(current: FeedbackMessage[], incoming: FeedbackMessage[]) {
  return current.length === incoming.length
    && current.every((message, index) => message.id === incoming[index].id);
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const labels: Record<FeedbackStatus, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', WAITING_ON_USER: 'Waiting for user', RESOLVED: 'Resolved', CLOSED: 'Closed' };
  const label = labels[status];
  const Icon = status === 'RESOLVED' || status === 'CLOSED' ? Check : status === 'OPEN' ? Clock3 : MessageCircle;
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${statusStyles[status]}`}><Icon size={11} />{label}</span>;
}

function PriorityBadge({ priority }: { priority: FeedbackPriority }) {
  const label = priority === 'URGENT' ? 'Urgent' : priority === 'HIGH' ? 'High' : priority === 'LOW' ? 'Low' : 'Normal';
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold ${priorityStyles[priority]}`}>{label}</span>;
}

function CategoryIcon({ category }: { category: FeedbackCategory }) {
  const Icon = category === 'BUG' ? Wrench : category === 'QUESTION' ? CircleHelp : Lightbulb;
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f1f5dc] text-[#c24e00] dark:bg-[#3b2818] dark:text-[#ffad66]"><Icon size={15} /></span>;
}

function Avatar({ admin, name }: { admin: boolean; name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
  return <span aria-hidden="true" className={`mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[10px] font-bold ${admin ? 'bg-[#fff0e3] text-[#693100] dark:bg-[#3b2818] dark:text-[#ffad66]' : 'bg-[#e9ece5] text-[#5b6255] dark:bg-[#303630] dark:text-[#dce1d7]'}`}>{initials}</span>;
}
