'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Archive, Bell, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Settings2, Trash2, Undo2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/api';
import { notificationsAPI, notificationEventLabel, notificationEventLabels, type InboxNotification, type InAppPreference, type NotificationEventType, type NotificationLogDetail } from '@/lib/api/notifications';
import { notify } from '@/components/ui/AppToaster';
import { EmptyState } from '@/components/ui/EmptyState';
import { dateLabel } from '@/components/sales/SalesPrimitives';
import { NotificationProviders } from '@/components/notifications/NotificationProviders';

const surface = 'min-w-0 rounded-xl border border-[#d8dfd5] bg-white shadow-sm dark:border-white/10 dark:bg-[#151815]';
const tabs = ['Inbox', 'Preferences', 'Delivery log', 'Providers'] as const;
const deliveryStatusLabel = (status: string, type: string) =>
  type === 'SMS' && status === 'SENT' ? 'PROVIDER ACCEPTED' : status;
type Tab = typeof tabs[number];
function notificationHref(entry: InboxNotification) {
  const id = entry.referenceId;
  const kind = (entry.referenceType || '').toLowerCase();
  if (!id) return null;
  if (kind.includes('invoice') || kind.includes('sale')) return `/dashboard/sales/invoices/${encodeURIComponent(id)}`;
  if (kind.includes('purchase') || kind.includes('order')) return `/dashboard/purchases/orders/${encodeURIComponent(id)}`;
  if (kind.includes('expense')) return `/dashboard/expenses/${encodeURIComponent(id)}`;
  if (kind.includes('product') || kind.includes('stock')) return `/dashboard/products/${encodeURIComponent(id)}`;
  return null;
}

