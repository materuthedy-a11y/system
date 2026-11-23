'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Boxes, ClipboardCheck, ClipboardList, Package, RefreshCw, Search, Settings2 } from 'lucide-react';
import { inventoryAPI, type InventoryDashboard as DashboardData, type InventoryLocationOption, type InventoryMovement, type StockBalance } from '@/lib/api/inventory';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Empty, ErrorNotice, InventoryDenied, InventoryHeading, Loading, PageNav, Panel, PrimaryLink, dateLabel, fieldClass, money, useInventoryPermissions } from './InventoryPrimitives';
import { Input } from '@/components/ui/forms/input';
import { Select } from '@/components/ui/forms/select';

export function InventoryDashboard() {
  const permission = useInventoryPermissions();
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [locations, setLocations] = useState<InventoryLocationOption[]>([]);
  const [optionsError, setOptionsError] = useState('');
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const summaryRequestId = useRef(0);
  const rowsRequestId = useRef(0);
  const optionsRequestId = useRef(0);

  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestId.current;
    if (!permission.canView) { setSummaryLoading(false); return; }
    setSummaryLoading(true); setSummaryError('');
    try {
      const dash = await inventoryAPI.dashboard();
      if (requestId === summaryRequestId.current) setSummary(dash);
    } catch (cause) {
      if (requestId === summaryRequestId.current) {
        setSummary(null);
        const message = getApiError(cause, 'Could not load inventory summary.');
        setSummaryError(message);
        notify.error(message);
      }
    } finally {
      if (requestId === summaryRequestId.current) setSummaryLoading(false);
    }
  }, [permission.canView]);

  const loadRows = useCallback(async () => {
    const requestId = ++rowsRequestId.current;
    if (!permission.canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [stock, activity] = await Promise.all([
        inventoryAPI.balances({ locationId: locationId || undefined, search: debouncedSearch || undefined, page, limit: 20 }),
        inventoryAPI.movements({ locationId: locationId || undefined, page: 1, limit: 8 }),
      ]);
      if (requestId !== rowsRequestId.current) return;
      setBalances(stock.data); setTotal(stock.total); setMoves(activity.data);
    } catch (cause) {
      if (requestId === rowsRequestId.current) {
        setBalances([]); setTotal(0); setMoves([]);
        const message = getApiError(cause, 'Could not load stock balances and recent movements.');
        setError(message);
        notify.error(message);
      }
    } finally {
      if (requestId === rowsRequestId.current) setLoading(false);
    }
  }, [permission.canView, locationId, debouncedSearch, page]);

  const loadOptions = useCallback(async () => {
    const requestId = ++optionsRequestId.current;
    try {
      const result = await inventoryAPI.options();
      if (requestId !== optionsRequestId.current) return;
      setLocations(result.locations);
      setOptionsError('');
    } catch (cause) {
      if (requestId === optionsRequestId.current) {
        const message = getApiError(cause, 'Could not load accessible locations.');
        setOptionsError(message);
        notify.error(message);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    void Promise.all([loadSummary(), loadRows()]);
    void loadOptions();
  }, [loadSummary, loadRows, loadOptions]);

  useEffect(() => {
    void loadSummary();
    return () => { summaryRequestId.current += 1; };
  }, [loadSummary]);
  useEffect(() => {
    void loadRows();
    return () => { rowsRequestId.current += 1; };
  }, [loadRows]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    void loadOptions();
    return () => { optionsRequestId.current += 1; };
  }, [loadOptions]);

  if (!permission.canView) return <InventoryDenied/>;
  const lowStockCount = summary?.lowStockProductLocationPairs;
  const actions = [
    { href: '/dashboard/inventory/adjustments/new', label: 'Stock adjustment', icon: ArrowUpRight, enabled: permission.canAdjust },
    { href: '/dashboard/inventory/transfers/new', label: 'Stock transfer', icon: ArrowLeftRight, enabled: permission.canTransfer },
    { href: '/dashboard/inventory/counts/new', label: 'Physical count', icon: ClipboardCheck, enabled: permission.canAdjust },
    { href: '/dashboard/inventory/reports', label: 'Inventory reports', icon: ClipboardList, enabled: permission.canView },
  ];
  const dashboardCards = [
    { label: 'Stock value', value: summary?.totalStockValue, format: (value: number) => money(value), icon: ArrowDownLeft, visual: 'flat', tone: 'border-amber-300 !bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:!bg-amber-400/[0.12] dark:text-amber-300' },
    { label: 'Stock quantity by unit', value: summary?.stockQuantitiesByUnit.map(({ unit, quantity }) => `${quantity.toLocaleString('en-TZ', { maximumFractionDigits: 4 })} ${unit}`).join(' · ') || (summary ? '0' : undefined), format: (value: number) => value.toLocaleString('en-TZ', { maximumFractionDigits: 4 }), icon: Boxes, visual: 'flat', tone: 'border-blue-300 !bg-blue-100 text-blue-700 dark:border-blue-400/25 dark:!bg-blue-400/[0.12] dark:text-blue-300' },
    { label: 'Active products', value: summary?.totalProducts, format: (value: number) => Math.round(value).toLocaleString(), icon: Package, visual: 'sphere', tone: 'border-emerald-300 !bg-emerald-100 text-emerald-700 dark:border-emerald-400/25 dark:!bg-emerald-400/[0.12] dark:text-emerald-300' },
    { label: 'Pairs at/below reorder', value: lowStockCount, format: (value: number) => Math.round(value).toLocaleString(), hint: 'Includes zero-stock pairs across accessible active locations.', icon: AlertTriangle, visual: 'sphere', tone: lowStockCount ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/[0.12] dark:text-rose-300' : 'border-[#e6e8e1] bg-white text-[#30332e] dark:border-white/[0.08] dark:bg-[#1b1e1a] dark:text-[#e1e4dc]' },
  ];
  return <div className="min-w-0 space-y-6">
    <InventoryHeading title="Stock overview" description="Current quantities, valuation, expiry alerts and movement history for locations you can access." actions={<><button onClick={refresh} disabled={loading || summaryLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dfe2da] bg-white px-3.5 text-sm font-semibold text-[#454a41] hover:bg-[#f7f8f5] disabled:opacity-50 dark:border-white/10 dark:bg-[#111310] dark:text-[#e1e4dc]"><RefreshCw size={15} className={loading || summaryLoading ? 'animate-spin' : ''}/>Refresh</button>{permission.canAdjust?<PrimaryLink href="/dashboard/inventory/settings/reorder-points"><Settings2 size={16} className="mr-2"/>Reorder levels</PrimaryLink>:null}</>}/>
    {summaryError ? <ErrorNotice message={summaryError} retry={() => void loadSummary()}/> : null}
    <div><p className="mb-2 text-xs font-semibold text-[#596257] dark:text-[#afb5ac]">Inventory summary</p><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">{dashboardCards.map(({ label, value, format, hint, icon: Icon, tone, visual }) => <Panel key={label} className={`flex min-h-[112px] min-w-0 items-center justify-between gap-3 overflow-hidden border p-4 ${tone}`}>{visual === 'sphere' ? <><div className="min-w-0"><p className="text-xs font-bold">{label}</p>{hint ? <p className="mt-1 max-w-[13rem] text-[11px] leading-4 opacity-80">{hint}</p> : null}</div><div role="img" aria-label={`${label}: ${value === undefined ? 'loading' : typeof value === 'number' ? format(value) : value}`} className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border border-white/55 bg-[radial-gradient(circle_at_34%_28%,#efe4c0_0%,#c9a74e_29%,#957b3a_55%,#315c45_100%)] text-2xl font-extrabold tabular-nums text-white shadow-[inset_-8px_-9px_16px_rgba(24,31,26,.4),inset_4px_4px_8px_rgba(255,255,255,.28),0_0_10px_rgba(217,166,54,.16)] after:absolute after:inset-[10%] after:rounded-full after:border after:border-white/20 after:content-[''] dark:border-white/15 dark:from-[#e6d49e] dark:via-[#806a36] dark:to-[#183b2b]">{value === undefined ? '—' : typeof value === 'number' ? <AnimatedNumber value={value} format={format}/> : value}</div></> : <><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/90 dark:bg-black/20"><Icon size={18}/></span><div className="min-w-0 flex-1"><p className="text-xs font-bold">{label}</p><p className="mt-1 break-words text-base font-extrabold leading-snug tabular-nums sm:text-xl">{value === undefined ? '—' : typeof value === 'number' ? <AnimatedNumber value={value} format={format}/> : value}</p></div></>}</Panel>)}</div><p className="mt-2 text-xs text-[#73766f] dark:text-[#afb5ac]">Stock quantity, value, reorder pairs and location count cover locations you can access. Active products counts the business catalog. The location filter changes only the stock table and recent movements, not these totals.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{actions.filter((x) => x.enabled).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#e6e8e1] bg-white px-4 py-3 text-sm font-semibold text-[#30332e] shadow-sm transition hover:border-[#c49a35]/50 hover:bg-[#fffdf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c49a35] dark:border-white/[0.08] dark:bg-[#1b1e1a] dark:text-[#e1e4dc] dark:hover:bg-[#24241f]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f7f0dc] text-[#775b17] dark:bg-[#d8b454]/10 dark:text-[#e2c471]"><Icon size={17}/></span>{label}<ArrowRight size={15} className="ml-auto text-[#8b8f86] transition group-hover:translate-x-0.5 group-hover:text-[#a17a16]"/></Link>)}</div>
    {error ? <ErrorNotice message={error} retry={() => void loadRows()}/> : null}
    {optionsError ? <ErrorNotice message={optionsError} retry={() => void loadOptions()}/> : null}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
      <Panel className="overflow-hidden"><div className="ui-filter-surface flex flex-wrap items-end justify-between gap-3 border-b border-[#eceee8] p-4 dark:border-white/[0.08] sm:p-5"><div><h2 className="font-semibold text-[#242622] dark:text-[#f0f1ed]">Recorded stock balances</h2><p className="mt-1 max-w-xl text-xs leading-5 text-[#73766f] dark:text-[#afb5ac]">Shows saved product-location balance rows only. A missing row means zero stock and is included in the reorder-pair total above. The location filter changes these rows and recent movements, not the totals. Row values are indicative (on hand × current buying price); use Inventory reports → Valuation for the configured costing method.</p></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="stock-search">Search stock</label><div className="relative"><Search size={15} className="absolute left-3 top-3 text-[#8a8e85]"/><Input id="stock-search" className={`${fieldClass} pl-9`} placeholder="Search product or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></div><Select aria-label="Filter stock by location" className={`${fieldClass} pr-8`} value={locationId} onChange={(e) => { setLocationId(e.target.value); setPage(1); }}><option value="">All locations</option>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div></div>
        {loading ? <Loading label="Loading stock balances…"/> : <><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#f8f8f5] text-[11px] uppercase tracking-wide text-[#686d64] dark:bg-[#151713] dark:text-[#afb5ac]"><tr>{['Product','Location','On hand','Reorder at','Indicative value'].map((t) => <th key={t} className="px-4 py-3">{t}</th>)}</tr></thead><tbody className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{balances.map((row) => <tr key={row.id} className="text-[#30332e] dark:text-[#e1e4dc]"><td className="px-4 py-3"><p className="font-semibold">{row.product.name}</p><p className="mt-0.5 text-xs text-[#73766f] dark:text-[#afb5ac]">{row.product.sku}</p></td><td className="px-4 py-3">{row.location.name}</td><td className={`px-4 py-3 font-bold ${row.quantity <= row.product.minimumStock ? 'text-red-600 dark:text-red-400' : ''}`}>{row.quantity.toLocaleString()}</td><td className="px-4 py-3">{row.product.reorderLevel.toLocaleString()}</td><td className="px-4 py-3">{money(row.quantity * row.product.buyingPrice)}</td></tr>)}{!balances.length ? <tr><td colSpan={5}><Empty title="No stock balances found" detail="Try another search or location, or receive stock from an approved purchase."/></td></tr> : null}</tbody></table></div><PageNav page={page} pages={Math.max(1, Math.ceil(total / 20))} onChange={setPage} shown={balances.length} total={total}/></>}</Panel>
      <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#eceee8] p-4 dark:border-white/[0.08] sm:p-5"><div><h2 className="font-semibold text-[#242622] dark:text-[#f0f1ed]">Recent stock movements</h2><p className="mt-1 text-xs text-[#73766f] dark:text-[#afb5ac]">Latest eight recorded events</p></div><Link href="/dashboard/inventory/reports?view=movements" className="ui-nav-link group"><span>All activity</span><ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5"/></Link></div>{loading ? <Loading/> : moves.length ? <div className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{moves.map((m) => <div key={m.id} className="flex min-w-0 items-start gap-3 p-4"><span aria-label={m.quantity < 0 ? 'Stock decreased' : 'Stock increased'} className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg shadow-sm ${m.quantity < 0 ? 'bg-rose-600 text-white shadow-rose-950/20 dark:bg-rose-500' : 'bg-emerald-600 text-white shadow-emerald-950/20 dark:bg-emerald-500'}`}>{m.quantity < 0 ? <ArrowUpRight size={15} strokeWidth={2.5}/> : <ArrowDownLeft size={15} strokeWidth={2.5}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#30332e] dark:text-[#e1e4dc]">{m.product.name}</p><p className="mt-0.5 truncate text-xs text-[#73766f] dark:text-[#afb5ac]">{m.type.replace(/_/g,' ')} · {m.location.name} · {dateLabel(m.createdAt)}</p></div><span className={`shrink-0 text-sm font-extrabold ${m.quantity < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span></div>)}</div> : <Empty title="No stock movements yet" detail="Purchasing, sales, returns, adjustments and transfers appear here."/>}</Panel>
    </div>
    <p className="text-xs leading-5 text-[#73766f] dark:text-[#93998f]">{summary ? `${summary.totalLocations} active locations · ${summary.expiredBatchCount} expired tracked batches · ${summary.expiringWithin30Days} batches expiring in 30 days · ${summary.pendingAdjustments} adjustments, ${summary.pendingTransfers} transfers and ${summary.pendingCounts} counts awaiting action.` : 'Inventory summaries are calculated from stock balances and movement layers.'}</p>
  </div>;
}
