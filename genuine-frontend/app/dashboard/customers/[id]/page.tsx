'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { customersAPI, type Customer, type CustomerActivity, type CustomerActivityType, type CustomerStatement } from '@/lib/api/customers';
import { CustomerAvatar } from '@/components/customers/CustomerPhoto';
import { money, dateLabel } from '@/components/sales/SalesPrimitives';
import { notify } from '@/components/ui/AppToaster';

const surface = 'rounded-xl border border-[#d8dfd5] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151815] sm:p-5';
const input = 'min-h-10 rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canView = permissions.includes('customers.view');
  const canEdit = permissions.includes('customers.edit');
  const canDelete = permissions.includes('customers.delete');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activity, setActivity] = useState<CustomerActivity[]>([]);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(true);
  const [error, setError] = useState('');
  const [activityError, setActivityError] = useState('');
  const [type, setType] = useState<CustomerActivityType>('NOTE');
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const activityDetailsRef = useRef<HTMLTextAreaElement | null>(null);
  const [reference, setReference] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadCustomer = useCallback(async () => {
    try { setError(''); setCustomer(await customersAPI.get(params.id)); }
    catch (cause) { setError(getApiError(cause, 'Could not load this customer.')); }
    finally { setLoading(false); }
  }, [params.id]);
  const loadStatement = useCallback(async () => {
    try { setStatementLoading(true); setStatement(await customersAPI.statement(params.id, { month })); }
    catch (cause) { setActivityError(getApiError(cause, 'Could not load the customer statement.')); }
    finally { setStatementLoading(false); }
  }, [params.id, month]);
  const loadActivity = useCallback(async () => {
    try { setActivityError(''); setActivity(await customersAPI.activities(params.id)); }
    catch (cause) { setActivityError(getApiError(cause, 'Could not load customer activity.')); }
  }, [params.id]);
  useEffect(() => { if (canView) { void loadCustomer(); void loadActivity(); void loadStatement(); } else setLoading(false); }, [canView, loadCustomer, loadActivity, loadStatement]);

  async function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim()) {
      setDescriptionError('Enter a clear summary for this interaction.');
      activityDetailsRef.current?.focus();
      return;
    }
    setDescriptionError('');
    setSavingActivity(true); setActivityError('');
    try { await customersAPI.addActivity(params.id, { type, description: description.trim(), reference: reference.trim() || undefined }); setDescription(''); setReference(''); await loadActivity(); notify.success('Customer interaction recorded.'); }
    catch (cause) { setActivityError(getApiError(cause, 'Could not record this interaction.')); }
    finally { setSavingActivity(false); }
  }

  async function deleteCustomer() {
    setDeleting(true);
    setDeleteError('');
    try { await customersAPI.remove(params.id); notify.success('Customer deleted.'); window.location.assign('/dashboard/customers'); }
    catch (cause) { setDeleteError(getApiError(cause, 'Could not delete this customer. Keep its history and change its status instead.')); }
    finally { setDeleting(false); }
  }

  if (!canView) return <main className="mx-auto w-full max-w-6xl p-4 sm:p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100"><h1 className="text-lg font-bold">Customer access required</h1><p className="mt-1">Your account is not allowed to view customers.</p></section></main>;
  if (loading) return <main role="status" className="mx-auto w-full max-w-6xl p-5 text-sm text-[#5f695d] dark:text-white/65"><Loader2 className="mr-2 inline animate-spin" size={16}/>Loading customer…</main>;
  if (!customer) return <main className="mx-auto w-full max-w-6xl p-4 sm:p-6"><div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error || 'Customer not found.'}<button onClick={() => void loadCustomer()} className="ml-3 rounded-md border border-rose-300 px-3 py-1 font-semibold">Retry</button></div></main>;

  const statusColors: Record<Customer['status'], string> = { ACTIVE: 'bg-emerald-600 text-white', SUSPENDED: 'bg-amber-400 text-amber-950', BLACKLISTED: 'bg-rose-600 text-white', ARCHIVED: 'bg-slate-600 text-white' };
  const creditColor = customer.creditLimit > 0 && customer.outstandingBalance > customer.creditLimit ? 'text-rose-700 dark:text-rose-300' : customer.creditLimit > 0 && customer.creditUtilization >= 80 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300';
  return <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard/customers" className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[#3f5846] hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-white/5"><ArrowLeft size={16}/>Customers</Link><div className="flex gap-2">{canEdit ? <Link href={`/dashboard/customers/${customer.id}/edit`} className="inline-flex min-h-9 items-center rounded-md border border-[#cbd8cc] px-3 text-sm font-semibold hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-white/5">Edit customer</Link> : null}{canDelete ? <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={14}/>Delete</button> : null}</div></div>
    <section className="mb-4 rounded-xl border border-[#cde9d9] bg-emerald-50/75 p-5 dark:border-emerald-900/60 dark:bg-[#141a16]"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-4"><CustomerAvatar customerId={customer.id} photoId={customer.photoId} className="h-16 w-16 sm:h-20 sm:w-20"/><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">{customer.customerCode} · {customer.customerType}</p><h1 className="mt-1 truncate text-2xl font-bold text-[#1f2c23] dark:text-white">{customer.name}</h1><p className="mt-1 break-all text-sm text-[#566458] dark:text-white/65">{customer.email} · {customer.phone}</p></div></div><span className={`inline-flex rounded-md px-3 py-1.5 text-xs font-bold ${statusColors[customer.status]}`}>{customer.status}</span></div></section>
    <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary title="Outstanding balance" value={`TZS ${money(customer.outstandingBalance)}`} tone={creditColor}/><Summary title="Credit limit" value={`TZS ${money(customer.creditLimit)}`} tone="text-blue-800 dark:text-blue-300"/><Summary title="Sales to date" value={`TZS ${money(customer.totalSales)}`} tone="text-emerald-800 dark:text-emerald-300"/><Summary title="Payments received" value={`TZS ${money(customer.totalPaid)}`} tone="text-[#81600e] dark:text-amber-300"/></section>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <section className={surface}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold text-[#283329] dark:text-white">Account statement</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">Sales, payments and accepted returns in this period.</p></div><label className="text-xs font-semibold">Period<input aria-label="Statement month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${input} ml-2`} /></label></div>
        {statementLoading ? <p role="status" className="py-8 text-center text-sm text-[#687368] dark:text-white/60"><Loader2 size={16} className="mr-2 inline animate-spin"/>Loading statement…</p> : statement ? <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Opening', statement.openingBalance], ['Sales', statement.sales], ['Payments', statement.payments], ['Returns', statement.returns]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-950 dark:bg-[#14171d]"><p className="text-[11px] text-[#667281] dark:text-white/55">{label}</p><p className="mt-1 text-sm font-bold tabular-nums">TZS {money(Number(value))}</p></div>)}</div><div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/75 px-3 py-3 dark:border-amber-950 dark:bg-[#191710]"><span className="text-sm font-semibold">Closing balance</span><strong className="text-sm tabular-nums">TZS {money(statement.closingBalance)}</strong></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="bg-[#f4f6f2] text-[#566155] dark:bg-[#101210] dark:text-white/60"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{statement.invoices.length ? statement.invoices.map((entry, index) => <tr key={`${entry.type}-${entry.invoiceNumber}-${index}`}><td className="px-3 py-2.5">{dateLabel(entry.date)}</td><td className="px-3 py-2.5">{entry.type}</td><td className="px-3 py-2.5">{entry.invoiceNumber}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums">TZS {money(entry.amount)}</td></tr>) : <tr><td colSpan={4} className="px-3 py-5"><EmptyState compact title="No account movements in this period." /></td></tr>}</tbody></table></div></> : <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{activityError}<button onClick={() => void loadStatement()} className="ml-2 font-bold underline">Retry</button></div>}
      </section>
      <section className={surface}>
        <h2 className="text-base font-bold text-[#283329] dark:text-white">Customer information</h2>
        <dl className="mt-4 space-y-3 text-sm">
          {[
            ['Email', customer.email], ['Phone', customer.phone], ['Other phone', customer.secondaryPhone || '—'],
            ['Tax ID', customer.taxId || '—'], ['Payment terms', customer.paymentTerms],
            ['Credit used', `${money(customer.creditUtilization)}%`],
            ['Address', customer.address ? [customer.address.street, customer.address.city, customer.address.region, customer.address.country].filter(Boolean).join(', ') : '—'],
          ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-[#edf0eb] pb-2 last:border-0 dark:border-white/[0.07]"><dt className="text-[#697468] dark:text-white/55">{label}</dt><dd className="max-w-[65%] break-words text-right font-semibold text-[#2d372e] dark:text-white/85">{value}</dd></div>)}
        </dl>
        {customer.description ? <div className="mt-4 rounded-lg border border-[#ead9a8] bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/15"><h3 className="text-xs font-bold uppercase tracking-wide text-[#76570c] dark:text-amber-300">Notes</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#343b33] dark:text-white/80">{customer.description}</p></div> : null}
        <p className={`mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold ${creditColor} dark:bg-emerald-950/20`}>{customer.creditLimit <= 0 ? 'No credit limit configured.' : customer.outstandingBalance > customer.creditLimit ? 'Credit limit exceeded.' : customer.creditUtilization >= 80 ? 'Credit use is near the limit.' : 'Credit is within the configured limit.'}</p>
        <h3 className="mt-5 text-sm font-bold">Additional contacts</h3>
        {customer.contacts.length ? <ul className="mt-2 space-y-2">{customer.contacts.map((contact) => <li key={contact.id} className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]"><p className="font-semibold">{contact.firstName} {contact.lastName}{contact.isPrimary ? ' · Primary' : ''}</p><p className="mt-1 text-[#687368] dark:text-white/55">{contact.position || 'Contact'} · {contact.phone} · {contact.email}</p></li>)}</ul> : <p className="mt-2 text-xs text-[#687368] dark:text-white/55">No additional contacts.</p>}
      </section>
    </div>
    <section className={`${surface} mt-4`}><div className="flex items-center gap-2"><ReceiptText size={17} className="text-emerald-700 dark:text-emerald-300"/><h2 className="text-base font-bold text-[#283329] dark:text-white">Interaction history</h2></div><p className="mt-1 text-xs text-[#687368] dark:text-white/55">Record customer calls, visits, emails or notes.</p>
      {activityError ? <div role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{activityError}<button onClick={() => void loadActivity()} className="ml-2 font-bold underline">Retry</button></div> : null}
      {canEdit ? <form onSubmit={addActivity} className="mt-4 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_180px_auto]"><label className="text-xs font-semibold">Interaction<select value={type} onChange={(e) => setType(e.target.value as CustomerActivityType)} className={`${input} mt-1 block w-full`}><option value="NOTE">Note</option><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="VISIT">Visit</option></select></label><label className="text-xs font-semibold">Details<textarea ref={activityDetailsRef} required maxLength={2000} rows={2} value={description} aria-invalid={Boolean(descriptionError)} aria-describedby={descriptionError ? 'customer-interaction-details-error' : 'customer-interaction-details-count'} onChange={(e) => { setDescription(e.target.value); if (e.target.value.trim()) setDescriptionError(''); }} className={`${input} mt-1 block w-full py-2`} placeholder="Add a clear summary…" />{descriptionError ? <span id="customer-interaction-details-error" role="alert" className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-300">{descriptionError}</span> : <span id="customer-interaction-details-count" className="mt-1 block text-right text-[11px] font-normal text-[#687368] dark:text-white/50">{description.length}/2000</span>}</label><label className="text-xs font-semibold">Reference (optional)<input maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} className={`${input} mt-1 block w-full`} /></label><button disabled={savingActivity} aria-busy={savingActivity} className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600"><Plus size={15}/>{savingActivity ? 'Saving…' : 'Add entry'}</button></form> : null}
      <div className="mt-4 divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{activity.length ? activity.map((entry) => <article key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">{entry.type}</span><time className="text-xs text-[#737d71] dark:text-white/50">{dateLabel(entry.createdAt)} · {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Team member'}</time></div><p className="mt-2 break-words whitespace-pre-wrap text-sm text-[#303a31] dark:text-white/80">{entry.description}</p>{entry.reference ? <p className="mt-1 break-all text-xs text-[#687368] dark:text-white/55">Ref: {entry.reference}</p> : null}</article>) : <div className="py-4"><EmptyState compact title="No interactions recorded yet." /></div>}</div>
    </section>
    {confirmDelete ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setConfirmDelete(false); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-customer-title" className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-2xl dark:border-rose-950 dark:bg-[#191b19]"><h2 id="delete-customer-title" className="text-lg font-bold text-[#252b25] dark:text-white">Delete this customer?</h2><p className="mt-2 text-sm leading-6 text-[#5f695d] dark:text-white/65">This permanently removes <strong>{customer.name}</strong> and its contact details. Customers with sales, payments or returns cannot be deleted.</p>{deleteError ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{deleteError}</p> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="min-h-9 rounded-md border border-[#d8ddd3] px-3 text-sm font-semibold dark:border-white/15">Cancel</button><button type="button" disabled={deleting} onClick={() => void deleteCustomer()} className="min-h-9 rounded-md bg-rose-700 px-3 text-sm font-semibold text-white disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete customer'}</button></div></section></div> : null}
  </main>;
}

function Summary({ title, value, tone }: { title: string; value: string; tone: string }) { return <article className="rounded-xl border border-[#cde9d9] bg-emerald-50/65 p-4 dark:border-emerald-950 dark:bg-[#141a16]"><p className="text-xs text-[#687368] dark:text-white/55">{title}</p><p className={`mt-2 truncate text-lg font-bold ${tone}`}>{value}</p></article>; }
