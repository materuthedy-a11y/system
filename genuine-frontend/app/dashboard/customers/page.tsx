'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Loader2, Plus, UsersRound } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/api';
import { customersAPI, type Customer, type CustomerFilters, type CustomerStatus, type CustomerType } from '@/lib/api/customers';
import { CustomerAvatar } from '@/components/customers/CustomerPhoto';
import { money } from '@/components/sales/SalesPrimitives';

const input = 'min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm text-[#20231f] outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white';
const statusClass: Record<CustomerStatus, string> = {
  ACTIVE: 'bg-emerald-600 text-white', SUSPENDED: 'bg-amber-400 text-amber-950',
  BLACKLISTED: 'bg-rose-600 text-white', ARCHIVED: 'bg-slate-600 text-white',
};

export default function CustomersPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canView = permissions.includes('customers.view');
  const canCreate = permissions.includes('customers.create');
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [sortBy, setSortBy] = useState<CustomerFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const limit = 20;
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [searchDraft]);
  const load = useCallback(async () => {
    const requestId = ++request.current;
    if (!canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = await customersAPI.list({ search, status: (status || undefined) as CustomerFilters['status'], customerType: (customerType || undefined) as CustomerType | undefined, sortBy, sortOrder, page, limit });
      if (requestId !== request.current) return;
      setRows(result.data); setTotal(result.total);
      if (result.page !== page) setPage(result.page);
    } catch (cause) { if (requestId === request.current) { setRows([]); setTotal(0); setError(getApiError(cause, 'Could not load customers.')); } }
    finally { if (requestId === request.current) setLoading(false); }
  }, [canView, search, status, customerType, sortBy, sortOrder, page]);
  useEffect(() => { void load(); }, [load]);

  if (!canView) return <div className="mx-auto w-full max-w-7xl p-4 sm:p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100"><h1 className="text-lg font-bold">Customer access required</h1><p className="mt-1">Your account does not have permission to view customers in this workspace.</p></section></div>;

  return <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Operations</p><h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">Customers</h1><p className="mt-1 text-sm text-[#667064] dark:text-white/60">Customer records, credit position and account history.</p></div>{canCreate ? <Link href="/dashboard/customers/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-600"><Plus size={16} />New customer</Link> : null}</div>
    <section className="mb-4 grid gap-3 sm:grid-cols-3"><Metric title="Customers shown" value={String(rows.length)} tone="mint"/><Metric title="Active accounts" value={String(rows.filter((row) => row.status === 'ACTIVE').length)} tone="blue"/><Metric title="Outstanding on this page" value={`TZS ${money(rows.reduce((sum, row) => sum + row.outstandingBalance, 0))}`} tone="gold"/></section>
    <section className="mb-4 rounded-xl border border-[#dce8df] bg-emerald-50/65 p-4 dark:border-white/10 dark:bg-[#151a16]"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr_auto]">
      <label className="text-xs font-semibold text-[#4a554a] dark:text-white/70">Search<input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Name, code, email or phone" className={`${input} mt-1.5`} /></label>
      <label className="text-xs font-semibold text-[#4a554a] dark:text-white/70">Status<select className={`${input} mt-1.5`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="BLACKLISTED">Blacklisted</option><option value="ARCHIVED">Archived</option><option value="OVERDUE">Has outstanding balance</option></select></label>
      <label className="text-xs font-semibold text-[#4a554a] dark:text-white/70">Type<select className={`${input} mt-1.5`} value={customerType} onChange={(e) => { setCustomerType(e.target.value); setPage(1); }}><option value="">All types</option><option value="RETAIL">Retail</option><option value="WHOLESALE">Wholesale</option><option value="CORPORATE">Corporate</option><option value="DISTRIBUTOR">Distributor</option></select></label>
      <label className="text-xs font-semibold text-[#4a554a] dark:text-white/70">Sort<select className={`${input} mt-1.5`} value={sortBy} onChange={(e) => setSortBy(e.target.value as CustomerFilters['sortBy'])}><option value="createdAt">Newest</option><option value="name">Name</option><option value="outstanding">Outstanding balance</option><option value="lastSale">Last sale</option></select></label>
      <button type="button" onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`} className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#d5ddce] bg-white px-3 text-sm font-semibold text-[#394439] hover:bg-[#f5f8f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-white/15 dark:bg-[#111411] dark:text-white/80"><ArrowDownUp size={15}/>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</button>
    </div></section>
    {error ? <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><span>{error}</span><button onClick={() => void load()} className="rounded-md border border-rose-300 px-3 py-1.5 font-semibold">Retry</button></div> : null}
    <section className="overflow-hidden rounded-xl border border-[#d8dfd5] bg-white shadow-sm dark:border-white/10 dark:bg-[#151815]" aria-busy={loading}>
      <div className="flex items-center justify-between border-b border-[#e8ece5] px-4 py-3 dark:border-white/10"><div className="flex items-center gap-2"><UsersRound size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-sm font-bold text-[#293229] dark:text-white">Customer directory</h2></div><span className="text-xs text-[#697266] dark:text-white/55">{total} total</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#f3f7f3] text-[10px] uppercase tracking-wide text-[#526052] dark:bg-[#101210] dark:text-white/60"><tr>{['Customer','Type','Phone / email','Last sale','Outstanding','Credit limit','Status'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">
        {loading && !rows.length ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-[#697266] dark:text-white/60"><span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin"/>Loading customers…</span></td></tr> : null}
        {!loading && !error && !rows.length ? <tr><td colSpan={7} className="px-4 py-8"><EmptyState compact title={search || status || customerType ? 'No customers match these filters.' : 'No customers yet.'} description={canCreate && !total ? 'Create a customer to start tracking sales and account balances.' : 'Try a different search or filter.'} /></td></tr> : null}
        {rows.map((row) => <tr key={row.id} className="transition hover:bg-emerald-50/45 dark:hover:bg-emerald-950/15"><td className="px-4 py-3"><div className="flex items-center gap-3"><CustomerAvatar customerId={row.id} photoId={row.photoId} className="h-10 w-10"/><div className="min-w-0"><Link href={`/dashboard/customers/${row.id}`} className="font-semibold text-[#1c3328] underline-offset-2 hover:underline dark:text-emerald-200">{row.name}</Link><div className="mt-0.5 text-xs text-[#737d71] dark:text-white/50">{row.customerCode}</div></div></div></td><td className="px-4 py-3 text-xs text-[#515d50] dark:text-white/70">{row.customerType}</td><td className="px-4 py-3"><div>{row.phone}</div><div className="max-w-52 truncate text-xs text-[#737d71] dark:text-white/50">{row.email}</div></td><td className="whitespace-nowrap px-4 py-3 text-xs text-[#515d50] dark:text-white/70">{row.lastSaleDate ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(row.lastSaleDate)) : 'No sales yet'}</td><td className="px-4 py-3 font-semibold tabular-nums">TZS {money(row.outstandingBalance)}</td><td className="px-4 py-3 tabular-nums">TZS {money(row.creditLimit)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold ${statusClass[row.status]}`}>{row.status}</span></td></tr>)}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ece5] px-4 py-3 text-xs dark:border-white/10"><span className="text-[#687368] dark:text-white/55">{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0 customers'}</span><div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#d8dfd5] px-2.5 font-semibold disabled:opacity-40 dark:border-white/15"><ChevronLeft size={15}/>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#d8dfd5] px-2.5 font-semibold disabled:opacity-40 dark:border-white/15">Next<ChevronRight size={15}/></button></div></div>
    </section>
  </div>;
}

function Metric({ title, value, tone }: { title: string; value: string; tone: 'mint' | 'blue' | 'gold' }) {
  const colors = { mint: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-950 dark:bg-[#141a16]', blue: 'border-blue-200 bg-blue-50/75 dark:border-blue-950 dark:bg-[#14171d]', gold: 'border-amber-200 bg-amber-50/80 dark:border-amber-950 dark:bg-[#191710]' };
  return <article className={`rounded-xl border p-4 ${colors[tone]}`}><p className="text-xs font-semibold text-[#627064] dark:text-white/55">{title}</p><p className="mt-2 truncate text-lg font-bold text-[#26362b] dark:text-white">{value}</p></article>;
}
