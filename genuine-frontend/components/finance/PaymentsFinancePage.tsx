'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Loader2, Plus, RefreshCw, Wallet } from 'lucide-react';
import { financeAPI, type AccountingPeriod, type FinancePayment, type PaymentFilters, type PaymentSourceType } from '@/lib/api/finance';
import { getApiError } from '@/lib/api';
import { workspaceAPI, type WorkspaceLocation } from '@/lib/api/workspace';
import { useAuthStore } from '@/store/authStore';
import { notify } from '@/components/ui/AppToaster';
import { formatBusinessDate } from '@/lib/format/businessDate';

const panel = 'rounded-2xl border border-[#e4e7df] bg-white p-4 shadow-sm sm:p-5 dark:border-white/[0.08] dark:bg-[#171a17]';
const field = 'min-h-10 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm text-[#30342e] outline-none transition focus:border-[#8c741e] focus:ring-2 focus:ring-[#d9bf55]/25 dark:border-white/10 dark:bg-[#111310] dark:text-white';
const statuses = ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED', 'VOIDED'];
const sourceLabels: Record<PaymentSourceType, string> = { SALES_INVOICE: 'Sales invoice', PURCHASE_ORDER: 'Purchase order', EXPENSE: 'Expense', OTHER: 'Other' };
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

