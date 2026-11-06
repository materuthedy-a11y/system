'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { expensesAPI, type ExpenseOptions, type ExpenseRecord } from '@/lib/api/expenses';
import { financeAPI, type FinancePayment } from '@/lib/api/finance';
import { getApiError } from '@/lib/api';
import { formatBusinessDate, formatBusinessDateTime } from '@/lib/format/businessDate';
import { useAuthStore } from '@/store/authStore';
import { notify } from '@/components/ui/AppToaster';

const panel = 'min-w-0 rounded-2xl border border-[#e4e7df] bg-white p-4 shadow-sm sm:p-5 dark:border-white/[0.08] dark:bg-[#171a17]';
const field = 'min-h-10 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm text-[#30342e] outline-none focus:border-[#8c741e] focus:ring-2 focus:ring-[#d9bf55]/25 dark:border-white/10 dark:bg-[#111310] dark:text-white';
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
type Action = 'approve' | 'reject' | 'pay' | 'delete' | 'submit' | null;

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canView = permissions.includes('expenses.view');
  const canCreate = permissions.includes('expenses.create');
  const canEdit = permissions.includes('expenses.edit');
  const canDelete = permissions.includes('expenses.delete');
  const canApprove = permissions.includes('expenses.approve');
  const canPay = permissions.includes('expenses.pay') || permissions.includes('payments.create');
  const canViewPayments = permissions.includes('payments.view');
  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [options, setOptions] = useState<ExpenseOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<Action>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const load = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [row, opts, paymentPage] = await Promise.all([
        expensesAPI.get(id), expensesAPI.options(),
        canViewPayments ? financeAPI.payments({ expenseId: id, page: 1, limit: 100 }) : Promise.resolve(null),
      ]);
      setExpense(row); setOptions(opts); setCurrency(opts.currency || 'TZS');
      setPayments(paymentPage?.data || []);
      if (!paymentMethodId && opts.paymentMethods.length) setPaymentMethodId(opts.paymentMethods[0].id);
      setAmount(String(row.totalAmount));
    } catch (cause) { setError(getApiError(cause, 'Could not load this expense.')); }
    finally { setLoading(false); }
  }, [canView, canViewPayments, id, paymentMethodId]);
  useEffect(() => { void load(); }, [load]);

  async function runAction(event: React.FormEvent) {
    event.preventDefault(); if (!expense || !action) return;
    setBusy(true); setError('');
    try {
      if (action === 'approve') await expensesAPI.approve(id, notes.trim() || undefined);
      else if (action === 'reject') { if (!notes.trim()) throw new Error('Enter a reason for rejecting this expense.'); await expensesAPI.reject(id, notes.trim()); }
      else if (action === 'submit') await expensesAPI.submit(id);
      else if (action === 'pay') {
        const method = options?.paymentMethods.find((item) => item.id === paymentMethodId);
        if (!paymentMethodId) throw new Error('Choose a payment method.');
        if (method?.requiresReference && !transactionReference.trim()) throw new Error(`${method.name} requires a transaction reference.`);
        const amountValue = Number(amount);
        if (!Number.isFinite(amountValue) || amountValue <= 0 || amountValue > (expense.balanceDue ?? expense.totalAmount)) throw new Error('Enter a payment amount greater than zero and no more than the remaining balance.');
        await expensesAPI.pay(id, { paymentMethodId, amount: amountValue, transactionReference: transactionReference.trim() || undefined, notes: notes.trim() || undefined });
      } else if (action === 'delete') { await expensesAPI.delete(id); notify.success('Draft expense deleted.'); router.push('/dashboard/expenses'); return; }
      notify.success(action === 'approve' ? 'Expense approved.' : action === 'reject' ? 'Expense rejected.' : action === 'submit' ? 'Expense submitted for approval.' : 'Expense payment recorded.');
      setAction(null); setNotes(''); setTransactionReference(''); await load();
    } catch (cause) { const message = cause instanceof Error && !('response' in cause) ? cause.message : getApiError(cause, 'Could not complete this expense action.'); setError(message); notify.error(message); }
    finally { setBusy(false); }
  }

  if (!canView) return <section className={panel}><h1 className="font-semibold text-[#30342e] dark:text-white">Expense access required</h1><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Your account cannot view this expense.</p></section>;
  if (loading) return <div role="status" className={`${panel} grid min-h-44 place-items-center text-sm text-[#687064] dark:text-[#b3bbb0]`}><span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin"/>Loading expense…</span></div>;
  if (!expense) return <section className={panel}><p role="alert" className="text-sm text-rose-800 dark:text-rose-200">{error || 'Expense not found.'}</p><button onClick={() => void load()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold dark:border-white/10"><RefreshCw size={14}/>Retry</button></section>;

  const isDraft = expense.status === 'DRAFT';
  const canSubmit = isDraft && canCreate;
  const canApproveNow = ['DRAFT', 'PENDING_APPROVAL'].includes(expense.status) && canApprove && expense.createdBy?.id !== useAuthStore.getState().user?.id;
  const canRejectNow = ['DRAFT', 'PENDING_APPROVAL'].includes(expense.status) && canApprove;
  const method = options?.paymentMethods.find((item) => item.id === paymentMethodId);
  return <div className="min-w-0 space-y-5">
    <Link href="/dashboard/expenses" className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#5a6256] hover:text-emerald-800 dark:text-[#c3c9bf] dark:hover:text-emerald-300"><ArrowLeft size={16}/>Back to expenses</Link>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">{error}</div> : null}
    <section className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-[#282317] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a6214] dark:text-[#e1c75b]">Expense · {expense.categoryName}</p><h1 className="mt-1 break-all text-2xl font-semibold text-[#20231f] dark:text-white">{expense.expenseNumber}</h1><p className="mt-1 text-sm text-[#626b51] dark:text-[#c1bda9]">{expense.description} · {expense.location?.name || 'Business-wide'}</p></div><div className="text-right"><p className="text-2xl font-bold text-[#2c302a] dark:text-white">{money(expense.totalAmount, currency)}</p><span className="mt-1 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-[#545b50] dark:bg-black/20 dark:text-white/80">{expense.status.replace(/_/g, ' ')}</span></div></div><div className="mt-4 flex flex-wrap gap-2">{isDraft && canEdit ? <Link href={`/dashboard/expenses/${id}/edit`} className="min-h-9 rounded-lg border border-[#d9d1b7] px-3 py-2 text-xs font-semibold dark:border-white/10">Edit draft</Link> : null}{canSubmit ? <button type="button" onClick={() => { setAction('submit'); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#20211f] px-3 text-xs font-semibold text-white dark:bg-emerald-900"><Send size={14}/>Submit for approval</button> : null}{canApproveNow ? <button type="button" onClick={() => { setNotes(''); setAction('approve'); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white"><Check size={14}/>Approve</button> : null}{canRejectNow ? <button type="button" onClick={() => { setNotes(''); setAction('reject'); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:text-rose-200"><X size={14}/>Reject</button> : null}{isDraft && canDelete ? <button type="button" onClick={() => setAction('delete')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:text-rose-200"><Trash2 size={14}/>Delete draft</button> : null}{expense.status === 'APPROVED' && canPay && (expense.balanceDue ?? expense.totalAmount) > 0 ? <button type="button" onClick={() => { setNotes(''); setAmount(String(expense.balanceDue ?? expense.totalAmount)); setAction('pay'); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white">Record payment</button> : null}</div></section>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]"><section className={panel}><h2 className="mb-4 text-base font-bold text-[#30342e] dark:text-white">Expense lines</h2><div className="divide-y divide-[#eceee8] dark:divide-white/[0.08]">{expense.items.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"><div><p className="font-semibold text-[#30342e] dark:text-white">{item.categoryName}</p><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{item.description || 'No line note'}</p></div><p className="font-bold text-[#30342e] dark:text-white">{money(item.amount, currency)}</p></div>)}</div><div className="mt-3 flex justify-between border-t border-[#eceee8] pt-3 font-bold dark:border-white/[0.08]"><span>Total</span><span>{money(expense.totalAmount, currency)}</span></div></section>
      <section className={panel}><h2 className="mb-4 text-base font-bold text-[#30342e] dark:text-white">Record details</h2><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Expense date</dt><dd className="mt-1 font-semibold">{formatBusinessDate(expense.expenseDate)}</dd></div><div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Supplier</dt><dd className="mt-1 font-semibold">{expense.supplier?.name || '—'}</dd></div><div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Reference</dt><dd className="mt-1 break-all font-semibold">{expense.reference || '—'}</dd></div><div><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Budget code</dt><dd className="mt-1 break-all font-semibold">{expense.budgetCode || '—'}</dd></div>{expense.notes ? <div className="sm:col-span-2"><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{expense.notes}</dd></div> : null}{expense.attachment ? <div className="sm:col-span-2"><dt className="text-xs text-[#737a70] dark:text-[#aeb6aa]">Supporting receipt</dt><dd className="mt-1"><a href={expense.attachment} target="_blank" rel="noreferrer" className="break-all text-emerald-800 underline dark:text-emerald-300">Open attachment link</a></dd></div> : null}</dl></section></div>
    <section className={panel}><h2 className="mb-3 text-base font-bold text-[#30342e] dark:text-white">Approval history</h2><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#f7f8f4] p-3 dark:bg-white/[0.03]"><p className="text-xs font-semibold">Created</p><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{expense.createdBy?.name || 'User'} · {formatBusinessDateTime(expense.createdAt)}</p></div>{expense.approvedAt ? <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20"><p className="text-xs font-semibold">Approved · {expense.approvedBy?.name || 'Reviewer'}</p><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{formatBusinessDateTime(expense.approvedAt)}</p>{expense.approvalNotes ? <p className="mt-2 whitespace-pre-wrap text-xs">{expense.approvalNotes}</p> : null}</div> : null}{expense.rejectedAt ? <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/20"><p className="text-xs font-semibold">Rejected · {expense.rejectedBy?.name || 'Reviewer'}</p><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{formatBusinessDateTime(expense.rejectedAt)}</p><p className="mt-2 whitespace-pre-wrap text-xs">{expense.rejectionReason}</p></div> : null}{expense.paidAt ? <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20"><p className="text-xs font-semibold">Paid · {expense.paidBy?.name || 'User'}</p><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{formatBusinessDateTime(expense.paidAt)} · {expense.paymentMethod?.name || 'Payment method'}</p><p className="mt-1 break-all text-xs">{expense.paymentReference || ''}</p></div> : null}</div></section>
    {canViewPayments ? <section className={panel}><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-[#30342e] dark:text-white">Payment history</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">Linked expense payments are also available in the finance register.</p></div><Link href={`/dashboard/finance?expenseId=${encodeURIComponent(id)}`} className="shrink-0 text-xs font-semibold text-emerald-800 underline dark:text-emerald-300">Finance register →</Link></div>{payments.length ? <div className="divide-y divide-[#eceee8] dark:divide-white/[0.08]">{payments.map((payment) => <Link key={payment.id} href={`/dashboard/finance/payments/${payment.id}`} className="flex min-w-0 items-center gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold text-[#30342e] dark:text-white">{payment.paymentNumber}</p><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{formatBusinessDate(payment.paymentDate)} · {payment.paymentMethodName} · {payment.status}</p>{payment.transactionId ? <p className="mt-1 break-all text-[11px] text-[#737a70] dark:text-[#aeb6aa]">Ref: {payment.transactionId}</p> : null}</div><p className="shrink-0 text-sm font-bold text-[#30342e] dark:text-white">{money(payment.amount, currency)}</p><span className="text-emerald-800 dark:text-emerald-300">→</span></Link>)}</div> : <p className="py-5 text-center text-sm text-[#737a70] dark:text-[#aeb6aa]">No expense payments recorded.</p>}</section> : null}
    {action ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4"><form onSubmit={(event) => void runAction(event)} role="dialog" aria-modal="true" aria-labelledby="expense-action-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-[#e4e7df] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#171a17]"><div><h2 id="expense-action-title" className="text-lg font-bold text-[#252923] dark:text-white">{action === 'approve' ? 'Approve expense' : action === 'reject' ? 'Reject expense' : action === 'pay' ? 'Record expense payment' : action === 'delete' ? 'Delete draft expense?' : 'Submit for approval'}</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">{action === 'pay' ? 'Payment is linked to this expense, appears in the finance ledger, and updates its remaining balance.' : action === 'delete' ? 'Only draft expenses can be deleted.' : 'The server validates workflow state, permissions, budgets and accounting periods.'}</p></div>{action === 'approve' ? <label className="block text-xs font-semibold">Approval note (optional)<textarea maxLength={1000} rows={3} className={`${field} mt-1 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)}/></label> : null}{action === 'reject' ? <label className="block text-xs font-semibold">Reason required<textarea required maxLength={1000} rows={3} className={`${field} mt-1 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)}/></label> : null}{action === 'pay' ? <><label className="block text-xs font-semibold">Amount ({currency})<input required type="number" min="0.01" max={expense.balanceDue ?? expense.totalAmount} step="0.01" className={`${field} mt-1`} value={amount} onChange={(event) => setAmount(event.target.value)}/></label><label className="block text-xs font-semibold">Payment method<select required className={`${field} mt-1`} value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}><option value="">Choose method</option>{options?.paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{method?.requiresReference ? <label className="block text-xs font-semibold">Transaction reference *<input required maxLength={160} className={`${field} mt-1`} value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)}/></label> : <label className="block text-xs font-semibold">Transaction reference (optional)<input maxLength={160} className={`${field} mt-1`} value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)}/></label>}<label className="block text-xs font-semibold">Notes (optional)<textarea maxLength={1000} rows={2} className={`${field} mt-1 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)}/></label></> : null}<div className="flex justify-end gap-2"><button type="button" onClick={() => setAction(null)} className="min-h-10 rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold dark:border-white/10">Cancel</button>{action === 'submit' ? <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await expensesAPI.submit(id); notify.success('Expense submitted for approval.'); setAction(null); await load(); } catch (cause) { const message = getApiError(cause, 'Could not submit expense.'); setError(message); notify.error(message); } finally { setBusy(false); } }} className="min-h-10 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit expense'}</button> : <button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-900">{busy ? 'Saving…' : action === 'delete' ? 'Confirm delete' : action === 'pay' ? 'Record payment' : action === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</button>}</div></form></div> : null}
  </div>;
}
