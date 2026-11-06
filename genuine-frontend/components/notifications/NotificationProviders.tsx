'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { getApiError } from '@/lib/api';
import { notificationsAPI } from '@/lib/api/notifications';
import { notify } from '@/components/ui/AppToaster';

const field = 'mt-1 min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white';
type EmailProvider = 'SMTP' | 'SENDGRID';
type SmsProvider = 'TWILIO' | 'AFRICAS_TALKING';

export function NotificationProviders() {
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('SMTP');
  const [fromEmail, setFromEmail] = useState(''); const [fromName, setFromName] = useState('Mizania');
  const [smtpHost, setSmtpHost] = useState(''); const [smtpPort, setSmtpPort] = useState('587'); const [smtpUsername, setSmtpUsername] = useState(''); const [smtpPassword, setSmtpPassword] = useState(''); const [sendGridKey, setSendGridKey] = useState(''); const [emailReady, setEmailReady] = useState(false);
  const [secure, setSecure] = useState(true);
  const [smsProvider, setSmsProvider] = useState<SmsProvider>('TWILIO'); const [fromNumber, setFromNumber] = useState(''); const [accountSid, setAccountSid] = useState(''); const [smsUsername, setSmsUsername] = useState(''); const [smsKey, setSmsKey] = useState(''); const [smsReady, setSmsReady] = useState(false);
  const [saving, setSaving] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void Promise.allSettled([notificationsAPI.emailConfig(), notificationsAPI.smsConfig()]).then(([emailResult, smsResult]) => {
      if (!active) return;
      if (emailResult.status === 'fulfilled') { const config = emailResult.value; setEmailProvider(config.provider); setFromEmail(config.fromEmail); setFromName(config.fromName); setEmailReady(true); }
      if (smsResult.status === 'fulfilled') { const config = smsResult.value; setSmsProvider(config.provider); setFromNumber(config.fromNumber); setSmsReady(true); }
    });
    return () => { active = false; };
  }, []);
  async function saveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving('email'); setError('');
    try {
      await notificationsAPI.saveEmailConfig({ provider: emailProvider, fromEmail: fromEmail.trim(), fromName: fromName.trim(), ...(emailProvider === 'SMTP' ? { smtpHost: smtpHost.trim(), smtpPort: Number(smtpPort), smtpUsername: smtpUsername.trim(), smtpPassword, secure } : { apiKey: sendGridKey }) });
      setSmtpPassword(''); setSendGridKey(''); setEmailReady(true); notify.success('Email delivery settings saved.');
    } catch (cause) { setError(getApiError(cause, 'Could not save email provider settings.')); }
    finally { setSaving(''); }
  }
  async function saveSms(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving('sms'); setError('');
    try {
      await notificationsAPI.saveSmsConfig({ provider: smsProvider, fromNumber: fromNumber.trim(), ...(smsProvider === 'TWILIO' ? { accountSid: accountSid.trim(), apiKey: smsKey } : { username: smsUsername.trim(), apiKey: smsKey }) });
      setSmsKey(''); setSmsReady(true); notify.success('SMS delivery settings saved.');
    } catch (cause) { setError(getApiError(cause, 'Could not save SMS provider settings.')); }
    finally { setSaving(''); }
  }
  return <div className="space-y-4 p-4 sm:p-5">
    <div><h2 className="text-base font-bold">External delivery providers</h2><p className="mt-1 text-xs leading-5 text-[#687368] dark:text-white/55">Provider secrets are encrypted by the server and never returned to this page. Every save requires the provider credentials again because the server replaces the encrypted configuration.</p></div>
    {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
    <form onSubmit={(event) => void saveEmail(event)} className="rounded-xl border border-[#d8dfd5] p-4 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Email delivery</h3><p className="mt-1 text-xs text-[#687368] dark:text-white/55">{emailReady ? 'Provider is configured. Re-enter the server credentials whenever you save changes.' : 'No email provider configured.'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${emailReady ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'}`}>{emailReady ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Provider<select className={field} value={emailProvider} onChange={(event) => setEmailProvider(event.target.value as EmailProvider)}><option value="SMTP">SMTP</option><option value="SENDGRID">SendGrid</option></select></label><label className="text-xs font-semibold">From email<input required type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} className={field}/></label><label className="text-xs font-semibold">Sender name<input required maxLength={160} value={fromName} onChange={(event) => setFromName(event.target.value)} className={field}/></label>{emailProvider === 'SMTP' ? <><label className="text-xs font-semibold">SMTP host<input required value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} className={field}/></label><label className="text-xs font-semibold">SMTP port<input required type="number" min="1" max="65535" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} className={field}/></label><label className="text-xs font-semibold">SMTP username<input required value={smtpUsername} onChange={(event) => setSmtpUsername(event.target.value)} className={field}/></label><label className="text-xs font-semibold sm:col-span-2">SMTP password<input required type="password" autoComplete="new-password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} className={field}/></label><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={secure} onChange={(event) => setSecure(event.target.checked)} className="h-4 w-4 accent-emerald-700"/>Use secure TLS connection</label></> : <label className="text-xs font-semibold sm:col-span-2">SendGrid API key<input required type="password" autoComplete="new-password" value={sendGridKey} onChange={(event) => setSendGridKey(event.target.value)} className={field}/></label>}</div><button type="submit" disabled={saving === 'email'} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600">{saving === 'email' ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}Save email settings</button></form>
    <form onSubmit={(event) => void saveSms(event)} className="rounded-xl border border-[#d8dfd5] p-4 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold">SMS delivery</h3><p className="mt-1 text-xs text-[#687368] dark:text-white/55">{smsReady ? 'Provider is configured. Re-enter the server credentials whenever you save changes.' : 'No SMS provider configured.'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${smsReady ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'}`}>{smsReady ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Provider<select className={field} value={smsProvider} onChange={(event) => setSmsProvider(event.target.value as SmsProvider)}><option value="TWILIO">Twilio</option><option value="AFRICAS_TALKING">Africa’s Talking</option></select></label><label className="text-xs font-semibold">From number or sender ID<input required value={fromNumber} onChange={(event) => setFromNumber(event.target.value)} placeholder="+255… or approved sender ID" className={field}/></label>{smsProvider === 'TWILIO' ? <label className="text-xs font-semibold">Account SID<input required value={accountSid} onChange={(event) => setAccountSid(event.target.value)} className={field}/></label> : <label className="text-xs font-semibold">Username<input required value={smsUsername} onChange={(event) => setSmsUsername(event.target.value)} className={field}/></label>}<label className="text-xs font-semibold">{smsProvider === 'TWILIO' ? 'Auth token' : 'API key'}<input required type="password" autoComplete="new-password" value={smsKey} onChange={(event) => setSmsKey(event.target.value)} className={field}/></label></div><button type="submit" disabled={saving === 'sms'} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600">{saving === 'sms' ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}Save SMS settings</button></form>
  </div>;
}
