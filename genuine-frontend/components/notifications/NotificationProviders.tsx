'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Save, Send } from 'lucide-react';
import { getApiError } from '@/lib/api';
import { notificationsAPI } from '@/lib/api/notifications';
import { notify } from '@/components/ui/AppToaster';

const field = 'mt-1 min-h-10 w-full rounded-lg border border-[#d8ddd3] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/70 dark:border-white/15 dark:bg-[#111411] dark:text-white';
type EmailProvider = 'SMTP' | 'SENDGRID';
type SmsProvider = 'TWILIO' | 'AFRICAS_TALKING' | 'SASISMS' | 'DARSMS' | 'EHUB' | 'SAKURA';

const smsProviderInfo: Record<SmsProvider, { label: string; docs: string; hint: string; senderLabel: string; senderPlaceholder: string; senderRequired: boolean }> = {
  SASISMS: { label: 'SasiSMS', docs: 'https://sms.sasidigital.co.tz/docs', hint: 'Tengeneza API key kwenye SasiSMS dashboard. API key pekee inahitajika; sender ID ni hiari na lazima iwe imeidhinishwa. Unaweza kuacha wazi kutumia sender wa kawaida wa SasiSMS.', senderLabel: 'Approved sender ID (optional)', senderPlaceholder: 'Leave blank for SasiSMS default', senderRequired: false },
  DARSMS: { label: 'DARSMS', docs: 'https://www.darsms.co.tz/', hint: 'Tengeneza API key kwenye DARSMS dashboard. Tumia sender ID iliyoidhinishwa; ukiacha wazi mfumo utatumia sender wa kawaida wa DARSMS.', senderLabel: 'Approved sender ID (optional)', senderPlaceholder: 'DARSMS or your approved sender', senderRequired: false },
  EHUB: { label: 'eHUB SMS', docs: 'https://sms.ehub.co.tz/api-docs', hint: 'Tengeneza API key na API secret kwenye Developer → API Keys. eHUB inahitaji UUID ya sender ID iliyoidhinishwa.', senderLabel: 'Approved sender ID UUID', senderPlaceholder: 'UUID from eHUB sender IDs', senderRequired: true },
  SAKURA: { label: 'Sakura SMS', docs: 'https://sakurahost.co.tz/sms/', hint: 'Tengeneza API key kwenye Sakura SMS dashboard. Sender ID ni hiari; ukitumia jina lako, lazima liwe limeidhinishwa.', senderLabel: 'Approved sender ID (optional)', senderPlaceholder: 'Your approved brand name', senderRequired: false },
  TWILIO: { label: 'Twilio', docs: 'https://www.twilio.com/docs/messaging/api/message-resource', hint: 'Tumia Account SID, Auth Token na namba iliyothibitishwa au sender iliyoidhinishwa kwenye akaunti yako ya Twilio.', senderLabel: 'Verified From phone number', senderPlaceholder: '+255… or verified Twilio number', senderRequired: true },
  AFRICAS_TALKING: { label: "Africa’s Talking", docs: 'https://developers.africastalking.com/docs/sms/overview', hint: 'Tumia username na API key kutoka Africa’s Talking dashboard. Sender ID inaweza kuhitaji idhini ya provider.', senderLabel: 'Approved sender ID (optional)', senderPlaceholder: 'Your approved sender ID', senderRequired: false },
};