function PaymentRow({ payment, currency }: { payment: FinancePayment; currency: string }) {
  const href = `/dashboard/finance/payments/${payment.id}`;
  const contents = <>
    <div className="min-w-0 flex-1">
      <p className="break-all text-sm font-bold text-[#2c302a] dark:text-white">{payment.paymentNumber}</p>
      <p className="mt-1 truncate text-xs text-[#687064] dark:text-[#b3bbb0]">{payment.counterpartyName || payment.sourceReference || 'Unlinked payment'} · {sourceLabels[payment.sourceType] || 'Other'}</p>
      <p className="mt-1 truncate text-[11px] text-[#7b8176] dark:text-[#aeb6aa]">{payment.locationName || 'Location not recorded'} · {payment.paymentMethodName} · {formatBusinessDate(payment.paymentDate)}</p>
      {payment.reference || payment.referenceNumber || payment.transactionId ? <p className="mt-1 break-all text-[11px] text-[#7b8176] dark:text-[#aeb6aa]">Reference: {payment.reference || payment.referenceNumber || payment.transactionId}</p> : null}
    </div>
    <div className="shrink-0 text-right">
      <p className="text-sm font-bold text-[#292d27] dark:text-white">{money(Number(payment.amount), currency)}</p>
      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${payment.status === 'VOIDED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200' : payment.isReconciled || payment.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'}`}>{payment.status.replace(/_/g, ' ')}</span>
    </div>
  </>;
  return href
    ? <Link href={href} className="flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 outline-none transition hover:bg-emerald-50/60 focus-visible:ring-2 focus-visible:ring-emerald-700 dark:hover:bg-white/[0.03] dark:focus-visible:ring-emerald-400">{contents}<span className="mt-1 text-xs text-emerald-800 dark:text-emerald-300" aria-hidden="true">→</span></Link>
    : <div className="flex min-w-0 items-start gap-3 px-2 py-3">{contents}</div>;
}

export default function PaymentsFinancePage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'periods' ? 'periods' : 'payments';
  const canViewPayments = permissions.includes('payments.view');
  const canViewSettings = permissions.includes('settings.view');
  const canEditSettings = permissions.includes('settings.edit');
  const [currency, setCurrency] = useState('TZS');
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [methods, setMethods] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const [locations, setLocations] = useState<WorkspaceLocation[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PaymentFilters>(() => ({
    page: 1,
    limit: 20,
    expenseId: searchParams.get('expenseId') || undefined,
    purchaseOrderId: searchParams.get('purchaseOrderId') || undefined,
    invoiceId: searchParams.get('invoiceId') || undefined,
  }));
  const [periodDialog, setPeriodDialog] = useState(false);
  const [periodDraft, setPeriodDraft] = useState({ periodName: '', startDate: '', endDate: '' });
  const [closing, setClosing] = useState<AccountingPeriod | null>(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [busyPeriod, setBusyPeriod] = useState('');

  const loadPayments = useCallback(async () => {
    if (!canViewPayments) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = await financeAPI.payments({ ...filters, page, limit: 20 });
      setPayments(result.data || []); setPaymentTotal(result.total || 0);
    } catch (cause) { setError(getApiError(cause, 'Could not load payment records.')); }
    finally { setLoading(false); }
  }, [canViewPayments, filters, page]);

  const loadPeriods = useCallback(async () => {
    if (!canViewSettings) return;
    setLoading(true); setError('');
    try { setPeriods(await financeAPI.periods()); }
    catch (cause) { setError(getApiError(cause, 'Could not load accounting periods.')); }
    finally { setLoading(false); }
  }, [canViewSettings]);

  useEffect(() => { if (activeTab === 'payments') void loadPayments(); else void loadPeriods(); }, [activeTab, loadPayments, loadPeriods]);
  useEffect(() => {
    let active = true;
    if (canViewPayments) financeAPI.payments({ page: 1, limit: 1 }).then(async () => {
      const [financeOptions, locationsResult] = await Promise.allSettled([
        financeAPI.options(), workspaceAPI.locations(),
      ]);
      if (!active) return;
      if (financeOptions.status === 'fulfilled') {
        setCurrency(financeOptions.value.currency || 'TZS');
        setMethods(financeOptions.value.paymentMethods.filter((item) => item.isActive));
      }
      if (locationsResult.status === 'fulfilled') setLocations(locationsResult.value);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [canViewPayments]);

  const totalVisible = useMemo(() => payments.filter((payment) => payment.status !== 'VOIDED').reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [payments]);
  const locationScope = locations.find((location) => location.id === filters.locationId)?.name || 'All locations';
  function updateFilter<K extends keyof PaymentFilters>(key: K, value: PaymentFilters[K] | '') {
    setPage(1); setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  }
  async function createPeriod(event: React.FormEvent) {
    event.preventDefault();
    if (!periodDraft.periodName.trim() || !periodDraft.startDate || !periodDraft.endDate || periodDraft.startDate >= periodDraft.endDate) {
      setError('Enter a period name and a valid date range. The end date must be after the start date.'); return;
    }
    setSaving(true); setError('');
    try { await financeAPI.createPeriod(periodDraft); notify.success('Accounting period created.'); setPeriodDialog(false); setPeriodDraft({ periodName: '', startDate: '', endDate: '' }); await loadPeriods(); }
    catch (cause) { const message = getApiError(cause, 'Could not create the accounting period.'); setError(message); notify.error(message); }
    finally { setSaving(false); }
  }
  async function transitionPeriod(period: AccountingPeriod, action: 'lock' | 'close') {
    setBusyPeriod(period.id); setError('');
    try {
      if (action === 'lock') await financeAPI.lockPeriod(period.id);
      else await financeAPI.closePeriod(period.id, closingNotes.trim() || undefined);
      notify.success(action === 'lock' ? 'Accounting period locked.' : 'Accounting period closed.');
      setClosing(null); setClosingNotes(''); await loadPeriods();
    } catch (cause) { const message = getApiError(cause, 'Could not update the accounting period.'); setError(message); notify.error(message); }
    finally { setBusyPeriod(''); }
  }

  const tabLink = (tab: 'payments' | 'periods') => `/dashboard/finance${tab === 'periods' ? '?tab=periods' : ''}`;
  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <section className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/40 dark:bg-[#282317] sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a6214] dark:text-[#e1c75b]">Finance</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight text-[#20231f] dark:text-white sm:text-3xl">Payments &amp; Finance</h1><p className="mt-1 text-sm text-[#626b51] dark:text-[#c1bda9]">Follow recorded payments and protect accounting periods across your business.</p></div><Link href="/dashboard/reports?tab=finance" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 px-3 text-sm font-semibold text-[#715900] hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30">Open financial reports <span aria-hidden="true">→</span></Link></div>
    </section>
    <nav aria-label="Finance sections" className="flex flex-wrap gap-2">
      <Link href={tabLink('payments')} aria-current={activeTab === 'payments' ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${activeTab === 'payments' ? 'bg-[#20211f] text-white dark:bg-emerald-900' : 'border border-[#dfe2da] bg-white text-[#454a42] dark:border-white/10 dark:bg-[#171a17] dark:text-white'}`}><Wallet size={16}/>Payment ledger</Link>
      {canViewSettings ? <Link href={tabLink('periods')} aria-current={activeTab === 'periods' ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${activeTab === 'periods' ? 'bg-[#20211f] text-white dark:bg-emerald-900' : 'border border-[#dfe2da] bg-white text-[#454a42] dark:border-white/10 dark:bg-[#171a17] dark:text-white'}`}><CalendarDays size={16}/>Accounting periods</Link> : null}
    </nav>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">{error}</div> : null}

    {activeTab === 'payments' ? <>
      {!canViewPayments ? <section className={panel}><h2 className="font-semibold text-[#2c302a] dark:text-white">Payment access required</h2><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Your account does not have permission to view payment records.</p></section> : <>
        <section className="grid gap-3 sm:grid-cols-2">
          <article className={panel}><p className="text-xs font-semibold text-[#687064] dark:text-[#b3bbb0]">Payments on this page</p><p className="mt-2 text-2xl font-bold text-[#2b302a] dark:text-white">{payments.length}</p><p className="mt-1 text-xs text-[#7b8176] dark:text-[#aeb6aa]">{paymentTotal} matching records across all pages</p></article>
          <article className={panel}><p className="text-xs font-semibold text-[#687064] dark:text-[#b3bbb0]">Active payment amounts on this page</p><p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-300">{money(totalVisible, currency)}</p><p className="mt-1 text-xs text-[#7b8176] dark:text-[#aeb6aa]">Voided records are excluded · this is not a net cash balance</p></article>
        </section>
        <section className={panel} aria-label="Payment filters">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-[#2c302a] dark:text-white">Find a payment</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">Filter recorded inflows and outflows; new payments stay attached to their source document.</p></div><button type="button" onClick={() => void loadPayments()} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#dfe2da] px-3 text-xs font-semibold dark:border-white/10"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">Search<input className={`${field} mt-1`} value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Payment no., reference, customer…" /></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">Status<select className={`${field} mt-1`} value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">Source<select className={`${field} mt-1`} value={filters.sourceType || ''} onChange={(event) => updateFilter('sourceType', event.target.value as PaymentSourceType | '')}><option value="">All sources</option>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">Direction<select className={`${field} mt-1`} value={filters.direction || ''} onChange={(event) => updateFilter('direction', event.target.value as 'INFLOW' | 'OUTFLOW' | '')}><option value="">All directions</option><option value="INFLOW">Money in</option><option value="OUTFLOW">Money out</option></select></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">Payment method<select className={`${field} mt-1`} value={filters.paymentMethodId || ''} onChange={(event) => updateFilter('paymentMethodId', event.target.value)}><option value="">All methods</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">Location<select className={`${field} mt-1`} value={filters.locationId || ''} onChange={(event) => updateFilter('locationId', event.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">From<input className={`${field} mt-1`} type="date" value={filters.fromDate || ''} onChange={(event) => updateFilter('fromDate', event.target.value)} /></label>
            <label className="text-xs font-semibold text-[#545b50] dark:text-[#d5d9d1]">To<input className={`${field} mt-1`} type="date" value={filters.toDate || ''} onChange={(event) => updateFilter('toDate', event.target.value)} /></label>
          </div>
        </section>
        <section className={panel}>
          <div className="mb-2 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-[#2c302a] dark:text-white">Payment records</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{paymentTotal} records · newest first</p></div><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#697165] dark:text-[#b3bbb0]"><CircleDollarSign size={15}/>{locationScope}</span></div>
          {loading ? <div role="status" className="grid min-h-36 place-items-center text-sm text-[#687064] dark:text-[#b3bbb0]"><span className="flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Loading payments…</span></div> : payments.length ? <div className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{payments.map((payment) => <PaymentRow key={payment.id} payment={payment} currency={currency}/>)}</div> : <div className="py-10 text-center"><p className="font-semibold text-[#343832] dark:text-white">No payments match these filters.</p><p className="mt-1 text-sm text-[#737a70] dark:text-[#aeb6aa]">Payment records appear after payment is recorded from an invoice, purchase order or approved expense.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><Link className="rounded-xl border border-[#dfe2da] px-3 py-2 text-xs font-semibold dark:border-white/10" href="/dashboard/sales/invoices">Sales invoices</Link><Link className="rounded-xl border border-[#dfe2da] px-3 py-2 text-xs font-semibold dark:border-white/10" href="/dashboard/purchases">Purchase orders</Link><Link className="rounded-xl border border-[#dfe2da] px-3 py-2 text-xs font-semibold dark:border-white/10" href="/dashboard/expenses">Expenses</Link></div></div>}
          <div className="mt-3 flex items-center justify-between border-t border-[#eceee8] pt-3 dark:border-white/[0.07]"><p className="text-xs text-[#687064] dark:text-[#b3bbb0]">Page {page} · {paymentTotal} total</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dfe2da] px-3 text-xs font-semibold disabled:opacity-40 dark:border-white/10"><ChevronLeft size={15}/>Previous</button><button type="button" disabled={page * 20 >= paymentTotal || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dfe2da] px-3 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Next<ChevronRight size={15}/></button></div></div>
        </section>
        <p className="text-xs leading-5 text-[#747a68] dark:text-[#aeb6aa]">Record payment from the related sales invoice, purchase order, or approved expense. This keeps the payment linked to the correct balance and location.</p>
      </>}
    </> : <>
      {!canViewSettings ? <section className={panel}><h2 className="font-semibold text-[#2c302a] dark:text-white">Accounting settings access required</h2><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Your account cannot view accounting periods.</p></section> : <section className={panel}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#2c302a] dark:text-white">Accounting periods</h2><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Locked or closed periods reject new transactions dated within their range.</p></div>{canEditSettings ? <button type="button" onClick={() => { setError(''); setPeriodDialog(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white hover:bg-[#405641] dark:bg-emerald-900"><Plus size={16}/>New period</button> : null}</div>
        {loading ? <div role="status" className="grid min-h-32 place-items-center text-sm text-[#687064]"><span className="flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Loading periods…</span></div> : periods.length ? <div className="space-y-3">{periods.map((period) => <article key={period.id} className="rounded-xl border border-[#eceee8] p-4 dark:border-white/[0.08]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#30342e] dark:text-white">{period.periodName}</h3><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{formatBusinessDate(period.startDate)} – {formatBusinessDate(period.endDate)}</p><p className="mt-1 text-[11px] text-[#7b8176] dark:text-[#aeb6aa]">Created {formatBusinessDate(period.createdAt)}{period.closingNotes ? ` · ${period.closingNotes}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${period.status === 'OPEN' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200' : period.status === 'LOCKED' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70'}`}>{period.status}</span></div>{canEditSettings && period.status !== 'CLOSED' ? <div className="mt-3 flex flex-wrap gap-2">{period.status === 'OPEN' ? <button type="button" disabled={!!busyPeriod} onClick={() => void transitionPeriod(period, 'lock')} className="min-h-9 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-900 disabled:opacity-50 dark:border-amber-800 dark:text-amber-200">{busyPeriod === period.id ? 'Saving…' : 'Lock period'}</button> : null}<button type="button" disabled={!!busyPeriod} onClick={() => setClosing(period)} className="min-h-9 rounded-lg border border-[#dfe2da] px-3 text-xs font-semibold text-[#454a42] disabled:opacity-50 dark:border-white/10 dark:text-white">Close period</button></div> : null}</article>)}</div> : <p className="py-8 text-center text-sm text-[#737a70] dark:text-[#aeb6aa]">No accounting periods configured.</p>}
      </section>}
    </>}

    {periodDialog ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="presentation"><form onSubmit={(event) => void createPeriod(event)} role="dialog" aria-modal="true" aria-labelledby="new-accounting-period-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-[#e4e7df] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#171a17]"><div><h2 id="new-accounting-period-title" className="text-lg font-bold text-[#252923] dark:text-white">Create accounting period</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">Periods cannot overlap and their boundaries block transaction dates once locked or closed.</p></div><label className="block text-xs font-semibold">Period name<input required maxLength={120} className={`${field} mt-1`} value={periodDraft.periodName} onChange={(event) => setPeriodDraft((state) => ({ ...state, periodName: event.target.value }))} placeholder="2026 financial year"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold">Start date<input required type="date" className={`${field} mt-1`} value={periodDraft.startDate} onChange={(event) => setPeriodDraft((state) => ({ ...state, startDate: event.target.value }))}/></label><label className="block text-xs font-semibold">End date<input required type="date" className={`${field} mt-1`} value={periodDraft.endDate} onChange={(event) => setPeriodDraft((state) => ({ ...state, endDate: event.target.value }))}/></label></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setPeriodDialog(false)} className="min-h-10 rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold dark:border-white/10">Cancel</button><button type="submit" disabled={saving} className="min-h-10 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create period'}</button></div></form></div> : null}
    {closing ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="close-accounting-period-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-[#e4e7df] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#171a17]"><div><h2 id="close-accounting-period-title" className="text-lg font-bold text-[#252923] dark:text-white">Close {closing.periodName}?</h2><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Closing blocks future transactions dated in this period. This action cannot be reversed from this screen.</p></div><label className="block text-xs font-semibold">Closing note (optional)<textarea maxLength={1000} rows={3} className={`${field} mt-1 py-2`} value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => { setClosing(null); setClosingNotes(''); }} className="min-h-10 rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold dark:border-white/10">Cancel</button><button type="button" disabled={!!busyPeriod} onClick={() => void transitionPeriod(closing, 'close')} className="min-h-10 rounded-xl bg-rose-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{busyPeriod ? 'Closing…' : 'Confirm close'}</button></div></section></div> : null}
  </div>;
}
