'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { inventoryAPI, type InventoryLocationOption, type InventoryProductOption } from '@/lib/api/inventory';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { ErrorNotice, InventoryDenied, InventoryHeading, Panel, PrimaryLink, fieldClass, labelClass, useInventoryPermissions } from './InventoryPrimitives';

type Kind = 'adjustments' | 'transfers' | 'counts';
type Line = { productId: string; quantity: string; reason: string; batchNumber: string; notes: string };
const initialLine = (): Line => ({ productId: '', quantity: '', reason: 'INVENTORY_COUNT', batchNumber: '', notes: '' });
const pageCopy = {
  adjustments: { title: 'New stock adjustment', description: 'Enter a signed quantity change. Positive adds stock; negative removes it. Stock changes only after an authorized user approves the adjustment.' },
  transfers: { title: 'New stock transfer', description: 'Choose two different active locations and the quantities to move. Stock leaves the source when you send the transfer.' },
  counts: { title: 'New physical count', description: 'Record actual shelf quantities against a system snapshot. Review the variance, complete the count, then post it to stock.' },
} as const;

export function InventoryCreateForm({ kind }: { kind: Kind }) {
  const permissions = useInventoryPermissions(); const router = useRouter();
  const activeLocation = useWorkspaceStore((s) => s.activeLocation);
  const [products, setProducts] = useState<InventoryProductOption[]>([]); const [locations, setLocations] = useState<InventoryLocationOption[]>([]);
  const [locationId, setLocationId] = useState(''); const [toLocationId, setToLocationId] = useState('');
  const [lines, setLines] = useState<Line[]>([initialLine()]); const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const canCreate = kind === 'transfers' ? permissions.canTransfer : permissions.canAdjust;
  useEffect(() => {
    let live = true;
    inventoryAPI.options().then(({ products: p, locations: l }) => {
      if (!live) return; setProducts(p); setLocations(l); setLoading(false);
      const selected = activeLocation && l.some((x) => x.id === activeLocation.id) ? activeLocation.id : l[0]?.id || '';
      setLocationId(selected); setToLocationId(l.find((x) => x.id !== selected)?.id || '');
    }).catch((cause) => { if (live) { setError(getApiError(cause, 'Could not load products and locations.')); setLoading(false); } });
    return () => { live = false; };
  }, [activeLocation]);
  if (!permissions.canView) return <InventoryDenied/>;
  if (!canCreate) return <Panel className="mx-auto max-w-2xl p-7 text-center"><h1 className="text-xl font-semibold">Inventory action access required</h1><p className="mt-2 text-sm text-[#73766f]">Your account is not allowed to create this inventory record.</p></Panel>;
  const copy = pageCopy[kind];
  const updateLine = (index: number, patch: Partial<Line>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  const addLine = () => setLines((current) => [...current, initialLine()]);
  const removeLine = (index: number) => setLines((current) => current.filter((_, i) => i !== index));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!lines.length || lines.some((line) => !line.productId || line.quantity.trim() === '' || !Number.isFinite(Number(line.quantity)))) { setError('Choose a product and enter a valid quantity for every line.'); return; }
    const keys = lines.map((line) => kind === 'adjustments' ? `${line.productId}:${locationId}:${line.batchNumber}` : line.productId);
    if (new Set(keys).size !== keys.length) { setError(kind === 'transfers' ? 'Each product can appear once per transfer.' : 'Combine duplicate product lines before saving.'); return; }
    if (kind === 'adjustments' && lines.some((x) => Number(x.quantity) === 0)) { setError('Adjustment quantity cannot be zero.'); return; }
    if (kind === 'transfers' && (!locationId || !toLocationId || locationId === toLocationId)) { setError('Choose different source and destination locations.'); return; }
    if (kind !== 'transfers' && !locationId) { setError('Choose an active location.'); return; }
    setSaving(true);
    try {
      if (kind === 'adjustments') {
        const created = await inventoryAPI.createAdjustment({ notes: notes.trim() || undefined, items: lines.map((x) => ({ productId: x.productId, locationId, quantity: Number(x.quantity), reason: x.reason, batchNumber: x.batchNumber.trim() || undefined, notes: x.notes.trim() || undefined })) });
        notify.success(`Adjustment ${created.adjustmentNumber} saved for review.`); router.push(`/dashboard/inventory/adjustments/${created.id}`);
      } else if (kind === 'transfers') {
        const created = await inventoryAPI.createTransfer({ fromLocationId: locationId, toLocationId, notes: notes.trim() || undefined, items: lines.map((x) => ({ productId: x.productId, quantity: Number(x.quantity), batchNumber: x.batchNumber.trim() || undefined, notes: x.notes.trim() || undefined })) });
        notify.success(`Transfer ${created.transferNumber} saved as draft.`); router.push(`/dashboard/inventory/transfers/${created.id}`);
      } else {
        const created = await inventoryAPI.createCount({ locationId, notes: notes.trim() || undefined, items: lines.map((x) => ({ productId: x.productId, countedQuantity: Number(x.quantity), batchNumber: x.batchNumber.trim() || undefined, notes: x.notes.trim() || undefined })) });
        notify.success(`Physical count ${created.countNumber} created.`); router.push(`/dashboard/inventory/counts/${created.id}`);
      }
    } catch (cause) { setError(getApiError(cause, 'Could not save the inventory record.')); }
    finally { setSaving(false); }
  };
  return <div className="min-w-0 space-y-6">
    <InventoryHeading title={copy.title} description={copy.description} actions={<PrimaryLink href={`/dashboard/inventory/${kind}`}><ArrowLeft size={15} className="mr-2"/>Back to {kind}</PrimaryLink>}/>
    {error ? <ErrorNotice message={error}/> : null}
    <form onSubmit={submit} className="space-y-5">
      <Panel className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"><label className={labelClass}>Location{kind === 'transfers' ? ' · Source' : ''}<select disabled={loading} className={fieldClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Choose location</option>{locations.map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{kind === 'transfers' ? <label className={labelClass}>Destination location<select disabled={loading} className={fieldClass} value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}><option value="">Choose destination</option>{locations.filter((x)=>x.id!==locationId).map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label> : null}<label className={`${labelClass} sm:col-span-2`}>Record notes (optional)<textarea className={`${fieldClass} min-h-20 py-2`} maxLength={1000} value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Add context for the review or audit trail"/></label></Panel>
      <Panel className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-[#eceee8] p-4 dark:border-white/[0.08]"><div><h2 className="font-semibold text-[#242622] dark:text-[#f0f1ed]">Items</h2><p className="mt-1 text-xs text-[#73766f] dark:text-[#afb5ac]">{kind === 'adjustments' ? 'Adjustment quantities are deltas, not target stock totals.' : kind === 'counts' ? 'The server records the current system quantity when you create this count.' : 'Each item may be listed once; batch is optional.'}</p></div><button type="button" disabled={loading} onClick={addLine} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#dfe2da] px-3 text-sm font-semibold hover:bg-[#f7f8f5] dark:border-white/10 dark:hover:bg-white/5"><Plus size={15}/>Add product</button></div>
        {loading ? <div className="p-8 text-center text-sm text-[#73766f]">Loading active products and locations…</div> : !products.length ? <div className="p-8 text-center text-sm text-[#73766f]">No active products found. Add or activate products first.</div> : <div className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{lines.map((line,index)=><div key={index} className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(130px,.6fr)_minmax(150px,.8fr)_minmax(160px,.8fr)_auto]"><label className={labelClass}>Product<select className={fieldClass} value={line.productId} onChange={(e)=>updateLine(index,{productId:e.target.value})}><option value="">Choose active product</option>{products.map((p)=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><label className={labelClass}>{kind==='adjustments'?'Quantity change':kind==='counts'?'Physical quantity':'Quantity'}<input type="number" min={kind==='adjustments'?undefined:0} step="0.0001" className={fieldClass} value={line.quantity} onChange={(e)=>updateLine(index,{quantity:e.target.value})} placeholder={kind==='adjustments'?'+5 or -2':'0'}/></label>{kind==='adjustments' ? <label className={labelClass}>Reason<select className={fieldClass} value={line.reason} onChange={(e)=>updateLine(index,{reason:e.target.value})}>{['INVENTORY_COUNT','DAMAGE','EXPIRY','THEFT','SYSTEM_CORRECTION','OTHER'].map((x)=><option key={x} value={x}>{x.replace(/_/g,' ')}</option>)}</select></label> : <label className={labelClass}>Batch number (optional)<input className={fieldClass} value={line.batchNumber} onChange={(e)=>updateLine(index,{batchNumber:e.target.value})} maxLength={80} placeholder="Batch / lot"/></label>}<label className={labelClass}>Line notes (optional)<input className={fieldClass} value={line.notes} onChange={(e)=>updateLine(index,{notes:e.target.value})} maxLength={500} placeholder="Short reason"/></label><button type="button" aria-label={`Remove line ${index+1}`} disabled={lines.length===1} onClick={()=>removeLine(index)} className="mt-auto grid min-h-10 w-10 place-items-center rounded-xl text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-400/10"><Trash2 size={16}/></button></div>)}</div>}
      </Panel>
      <div className="flex flex-wrap justify-end gap-2"><Link href={`/dashboard/inventory/${kind}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold text-[#555a52] hover:bg-white dark:border-white/10 dark:text-[#e1e4dc] dark:hover:bg-white/5">Cancel</Link><button disabled={saving||loading||!products.length} className="min-h-10 rounded-xl bg-[#20211f] px-5 text-sm font-semibold text-white hover:bg-[#3c3522] disabled:cursor-wait disabled:opacity-60 dark:border dark:border-[#8b702d] dark:bg-[#11120f]">{saving?'Saving…':kind==='adjustments'?'Submit for approval':kind==='transfers'?'Save transfer draft':'Create count snapshot'}</button></div>
    </form>
  </div>;
}
