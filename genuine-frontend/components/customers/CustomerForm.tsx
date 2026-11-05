'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getApiError } from '@/lib/api';
import { customersAPI, type Customer, type CustomerInput, type CustomerType } from '@/lib/api/customers';
import { CustomerPhotoField } from '@/components/customers/CustomerPhoto';
import { notify } from '@/components/ui/AppToaster';

const inputClass = 'min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm text-[#20231f] outline-none transition placeholder:text-[#858d82] focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white dark:placeholder:text-white/40 dark:focus-visible:ring-emerald-400/70';
const labelClass = 'block text-xs font-semibold text-[#485247] dark:text-white/75';
type ContactDraft = { firstName: string; lastName: string; email: string; phone: string; position: string };
const blankContact = (): ContactDraft => ({ firstName: '', lastName: '', email: '', phone: '', position: '' });

const phoneCountries = [
  { name: 'Tanzania', code: '+255' }, { name: 'Kenya', code: '+254' }, { name: 'Uganda', code: '+256' },
  { name: 'Rwanda', code: '+250' }, { name: 'Burundi', code: '+257' }, { name: 'DR Congo', code: '+243' },
  { name: 'Zambia', code: '+260' }, { name: 'Malawi', code: '+265' }, { name: 'South Africa', code: '+27' },
  { name: 'United Kingdom', code: '+44' }, { name: 'United States', code: '+1' }, { name: 'India', code: '+91' },
  { name: 'UAE', code: '+971' },
];

function phoneParts(value: string) {
  const trimmed = value.trim();
  const matched = [...phoneCountries].sort((a, b) => b.code.length - a.code.length).find(({ code }) => trimmed.startsWith(code));
  if (matched) return { code: matched.code, number: trimmed.slice(matched.code.length).replace(/\D/g, '') };
  if (trimmed.startsWith('+')) return { code: 'OTHER', number: trimmed };
  return { code: '+255', number: trimmed.replace(/\D/g, '').replace(/^0+/, '') };
}

