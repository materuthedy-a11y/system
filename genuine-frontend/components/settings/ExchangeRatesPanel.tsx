'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { getApiError } from '@/lib/api';
import { BusinessExchangeRate, ExchangeRateConversion, settingsAPI } from '@/lib/api/settings';
import { getBusinessTimezone } from '@/lib/format/businessDate';
import { notify } from '@/components/ui/AppToaster';

const field = 'mt-1 min-h-10 w-full rounded-xl border border-[#d8ddd4] bg-white px-3 py-2 text-sm text-[#20231f] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40 dark:border-white/10 dark:bg-[#171916] dark:text-white';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-[#2d2200] transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60';
const today = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: getBusinessTimezone(), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const money = (amount: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

export default function ExchangeRatesPanel({ canEdit, currentBaseCurrency }: { canEdit: boolean; currentBaseCurrency: string }) {
  const [rates, setRates] = useState<BusinessExchangeRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState(currentBaseCurrency);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [rateToBase, setRateToBase] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('1');
  const [asOf, setAsOf] = useState(today());
  const [direction, setDirection] = useState<'TO_BASE' | 'FROM_BASE'>('TO_BASE');
  const [conversion, setConversion] = useState<ExchangeRateConversion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await settingsAPI.exchangeRates();
      setBaseCurrency(result.baseCurrency);
      setRates(result.rates);
    } catch (cause) {
      setError(getApiError(cause, 'Exchange rates could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      const code = currencyCode.trim().toUpperCase();
      await settingsAPI.createExchangeRate({ currencyCode: code, rateToBase: Number(rateToBase), effectiveFrom, note: note.trim() || undefined });
      notify.success(`Exchange rate saved: 1 ${code} = ${rateToBase} ${baseCurrency}.`);
      setNote('');
      setRateToBase('');
      setCurrencyCode(code);
      await load();
    } catch (cause) {
      const message = getApiError(cause, 'Exchange rate could not be saved.');
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setConversion(null);
    try {
      const result = await settingsAPI.convertCurrency({ currencyCode: currencyCode.trim().toUpperCase(), amount: Number(amount), asOf, direction });
      setConversion(result);
    } catch (cause) {
      setError(getApiError(cause, 'No exchange rate is available for that currency and date.'));
    }
  }

  const codes = [...new Set(rates.map((rate) => rate.currencyCode))];
  const displayCode = conversion?.currencyCode || (direction === 'TO_BASE' ? baseCurrency : currencyCode.toUpperCase());

  return <div className="space-y-4">
    <section className="rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1d201d]">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Business base currency</p><h3 className="mt-1 text-lg font-bold">{baseCurrency}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-[#687064] dark:text-white/60">All saved prices and accounting balances remain in {baseCurrency}. Changing the currency label never converts money; once prices or financial records exist, the system locks the base currency to protect them.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d8ddd4] px-3 text-xs font-semibold dark:border-white/10"><RefreshCw size={14}/>Refresh rates</button></div>
    </section>

    <section className="rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1d201d]">
      <div className="mb-4"><h3 className="font-bold">Add a market rate</h3><p className="mt-1 text-xs leading-5 text-[#687064] dark:text-white/60">Enter the rate you use: one foreign currency unit equals this many {baseCurrency}. Rates are manually maintained, effective-dated and audited; the system does not invent a fixed market rate.</p></div>
      <form onSubmit={saveRate} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[0.7fr_1fr_1fr_1.4fr_auto] xl:items-end">
        <label className="text-xs font-semibold">Foreign currency code<input required disabled={!canEdit||saving} maxLength={3} pattern="[A-Za-z]{3}" className={field} value={currencyCode} onChange={(event)=>setCurrencyCode(event.target.value.toUpperCase())} placeholder="USD"/></label>
        <label className="text-xs font-semibold">1 currency unit = {baseCurrency}<input required disabled={!canEdit||saving} type="number" min="0.00000001" max="1000000000" step="0.00000001" className={field} value={rateToBase} onChange={(event)=>setRateToBase(event.target.value)} placeholder="Enter current rate"/></label>
        <label className="text-xs font-semibold">Effective from<input required disabled={!canEdit||saving} type="date" className={field} value={effectiveFrom} onChange={(event)=>setEffectiveFrom(event.target.value)}/></label>
        <label className="text-xs font-semibold">Source / note (optional)<input disabled={!canEdit||saving} maxLength={500} className={field} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Bank quote, date or reference"/></label>
        <button className={button} disabled={!canEdit||saving}>{saving?<Loader2 size={15} className="animate-spin"/>:<Plus size={15}/>}Save rate</button>
      </form>
      {!canEdit ? <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">You can view and use rates; adding rates requires `settings.edit`.</p> : null}
    </section>

    <section className="rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1d201d]">
      <div className="mb-4"><h3 className="font-bold">Currency converter</h3><p className="mt-1 text-xs leading-5 text-[#687064] dark:text-white/60">Converts using the latest saved rate effective on the selected date. Use the result when entering a base-currency amount; existing records are never changed.</p></div>
      <form onSubmit={convert} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[0.8fr_1fr_1fr_1fr_1.2fr_auto] xl:items-end">
        <label className="text-xs font-semibold">Currency<select required className={field} value={currencyCode} onChange={(event)=>{setCurrencyCode(event.target.value);setConversion(null);}}><option value={baseCurrency}>{baseCurrency}</option>{codes.map((code)=><option key={code} value={code}>{code}</option>)}</select></label>
        <label className="text-xs font-semibold">Amount<input required type="number" min="0" step="0.01" className={field} value={amount} onChange={(event)=>setAmount(event.target.value)}/></label>
        <label className="text-xs font-semibold">Direction<select className={field} value={direction} onChange={(event)=>{setDirection(event.target.value as 'TO_BASE'|'FROM_BASE');setConversion(null);}}><option value="TO_BASE">Foreign currency → {baseCurrency}</option><option value="FROM_BASE">{baseCurrency} → foreign currency</option></select></label>
        <label className="text-xs font-semibold">Rate date<input type="date" required className={field} value={asOf} onChange={(event)=>{setAsOf(event.target.value);setConversion(null);}}/></label>
        <div className="text-xs text-[#687064] dark:text-white/60">{codes.length ? `${codes.length} foreign currency rate(s) available` : 'Add a rate above to enable conversion.'}</div>
        <button className={button} disabled={loading}><ArrowLeftRight size={15}/>Convert</button>
      </form>
      {conversion ? <div role="status" className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"><ArrowDownLeft size={17} className="text-emerald-700 dark:text-emerald-300"/><p className="text-sm font-semibold">{money(conversion.amount, direction === 'TO_BASE' ? currencyCode.toUpperCase() : baseCurrency)} = {money(conversion.result, displayCode)}</p><p className="w-full pl-6 text-xs text-[#687064] dark:text-white/60">Rate: 1 {currencyCode.toUpperCase()} = {conversion.rateToBase.toLocaleString()} {baseCurrency} · effective {conversion.effectiveFrom}</p></div> : null}
    </section>

    <section className="rounded-2xl border border-[#e6e9e1] bg-white p-0 shadow-sm dark:border-white/10 dark:bg-[#1d201d]">
      <div className="border-b border-[#eceee8] p-4 dark:border-white/10"><h3 className="font-bold">Rate history</h3><p className="mt-1 text-xs text-[#687064] dark:text-white/60">Historical quotes remain available for their effective dates. Add a new date for a market change; old records and conversions keep their historical rate.</p></div>
      {error ? <p role="alert" className="m-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
      {loading ? <div role="status" className="flex items-center gap-2 p-6 text-sm text-[#687064]"><Loader2 size={16} className="animate-spin"/>Loading exchange rates…</div> : rates.length ? <div className="divide-y divide-[#eceee8] dark:divide-white/10">{rates.map((rate)=><div key={rate.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-bold tabular-nums">1 {rate.currencyCode} = {rate.rateToBase.toLocaleString(undefined,{maximumFractionDigits:8})} {rate.baseCurrency}</p><p className="mt-1 text-xs text-[#687064] dark:text-white/55">Effective {rate.effectiveFrom.slice(0,10)}{rate.note?` · ${rate.note}`:''}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Manual rate</span></div>)}</div> : <div className="p-8 text-center"><p className="text-sm font-semibold">No exchange rates configured</p><p className="mt-1 text-xs text-[#687064] dark:text-white/55">Add a rate such as `1 USD = [your current market quote] {baseCurrency}`. The app does not prefill a potentially stale value.</p></div>}
    </section>
  </div>;
}
