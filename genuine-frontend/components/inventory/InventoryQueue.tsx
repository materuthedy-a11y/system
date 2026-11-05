'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Plus, RefreshCw, Search } from 'lucide-react';
import { inventoryAPI, type InventoryLocationOption, type PhysicalCount, type StockAdjustment, type StockTransfer } from '@/lib/api/inventory';
import { getApiError } from '@/lib/api';
import { Empty, ErrorNotice, InventoryDenied, InventoryHeading, Loading, PageNav, Panel, PrimaryLink, Status, dateLabel, fieldClass, money, useInventoryPermissions } from './InventoryPrimitives';

type Kind = 'adjustments' | 'transfers' | 'counts';
const config = {
  adjustments: { title: 'Stock adjustments', description: 'Review proposed stock corrections. Approving an adjustment posts its quantity change to stock; rejecting it leaves balances unchanged.', action: '/dashboard/inventory/adjustments/new', actionLabel: 'New adjustment', statuses: ['PENDING','DRAFT','APPROVED','REJECTED'] },
  transfers: { title: 'Stock transfers', description: 'Move products between active locations. Sending removes stock from the source; receiving adds only the quantities recorded at the destination.', action: '/dashboard/inventory/transfers/new', actionLabel: 'New transfer', statuses: ['DRAFT','SENT','PARTIAL','COMPLETED','CANCELLED'] },
  counts: { title: 'Physical counts', description: 'Capture a system snapshot, complete the physical count, then post variances. Posting is blocked if stock changed after the snapshot.', action: '/dashboard/inventory/counts/new', actionLabel: 'New physical count', statuses: ['DRAFT','COMPLETED','POSTED'] },
} as const;

export function InventoryQueue({ kind }: { kind: Kind }) {
  const permissions = useInventoryPermissions();
  const [rows, setRows] = useState<Array<StockAdjustment | StockTransfer | PhysicalCount>>([]);
  const [locations, setLocations] = useState<InventoryLocationOption[]>([]);
  const [locationId, setLocationId] = useState(''); const [status, setStatus] = useState(''); const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const canCreate = kind === 'transfers' ? permissions.canTransfer : permissions.canAdjust;
  const load = useCallback(async () => {
    if (!permissions.canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const filters = { locationId: locationId || undefined, status: status || undefined, search: search.trim() || undefined, page, limit: 20 };
      const result = kind === 'adjustments' ? await inventoryAPI.adjustments(filters) : kind === 'transfers' ? await inventoryAPI.transfers(filters) : await inventoryAPI.counts(filters);
      setRows(result.data); setTotal(result.total);
    } catch (cause) { setError(getApiError(cause, 'Could not load inventory records.')); }
    finally { setLoading(false); }
  }, [permissions.canView, kind, locationId, status, search, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { inventoryAPI.options().then((result) => setLocations(result.locations)).catch(() => undefined); }, []);
  if (!permissions.canView) return <InventoryDenied/>;
  const current = config[kind]; const pages = Math.max(1, Math.ceil(total / 20));
  const getId = (row: StockAdjustment | StockTransfer | PhysicalCount) => row.id;
  const detailHref = (id: string) => `/dashboard/inventory/${kind}/${encodeURIComponent(id)}`;
  return <div className="min-w-0 space-y-6">
    <InventoryHeading title={current.title} description={current.description} actions={<><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dfe2da] bg-white px-3.5 text-sm font-semibold text-[#454a41] hover:bg-[#f7f8f5] disabled:opacity-50 dark:border-white/10 dark:bg-[#111310] dark:text-[#e1e4dc]"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button>{canCreate ? <PrimaryLink href={current.action}><Plus size={16} className="mr-2"/>{current.actionLabel}</PrimaryLink> : null}</>}/>
    <Panel className="overflow-hidden"><div className="grid gap-3 border-b border-[#eceee8] p-4 dark:border-white/[0.08] sm:grid-cols-2 xl:grid-cols-4"><label className="relative"><span className="sr-only">Search inventory records</span><Search size={15} className="absolute left-3 top-3 text-[#8a8e85]"/><input className={`${fieldClass} pl-9`} value={search} onChange={(e) => {setSearch(e.target.value);setPage(1);}} placeholder="Search record number or notes"/></label><label className="sr-only" htmlFor="inventory-location-filter">Location</label><select id="inventory-location-filter" className={fieldClass} value={locationId} onChange={(e) => {setLocationId(e.target.value);setPage(1);}}><option value="">All locations</option>{locations.map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}</select><label className="sr-only" htmlFor="inventory-status-filter">Status</label><select id="inventory-status-filter" className={fieldClass} value={status} onChange={(e) => {setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{current.statuses.map((x)=><option key={x} value={x}>{x.replace(/_/g,' ')}</option>)}</select><div className="flex items-center justify-end text-sm text-[#73766f] dark:text-[#afb5ac]">{total.toLocaleString()} records</div></div>
      {error ? <div className="p-4"><ErrorNotice message={error} retry={() => void load()}/></div> : null}
      {loading ? <Loading/> : <><div className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{rows.map((row) => {
        const title = kind === 'adjustments' ? (row as StockAdjustment).adjustmentNumber : kind === 'transfers' ? (row as StockTransfer).transferNumber : (row as PhysicalCount).countNumber;
        const recordStatus = row.status;
        const subtitle = kind === 'adjustments' ? `${(row as StockAdjustment).items.length} lines · ${(row as StockAdjustment).reason}` : kind === 'transfers' ? `${(row as StockTransfer).fromLocation.name} → ${(row as StockTransfer).toLocation.name} · ${(row as StockTransfer).items.length} items` : `${(row as PhysicalCount).location.name} · ${(row as PhysicalCount).items.length} items · ${(row as PhysicalCount).varianceCount} variances`;
        const date = kind === 'adjustments' ? (row as StockAdjustment).adjustmentDate : kind === 'transfers' ? (row as StockTransfer).transferDate : row.createdAt;
        const totalLabel = kind === 'adjustments' ? `${(row as StockAdjustment).items.reduce((sum, item) => sum + (item.difference || 0), 0).toLocaleString()} net units` : kind === 'transfers' ? `${(row as StockTransfer).items.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()} units` : money((row as PhysicalCount).totalVarianceAmount);
        return <Link key={getId(row)} href={detailHref(row.id)} className="group grid min-w-0 gap-2 p-4 transition hover:bg-[#fbfcf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#c49a35] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5 dark:hover:bg-[#22241f]"><div className="min-w-0"><p className="truncate font-semibold text-[#242622] dark:text-[#f0f1ed]">{title} <span className="ml-1"><Status value={recordStatus}/></span></p><p className="mt-1 truncate text-xs text-[#73766f] dark:text-[#afb5ac]">{subtitle}</p></div><p className="text-xs text-[#73766f] dark:text-[#afb5ac]">{dateLabel(date)}</p><span className="flex items-center gap-2 text-sm font-semibold text-[#755700] dark:text-[#d8b454]">{totalLabel}<ArrowRight size={15} className="transition group-hover:translate-x-0.5"/></span></Link>;
      })}{!rows.length ? <Empty title={`No ${kind} found`} detail="Clear a filter or create a new inventory record to get started."/> : null}</div><PageNav page={page} pages={pages} onChange={setPage} shown={rows.length} total={total}/></>}
    </Panel>
  </div>;
}
