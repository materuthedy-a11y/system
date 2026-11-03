'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getApiError } from '@/lib/api';
import { customersAPI, type Customer, type CustomerInput, type CustomerType } from '@/lib/api/customers';
import { notify } from '@/components/ui/AppToaster';

const inputClass = 'min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm text-[#20231f] outline-none transition placeholder:text-[#858d82] focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white dark:placeholder:text-white/40 dark:focus-visible:ring-emerald-400/70';
const labelClass = 'block text-xs font-semibold text-[#485247] dark:text-white/75';
type ContactDraft = { firstName: string; lastName: string; email: string; phone: string; position: string };
const blankContact = (): ContactDraft => ({ firstName: '', lastName: '', email: '', phone: '', position: '' });

export function CustomerForm({ customerId }: { customerId?: string }) {
  const router = useRouter();
  const editing = !!customerId;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('RETAIL');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [description, setDescription] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('COD');
  const [status, setStatus] = useState<CustomerInput['status']>('ACTIVE');
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Tanzania');

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    customersAPI.get(customerId).then((data) => {
      if (!active) return;
      setCustomer(data); setName(data.name); setCustomerCode(data.customerCode); setCustomerType(data.customerType);
      setEmail(data.email); setPhone(data.phone); setSecondaryPhone(data.secondaryPhone || ''); setTaxId(data.taxId || '');
      setDescription(data.description || ''); setCreditLimit(String(data.creditLimit)); setOpeningBalance(String(data.openingBalance));
      setPaymentTerms(data.paymentTerms); setStatus(data.status);
      setContacts(data.contacts.map(({ firstName, lastName, email: contactEmail, phone: contactPhone, position }) => ({ firstName, lastName, email: contactEmail, phone: contactPhone, position: position || '' })));
      setStreet(data.address?.street || ''); setCity(data.address?.city || ''); setRegion(data.address?.region || '');
      setPostalCode(data.address?.postalCode || ''); setCountry(data.address?.country || 'Tanzania');
    }).catch((cause) => { if (active) setError(getApiError(cause, 'Could not load customer details.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const limit = Number(creditLimit); const opening = Number(openingBalance);
    if (!Number.isFinite(limit) || limit < 0 || !Number.isFinite(opening) || opening < 0) {
      setError('Credit limit and opening balance must be zero or more.'); return;
    }
    const keptContacts = contacts.filter((item) => Object.values(item).some((value) => value.trim()));
    if (keptContacts.some((item) => !item.firstName.trim() || !item.lastName.trim() || !item.email.trim() || !item.phone.trim())) {
      setError('Complete the name, email and phone for every contact, or remove the empty contact.'); return;
    }
    const input: CustomerInput = {
      name: name.trim(), customerCode: customerCode.trim() || undefined, customerType,
      email: email.trim(), phone: phone.trim(), secondaryPhone: secondaryPhone.trim() || undefined,
      taxId: taxId.trim() || undefined, description: description.trim() || undefined,
      creditLimit: limit, openingBalance: editing ? customer?.openingBalance ?? opening : opening,
      paymentTerms, isActive: status === 'ACTIVE', status,
      contacts: keptContacts.map((item) => ({ ...item, position: item.position.trim() || undefined })),
      address: [street, city, region, postalCode].some((value) => value.trim())
        ? { street: street.trim(), city: city.trim(), region: region.trim(), postalCode: postalCode.trim(), country: country.trim() || undefined }
        : null,
    };
    setSaving(true);
    try {
      const saved = editing ? await customersAPI.update(customerId!, input) : await customersAPI.create(input);
      notify.success(editing ? 'Customer changes saved.' : 'Customer created.');
      router.push(`/dashboard/customers/${saved.id}`);
    } catch (cause) { setError(getApiError(cause, 'Could not save this customer.')); }
    finally { setSaving(false); }
  }

  if (loading) return <section role="status" className="rounded-xl border border-[#dce8df] bg-emerald-50/70 p-5 text-sm text-[#465348] dark:border-white/10 dark:bg-[#151a16] dark:text-white/70">Loading customer…</section>;
  if (editing && error && !customer) return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</section>;

  return <form onSubmit={submit} className="space-y-5">
    {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
    <section className="rounded-xl border border-[#cde9d9] bg-emerald-50/75 p-4 sm:p-5 dark:border-emerald-900/60 dark:bg-[#141a16]">
      <h2 className="text-sm font-bold text-[#08784f] dark:text-emerald-300">Business details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Customer or business name *<input required maxLength={120} autoComplete="organization" className={`${inputClass} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className={labelClass}>Customer code<input maxLength={32} className={`${inputClass} mt-1.5`} value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} placeholder="Generated automatically" /></label>
        <label className={labelClass}>Customer type *<select className={`${inputClass} mt-1.5`} value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)}><option value="RETAIL">Retail</option><option value="WHOLESALE">Wholesale</option><option value="CORPORATE">Corporate</option><option value="DISTRIBUTOR">Distributor</option></select></label>
        <label className={labelClass}>Status<select className={`${inputClass} mt-1.5`} value={status} onChange={(e) => setStatus(e.target.value as CustomerInput['status'])}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="BLACKLISTED">Blacklisted</option><option value="ARCHIVED">Archived</option></select></label>
        <label className={labelClass}>Email address *<input required type="email" autoComplete="email" maxLength={254} className={`${inputClass} mt-1.5`} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className={labelClass}>Phone number *<input required type="tel" autoComplete="tel" maxLength={30} className={`${inputClass} mt-1.5`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" /></label>
        <label className={labelClass}>Other phone<input type="tel" maxLength={30} className={`${inputClass} mt-1.5`} value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} /></label>
        <label className={labelClass}>Tax ID<input maxLength={80} className={`${inputClass} mt-1.5`} value={taxId} onChange={(e) => setTaxId(e.target.value)} /></label>
        <label className={labelClass}>Credit limit (TZS) *<input required type="number" min="0" step="0.01" className={`${inputClass} mt-1.5`} value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} /></label>
        <label className={labelClass}>Payment terms *<select className={`${inputClass} mt-1.5`} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>{['COD', 'PREPAID', 'NET-7', 'NET-14', 'NET-30', 'NET-45', 'NET-60'].map((term) => <option key={term}>{term}</option>)}</select></label>
        {!editing ? <label className={labelClass}>Opening balance (TZS)<input type="number" min="0" step="0.01" className={`${inputClass} mt-1.5`} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></label> : null}
        <label className={`${labelClass} sm:col-span-2`}>Notes<textarea maxLength={1000} rows={3} className={`${inputClass} mt-1.5 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      </div>
    </section>

    <section className="rounded-xl border border-[#d9e2f4] bg-blue-50/70 p-4 sm:p-5 dark:border-blue-950 dark:bg-[#14171d]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-blue-800 dark:text-blue-300">Contact people</h2><p className="mt-1 text-xs text-[#606b7a] dark:text-white/60">Optional extra people linked to this customer.</p></div><button type="button" onClick={() => setContacts((items) => [...items, blankContact()])} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-blue-900 dark:bg-[#111411] dark:text-blue-200"><Plus size={15} />Add contact</button></div>
      {contacts.length ? <div className="mt-4 space-y-3">{contacts.map((contact, index) => <div key={index} className="grid gap-3 rounded-lg border border-blue-100 bg-white/80 p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.03]">
        {(['firstName', 'lastName', 'email', 'phone', 'position'] as const).map((key) => <label key={key} className={labelClass}>{({ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', position: 'Role' })[key]}{key === 'email' ? ' *' : key !== 'position' ? ' *' : ''}<input required={key !== 'position'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} className={`${inputClass} mt-1`} value={contact[key]} onChange={(e) => setContacts((items) => items.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))} /></label>)}
        <div className="flex items-end justify-between sm:col-span-2"><p className="text-xs font-semibold text-[#08784f] dark:text-emerald-300">{index === 0 ? 'Primary contact' : `Contact ${index + 1}`}</p><button type="button" onClick={() => setContacts((items) => items.filter((_, i) => i !== index))} aria-label={`Remove contact ${index + 1}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300"><Trash2 size={14} />Remove</button></div>
      </div>)}</div> : null}
    </section>

    <section className="rounded-xl border border-[#efdfb5] bg-amber-50/75 p-4 sm:p-5 dark:border-amber-950 dark:bg-[#191710]">
      <h2 className="text-sm font-bold text-[#87600a] dark:text-amber-300">Business address</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Street<input maxLength={160} className={`${inputClass} mt-1.5`} value={street} onChange={(e) => setStreet(e.target.value)} /></label><label className={labelClass}>City<input maxLength={100} className={`${inputClass} mt-1.5`} value={city} onChange={(e) => setCity(e.target.value)} /></label><label className={labelClass}>Region<input maxLength={100} className={`${inputClass} mt-1.5`} value={region} onChange={(e) => setRegion(e.target.value)} /></label><label className={labelClass}>Postal code<input maxLength={30} className={`${inputClass} mt-1.5`} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></label><label className={labelClass}>Country<input maxLength={80} className={`${inputClass} mt-1.5`} value={country} onChange={(e) => setCountry(e.target.value)} /></label>
      </div></section>
    <div className="flex flex-wrap justify-end gap-2"><Link href={customerId ? `/dashboard/customers/${customerId}` : '/dashboard/customers'} className="inline-flex min-h-10 items-center rounded-md border border-[#d4d9ce] px-4 text-sm font-semibold text-[#414a40] hover:bg-white dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5">Cancel</Link><button disabled={saving} className="inline-flex min-h-10 items-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 dark:bg-emerald-600 dark:hover:bg-emerald-500">{saving ? 'Saving…' : editing ? 'Save customer' : 'Create customer'}</button></div>
  </form>;
}
