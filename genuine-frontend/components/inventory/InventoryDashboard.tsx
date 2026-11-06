'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Boxes, ClipboardCheck, ClipboardList, Package, RefreshCw, Search, Settings2 } from 'lucide-react';
import { inventoryAPI, type InventoryDashboard as DashboardData, type InventoryLocationOption, type InventoryMovement, type StockBalance } from '@/lib/api/inventory';
import { getApiError } from '@/lib/api';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Empty, ErrorNotice, InventoryDenied, InventoryHeading, Loading, PageNav, Panel, PrimaryLink, dateLabel, fieldClass, money, useInventoryPermissions } from './InventoryPrimitives';

export function InventoryDashboard() {
  const permission = useInventoryPermissions();
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [locations, setLocations] = useState<InventoryLocationOption[]>([]);
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!permission.canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [dash, stock, activity] = await Promise.all([
        inventoryAPI.dashboard(),
        inventoryAPI.balances({ locationId: locationId || undefined, search: search.trim() || undefined, page, limit: 20 }),
        inventoryAPI.movements({ locationId: locationId || undefined, page: 1, limit: 8 }),
      ]);
      setSummary(dash); setBalances(stock.data); setTotal(stock.total); setMoves(activity.data);
    } catch (cause) { setError(getApiError(cause, 'Could not load inventory.')); }
    finally { setLoading(false); }
  }, [permission.canView, locationId, search, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { inventoryAPI.options().then((result) => setLocations(result.locations)).catch(() => undefined); }, []);

  if (!permission.canView) return <InventoryDenied/>;
  const lowStockCount = summary?.lowStockBalances;
  const actions = [
    { href: '/dashboard/inventory/adjustments/new', label: 'Stock adjustment', icon: ArrowUpRight, enabled: permission.canAdjust },
    { href: '/dashboard/inventory/transfers/new', label: 'Stock transfer', icon: ArrowLeftRight, enabled: permission.canTransfer },
    { href: '/dashboard/inventory/counts/new', label: 'Physical count', icon: ClipboardCheck, enabled: permission.canAdjust },
    { href: '/dashboard/inventory/reports', label: 'Inventory reports', icon: ClipboardList, enabled: permission.canView },
  ];
  const dashboardCards = [
    { label: 'Active products', value: summary?.totalProducts, format: (value: number) => Math.round(value).toLocaleString(), icon: Package, tone: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/[0.12] dark:text-emerald-300' },
    { label: 'Stock on hand', value: summary?.totalStockUnits, format: (value: number) => `${Math.round(value).toLocaleString()} units`, icon: Boxes, tone: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/[0.12] dark:text-blue-300' },
    { label: 'Stock value', value: summary?.totalStockValue, format: (value: number) => money(value), icon: ArrowDownLeft, tone: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/[0.12] dark:text-amber-300' },
    { label: 'Low stock balances', value: lowStockCount, format: (value: number) => Math.round(value).toLocaleString(), icon: AlertTriangle, tone: lowStockCount ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/[0.12] dark:text-rose-300' : 'border-[#e6e8e1] bg-white text-[#30332e] dark:border-white/[0.08] dark:bg-[#1b1e1a] dark:text-[#e1e4dc]' },
  ];
  return <div className="min-w-0 space-y-6">
    <InventoryHeading title="Stock overview" description="Current quantities, valuation, expiry alerts and movement history across your business locations." actions={<><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dfe2da] bg-white px-3.5 text-sm font-semibold text-[#454a41] hover:bg-[#f7f8f5] disabled:opacity-50 dark:border-white/10 dark:bg-[#111310] dark:text-[#e1e4dc]"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button>{permission.canAdjust?<PrimaryLink href="/dashboard/inventory/settings/reorder-points"><Settings2 size={16} className="mr-2"/>Reorder levels</PrimaryLink>:null}</>}/>
    <div><p className="mb-2 text-xs font-semibold text-[#596257] dark:text-[#afb5ac]">Business-wide inventory totals · all active locations</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dashboardCards.map(({ label, value, format, icon: Icon, tone }) => <Panel key={label} className={`flex min-w-0 items-center gap-3 border p-4 ${tone}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/90 dark:bg-black/20"><Icon size={18}/></span><div className="min-w-0"><p className="text-xs font-bold">{label}</p><p className="mt-1 truncate text-xl font-extrabold tabular-nums">{value === undefined ? '—' : <AnimatedNumber value={value} format={format}/>}</p></div></Panel>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{actions.filter((x) => x.enabled).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#e6e8e1] bg-white px-4 py-3 text-sm font-semibold text-[#30332e] shadow-sm transition hover:border-[#c49a35]/50 hover:bg-[#fffdf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c49a35] dark:border-white/[0.08] dark:bg-[#1b1e1a] dark:text-[#e1e4dc] dark:hover:bg-[#24241f]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f7f0dc] text-[#775b17] dark:bg-[#d8b454]/10 dark:text-[#e2c471]"><Icon size={17}/></span>{label}<ArrowRight size={15} className="ml-auto text-[#8b8f86] transition group-hover:translate-x-0.5 group-hover:text-[#a17a16]"/></Link>)}</div>
    {error ? <ErrorNotice message={error} retry={() => void load()}/> : null}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
      <Panel className="overflow-hidden"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eceee8] p-4 dark:border-white/[0.08] sm:p-5"><div><h2 className="font-semibold text-[#242622] dark:text-[#f0f1ed]">Stock by location</h2><p className="mt-1 text-xs text-[#73766f] dark:text-[#afb5ac]">Defaults to all locations; choose one location to inspect its live stock and movements.</p></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="stock-search">Search stock</label><div className="relative"><Search size={15} className="absolute left-3 top-3 text-[#8a8e85]"/><input id="stock-search" className={`${fieldClass} pl-9`} placeholder="Search product or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></div><select aria-label="Filter stock by location" className={fieldClass} value={locationId} onChange={(e) => { setLocationId(e.target.value); setPage(1); }}><option value="">All locations</option>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div></div>
        {loading ? <Loading label="Loading stock balances…"/> : <><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#f8f8f5] text-[11px] uppercase tracking-wide text-[#686d64] dark:bg-[#151713] dark:text-[#afb5ac]"><tr>{['Product','Location','On hand','Reorder at','Value at cost'].map((t) => <th key={t} className="px-4 py-3">{t}</th>)}</tr></thead><tbody className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{balances.map((row) => <tr key={row.id} className="text-[#30332e] dark:text-[#e1e4dc]"><td className="px-4 py-3"><p className="font-semibold">{row.product.name}</p><p className="mt-0.5 text-xs text-[#73766f] dark:text-[#afb5ac]">{row.product.sku}</p></td><td className="px-4 py-3">{row.location.name}</td><td className={`px-4 py-3 font-semibold ${row.quantity <= row.product.minimumStock ? 'text-rose-700 dark:text-rose-300' : ''}`}>{row.quantity.toLocaleString()}</td><td className="px-4 py-3">{row.product.reorderLevel.toLocaleString()}</td><td className="px-4 py-3">{money(row.quantity * row.product.buyingPrice)}</td></tr>)}{!balances.length ? <tr><td colSpan={5}><Empty title="No stock balances found" detail="Try another search or location, or receive stock from an approved purchase."/></td></tr> : null}</tbody></table></div><PageNav page={page} pages={Math.max(1, Math.ceil(total / 20))} onChange={setPage} shown={balances.length} total={total}/></>}</Panel>
      <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#eceee8] p-4 dark:border-white/[0.08] sm:p-5"><div><h2 className="font-semibold text-[#242622] dark:text-[#f0f1ed]">Recent stock movements</h2><p className="mt-1 text-xs text-[#73766f] dark:text-[#afb5ac]">Latest eight recorded events</p></div><Link href="/dashboard/inventory/reports?view=movements" className="text-xs font-bold text-[#755700] hover:underline dark:text-[#f0c84a]">All activity</Link></div>{loading ? <Loading/> : moves.length ? <div className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{moves.map((m) => <div key={m.id} className="flex min-w-0 items-start gap-3 p-4"><span aria-label={m.quantity < 0 ? 'Stock decreased' : 'Stock increased'} className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg shadow-sm ${m.quantity < 0 ? 'bg-rose-600 text-white shadow-rose-950/20 dark:bg-rose-500' : 'bg-emerald-600 text-white shadow-emerald-950/20 dark:bg-emerald-500'}`}>{m.quantity < 0 ? <ArrowUpRight size={15} strokeWidth={2.5}/> : <ArrowDownLeft size={15} strokeWidth={2.5}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#30332e] dark:text-[#e1e4dc]">{m.product.name}</p><p className="mt-0.5 truncate text-xs text-[#73766f] dark:text-[#afb5ac]">{m.type.replace(/_/g,' ')} · {m.location.name} · {dateLabel(m.createdAt)}</p></div><span className={`shrink-0 text-sm font-extrabold ${m.quantity < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span></div>)}</div> : <Empty title="No stock movements yet" detail="Purchasing, sales, returns, adjustments and transfers appear here."/>}</Panel>
    </div>
    <p className="text-xs leading-5 text-[#73766f] dark:text-[#93998f]">{summary ? `${summary.totalLocations} active locations · ${summary.expiredBatchCount} expired tracked batches · ${summary.expiringWithin30Days} batches expiring in 30 days · ${summary.pendingAdjustments} adjustments, ${summary.pendingTransfers} transfers and ${summary.pendingCounts} counts awaiting action.` : 'Inventory summaries are calculated from stock balances and movement layers.'}</p>
  </div>;
}
