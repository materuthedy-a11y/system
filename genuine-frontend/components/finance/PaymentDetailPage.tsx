'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Wallet, XCircle } from 'lucide-react';
import { financeAPI, type FinancePayment } from '@/lib/api/finance';
import { getApiError } from '@/lib/api';
import { formatBusinessDate, formatBusinessDateTime } from '@/lib/format/businessDate';
import { useAuthStore } from '@/store/authStore';
import { notify } from '@/components/ui/AppToaster';

const panel = 'rounded-2xl border border-[#e4e7df] bg-white p-4 shadow-sm sm:p-5 dark:border-white/[0.08] dark:bg-[#171a17]';
const field = 'min-h-10 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm text-[#30342e] outline-none transition focus:border-[#8c741e] focus:ring-2 focus:ring-[#d9bf55]/25 dark:border-white/10 dark:bg-[#111310] dark:text-white';
const money = (amount: number, currency = 'TZS') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));

function sourceDetails(payment: FinancePayment) {
  if (payment.invoiceId) return { label: payment.invoice?.invoiceNumber || payment.sourceReference || 'Sales invoice', href: `/dashboard/sales/invoices/${payment.invoiceId}` };
  if (payment.poId) return { label: payment.po?.poNumber || payment.sourceReference || 'Purchase order', href: `/dashboard/purchases/orders/${payment.poId}` };
  if (payment.expenseId) return { label: payment.expense?.expenseNumber || payment.sourceReference || 'Expense', href: `/dashboard/expenses/${payment.expenseId}` };
  return null;
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canView = permissions.includes('payments.view');
  const canManage = permissions.includes('payments.create');
  const [payment, setPayment] = useState<FinancePayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'reconcile' | 'void' | null>(null);
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try { setPayment(await financeAPI.payment(params.id)); }
    catch (cause) { setError(getApiError(cause, 'Could not load this payment record.')); }
    finally { setLoading(false); }
  }, [canView, params.id]);
  useEffect(() => { void load(); }, [load]);

  async function submitAction(event: React.FormEvent) {
    event.preventDefault();
    if (!payment || !mode) return;
    if (mode === 'reconcile' && !bankReference.trim()) { setError('Bank statement reference is required.'); return; }
    if (mode === 'void' && !reason.trim()) { setError('A reason is required to void a payment.'); return; }
    setBusy(true); setError('');
    try {
      if (mode === 'reconcile') await financeAPI.reconcilePayment(payment.id, bankReference.trim(), notes.trim() || undefined);
      else await financeAPI.voidPayment(payment.id, reason.trim());
      notify.success(mode === 'reconcile' ? 'Payment reconciled.' : 'Payment voided.');
      setMode(null); setBankReference(''); setNotes(''); setReason(''); await load();
    } catch (cause) { const message = getApiError(cause, 'Could not update this payment.'); setError(message); notify.error(message); }
    finally { setBusy(false); }
  }

  if (!canView) return <section className={panel}><h1 className="text-lg font-semibold text-[#30342e] dark:text-white">Payment access required</h1><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Your account cannot view payment details.</p></section>;
  if (loading) return <div role="status" className={`${panel} grid min-h-48 place-items-center text-sm text-[#687064] dark:text-[#b3bbb0]`}><span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin"/>Loading payment…</span></div>;
  if (!payment) return <section className={panel}><p role="alert" className="text-sm text-rose-800 dark:text-rose-200">{error || 'Payment not found.'}</p><button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#dfe2da] px-3 text-xs font-semibold dark:border-white/10"><RefreshCw size={14}/>Retry</button></section>;

  const source = sourceDetails(payment);
  const mayReconcile = canManage && !payment.isReconciled && payment.status !== 'RECONCILED' && payment.status !== 'VOIDED';
  const mayVoid = canManage && !payment.isReconciled && payment.status !== 'RECONCILED' && payment.status !== 'VOIDED';
  const direction = payment.direction || (payment.expenseId || payment.poId ? 'OUTFLOW' : 'INFLOW');

  return <div className="min-w-0 space-y-5">
    <Link href="/dashboard/finance" className="inline-flex min-h-9 items-center gap-2 rounded-lg text-sm font-semibold text-[#5a6256] hover:text-emerald-800 dark:text-[#c3c9bf] dark:hover:text-emerald-300"><ArrowLeft size={16}/>Back to Payments &amp; Finance</Link>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">{error}</div> : null}
    <section className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-[#282317] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a6214] dark:text-[#e1c75b]">Payment record</p><h1 className="mt-1 break-all text-2xl font-semibold tracking-tight text-[#20231f] dark:text-white">{payment.paymentNumber}</h1><p className="mt-1 text-sm text-[#626b51] dark:text-[#c1bda9]">{payment.counterpartyName || 'Business transaction'} · {payment.locationName || 'Location not recorded'}</p></div><div className="text-right"><p className="text-2xl font-bold text-[#2c302a] dark:text-white">{money(payment.amount, payment.currency)}</p><span className="mt-1 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-[#545b50] dark:bg-black/20 dark:text-white/80">{payment.status.replace(/_/g, ' ')}</span></div></div>
    </section>
    <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
      <section className={panel}><div className="mb-4 flex items-center gap-2"><Wallet className="text-[#8a7019]" size={18}/><h2 className="text-base font-bold text-[#30342e] dark:text-white">Payment details</h2></div><dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Direction</dt><dd className="mt-1 font-semibold text-[#30342e] dark:text-white">{direction === 'INFLOW' ? 'Money received' : 'Money paid'}</dd></div>
        <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Date</dt><dd className="mt-1 font-semibold text-[#30342e] dark:text-white">{formatBusinessDate(payment.paymentDate)}</dd></div>
        <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Payment method</dt><dd className="mt-1 font-semibold text-[#30342e] dark:text-white">{payment.paymentMethodName}</dd></div>
        <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Source</dt><dd className="mt-1 font-semibold text-[#30342e] dark:text-white">{source ? <Link className="text-emerald-800 underline decoration-emerald-700/40 underline-offset-2 dark:text-emerald-300" href={source.href}>{source.label}</Link> : payment.referenceType || 'Other / unlinked'}</dd></div>
        <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Transaction reference</dt><dd className="mt-1 break-all font-semibold text-[#30342e] dark:text-white">{payment.reference || payment.referenceNumber || payment.transactionId || '—'}</dd></div>
        <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Reconciliation</dt><dd className="mt-1 font-semibold text-[#30342e] dark:text-white">{payment.isReconciled || payment.status === 'RECONCILED' ? `Reconciled${payment.reconciledAt ? ` · ${formatBusinessDateTime(payment.reconciledAt)}` : ''}` : 'Not reconciled'}</dd></div>
        {payment.bankStatementReference ? <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Bank statement reference</dt><dd className="mt-1 break-all font-semibold text-[#30342e] dark:text-white">{payment.bankStatementReference}</dd></div> : null}
        {payment.bankName ? <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Bank</dt><dd className="mt-1 font-semibold text-[#30342e] dark:text-white">{payment.bankName}</dd></div> : null}
        {payment.chequeNumber ? <div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Cheque number</dt><dd className="mt-1 break-all font-semibold text-[#30342e] dark:text-white">{payment.chequeNumber}</dd></div> : null}
        {payment.notes ? <div className="sm:col-span-2"><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium text-[#30342e] dark:text-white">{payment.notes}</dd></div> : null}
        {payment.voidReason ? <div className="sm:col-span-2"><dt className="text-xs text-rose-700 dark:text-rose-300">Void reason</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium text-rose-800 dark:text-rose-200">{payment.voidReason}</dd></div> : null}
      </dl></section>
      <section className={panel}><h2 className="text-base font-bold text-[#30342e] dark:text-white">Payment controls</h2><p className="mt-1 text-xs leading-5 text-[#687064] dark:text-[#b3bbb0]">Reconcile after matching a bank statement. Voiding changes the linked balance and cannot be undone here.</p>
        {payment.status === 'VOIDED' ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/20 dark:text-rose-200">This payment has been voided.</p> : payment.isReconciled || payment.status === 'RECONCILED' ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">This payment is reconciled and cannot be voided.</p> : canManage ? <div className="mt-4 flex flex-wrap gap-2">{mayReconcile ? <button type="button" onClick={() => { setError(''); setMode('reconcile'); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900"><CheckCircle2 size={16}/>Reconcile</button> : null}{mayVoid ? <button type="button" onClick={() => { setError(''); setMode('void'); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-200 dark:hover:bg-rose-950/30"><XCircle size={16}/>Void payment</button> : null}</div> : <p className="mt-4 text-sm text-[#737a70] dark:text-[#aeb6aa]">Your account cannot reconcile or void payments.</p>}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-5 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"><span className="inline-flex items-center gap-1.5 font-bold"><ShieldAlert size={14}/>Control reminder</span><p className="mt-1">Only void an unreconciled payment when the original entry is wrong. The server updates the connected invoice or expense balance.</p></div>
      </section>
    </div>
    {mode ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4"><form onSubmit={(event) => void submitAction(event)} role="dialog" aria-modal="true" aria-labelledby="payment-action-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-[#e4e7df] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#171a17]"><div><h2 id="payment-action-title" className="text-lg font-bold text-[#252923] dark:text-white">{mode === 'reconcile' ? 'Reconcile payment' : 'Void payment?'}</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{mode === 'reconcile' ? 'Enter the matching bank statement reference.' : 'The reason will be saved in the audit record and linked balance will be recalculated.'}</p></div>{mode === 'reconcile' ? <><label className="block text-xs font-semibold">Bank statement reference<input required maxLength={160} className={`${field} mt-1`} value={bankReference} onChange={(event) => setBankReference(event.target.value)} /></label><label className="block text-xs font-semibold">Notes (optional)<textarea maxLength={1000} rows={3} className={`${field} mt-1 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></> : <label className="block text-xs font-semibold">Reason<textarea required minLength={1} maxLength={1000} rows={3} className={`${field} mt-1 py-2`} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setMode(null)} className="min-h-10 rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold dark:border-white/10">Cancel</button><button type="submit" disabled={busy} className={`min-h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${mode === 'void' ? 'bg-rose-800' : 'bg-emerald-800'}`}>{busy ? 'Saving…' : mode === 'reconcile' ? 'Confirm reconciliation' : 'Confirm void'}</button></div></form></div> : null}
  </div>;
}
