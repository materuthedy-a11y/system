'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { getApiError } from '@/lib/api';
import { suppliersAPI, type Supplier, type SupplierInput } from '@/lib/api/suppliers';
import { notify } from '@/components/ui/AppToaster';

const input = 'min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm text-[#20231f] outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white';
type Draft = { name: string; supplierCode: string; description: string; email: string; phone: string; secondaryPhone: string; taxId: string; bankName: string; bankAccountNumber: string; bankSwiftCode: string; creditLimit: string; paymentTerms: SupplierInput['paymentTerms']; openingBalance: string; isActive: boolean; contactFirstName: string; contactLastName: string; contactEmail: string; contactPhone: string; contactPosition: string; street: string; city: string; region: string; postalCode: string; country: string };
const empty: Draft = { name: '', supplierCode: '', description: '', email: '', phone: '', secondaryPhone: '', taxId: '', bankName: '', bankAccountNumber: '', bankSwiftCode: '', creditLimit: '0', paymentTerms: 'CASH', openingBalance: '0', isActive: true, contactFirstName: '', contactLastName: '', contactEmail: '', contactPhone: '', contactPosition: '', street: '', city: '', region: '', postalCode: '', country: 'Tanzania' };

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const [form, setForm] = useState<Draft>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supplier) return;
    const contact = supplier.contacts?.[0]; const address = supplier.address;
    setForm({ name: supplier.name, supplierCode: supplier.supplierCode, description: supplier.description || '', email: supplier.email, phone: supplier.phone, secondaryPhone: supplier.secondaryPhone || '', taxId: supplier.taxId || '', bankName: supplier.bankName || '', bankAccountNumber: supplier.bankAccountNumber || '', bankSwiftCode: supplier.bankSwiftCode || '', creditLimit: String(supplier.creditLimit ?? 0), paymentTerms: supplier.paymentTerms as Draft['paymentTerms'], openingBalance: String(supplier.openingBalance ?? 0), isActive: supplier.isActive, contactFirstName: contact?.firstName || '', contactLastName: contact?.lastName || '', contactEmail: contact?.email || '', contactPhone: contact?.phone || '', contactPosition: contact?.position || '', street: address?.street || '', city: address?.city || '', region: address?.region || '', postalCode: address?.postalCode || '', country: address?.country || 'Tanzania' });
  }, [supplier]);
  function set<K extends keyof Draft>(key: K, value: Draft[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const name = form.name.trim(); const email = form.email.trim(); const phone = form.phone.trim();
    if (!name || !email || !phone) { setError('Supplier name, email and phone are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid supplier email address.'); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ''))) { setError('Enter the phone number with a country code, for example +255712345678.'); return; }
    const contactValues = [form.contactFirstName, form.contactLastName, form.contactEmail, form.contactPhone];
    const hasContact = contactValues.some((value) => value.trim());
    if (hasContact && contactValues.some((value) => !value.trim())) { setError('Complete the contact person name, email and phone, or leave all contact fields empty.'); return; }
    if (hasContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) { setError('Enter a valid contact person email address.'); return; }
    const addressValues = [form.street, form.city, form.region, form.postalCode];
    const hasAddress = addressValues.some((value) => value.trim());
    if (hasAddress && addressValues.some((value) => !value.trim())) { setError('Complete street, city, region and postal code, or leave all address fields empty.'); return; }
    const amount = (value: string, label: string) => { const number = Number(value); if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be zero or greater.`); return number; };
    let creditLimit: number; let openingBalance: number;
    try { creditLimit = amount(form.creditLimit, 'Credit limit'); openingBalance = amount(form.openingBalance, 'Opening balance'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the amount fields.'); return; }
    const remainingContacts = supplier?.contacts.slice(1).map(({ firstName, lastName, email, phone, position }) => ({ firstName, lastName, email, phone, position: position || undefined })) || [];
    const payload: SupplierInput = { name, email, phone: phone.replace(/[\s()-]/g, ''), description: form.description.trim() || undefined, secondaryPhone: form.secondaryPhone.trim() || undefined, taxId: form.taxId.trim() || undefined, bankName: form.bankName.trim() || undefined, bankAccountNumber: form.bankAccountNumber.trim() || undefined, bankSwiftCode: form.bankSwiftCode.trim() || undefined, creditLimit, paymentTerms: form.paymentTerms, isActive: form.isActive, ...(hasContact ? { contacts: [{ firstName: form.contactFirstName.trim(), lastName: form.contactLastName.trim(), email: form.contactEmail.trim(), phone: form.contactPhone.trim().replace(/[\s()-]/g, ''), position: form.contactPosition.trim() || undefined }, ...remainingContacts] } : supplier?.contacts.length ? { contacts: remainingContacts } : {}), ...(hasAddress ? { address: { street: form.street.trim(), city: form.city.trim(), region: form.region.trim(), postalCode: form.postalCode.trim(), country: form.country.trim() || 'Tanzania' } } : supplier?.address ? { address: null } : {}) };
    if (!supplier) { payload.supplierCode = form.supplierCode.trim() || undefined; payload.openingBalance = openingBalance; }
    setLoading(true);
    try {
      const result = supplier ? await suppliersAPI.update(supplier.id, payload) : await suppliersAPI.create(payload);
      notify.success(supplier ? 'Supplier changes saved.' : 'Supplier created.');
      router.replace(`/dashboard/suppliers/${result.id}`);
    } catch (cause) { setError(getApiError(cause, supplier ? 'Could not save supplier changes.' : 'Could not create the supplier.')); }
    finally { setLoading(false); }
  }
  const field = (label: string, key: keyof Draft, options: { required?: boolean; type?: string; placeholder?: string; disabled?: boolean } = {}) => <label className="block min-w-0 text-xs font-semibold text-[#39443a] dark:text-white/80">{label}{options.required ? ' *' : ''}<input required={options.required} type={options.type || 'text'} value={String(form[key])} placeholder={options.placeholder} disabled={options.disabled} onChange={(event) => set(key, event.target.value as never)} className={`${input} mt-1 disabled:opacity-60`} /></label>;
  return <main className="mx-auto w-full min-w-0 max-w-4xl p-4 sm:p-6">
    <Link href={supplier ? `/dashboard/suppliers/${supplier.id}` : '/dashboard/suppliers'} className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#536052] hover:bg-emerald-50 dark:text-white/70 dark:hover:bg-white/5"><ArrowLeft size={16}/>Back to suppliers</Link>
    <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Suppliers</p><h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">{supplier ? 'Edit supplier' : 'New supplier'}</h1><p className="mt-1 text-sm text-[#667064] dark:text-white/60">{supplier ? 'Update contact details and account terms.' : 'Set up a supplier for purchase orders and account tracking.'}</p></div>
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <section className="rounded-xl border border-[#d8dfd5] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151815] sm:p-5"><h2 className="text-sm font-bold">Supplier details</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{field('Supplier or business name', 'name', { required: true })}{field('Supplier code', 'supplierCode', { disabled: !!supplier, placeholder: supplier?.supplierCode || 'Generated automatically' })}{field('Email address', 'email', { required: true, type: 'email' })}{field('Phone number with country code', 'phone', { required: true, type: 'tel', placeholder: '+255712345678' })}{field('Other phone', 'secondaryPhone', { type: 'tel' })}{field('Tax ID', 'taxId')}<label className="block text-xs font-semibold">Payment terms<select className={`${input} mt-1`} value={form.paymentTerms} onChange={(event) => set('paymentTerms', event.target.value as Draft['paymentTerms'])}>{['CASH','NET-7','NET-14','NET-30','NET-45','NET-60'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-xs font-semibold">Credit limit (TZS)<input type="number" min="0" step="0.01" value={form.creditLimit} onChange={(event) => set('creditLimit', event.target.value)} className={`${input} mt-1`} /></label>{!supplier ? field('Opening balance (TZS)', 'openingBalance', { type: 'number' }) : null}{field('Bank name', 'bankName')}{field('Bank account number', 'bankAccountNumber')}{field('Bank SWIFT/BIC', 'bankSwiftCode')}<label className="block text-xs font-semibold sm:col-span-2">Description<textarea maxLength={2000} value={form.description} onChange={(event) => set('description', event.target.value)} className={`${input} mt-1 min-h-24 py-2`} /></label>{supplier ? <label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(event) => set('isActive', event.target.checked)} className="h-4 w-4 accent-emerald-700"/>Supplier is active and available for new purchase orders</label> : null}</div></section>
      <section className="rounded-xl border border-[#d8dfd5] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151815] sm:p-5"><h2 className="text-sm font-bold">Primary contact (optional)</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">{supplier?.contacts.length ? `${supplier.contacts.length - 1} additional contact(s) will be preserved.` : 'Leave all contact fields empty to skip.'}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{field('First name', 'contactFirstName')}{field('Last name', 'contactLastName')}{field('Contact email', 'contactEmail', { type: 'email' })}{field('Contact phone', 'contactPhone', { type: 'tel', placeholder: '+255712345678' })}{field('Position', 'contactPosition')}</div></section>
      <section className="rounded-xl border border-[#d8dfd5] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151815] sm:p-5"><h2 className="text-sm font-bold">Address (optional)</h2><p className="mt-1 text-xs text-[#687368] dark:text-white/55">Clear every address field to remove the saved address.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{field('Street', 'street')}{field('City', 'city')}{field('Region', 'region')}{field('Postal code', 'postalCode')}{field('Country', 'country')}</div></section>
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
      <div className="flex justify-end"><button type="submit" disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600">{loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} {loading ? 'Saving…' : supplier ? 'Save supplier' : 'Create supplier'}</button></div>
    </form>
  </main>;
}
