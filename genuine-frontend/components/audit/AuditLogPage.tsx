'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Download, FileClock, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { auditAPI, type AuditEvent, type AuditFilters } from '@/lib/api/audit';
import { getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const panel = 'rounded-2xl border border-[#e1e6dd] bg-white dark:border-white/10 dark:bg-[#191c19]';
const field = 'min-h-10 rounded-xl border border-[#d9dfd5] bg-white px-3 text-sm text-[#252a24] outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white dark:focus:border-emerald-400';
const actionTone = (action: string) => /DELETE|CANCEL|REJECT|VOID|DEACTIVATE/i.test(action) ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : /LOGIN|LOGOUT|PASSWORD/i.test(action) ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200';
const display = (value: unknown) => value == null ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const humanKey = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
function auditObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null; } catch { return null; }
}
const auditValue = (value: unknown) => value == null ? 'Not set' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'object' ? JSON.stringify(value) : String(value);
function AuditChangeView({ before, after }: { before: unknown; after: unknown }) {
  const [showRaw, setShowRaw] = useState(false);
  const oldValues = auditObject(before); const newValues = auditObject(after);
  if (!oldValues && !newValues) return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] dark:bg-black/20">{display(before ?? after)}</pre>;
  const keys = [...new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})])];
  const changed = keys.filter((key) => JSON.stringify(oldValues?.[key] ?? null) !== JSON.stringify(newValues?.[key] ?? null));
  return <div className="space-y-3 sm:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#465342] dark:text-white/75">{changed.length ? `${changed.length} changed ${changed.length === 1 ? 'field' : 'fields'}` : 'Recorded details'}</p><button type="button" onClick={() => setShowRaw((value) => !value)} className="min-h-8 rounded-lg border border-[#d9dfd5] px-2.5 text-[11px] font-semibold text-[#485344] hover:bg-white dark:border-white/15 dark:text-white/75 dark:hover:bg-white/10">{showRaw ? 'Hide raw data' : 'View raw data'}</button></div>
    {!showRaw ? <div className="overflow-hidden rounded-xl border border-[#e2e7df] dark:border-white/10"><div className="grid grid-cols-[minmax(90px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] bg-[#eef2ec] px-3 py-2 text-[11px] font-bold text-[#53604f] dark:bg-white/[0.06] dark:text-white/70"><span>Field</span><span>Before</span><span>After</span></div>{(changed.length ? changed : keys).map((key) => { const isChanged = changed.includes(key); return <div key={key} className={`grid grid-cols-[minmax(90px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-[#e8ece6] px-3 py-2.5 text-xs dark:border-white/[0.08] ${isChanged ? 'bg-white dark:bg-black/10' : ''}`}><span className="font-semibold text-[#384235] dark:text-white/80">{humanKey(key)}</span><span className={`break-words ${isChanged ? 'text-rose-800 dark:text-rose-200' : 'text-[#667064] dark:text-white/60'}`}>{auditValue(oldValues?.[key])}</span><span className={`break-words ${isChanged ? 'text-emerald-800 dark:text-emerald-200' : 'text-[#667064] dark:text-white/60'}`}>{auditValue(newValues?.[key])}</span></div>; })}</div> : <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 font-bold text-[#4d594a] dark:text-white/75">Before · raw</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] dark:bg-black/20">{display(before)}</pre></div><div><p className="mb-1 font-bold text-[#4d594a] dark:text-white/75">After · raw</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] dark:bg-black/20">{display(after)}</pre></div></div>}
  </div>;
}

export default function AuditLogPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canView = permissions.includes('audit.view');
  const canExport = permissions.includes('audit.export');
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState({ q: '', action: '', entityType: '', dateFrom: '', dateTo: '' });
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 25 });

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true); setError('');
    try {
      const result = await auditAPI.list({ ...filters, page, limit: 25 });
      setRows(result.data); setTotal(result.total); setTotalPages(result.totalPages);
    } catch (cause) { setError(getApiError(cause, 'Could not load the audit log.')); }
    finally { setLoading(false); }
  }, [canView, filters, page]);

  useEffect(() => { void load(); }, [load]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters({ q: draft.q.trim() || undefined, action: draft.action.trim() || undefined, entityType: draft.entityType.trim() || undefined, dateFrom: draft.dateFrom || undefined, dateTo: draft.dateTo || undefined });
  }

  async function exportCsv() {
    if (!canExport) return;
    setExporting(true); setError('');
    try {
      const response = await auditAPI.export(filters);
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'mizania-audit-log.csv'; anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) { setError(getApiError(cause, 'Could not export audit records.')); }
    finally { setExporting(false); }
  }

  if (!canView) return <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 text-sm text-[#30342e] dark:border-amber-900/50 dark:bg-[#191c19] dark:text-white"><h1 className="text-xl font-bold">Audit access required</h1><p className="mt-2 text-[#687064] dark:text-white/65">Your account does not have permission to view this business audit trail.</p></main>;

  return <main className="mx-auto w-full max-w-7xl space-y-5 px-1 pb-12">
    <header className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 dark:border-emerald-900/40 dark:bg-[#17231b] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-300">Security · Business history</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-[#20231f] dark:text-white sm:text-3xl">Audit log</h1><p className="mt-1 max-w-3xl text-sm text-[#606b5f] dark:text-white/65">Trace recorded business changes and security actions by user and time. Passwords, tokens and credential fields are hidden.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300 px-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button>{canExport ? <button type="button" onClick={() => void exportCsv()} disabled={exporting} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700"><Download size={15}/>{exporting ? 'Exporting…' : 'Export CSV'}</button> : null}</div></div>
    </header>

    <section className={`${panel} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-sm font-bold">Find an event</h2></div>
      <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="relative sm:col-span-2 xl:col-span-2"><span className="sr-only">Search events</span><Search size={15} className="absolute left-3 top-3 text-[#748071]"/><input value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} className={`${field} w-full pl-9`} placeholder="Search actor, action, record or notes"/></label>
        <label><span className="sr-only">Action</span><input value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} className={`${field} w-full`} placeholder="Action (e.g. UPDATE)"/></label>
        <label><span className="sr-only">Record type</span><input value={draft.entityType} onChange={(event) => setDraft({ ...draft, entityType: event.target.value })} className={`${field} w-full`} placeholder="Record type"/></label>
        <label><span className="sr-only">From date</span><input type="date" value={draft.dateFrom} onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })} className={`${field} w-full`} aria-label="From date"/></label>
        <label><span className="sr-only">To date</span><input type="date" value={draft.dateTo} onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })} className={`${field} w-full`} aria-label="To date"/></label>
        <div className="flex justify-end sm:col-span-2 xl:col-span-6"><button className="min-h-10 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white hover:bg-[#405641] dark:bg-emerald-900">Apply filters</button></div>
      </form>
    </section>

    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
    <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7ebe4] px-4 py-3 dark:border-white/10"><div className="flex items-center gap-2"><FileClock size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-sm font-bold">Recorded events</h2></div><p className="text-xs text-[#687064] dark:text-white/55">{loading ? 'Loading…' : `${total.toLocaleString()} events`}</p></div>
      {loading && rows.length === 0 ? <p className="p-8 text-center text-sm text-[#687064] dark:text-white/60">Loading audit history…</p> : rows.length === 0 ? <div className="p-10 text-center"><FileClock className="mx-auto text-[#879184]" size={28}/><p className="mt-3 text-sm font-semibold">No audit events match these filters.</p><p className="mt-1 text-xs text-[#687064] dark:text-white/55">Events are recorded when users perform tracked business actions.</p></div> : <div className="divide-y divide-[#e7ebe4] dark:divide-white/10">{rows.map((row) => <article key={row.id} className="px-4 py-3 sm:px-5"><button type="button" onClick={() => setExpanded(expanded === row.id ? null : row.id)} aria-expanded={expanded === row.id} className="flex w-full min-w-0 flex-wrap items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><span className={`mt-0.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide ${actionTone(row.action)}`}>{row.action.replace(/_/g, ' ')}</span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-[#252a24] dark:text-white">{row.description || `${row.entityType} · ${row.entityId}`}</span><span className="mt-1 block break-all text-xs text-[#687064] dark:text-white/55">{row.actor?.name || 'Unknown user'}{row.actor?.email ? ` · ${row.actor.email}` : ''} · {row.entityType} · {row.entityId}</span></span><time className="shrink-0 text-xs text-[#687064] dark:text-white/55" dateTime={row.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.createdAt))}</time><span className="ml-1 text-xs text-emerald-800 dark:text-emerald-300">{expanded === row.id ? 'Hide details' : 'Details →'}</span></button>
        {expanded === row.id ? <div className="mt-3 grid gap-3 rounded-xl bg-[#f6f8f4] p-3 text-xs dark:bg-white/[0.035]"><AuditChangeView before={row.beforeData} after={row.afterData}/><div className="text-[#687064] dark:text-white/55">{row.ipAddress ? `IP ${row.ipAddress}` : 'IP not recorded'}{row.userAgent ? ` · ${row.userAgent}` : ''}</div></div> : null}
      </article>)}</div>}
      <div className="flex items-center justify-between border-t border-[#e7ebe4] px-4 py-3 text-xs dark:border-white/10"><span>Page {Math.max(1, page)} of {Math.max(1, totalPages)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="min-h-9 rounded-lg border border-[#d9dfd5] px-3 disabled:opacity-40 dark:border-white/10">Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="min-h-9 rounded-lg border border-[#d9dfd5] px-3 disabled:opacity-40 dark:border-white/10">Next</button></div></div>
    </section>
  </main>;
}