export function NotificationProviders() {
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('SMTP');
  const [fromEmail, setFromEmail] = useState(''); const [fromName, setFromName] = useState('Mizania');
  const [smtpHost, setSmtpHost] = useState(''); const [smtpPort, setSmtpPort] = useState('587'); const [smtpUsername, setSmtpUsername] = useState(''); const [smtpPassword, setSmtpPassword] = useState(''); const [sendGridKey, setSendGridKey] = useState(''); const [emailReady, setEmailReady] = useState(false);
  const [secure, setSecure] = useState(false);
  const [smsProvider, setSmsProvider] = useState<SmsProvider>('SASISMS'); const [fromNumber, setFromNumber] = useState(''); const [accountSid, setAccountSid] = useState(''); const [smsUsername, setSmsUsername] = useState(''); const [smsKey, setSmsKey] = useState(''); const [smsApiSecret, setSmsApiSecret] = useState(''); const [smsReady, setSmsReady] = useState(false); const [testPhone, setTestPhone] = useState('');
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

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving('email'); setError('');
    try {
      await notificationsAPI.saveEmailConfig({ provider: emailProvider, fromEmail: fromEmail.trim(), fromName: fromName.trim(), ...(emailProvider === 'SMTP' ? { smtpHost: smtpHost.trim(), smtpPort: Number(smtpPort), smtpUsername: smtpUsername.trim(), smtpPassword, secure } : { apiKey: sendGridKey }) });
      setSmtpPassword(''); setSendGridKey(''); setEmailReady(true); notify.success('Email delivery settings saved.');
    } catch (cause) { setError(getApiError(cause, 'Could not save email provider settings.')); }
    finally { setSaving(''); }
  }

  async function saveSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving('sms'); setError('');
    try {
      await notificationsAPI.saveSmsConfig({ provider: smsProvider, fromNumber: fromNumber.trim(), ...(smsProvider === 'TWILIO' ? { accountSid: accountSid.trim(), apiKey: smsKey } : smsProvider === 'AFRICAS_TALKING' ? { username: smsUsername.trim(), apiKey: smsKey } : { apiKey: smsKey, ...(smsProvider === 'EHUB' ? { apiSecret: smsApiSecret } : {}) }) });
      setSmsKey(''); setSmsApiSecret(''); setSmsReady(true); notify.success('SMS delivery settings saved.');
    } catch (cause) { setError(getApiError(cause, 'Could not save SMS provider settings.')); }
    finally { setSaving(''); }
  }

  async function sendTestSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving('sms-test'); setError('');
    try {
      const result = await notificationsAPI.testSms(testPhone.trim());
      notify.success(`${result.message}${result.providerId ? ` · provider ID ${result.providerId}` : ''}. Check the recipient phone.`);
    }
    catch (cause) { const message = getApiError(cause, 'Test SMS could not be sent.'); setError(message); notify.error(message); }
    finally { setSaving(''); }
  }

  const smsInfo = smsProviderInfo[smsProvider];
  return <div className="space-y-4 p-4 sm:p-5">
    <div><h2 className="text-base font-bold">External delivery providers</h2><p className="mt-1 text-xs leading-5 text-[#687368] dark:text-white/55">Provider secrets are encrypted by the server and never returned to this page. Every save requires the provider credentials again because the server replaces the encrypted configuration.</p></div>
    {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
    <form onSubmit={(event) => void saveEmail(event)} className="rounded-xl border border-[#d8dfd5] p-4 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Email delivery</h3><p className="mt-1 text-xs text-[#687368] dark:text-white/55">{emailReady ? 'Provider is configured. Re-enter the server credentials whenever you save changes.' : 'No email provider configured.'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${emailReady ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'}`}>{emailReady ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Provider<select className={field} value={emailProvider} onChange={(event) => setEmailProvider(event.target.value as EmailProvider)}><option value="SMTP">SMTP</option><option value="SENDGRID">SendGrid</option></select></label><label className="text-xs font-semibold">From email<input required type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} className={field}/></label><label className="text-xs font-semibold">Sender name<input required maxLength={160} value={fromName} onChange={(event) => setFromName(event.target.value)} className={field}/></label>{emailProvider === 'SMTP' ? <><label className="text-xs font-semibold">SMTP host<input required value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="smtp.gmail.com" className={field}/></label><label className="text-xs font-semibold">SMTP port<input required type="number" min="1" max="65535" value={smtpPort} onChange={(event) => { const port = event.target.value; setSmtpPort(port); if (port === '465') setSecure(true); else if (port === '587') setSecure(false); }} className={field}/></label><label className="text-xs font-semibold">SMTP username<input required value={smtpUsername} onChange={(event) => setSmtpUsername(event.target.value)} placeholder="Full Gmail address" className={field}/></label><label className="text-xs font-semibold sm:col-span-2">SMTP app password<input required type="password" autoComplete="new-password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} className={field}/></label><div className="sm:col-span-2 rounded-lg bg-[#f4f7ed] p-3 text-xs leading-5 text-[#4e5b3f] dark:bg-[#20251b] dark:text-[#d5dec8]">For Gmail with 2-Step Verification, use <strong>smtp.gmail.com</strong>, port <strong>587</strong>, leave implicit TLS off, and enter a Google App Password (not your normal Google password). Port <strong>465</strong> uses implicit TLS. Gmail may also require the From email to match the SMTP account.</div><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={secure} onChange={(event) => setSecure(event.target.checked)} className="h-4 w-4 accent-emerald-700"/>Use implicit TLS (usually port 465)</label></> : <label className="text-xs font-semibold sm:col-span-2">SendGrid API key<input required type="password" autoComplete="new-password" value={sendGridKey} onChange={(event) => setSendGridKey(event.target.value)} className={field}/></label>}</div><button type="submit" disabled={saving === 'email'} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600">{saving === 'email' ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}Save email settings</button></form>

    <form onSubmit={(event) => void saveSms(event)} className="rounded-xl border border-[#d8dfd5] p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold">SMS delivery</h3><p className="mt-1 text-xs text-[#687368] dark:text-white/55">{smsReady ? 'Provider is configured. Credentials stay encrypted and are never shown here.' : 'Choose a provider and enter the credentials from its dashboard.'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${smsReady ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'}`}>{smsReady ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Provider<select className={field} value={smsProvider} onChange={(event) => setSmsProvider(event.target.value as SmsProvider)}>{Object.entries(smsProviderInfo).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}</select></label>
        <label className="text-xs font-semibold">{smsInfo.senderLabel}<input required={smsInfo.senderRequired} value={fromNumber} onChange={(event) => setFromNumber(event.target.value)} placeholder={smsInfo.senderPlaceholder} className={field}/></label>
        {smsProvider === 'TWILIO' ? <><label className="text-xs font-semibold">Account SID<input required value={accountSid} onChange={(event) => setAccountSid(event.target.value)} className={field}/></label><label className="text-xs font-semibold">Auth token<input required type="password" autoComplete="new-password" value={smsKey} onChange={(event) => setSmsKey(event.target.value)} className={field}/></label></> : null}
        {smsProvider === 'AFRICAS_TALKING' ? <><label className="text-xs font-semibold">Username<input required value={smsUsername} onChange={(event) => setSmsUsername(event.target.value)} className={field}/></label><label className="text-xs font-semibold">API key<input required type="password" autoComplete="new-password" value={smsKey} onChange={(event) => setSmsKey(event.target.value)} className={field}/></label></> : null}
        {smsProvider !== 'TWILIO' && smsProvider !== 'AFRICAS_TALKING' ? <label className="text-xs font-semibold">API key<input required type="password" autoComplete="new-password" value={smsKey} onChange={(event) => setSmsKey(event.target.value)} className={field}/></label> : null}
        {smsProvider === 'EHUB' ? <label className="text-xs font-semibold">API secret<input required type="password" autoComplete="new-password" value={smsApiSecret} onChange={(event) => setSmsApiSecret(event.target.value)} className={field}/></label> : null}
      </div>
      <div className="mt-3 rounded-lg bg-[#f4f7ed] p-3 text-xs leading-5 text-[#4e5b3f] dark:bg-[#20251b] dark:text-[#d5dec8]"><p>{smsInfo.hint}</p><a href={smsInfo.docs} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold underline">Provider docs and account setup <ExternalLink size={12}/></a><p className="mt-2">This is an outbound SMS connection for system notifications and the test button; it cannot receive replies. Help & feedback conversations stay inside Mizania. Free-trial credits, sender-ID approval and current prices depend on the provider account; check its dashboard before sending. API credentials are sent only from Mizania’s backend.</p></div>
      <button type="submit" disabled={saving === 'sms'} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600">{saving === 'sms' ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}Save SMS settings</button>
    </form>

    {smsReady ? <form onSubmit={(event) => void sendTestSms(event)} className="rounded-xl border border-[#d8dfd5] p-4 dark:border-white/10"><h3 className="text-sm font-bold">Test SMS connection</h3><p className="mt-1 text-xs leading-5 text-[#687368] dark:text-white/55">This sends one real SMS and may use provider credits.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1 text-xs font-semibold">Recipient phone number<input required value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder={smsProvider === 'SASISMS' ? '2557… (no +) or 07…' : '+2557…'} className={field}/></label><button type="submit" disabled={saving === 'sms-test'} className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600">{saving === 'sms-test' ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}Send test</button></div></form> : null}
    <p className="text-[11px] leading-5 text-[#687368] dark:text-white/50">The configured provider handles password reset and system notification SMS. Delivery is asynchronous; the delivery log records provider acceptance or failure. A provider acceptance is not a carrier delivery receipt.</p>
  </div>;
}
