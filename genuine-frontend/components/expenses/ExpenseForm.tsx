'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { expensesAPI, type ExpenseInput, type ExpenseOptions, type ExpenseRecord } from '@/lib/api/expenses';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const input = 'min-h-10 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm text-[#30342e] outline-none transition focus:border-[#8c741e] focus:ring-2 focus:ring-[#d9bf55]/25 dark:border-white/10 dark:bg-[#111310] dark:text-white';
const panel = 'rounded-2xl border border-[#e4e7df] bg-white p-4 shadow-sm sm:p-6 dark:border-white/[0.08] dark:bg-[#171a17]';
type DraftItem = { key: string; expenseCategoryId: string; amount: string; description: string; notes: string };
const newKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const newItem = (): DraftItem => ({ key: newKey(), expenseCategoryId: '', amount: '', description: '', notes: '' });

function inputDate(value?: string) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({ mode, expense }: { mode: 'create' | 'edit'; expense?: ExpenseRecord }) {
  const router = useRouter();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const activeLocation = useWorkspaceStore((state) => state.activeLocation);
  const [options, setOptions] = useState<ExpenseOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expenseDate, setExpenseDate] = useState(inputDate(expense?.expenseDate));
  const [description, setDescription] = useState(expense?.description || '');
  const [reference, setReference] = useState(expense?.reference || '');
  const [locationId, setLocationId] = useState(expense?.location?.id || activeLocation?.id || '');
  const [supplierId, setSupplierId] = useState(expense?.supplier?.id || '');
  const [attachmentUrl, setAttachmentUrl] = useState(expense?.attachment || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [budgetCode, setBudgetCode] = useState(expense?.budgetCode || '');
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (expense?.items?.length) return expense.items.map((item) => ({ key: item.id || newKey(), expenseCategoryId: item.expenseCategoryId, amount: String(item.amount), description: item.description || '', notes: item.notes || '' }));
    if (expense) return [{ key: newKey(), expenseCategoryId: expense.expenseCategoryId, amount: String(expense.totalAmount), description: expense.description || '', notes: '' }];
    return [newItem()];
  });
  const canCreate = permissions.includes('expenses.create');
  const canEdit = permissions.includes('expenses.edit');
  const total = useMemo(() => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [items]);
  const currency = options?.currency || 'TZS';

  useEffect(() => {
    let active = true;
    expensesAPI.options().then((result) => { if (active) setOptions(result); })
      .catch((cause) => { if (active) setError(getApiError(cause, 'Could not load expense categories and business options.')); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!expense && !locationId && activeLocation?.id && options?.locations.some((location) => location.id === activeLocation.id)) setLocationId(activeLocation.id);
  }, [activeLocation?.id, expense, locationId, options?.locations]);

  function updateItem(key: string, update: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...update } : item));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (mode === 'create' && !canCreate) { setError('Your account cannot create expenses.'); return; }
    if (mode === 'edit' && !canEdit) { setError('Your account cannot edit expenses.'); return; }
    if (!description.trim()) { setError('Enter a clear description for this expense.'); return; }
    if (!items.length || items.some((item) => !item.expenseCategoryId || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) { setError('Choose a category and a positive amount for every line.'); return; }
    if (attachmentUrl) {
      try { if (new URL(attachmentUrl).protocol !== 'https:') throw new Error(); }
      catch { setError('Attachment must be a valid HTTPS link.'); return; }
    }
    const totalAmount = Math.round((total + Number.EPSILON) * 100) / 100;
    const payload: ExpenseInput = {
      expenseCategoryId: items[0].expenseCategoryId,
      locationId: locationId || undefined,
      supplierId: supplierId || undefined,
      expenseDate: expenseDate,
      description: description.trim(),
      reference: reference.trim() || undefined,
      attachmentUrl: attachmentUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      budgetCode: budgetCode.trim() || undefined,
      totalAmount,
      items: items.map((item) => ({ expenseCategoryId: item.expenseCategoryId, amount: Math.round((Number(item.amount) + Number.EPSILON) * 100) / 100, description: item.description.trim() || undefined, notes: item.notes.trim() || undefined })),
    };
    setSaving(true);
    try {
      const saved = mode === 'create' ? await expensesAPI.create(payload) : await expensesAPI.update(expense!.id, payload);
      notify.success(mode === 'create' ? permissions.includes('expenses.view') ? 'Expense draft created.' : 'Expense draft created. Saved expenses remain hidden without expenses.view.' : 'Expense draft updated.');
      if (mode === 'edit' || permissions.includes('expenses.view')) router.push(`/dashboard/expenses/${saved.id}`);
      else {
        setExpenseDate(inputDate()); setDescription(''); setReference(''); setSupplierId(''); setAttachmentUrl('');
        setNotes(''); setBudgetCode(''); setItems([newItem()]);
        setError('Draft created. Your role can create expenses but cannot open saved drafts; ask an administrator for expenses.view if you need to review them.');
      }
    } catch (cause) { const message = getApiError(cause, mode === 'create' ? 'Could not create this expense.' : 'Could not save this expense.'); setError(message); notify.error(message); }
    finally { setSaving(false); }
  }

  const selectedCategories = items.map((item) => options?.categories.find((category) => category.id === item.expenseCategoryId)).filter(Boolean);
  const budgetHints = Array.from(new Map(selectedCategories.filter((category) => category?.budgetLimit != null).map((category) => [category!.id, category!])).values());

  return <div className="mx-auto min-w-0 max-w-4xl space-y-5">
    <div><Link href={mode === 'edit' && expense ? `/dashboard/expenses/${expense.id}` : permissions.includes('expenses.view') ? '/dashboard/expenses' : '/dashboard'} className="text-xs font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300">← {permissions.includes('expenses.view') ? 'Back to expenses' : 'Back to workspace'}</Link><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#7a6214] dark:text-[#e1c75b]">Expenses</p><h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">{mode === 'create' ? 'New expense' : 'Edit expense draft'}</h1><p className="mt-1 text-sm text-[#687064] dark:text-[#b3bbb0]">Record the expense details first. Payment can only be recorded after approval.</p></div>
    {error ? <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</div> : null}
    {loadingOptions ? <div role="status" className={`${panel} grid min-h-32 place-items-center text-sm text-[#687064] dark:text-[#b3bbb0]`}><span className="flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Loading business options…</span></div> : !options ? <section className={panel}><p className="text-sm text-[#687064] dark:text-[#b3bbb0]">Expense options could not load. Use Refresh or sign in with expense access.</p><button type="button" onClick={() => { setLoadingOptions(true); expensesAPI.options().then(setOptions).catch((cause) => setError(getApiError(cause, 'Could not load expense options.'))).finally(() => setLoadingOptions(false)); }} className="mt-3 min-h-9 rounded-lg border border-[#dfe2da] px-3 text-xs font-semibold dark:border-white/10">Retry</button></section> : <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <section className={panel}><h2 className="mb-4 text-sm font-bold text-[#30342e] dark:text-white">Expense details</h2><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold sm:col-span-2">Description *<input required maxLength={1000} className={`${input} mt-1.5`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Monthly shop rent"/></label>
        <label className="text-xs font-semibold">Expense date *<input required type="date" className={`${input} mt-1.5`} value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)}/></label>
        <label className="text-xs font-semibold">Location<select className={`${input} mt-1.5`} value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Business-wide / not location-specific</option>{options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="text-xs font-semibold">Supplier (optional)<select className={`${input} mt-1.5`} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">No supplier</option>{options.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.supplierCode}</option>)}</select></label>
        <label className="text-xs font-semibold">Reference (optional)<input maxLength={120} className={`${input} mt-1.5`} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Receipt or document number"/></label>
        <label className="text-xs font-semibold sm:col-span-2">Receipt / attachment HTTPS link (optional)<input type="url" maxLength={2048} className={`${input} mt-1.5`} value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="https://…"/><span className="mt-1 block text-[11px] font-normal text-[#7b8176] dark:text-[#aeb6aa]">Attach a secure link to the supporting receipt. Do not paste passwords or private access tokens.</span></label>
        <label className="text-xs font-semibold sm:col-span-2">Notes (optional)<textarea maxLength={1000} rows={3} className={`${input} mt-1.5 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Additional context for the reviewer"/></label>
        <label className="text-xs font-semibold">Budget code (optional)<input maxLength={120} className={`${input} mt-1.5`} value={budgetCode} onChange={(event) => setBudgetCode(event.target.value)} placeholder="e.g. OPEX-RENT"/></label>
      </div></section>
      <section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#30342e] dark:text-white">Expense lines</h2><p className="mt-1 text-xs text-[#687064] dark:text-[#b3bbb0]">Each line must have a category. The server calculates and checks the total.</p></div><button type="button" onClick={() => setItems((current) => [...current, newItem()])} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#cfd8c6] px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-white/10 dark:text-emerald-300 dark:hover:bg-white/[0.03]"><Plus size={15}/>Add line</button></div>
        <div className="space-y-3">{items.map((item, index) => <div key={item.key} className="rounded-xl border border-[#eceee8] p-3 dark:border-white/[0.08]"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-[#596054] dark:text-[#c0c8bd]">Line {index + 1}</p>{items.length > 1 ? <button type="button" onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))} aria-label={`Remove line ${index + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={15}/></button> : null}</div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Category *<select required className={`${input} mt-1`} value={item.expenseCategoryId} onChange={(event) => updateItem(item.key, { expenseCategoryId: event.target.value })}><option value="">Choose category</option>{options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.budgetLimit != null ? ` · budget ${category.budgetLimit}` : ''}</option>)}</select></label><label className="text-xs font-semibold">Amount ({currency}) *<input required type="number" min="0.01" step="0.01" className={`${input} mt-1`} value={item.amount} onChange={(event) => updateItem(item.key, { amount: event.target.value })} placeholder="0.00"/></label><label className="text-xs font-semibold sm:col-span-2">Line note (optional)<input maxLength={500} className={`${input} mt-1`} value={item.description} onChange={(event) => updateItem(item.key, { description: event.target.value })} placeholder="What was purchased or paid for?"/></label></div></div>)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eceee8] pt-4 dark:border-white/[0.08]"><span className="text-sm font-semibold text-[#596054] dark:text-[#c0c8bd]">Total expense</span><span className="text-xl font-bold text-emerald-900 dark:text-emerald-300">{new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(total)}</span></div>
      </section>
      {budgetHints.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-5 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"><p className="font-bold">Budget limits apply on submission or approval.</p><p className="mt-1">{budgetHints.map((category) => `${category!.name}: ${category!.budgetLimit} ${category!.budgetPeriod || 'budget period'}`).join(' · ')}</p></section> : null}
      <div className="flex flex-wrap justify-end gap-2"><Link href={mode === 'edit' && expense ? `/dashboard/expenses/${expense.id}` : permissions.includes('expenses.view') ? '/dashboard/expenses' : '/dashboard'} className="inline-flex min-h-10 items-center rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold dark:border-white/10">Cancel</Link><button type="submit" disabled={saving || loadingOptions || !items.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white hover:bg-[#405641] disabled:opacity-50 dark:bg-emerald-900">{saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} {saving ? 'Saving draft…' : mode === 'create' ? 'Create draft' : 'Save draft'}</button></div>
    </form>}
  </div>;
}
