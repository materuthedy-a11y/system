'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Truck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/api';
import { suppliersAPI, type Supplier, type SupplierFilters } from '@/lib/api/suppliers';
import { money } from '@/components/sales/SalesPrimitives';
import { formatBusinessDate } from '@/lib/format/businessDate';

const field = 'min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm text-[#20231f] outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white';

export default function SuppliersPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canView = permissions.includes('suppliers.view');
  const canCreate = permissions.includes('suppliers.create');
  const [rows, setRows] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [sortBy, setSortBy] = useState<SupplierFilters['sortBy']>('createdAt');
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
      const result = await suppliersAPI.list({ search, status: (status || undefined) as SupplierFilters['status'], paymentTerms: paymentTerms || undefined, sortBy, sortOrder, page, limit });
      if (requestId !== request.current) return;
      setRows(result.data); setTotal(result.total);
      if (result.page !== page) setPage(result.page);
    } catch (cause) { if (requestId === request.current) { setRows([]); setTotal(0); setError(getApiError(cause, 'Could not load suppliers.')); } }
    finally { if (requestId === request.current) setLoading(false); }
  }, [canView, search, status, paymentTerms, sortBy, sortOrder, page]);
  useEffect(() => { void load(); }, [load]);

  if (!canView) return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100"><h1 className="text-lg font-bold">Supplier access required</h1><p className="mt-1">Your account does not have permission to view suppliers in this workspace.</p></section></main>;

  return <main className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Operations</p><h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">Suppliers</h1><p className="mt-1 text-sm text-[#667064] dark:text-white/60">Supplier accounts, purchase history and amounts payable.</p></div>{canCreate ? <Link href="/dashboard/suppliers/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-600"><Plus size={16}/>New supplier</Link> : null}</div>
    <section className="mb-4 grid gap-3 sm:grid-cols-3"><Metric title="Suppliers shown" value={rows.length}/><Metric title="Active on this page" value={rows.filter((row) => row.isActive).length}/><Metric title="Outstanding on this page" value={rows.reduce((sum, row) => sum + row.outstandingBalance, 0)} money/></section>
    <section className="mb-4 rounded-xl border border-[#cde9d9] bg-emerald-50/65 p-4 dark:border-white/10 dark:bg-[#151a16]"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr_auto]"><label className="text-xs font-semibold">Search<input className={`${field} mt-1 block`} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Name, code, email or phone" /></label><label className="text-xs font-semibold">Status<select className={`${field} mt-1 block`} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="OVERDUE">Has outstanding balance</option></select></label><label className="text-xs font-semibold">Payment terms<select className={`${field} mt-1 block`} value={paymentTerms} onChange={(event) => { setPaymentTerms(event.target.value); setPage(1); }}><option value="">All terms</option>{['CASH','NET-7','NET-14','NET-30','NET-45','NET-60'].map((term) => <option key={term}>{term}</option>)}</select></label><label className="text-xs font-semibold">Sort<select className={`${field} mt-1 block`} value={sortBy} onChange={(event) => setSortBy(event.target.value as SupplierFilters['sortBy'])}><option value="createdAt">Newest</option><option value="name">Name</option><option value="outstanding">Outstanding balance</option><option value="lastPurchase">Last purchase</option></select></label><button type="button" onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')} className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm font-semibold dark:border-white/15 dark:bg-[#111411]"><ArrowDownUp size={15}/>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</button></div></section>
    {error ? <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><span>{error}</span><button type="button" onClick={() => void load()} className="rounded-md border border-rose-300 px-3 py-1.5 font-semibold">Retry</button></div> : null}
    <section className="overflow-hidden rounded-xl border border-[#d8dfd5] bg-white shadow-sm dark:border-white/10 dark:bg-[#151815]" aria-busy={loading}>
      <div className="flex items-center justify-between border-b border-[#e8ece5] px-4 py-3 dark:border-white/10"><div className="flex items-center gap-2"><Truck size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-sm font-bold text-[#293229] dark:text-white">Supplier directory</h2></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh suppliers" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#d8dfd5] px-2.5 text-xs font-semibold disabled:opacity-50 dark:border-white/15"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-[#f3f7f3] text-[10px] uppercase tracking-wide text-[#526052] dark:bg-[#101210] dark:text-white/60"><tr>{['Supplier','Phone / email','Payment terms','Last purchase','Outstanding','Credit limit','Status'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">
        {loading && !rows.length ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-[#697266] dark:text-white/60"><Loader2 size={16} className="mr-2 inline animate-spin"/>Loading suppliers…</td></tr> : null}
        {!loading && !error && !rows.length ? <tr><td colSpan={7} className="px-4 py-8"><EmptyState compact title={search || status || paymentTerms ? 'No suppliers match these filters.' : 'No suppliers yet.'} description={canCreate && !total ? 'Add a supplier to track purchase orders, payments and payables.' : 'Try changing your search or filters.'}/></td></tr> : null}
        {rows.map((supplier) => <tr key={supplier.id} className="transition hover:bg-emerald-50/45 dark:hover:bg-emerald-950/15"><td className="px-4 py-3"><Link className="font-semibold text-[#1c3328] underline-offset-2 hover:underline dark:text-emerald-200" href={`/dashboard/suppliers/${supplier.id}`}>{supplier.name}</Link><div className="mt-0.5 text-xs text-[#737d71] dark:text-white/50">{supplier.supplierCode}</div></td><td className="px-4 py-3"><div>{supplier.phone}</div><div className="max-w-56 truncate text-xs text-[#737d71] dark:text-white/50" title={supplier.email}>{supplier.email}</div></td><td className="px-4 py-3 text-xs">{supplier.paymentTerms}</td><td className="whitespace-nowrap px-4 py-3 text-xs">{supplier.lastPurchaseDate ? formatBusinessDate(supplier.lastPurchaseDate) : 'No purchases yet'}</td><td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">TZS {money(supplier.outstandingBalance)}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">TZS {money(supplier.creditLimit)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold ${supplier.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'}`}>{supplier.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td></tr>)}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ece5] px-4 py-3 text-xs dark:border-white/10"><span className="text-[#687368] dark:text-white/55">{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0 suppliers'}</span><div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#d8dfd5] px-2.5 font-semibold disabled:opacity-40 dark:border-white/15"><ChevronLeft size={15}/>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#d8dfd5] px-2.5 font-semibold disabled:opacity-40 dark:border-white/15">Next<ChevronRight size={15}/></button></div></div>
    </section>
  </main>;
}

function Metric({ title, value, money: asMoney = false }: { title: string; value: number; money?: boolean }) {
  return <article className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-950 dark:bg-[#141a16]"><p className="text-xs font-semibold text-[#627064] dark:text-white/55">{title}</p><p className="mt-2 truncate text-lg font-bold tabular-nums text-[#26362b] dark:text-white"><AnimatedNumber value={value} format={(number) => asMoney ? `TZS ${money(number)}` : Math.round(number).toLocaleString()}/></p></article>;
}