function PhoneInput({ label, value, onChange, required = false, error, inputRef }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; error?: string; inputRef?: Ref<HTMLInputElement> }) {
  const [selectedCode, setSelectedCode] = useState(() => phoneParts(value).code);
  const parts = phoneParts(value);
  const errorId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-error`;
  useEffect(() => { setSelectedCode(parts.code); }, [value, parts.code]);
  const displayedNumber = selectedCode === 'OTHER' ? value : parts.code === 'OTHER' ? '' : parts.number;
  const selectClass = 'min-h-10 w-[46%] shrink-0 rounded-lg border border-[#d8ddd3] bg-white px-2 text-xs text-[#20231f] outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600/70 sm:w-[44%] dark:border-white/15 dark:bg-[#111411] dark:text-white dark:focus-visible:ring-emerald-400/70';
  return <label className={labelClass}>{label}<span className="mt-1.5 flex min-w-0 gap-2">
    <select aria-label={`${label} country code`} className={selectClass} value={selectedCode} onChange={(event) => {
      const nextCode = event.target.value;
      setSelectedCode(nextCode);
      if (nextCode === 'OTHER') return;
      const digits = parts.code === 'OTHER' ? '' : parts.number.replace(/^0+/, '');
      onChange(digits ? `${nextCode}${digits}` : '');
    }}>
      {phoneCountries.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
      <option value="OTHER">Other (international)</option>
    </select>
    <input ref={inputRef} required={required} type="tel" inputMode={selectedCode === 'OTHER' ? 'tel' : 'numeric'} autoComplete={required ? 'tel' : 'off'} maxLength={selectedCode === 'OTHER' ? 30 : 18} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} className={`${inputClass} min-w-0 flex-1 ${error ? 'border-rose-500' : ''}`} value={displayedNumber} onChange={(event) => {
      const raw = event.target.value;
      if (selectedCode === 'OTHER') { onChange(raw.trim()); return; }
      const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
      onChange(digits ? `${selectedCode}${digits}` : '');
    }} placeholder={selectedCode === 'OTHER' ? '+country code and number' : 'e.g. 650 745 642'} />
  </span>{error ? <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-300">{error}</span> : null}</label>;
}

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
  const [emailError, setEmailError] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const phoneRef = useRef<HTMLInputElement>(null);
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [secondaryPhoneError, setSecondaryPhoneError] = useState('');
  const secondaryPhoneRef = useRef<HTMLInputElement>(null);
  const [taxId, setTaxId] = useState('');
  const [description, setDescription] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('COD');
  const [status, setStatus] = useState<CustomerInput['status']>('ACTIVE');
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Tanzania');

  function validateEmail(value: string) {
    const normalized = value.trim();
    if (!normalized) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      return 'Enter a valid email address, for example jina@kampuni.com.';
    }
    return '';
  }

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
    const addressParts = [street, city, region, postalCode].map((part) => part.trim());
    if (addressParts.some(Boolean) && addressParts.some((part) => !part)) {
      setError('Complete street, city, region and postal code, or leave the address blank.'); return;
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
      photo,
      contacts: keptContacts.map((item) => ({ ...item, position: item.position.trim() || undefined })),
      address: addressParts.some(Boolean)
        ? { street: street.trim(), city: city.trim(), region: region.trim(), postalCode: postalCode.trim(), country: country.trim() || undefined }
        : null,
    };
    setSaving(true);
    try {
      // Customer code and opening balance are create-only fields. The update DTO
      // rejects unknown fields, so never send them in an edit request.
      const updateInput: Partial<CustomerInput> = { ...input };
      delete updateInput.customerCode;
      delete updateInput.openingBalance;
      const saved = editing ? await customersAPI.update(customerId!, updateInput) : await customersAPI.create(input);
      notify.success(editing ? 'Customer changes saved.' : 'Customer created.');
      router.push(`/dashboard/customers/${saved.id}`);
    } catch (cause) {
      const message = getApiError(cause, 'Could not save this customer.');
      if (/secondaryPhone must be a valid phone number/i.test(message)) {
        setError('');
        setSecondaryPhoneError('Enter a valid phone number for the selected country code.');
        window.requestAnimationFrame(() => secondaryPhoneRef.current?.focus());
      } else if (/phone must be a valid phone number/i.test(message)) {
        setError('');
        setPhoneError('Enter a valid Tanzanian phone number, for example 650 745 642.');
        window.requestAnimationFrame(() => phoneRef.current?.focus());
      } else {
        setError(message);
      }
    }
    finally { setSaving(false); }
  }

  if (loading) return <section role="status" className="rounded-xl border border-[#dce8df] bg-emerald-50/70 p-5 text-sm text-[#465348] dark:border-white/10 dark:bg-[#151a16] dark:text-white/70">Loading customer…</section>;
  if (editing && error && !customer) return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</section>;

  return <form onSubmit={submit} className="space-y-5">
    {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
    <CustomerPhotoField customerId={customer?.id} photoId={customer?.photoId} value={photo} onChange={setPhoto} disabled={saving} />
    <section className="rounded-xl border border-[#cde9d9] bg-emerald-50/75 p-4 sm:p-5 dark:border-emerald-900/60 dark:bg-[#141a16]">
      <h2 className="text-sm font-bold text-[#08784f] dark:text-emerald-300">Business details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Customer or business name *<input required maxLength={120} autoComplete="organization" className={`${inputClass} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className={labelClass}>Customer code<input maxLength={32} readOnly={editing} aria-readonly={editing} className={`${inputClass} mt-1.5 ${editing ? 'cursor-not-allowed bg-[#f4f6f2] dark:bg-white/[0.04]' : ''}`} value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} placeholder="Generated automatically" />{editing ? <span className="mt-1 block text-[11px] font-normal text-[#697468] dark:text-white/55">Customer codes cannot be changed after creation.</span> : null}</label>
        <label className={labelClass}>Customer type *<select className={`${inputClass} mt-1.5`} value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)}><option value="RETAIL">Retail</option><option value="WHOLESALE">Wholesale</option><option value="CORPORATE">Corporate</option><option value="DISTRIBUTOR">Distributor</option></select></label>
        <label className={labelClass}>Status<select className={`${inputClass} mt-1.5`} value={status} onChange={(e) => setStatus(e.target.value as CustomerInput['status'])}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="BLACKLISTED">Blacklisted</option><option value="ARCHIVED">Archived</option></select></label>
        <label className={labelClass}>Email address *<input required type="email" autoComplete="email" maxLength={254} aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? 'customer-email-error' : undefined} onInvalid={(e) => { e.preventDefault(); setEmailError(validateEmail(email)); e.currentTarget.focus(); }} onBlur={() => { if (email.trim()) setEmailError(validateEmail(email)); }} className={`${inputClass} mt-1.5 ${emailError ? 'border-rose-500' : ''}`} value={email} onChange={(e) => { const value = e.target.value; setEmail(value); if (emailError) setEmailError(value.trim() ? validateEmail(value) : ''); }} />{emailError ? <span id="customer-email-error" role="alert" className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-300">{emailError}</span> : null}</label>
        <PhoneInput label="Phone number *" required value={phone} inputRef={phoneRef} error={phoneError} onChange={(value) => { setPhone(value); if (phoneError) setPhoneError(''); }} />
        <PhoneInput label="Other phone" value={secondaryPhone} inputRef={secondaryPhoneRef} error={secondaryPhoneError} onChange={(value) => { setSecondaryPhone(value); if (secondaryPhoneError) setSecondaryPhoneError(''); }} />
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
        {(['firstName', 'lastName', 'email', 'phone', 'position'] as const).map((key) => key === 'phone' ? <PhoneInput key={key} label="Phone *" required value={contact.phone} onChange={(value) => setContacts((items) => items.map((item, i) => i === index ? { ...item, phone: value } : item))} /> : <label key={key} className={labelClass}>{({ firstName: 'First name', lastName: 'Last name', email: 'Email', position: 'Role' })[key]}{key === 'email' ? ' *' : key !== 'position' ? ' *' : ''}<input required={key !== 'position'} type={key === 'email' ? 'email' : 'text'} className={`${inputClass} mt-1`} value={contact[key]} onChange={(e) => setContacts((items) => items.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))} /></label>)}
        <div className="flex items-end justify-between sm:col-span-2"><p className="text-xs font-semibold text-[#08784f] dark:text-emerald-300">{index === 0 ? 'Primary contact' : `Contact ${index + 1}`}</p><button type="button" onClick={() => setContacts((items) => items.filter((_, i) => i !== index))} aria-label={`Remove contact ${index + 1}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300"><Trash2 size={14} />Remove</button></div>
      </div>)}</div> : null}
    </section>

    <section className="rounded-xl border border-[#efdfb5] bg-amber-50/75 p-4 sm:p-5 dark:border-amber-950 dark:bg-[#191710]">
      <h2 className="text-sm font-bold text-[#87600a] dark:text-amber-300">Business address</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Street<input maxLength={160} className={`${inputClass} mt-1.5`} value={street} onChange={(e) => setStreet(e.target.value)} /></label><label className={labelClass}>City<input maxLength={100} className={`${inputClass} mt-1.5`} value={city} onChange={(e) => setCity(e.target.value)} /></label><label className={labelClass}>Region<input maxLength={100} className={`${inputClass} mt-1.5`} value={region} onChange={(e) => setRegion(e.target.value)} /></label><label className={labelClass}>Postal code<input maxLength={30} className={`${inputClass} mt-1.5`} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></label><label className={labelClass}>Country<input maxLength={80} className={`${inputClass} mt-1.5`} value={country} onChange={(e) => setCountry(e.target.value)} /></label>
      </div></section>
    <div className="flex flex-wrap justify-end gap-2"><Link href={customerId ? `/dashboard/customers/${customerId}` : '/dashboard/customers'} className="inline-flex min-h-10 items-center rounded-md border border-[#d4d9ce] px-4 text-sm font-semibold text-[#414a40] hover:bg-white dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5">Cancel</Link><button disabled={saving} aria-busy={saving} className="inline-flex min-h-10 items-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 dark:bg-emerald-600 dark:hover:bg-emerald-500">{saving ? 'Saving…' : editing ? 'Save customer' : 'Create customer'}</button></div>
  </form>;
}