export default function NotificationsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const [tab, setTab] = useState<Tab>('Inbox');
  const [rows, setRows] = useState<InboxNotification[]>([]);
  const [preferences, setPreferences] = useState<InAppPreference[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [preferenceBusy, setPreferenceBusy] = useState('');
  const [logs, setLogs] = useState<Array<{id:string;type:string;eventType:string;status:string;subject:string;createdAt:string;recipientCount:number;sentCount:number;failedCount:number;attemptCount:number}>>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logStatus, setLogStatus] = useState('');
  const [logDetail, setLogDetail] = useState<NotificationLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [providerVersion, setProviderVersion] = useState(0);
  const canManage = permissions.includes('settings.view');
  const canConfigure = permissions.includes('settings.edit');
  const limit = 20;
  const pages = Math.max(1, Math.ceil(total / limit));
  const logPages = Math.max(1, Math.ceil(logTotal / limit));

  const loadInbox = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await notificationsAPI.inbox({ unreadOnly, archivedOnly, search: searchQuery.trim() || undefined, page, limit }); setRows(result.data); setTotal(result.total); setUnreadCount(result.unreadCount); }
    catch (cause) { setRows([]); setError(getApiError(cause, 'Could not load notifications.')); }
    finally { setLoading(false); }
  }, [unreadOnly, archivedOnly, searchQuery, page]);
  const loadPreferences = useCallback(async () => {
    try { setError(''); setPreferences(await notificationsAPI.preferences()); }
    catch (cause) { setError(getApiError(cause, 'Could not load notification preferences.')); }
  }, []);
  const loadLogs = useCallback(async () => {
    if (!canManage) return;
    setLoading(true); setError('');
    try { const result = await notificationsAPI.deliveryLog({ status: logStatus || undefined, page: logPage, limit }); setLogs(result.data); setLogTotal(result.total); }
    catch (cause) { setLogs([]); setError(getApiError(cause, 'Could not load the notification delivery log.')); }
    finally { setLoading(false); }
  }, [canManage, logStatus, logPage]);
  useEffect(() => { if (tab === 'Inbox') void loadInbox(); else if (tab === 'Preferences') void loadPreferences(); else if (tab === 'Delivery log') void loadLogs(); }, [tab, loadInbox, loadPreferences, loadLogs]);

  async function markRead(row: InboxNotification) {
    if (row.isRead) return;
    setBusyId(row.id); setError('');
    try { await notificationsAPI.markRead(row.id); setRows((items) => items.map((item) => item.id === row.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item)); if (!row.isArchived) setUnreadCount((count) => Math.max(0, count - 1)); }
    catch (cause) { setError(getApiError(cause, 'Could not mark this notification as read.')); }
    finally { setBusyId(''); }
  }
  async function markAllRead() {
    setBusyId('all'); setError('');
    try {
      await notificationsAPI.markAllRead();
      setRows((items) => items.map((item) => item.isArchived ? item : { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }));
      setUnreadCount(0);
      notify.success('All inbox notifications marked as read.');
    } catch (cause) { setError(getApiError(cause, 'Could not mark notifications as read.')); }
    finally { setBusyId(''); }
  }
  async function updateArchive(row: InboxNotification, restore = false) {
    setBusyId(row.id); setError('');
    try {
      if (restore) await notificationsAPI.restore(row.id); else await notificationsAPI.archive(row.id);
      await loadInbox();
      notify.success(restore ? 'Notification restored.' : 'Notification archived.');
    } catch (cause) { setError(getApiError(cause, restore ? 'Could not restore this notification.' : 'Could not archive this notification.')); }
    finally { setBusyId(''); }
  }
  async function removeFromInbox(row: InboxNotification) {
    if (!window.confirm('Remove this notification from your inbox? The business delivery record and other users’ inboxes will remain.')) return;
    setBusyId(row.id); setError('');
    try {
      await notificationsAPI.removeFromInbox(row.id);
      await loadInbox();
      notify.success('Notification removed from your inbox.');
    } catch (cause) { setError(getApiError(cause, 'Could not remove this inbox entry.')); }
    finally { setBusyId(''); }
  }
  async function showDeliveryDetail(id: string) {
    setDetailLoading(true); setError('');
    try { setLogDetail(await notificationsAPI.deliveryDetail(id)); }
    catch (cause) { setError(getApiError(cause, 'Could not load notification delivery details.')); }
    finally { setDetailLoading(false); }
  }
  async function changePreference(eventType: NotificationEventType, enabled: boolean) {
    const previous = preferences;
    setPreferenceBusy(eventType); setError('');
    setPreferences((items) => items.map((item) => item.eventType === eventType ? { ...item, inAppEnabled: enabled } : item));
    try { await notificationsAPI.updatePreference(eventType, enabled); notify.success('Notification preference saved.'); }
    catch (cause) { setPreferences(previous); setError(getApiError(cause, 'Could not save notification preference.')); }
    finally { setPreferenceBusy(''); }
  }
  function refresh() { if (tab === 'Inbox') void loadInbox(); else if (tab === 'Preferences') void loadPreferences(); else if (tab === 'Delivery log') void loadLogs(); else setProviderVersion((version) => version + 1); }

  return <main className="mx-auto w-full min-w-0 max-w-5xl p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Workspace</p><h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">Notifications</h1><p className="mt-1 text-sm text-[#667064] dark:text-white/60">Business updates delivered to your account.</p></div><button type="button" onClick={refresh} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#d8dfd5] bg-white px-3 text-sm font-semibold dark:border-white/15 dark:bg-[#151815]"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
    <section className={`${surface} mb-4 p-3`}><div className="flex flex-wrap gap-2" role="tablist" aria-label="Notification sections">{tabs.filter((item) => item !== 'Delivery log' || canManage).filter((item) => item !== 'Providers' || canConfigure).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => { setTab(item); setPage(1); }} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${tab === item ? 'bg-[#f5d788] text-[#5f4300] shadow-sm dark:bg-[#4b3716] dark:text-[#ffdc82]' : 'text-[#526052] hover:bg-amber-50 dark:text-white/70 dark:hover:bg-white/5'}`}>{item}{item === 'Inbox' && unreadCount ? <span className="ml-2 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{unreadCount}</span> : null}</button>)}</div></section>
    {error ? <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}<button type="button" onClick={refresh} className="ml-2 underline">Retry</button></div> : null}
    {tab === 'Inbox' ? <section className={surface}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ece5] px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2"><Bell size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-sm font-bold">Your inbox</h2><span className="text-xs text-[#687368] dark:text-white/55">{unreadCount} unread</span></div>
        <div className="flex flex-wrap items-center gap-3">
          {!archivedOnly && unreadCount > 0 ? <button type="button" disabled={busyId === 'all'} onClick={() => void markAllRead()} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-white/5">{busyId === 'all' ? 'Saving…' : 'Mark all read'}</button> : null}
          <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={archivedOnly} onChange={(event) => { setArchivedOnly(event.target.checked); if (event.target.checked) setUnreadOnly(false); setPage(1); }} className="h-4 w-4 accent-emerald-700"/>Archived</label>
          {!archivedOnly ? <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} className="h-4 w-4 accent-emerald-700"/>Unread only</label> : null}
        </div>
      </div>
      <form className="flex flex-wrap gap-2 border-b border-[#e8ece5] p-3 dark:border-white/10" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearchQuery(search.trim()); }}>
        <label className="flex min-w-[min(100%,18rem)] flex-1 items-center gap-2 rounded-lg border border-[#d8dfd5] px-3 dark:border-white/15"><Search size={15} className="shrink-0 text-[#687368]"/><input aria-label="Search notifications" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
        <button type="submit" className="min-h-10 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Search</button>
      </form>
      <div aria-busy={loading} className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{loading && !rows.length ? <p role="status" className="px-4 py-12 text-center text-sm"><Loader2 size={16} className="mr-2 inline animate-spin"/>Loading notifications…</p> : null}{!loading && !rows.length ? <div className="p-4"><EmptyState compact title={archivedOnly ? 'No archived notifications.' : unreadOnly ? 'You are all caught up.' : searchQuery ? 'No matching notifications.' : 'No notifications yet.'} description="Important sales, payment, stock and purchasing updates will appear here."/></div> : null}{rows.map((row) => { const href = notificationHref(row); return <article key={row.id} className={`flex min-w-0 gap-3 p-4 ${row.isRead ? '' : 'bg-emerald-50/45 dark:bg-emerald-950/10'}`}><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${row.isRead ? 'bg-transparent' : 'bg-emerald-600 dark:bg-emerald-400'}`} aria-label={row.isRead ? 'Read' : 'Unread'}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words text-sm font-bold">{row.subject}</h3><time className="shrink-0 text-[11px] text-[#687368] dark:text-white/55">{dateLabel(row.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#526052] dark:text-white/70">{row.body}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">{notificationEventLabel(row.eventType)}</p><div className="mt-3 flex flex-wrap gap-2">{href ? <Link href={href} onClick={() => void markRead(row)} className="inline-flex min-h-8 items-center rounded-md border border-orange-300 bg-orange-100 px-2.5 text-xs font-semibold text-orange-900 transition-colors hover:bg-orange-200 dark:border-orange-800 dark:bg-orange-950/45 dark:text-orange-200 dark:hover:bg-orange-900/60">Open related record</Link> : null}{!row.isRead ? <button type="button" disabled={busyId === row.id} onClick={() => void markRead(row)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-violet-300 bg-violet-100 px-2.5 text-xs font-semibold text-violet-900 transition-colors hover:bg-violet-200 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/45 dark:text-violet-200 dark:hover:bg-violet-900/60">{busyId === row.id ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}Mark as read</button> : null}{row.isArchived ? <button type="button" disabled={busyId === row.id} onClick={() => void updateArchive(row, true)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-violet-300 bg-violet-100 px-2.5 text-xs font-semibold text-violet-900 transition-colors hover:bg-violet-200 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/45 dark:text-violet-200 dark:hover:bg-violet-900/60"><Undo2 size={13}/>Restore</button> : <button type="button" disabled={busyId === row.id} onClick={() => void updateArchive(row)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-blue-300 bg-blue-100 px-2.5 text-xs font-semibold text-blue-900 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-200 dark:hover:bg-blue-900/60"><Archive size={13}/>Archive</button>}{row.isArchived ? <button type="button" disabled={busyId === row.id} onClick={() => void removeFromInbox(row)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={13}/>Remove from my inbox</button> : null}</div></div></article>; })}</div><Pager page={page} pages={pages} loading={loading} onPage={setPage} label={`${total} notifications`}/></section> : null}
    {tab === 'Preferences' ? <section className={surface}><div className="border-b border-[#e8ece5] px-4 py-4 dark:border-white/10"><div className="flex items-center gap-2"><Settings2 size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-sm font-bold">In-app notification preferences</h2></div><p className="mt-1 text-xs leading-5 text-[#687368] dark:text-white/55">Choose which business events appear in your Mizania inbox. Email and SMS delivery are managed separately by the workspace administrator.</p></div><div className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{preferences.map((item) => <label key={item.eventType} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3"><span className="min-w-0"><span className="block text-sm font-semibold">{notificationEventLabels[item.eventType]}</span><span className="mt-0.5 block text-xs text-[#687368] dark:text-white/55">In-app inbox</span></span><input type="checkbox" checked={item.inAppEnabled} disabled={preferenceBusy === item.eventType} onChange={(event) => void changePreference(item.eventType, event.target.checked)} aria-label={`Enable ${notificationEventLabels[item.eventType]} in-app notifications`} className="h-5 w-5 shrink-0 accent-emerald-700"/></label>)}{!preferences.length ? <p className="p-4 text-sm text-[#687368] dark:text-white/55">Loading preferences…</p> : null}</div></section> : null}
    {tab === 'Delivery log' && canManage ? <section className={surface}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ece5] px-4 py-3 dark:border-white/10"><div><h2 className="text-sm font-bold">Workspace delivery log</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">For SMS, “Provider accepted” means the provider queued the message. Carrier delivery receipts are not connected yet.</p></div><label className="text-xs font-semibold">Status<select className="ml-2 min-h-9 rounded-lg border border-[#d8ddd3] bg-white px-2 text-xs dark:border-white/15 dark:bg-[#111411] dark:text-white" value={logStatus} onChange={(event) => { setLogStatus(event.target.value); setLogPage(1); }}><option value="">All statuses</option>{['PENDING','SENDING','SENT','PARTIALLY_SENT','FAILED'].map((status) => <option key={status}>{status}</option>)}</select></label></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-[#f3f7f3] text-[10px] uppercase dark:bg-[#101210]"><tr>{['Notification','Channel','Status','Recipients','Sent','Failed','Created','Details'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{logs.map((row) => <tr key={row.id}><td className="max-w-64 truncate px-3 py-3" title={row.subject}>{row.subject}<span className="mt-1 block text-[10px] text-[#687368] dark:text-white/50">{notificationEventLabel(row.eventType)}</span></td><td className="px-3 py-3">{row.type}</td><td className="px-3 py-3">{deliveryStatusLabel(row.status, row.type)}</td><td className="px-3 py-3">{row.recipientCount}</td><td className="px-3 py-3">{row.sentCount}</td><td className="px-3 py-3">{row.failedCount}</td><td className="whitespace-nowrap px-3 py-3">{dateLabel(row.createdAt)}</td><td className="px-3 py-3"><button type="button" onClick={() => void showDeliveryDetail(row.id)} className="font-semibold text-emerald-800 underline underline-offset-2 dark:text-emerald-300">Details</button></td></tr>)}{!loading && !logs.length ? <tr><td colSpan={8} className="px-3 py-9 text-center">No notifications match this filter.</td></tr> : null}</tbody></table></div><Pager page={logPage} pages={logPages} loading={loading} onPage={setLogPage} label={`${logTotal} messages`}/></section> : null}
    {tab === 'Providers' && canConfigure ? <section className={surface}><NotificationProviders key={providerVersion}/></section> : null}
    {detailLoading ? <div role="status" className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4"><div className="rounded-xl bg-white p-5 text-sm dark:bg-[#151815]">Loading delivery details…</div></div> : null}
    {logDetail ? <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setLogDetail(null); }}><section role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#d8dfd5] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#151815]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">{logDetail.eventType}</p><h2 id="notification-detail-title" className="mt-1 break-words text-lg font-semibold">{logDetail.subject}</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">{deliveryStatusLabel(logDetail.status, logDetail.type)} · {logDetail.attemptCount} attempts</p></div><button type="button" onClick={() => setLogDetail(null)} className="min-h-9 rounded-lg border border-[#d8dfd5] px-3 text-sm font-semibold dark:border-white/15">Close</button></div><div className="mt-4 space-y-3">{logDetail.recipients.map((recipient, index) => <article key={index} className="rounded-lg border border-[#e5e9e2] p-3 dark:border-white/10"><p className="text-xs font-bold">Recipient {recipient.phoneNumber || ""} · {deliveryStatusLabel(recipient.status, logDetail.type)}</p>{recipient.providerId ? <p className="mt-1 break-all text-xs text-[#526052] dark:text-white/70">Provider message ID: {recipient.providerId}</p> : null}{recipient.failureReason ? <p className="mt-2 break-words text-xs leading-5 text-rose-800 dark:text-rose-200">{recipient.failureReason}</p> : null}</article>)}{logDetail.logs.map((entry, index) => <article key={`${entry.timestamp}-${index}`} className="rounded-lg bg-[#f5f7f3] p-3 dark:bg-white/[0.04]"><p className="flex justify-between gap-3 text-xs font-semibold"><span>{deliveryStatusLabel(entry.status, logDetail.type)}</span><time>{dateLabel(entry.timestamp)}</time></p><p className="mt-2 break-words text-xs leading-5 text-[#526052] dark:text-white/70">{entry.message}</p></article>)}</div><p className="mt-4 text-[11px] leading-5 text-[#687368] dark:text-white/50">Sensitive reset links are hidden here. Never share SMTP credentials or password reset tokens.</p></section></div> : null}
    <p className="mt-3 text-xs leading-5 text-[#687368] dark:text-white/50">External email/SMS delivery depends on the provider configured by an authorized workspace administrator. In-app notifications are scoped to your signed-in account.</p>
  </main>;
}

function Pager({ page, pages, loading, onPage, label }: { page: number; pages: number; loading: boolean; onPage: (page: number) => void; label: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ece5] px-4 py-3 text-xs dark:border-white/10"><span className="text-[#687368] dark:text-white/55">{label}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#d8dfd5] px-2.5 font-semibold disabled:opacity-40 dark:border-white/15"><ChevronLeft size={15}/>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages || loading} onClick={() => onPage(page + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#d8dfd5] px-2.5 font-semibold disabled:opacity-40 dark:border-white/15">Next<ChevronRight size={15}/></button></div></div>;
}
