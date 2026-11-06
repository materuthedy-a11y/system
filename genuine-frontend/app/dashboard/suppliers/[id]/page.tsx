'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/api';
import { suppliersAPI, type Supplier, type SupplierStatement } from '@/lib/api/suppliers';
import { purchasesAPI, type PurchaseOrder } from '@/lib/api/purchases';
import { money, dateLabel } from '@/components/sales/SalesPrimitives';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { notify } from '@/components/ui/AppToaster';

const surface = 'min-w-0 rounded-xl border border-[#d8dfd5] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151815] sm:p-5';
export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const canView = !!user?.permissions.includes('suppliers.view');
  const canEdit = !!user?.permissions.includes('suppliers.edit');
  const load = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [record, account, purchasePage] = await Promise.all([
        suppliersAPI.get(id), suppliersAPI.statement(id, month), purchasesAPI.orders({ supplierId: id, page: 1, limit: 20, sortBy: 'orderDate', sortOrder: 'desc' }),
      ]);
      setSupplier(record); setStatement(account); setOrders(purchasePage.data); setOrdersTotal(purchasePage.total);
    } catch (cause) { setError(getApiError(cause, 'Could not load supplier information.')); }
    finally { setLoading(false); }
  }, [canView, id, month]);
  useEffect(() => { void load(); }, [load]);
  async function toggleStatus() {
    if (!supplier || !canEdit) return;
    setSavingStatus(true); setError('');
    try { setSupplier(await suppliersAPI.update(supplier.id, { isActive: !supplier.isActive })); notify.success(supplier.isActive ? 'Supplier deactivated. Existing purchase history is preserved.' : 'Supplier reactivated.'); }
    catch (cause) { setError(getApiError(cause, 'Could not update supplier status.')); }
    finally { setSavingStatus(false); }
  }
  async function deleteSupplier() {
    if (!supplier || !user?.permissions.includes('suppliers.delete')) return;
    setDeleting(true); setError('');
    try { await suppliersAPI.remove(supplier.id); notify.success('Supplier deleted.'); router.replace('/dashboard/suppliers'); }
    catch (cause) { setError(getApiError(cause, 'This supplier has account history and should be deactivated instead.')); setConfirmDelete(false); }
    finally { setDeleting(false); }
  }
  if (!canView) return <main className="p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm dark:border-blue-900 dark:bg-[#14171d]"><h1 className="font-bold">Supplier access required</h1><p className="mt-1">Your account is not allowed to view suppliers.</p></section></main>;
  if (loading && !supplier) return <main role="status" className="p-6 text-sm"><Loader2 size={16} className="mr-2 inline animate-spin"/>Loading supplier…</main>;
  if (!supplier) return <main className="p-4 sm:p-6"><div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error || 'Supplier not found.'}<button type="button" onClick={() => void load()} className="ml-3 rounded-md border px-3 py-1 font-semibold">Retry</button></div></main>;
  return <main className="mx-auto w-full min-w-0 max-w-6xl p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard/suppliers" className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[#3f5846] hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-white/5"><ArrowLeft size={16}/>Suppliers</Link><div className="flex flex-wrap gap-2">{canEdit ? <Link href={`/dashboard/suppliers/${supplier.id}/edit`} className="inline-flex min-h-9 items-center rounded-md border border-[#cbd8cc] px-3 text-sm font-semibold hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-white/5">Edit supplier</Link> : null}{canEdit ? <button type="button" disabled={savingStatus} onClick={() => void toggleStatus()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#cbd8cc] px-3 text-sm font-semibold disabled:opacity-50 dark:border-white/15"><RefreshCw size={14} className={savingStatus ? 'animate-spin' : ''}/>{supplier.isActive ? 'Deactivate' : 'Reactivate'}</button> : null}{user?.permissions.includes('suppliers.delete') && ordersTotal === 0 && supplier.totalPaid === 0 && supplier.totalReturned === 0 && supplier.openingBalance === 0 ? <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={14}/>Delete</button> : null}</div></div>
    {error ? <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}<button type="button" onClick={() => void load()} className="ml-2 underline">Retry</button></p> : null}
    <section className="mb-4 rounded-xl border border-[#cde9d9] bg-emerald-50/75 p-5 dark:border-emerald-900/60 dark:bg-[#141a16]"><div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">{supplier.supplierCode} · {supplier.paymentTerms}</p><h1 className="mt-1 break-words text-2xl font-bold text-[#1f2c23] dark:text-white">{supplier.name}</h1><p className="mt-1 break-all text-sm text-[#566458] dark:text-white/65">{supplier.email} · {supplier.phone}</p></div><span className={`rounded-md px-3 py-1.5 text-xs font-bold text-white ${supplier.isActive ? 'bg-emerald-600' : 'bg-slate-600'}`}>{supplier.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div></section>
    <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary title="Outstanding payable" value={supplier.outstandingBalance}/><Summary title="Credit limit" value={supplier.creditLimit}/><Summary title="Purchases to date" value={supplier.totalPurchased}/><Summary title="Payments made" value={supplier.totalPaid}/></section>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.85fr)]">
      <section className={surface}><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold">Supplier statement</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">Purchases, payments and approved returns for this period.</p></div><label className="w-full text-xs font-semibold sm:w-auto">Period<input aria-label="Statement month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm dark:border-white/15 dark:bg-[#111411] dark:text-white sm:w-auto"/></label></div>
        {statement ? <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Opening',statement.openingBalance],['Purchases',statement.purchases],['Payments',statement.payments],['Returns',statement.returns]].map(([label,value]) => <div key={String(label)} className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-950 dark:bg-[#121813]"><p className="text-[11px] text-[#687368] dark:text-white/55">{label}</p><p className="mt-1 truncate text-sm font-bold tabular-nums">TZS {money(Number(value))}</p></div>)}</div><div className="mt-3 flex justify-between gap-3 rounded-lg bg-[#f3f7f3] p-3 text-sm dark:bg-[#101210]"><strong>Closing balance</strong><strong className="tabular-nums">TZS {money(statement.closingBalance)}</strong></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="bg-[#f3f7f3] text-[10px] uppercase dark:bg-[#101210]"><tr>{['Date','Type','Reference','Amount'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{statement.invoices.map((line,index) => <tr key={`${line.invoiceNumber}-${index}`}><td className="whitespace-nowrap px-3 py-2">{dateLabel(line.date)}</td><td className="px-3 py-2">{line.type}</td><td className="break-all px-3 py-2">{line.invoiceNumber}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">TZS {money(line.amount)}</td></tr>)}{!statement.invoices.length ? <tr><td colSpan={4} className="px-3 py-7 text-center text-[#687368] dark:text-white/55">No supplier account movements for this period.</td></tr> : null}</tbody></table></div></> : <p className="py-8 text-sm text-[#687368] dark:text-white/55">Loading statement…</p>}
      </section>
      <section className={surface}><h2 className="text-base font-bold">Supplier information</h2><dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">{[['Email',supplier.email],['Phone',supplier.phone],['Other phone',supplier.secondaryPhone || '—'],['Tax ID',supplier.taxId || '—'],['Payment terms',supplier.paymentTerms],['Credit used',`${supplier.creditUtilization.toFixed(2)}%`],['Address',supplier.address ? [supplier.address.street,supplier.address.city,supplier.address.region,supplier.address.country].filter(Boolean).join(', ') : '—'],['Bank',supplier.bankName || '—'],['Bank account',supplier.bankAccountNumber || '—'],['Bank SWIFT/BIC',supplier.bankSwiftCode || '—'],['Description',supplier.description || '—']].map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-xs text-[#687368] dark:text-white/55">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>{supplier.contacts.length ? <div className="mt-5 border-t border-[#edf0eb] pt-4 dark:border-white/10"><h3 className="text-sm font-bold">Contacts</h3>{supplier.contacts.map((contact) => <div key={contact.id} className="mt-3 rounded-lg bg-[#f3f7f3] p-3 text-xs dark:bg-[#101210]"><p className="font-semibold">{contact.firstName} {contact.lastName}{contact.isPrimary ? ' · Primary' : ''}</p><p className="mt-1 break-all text-[#687368] dark:text-white/55">{contact.position || '—'} · {contact.phone} · {contact.email}</p></div>)}</div> : <p className="mt-5 border-t border-[#edf0eb] pt-4 text-xs text-[#687368] dark:border-white/10 dark:text-white/55">No additional contacts.</p>}</section>
      <section className={`${surface} lg:col-span-2`}><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-bold">Purchase history</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">Orders linked to this supplier; balances are refreshed from purchase records.</p></div><Link href="/dashboard/purchases/orders/new" className="shrink-0 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600">New purchase order</Link></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[#f3f7f3] text-[10px] uppercase dark:bg-[#101210]"><tr>{['Purchase order','Location','Date','Total','Balance','Status'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{orders.map((order) => <tr key={order.id}><td className="px-3 py-3"><Link className="font-semibold text-emerald-800 hover:underline dark:text-emerald-200" href={`/dashboard/purchases/orders/${order.id}`}>{order.poNumber}</Link></td><td className="px-3 py-3">{order.locationName}</td><td className="whitespace-nowrap px-3 py-3">{dateLabel(order.orderDate)}</td><td className="whitespace-nowrap px-3 py-3">TZS {money(order.totalAmount)}</td><td className="whitespace-nowrap px-3 py-3">TZS {money(order.balanceDue)}</td><td className="px-3 py-3">{order.status}</td></tr>)}{!orders.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-[#687368] dark:text-white/55">No purchase orders recorded.</td></tr> : null}</tbody></table></div></section>
    </div>
    {confirmDelete ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setConfirmDelete(false); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-supplier-title" className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-2xl dark:border-rose-950 dark:bg-[#191b19]"><h2 id="delete-supplier-title" className="text-lg font-bold">Delete this supplier?</h2><p className="mt-2 text-sm leading-6 text-[#5f695d] dark:text-white/65">This permanently removes <strong>{supplier.name}</strong>. The server allows deletion only when there are no purchase orders, payments, returns or opening balance. Otherwise deactivate the supplier to keep its history.</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="min-h-9 rounded-md border border-[#d8ddd3] px-3 text-sm font-semibold dark:border-white/15">Cancel</button><button type="button" disabled={deleting} onClick={() => void deleteSupplier()} className="min-h-9 rounded-md bg-rose-700 px-3 text-sm font-semibold text-white disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete supplier'}</button></div></section></div> : null}
  </main>;
}
function Summary({ title, value }: { title: string; value: number }) { return <article className="rounded-xl border border-[#cde9d9] bg-emerald-50/65 p-4 dark:border-emerald-950 dark:bg-[#141a16]"><p className="text-xs text-[#687368] dark:text-white/55">{title}</p><p className="mt-2 truncate text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300"><AnimatedNumber value={value} format={(number) => `TZS ${money(number)}`}/></p></article>; }
