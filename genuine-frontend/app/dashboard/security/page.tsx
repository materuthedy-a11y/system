'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Monitor, RefreshCw, ShieldCheck, Smartphone, X } from 'lucide-react';
import { AuthField, FormError, SubmitButton } from '@/components/auth/AuthFrame';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { authAPI, getApiError, type ActiveAuthSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { notify } from '@/components/ui/AppToaster';

function sessionDevice(userAgent: string | null) {
  const value = userAgent || '';
  const device = /iPhone|iPad|Android|Mobile/i.test(value) ? 'Mobile device' : 'Desktop browser';
  const browser = /Edg\//.test(value) ? 'Microsoft Edge' : /Firefox\//.test(value) ? 'Firefox' : /Chrome\//.test(value) ? 'Google Chrome' : /Safari\//.test(value) ? 'Safari' : 'Web browser';
  const os = /Windows/i.test(value) ? 'Windows' : /Mac OS|Macintosh/i.test(value) ? 'macOS' : /Android/i.test(value) ? 'Android' : /iPhone|iPad/i.test(value) ? 'iOS' : /Linux/i.test(value) ? 'Linux' : '';
  return { device, browser, os };
}

export default function SecurityPage() {
  const router = useRouter();
  const changePassword = useAuthStore((state) => state.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessions, setSessions] = useState<ActiveAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState('');

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      setSessions(await authAPI.listSessions());
    } catch (cause) {
      setSessionsError(getApiError(cause, 'Could not load active sessions.'));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  async function revokeSession(session: ActiveAuthSession) {
    setRevokingSessionId(session.id);
    try {
      await authAPI.revokeSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      notify.success('Device session signed out.');
    } catch (cause) {
      notify.error(getApiError(cause, 'Could not sign out that device.'));
      void loadSessions();
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8 || newPassword.length > 128 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[@$!%*?&]/.test(newPassword)) {
      setError('Use 8–128 characters with uppercase, lowercase, a number, and one of @$!%*?&.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      router.replace('/login?reason=password-updated');
    } catch (cause) {
      setError(getApiError(cause, 'We could not update your password. Check your current password and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#73766f] hover:text-[#20211f]"><ArrowLeft size={16} /> Back to overview</Link>
      <section className="mt-6 rounded-2xl border border-[#e8e9e5] bg-white p-5 shadow-sm sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#d8f04b] text-[#354900]"><KeyRound size={19} /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#20231f]">Change password</h1>
        <p className="mt-2 text-sm leading-6 text-[#73766f]">Changing your password signs out all active sessions. You will need to sign in again with the new password.</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
          <FormError message={error} />
          <AuthField label="Current password" id="currentPassword" type={showPasswords ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter current password" value={currentPassword} onChange={setCurrentPassword} disabled={isSubmitting} />
          <AuthField label="New password" id="newPassword" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" placeholder="8+ chars, upper/lowercase, number, symbol" value={newPassword} onChange={setNewPassword} disabled={isSubmitting} maxLength={128} />
          <AuthField label="Confirm new password" id="confirmPassword" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" placeholder="Type the new password again" value={confirmation} onChange={setConfirmation} disabled={isSubmitting} maxLength={128} />
          <button type="button" onClick={() => setShowPasswords((shown) => !shown)} className="inline-flex items-center gap-2 text-xs font-semibold text-[#73766f] hover:text-[#20211f]">{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}{showPasswords ? 'Hide passwords' : 'Show passwords'}</button>
          <SubmitButton loading={isSubmitting}>Update password <span aria-hidden="true">→</span></SubmitButton>
        </form>
      </section>
      <section className="mt-5 rounded-2xl border border-[#e8e9e5] bg-white p-5 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#171a17]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef4d7] text-[#5c7000] dark:bg-[#33391d] dark:text-[#e1ec8b]"><ShieldCheck size={19} /></span><div><h2 className="text-lg font-semibold text-[#20231f] dark:text-white">Active devices</h2><p className="mt-1 max-w-xl text-sm leading-5 text-[#73766f] dark:text-white/60">Sign out a device you no longer recognize. Your current device is marked below.</p></div></div>
          <button type="button" onClick={() => void loadSessions()} disabled={sessionsLoading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dfe2da] px-3 text-xs font-semibold text-[#454a42] hover:bg-[#f5f6f2] disabled:opacity-60 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.06]">{sessionsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Refresh</button>
        </div>
        <div className="mt-4 rounded-xl border border-[#e7ebdf] bg-[#f8faf5] p-3 text-xs leading-5 text-[#62685d] dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">Sessions end after <strong className="text-[#30362c] dark:text-white">30 minutes of inactivity</strong> or <strong className="text-[#30362c] dark:text-white">12 hours</strong>, whichever comes first.</div>
        {sessionsError ? <p role="alert" className="mt-4 text-sm font-medium text-[#a63832]">{sessionsError}</p> : null}
        {sessionsLoading ? <div className="mt-5 flex items-center gap-2 text-sm text-[#73766f] dark:text-white/60"><Loader2 size={16} className="animate-spin" />Loading active sessions…</div> : sessions.length ? <div className="mt-4 divide-y divide-[#edf0eb] dark:divide-white/[0.07]">{sessions.map((session) => {
          const { device, browser, os } = sessionDevice(session.userAgent);
          const DeviceIcon = /Mobile/i.test(device) ? Smartphone : Monitor;
          return <article key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0f3eb] text-[#5f6d4f] dark:bg-white/[0.06] dark:text-white/70"><DeviceIcon size={18} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#30362c] dark:text-white">{browser}{os ? ` · ${os}` : ''}</p><p className="mt-0.5 text-xs text-[#73766f] dark:text-white/55">{device} · Signed in {new Date(session.createdAt).toLocaleString()}</p><p className="mt-0.5 text-[11px] text-[#858b7f] dark:text-white/40">IP {session.ipAddress || 'not recorded'} · Last session expiry {new Date(session.expiresAt).toLocaleString()}</p></div></div>
            <div className="flex items-center gap-2">{session.isCurrent ? <span className="rounded-full bg-[#e8f5ed] px-2.5 py-1 text-[11px] font-bold text-[#147554] dark:bg-emerald-950/50 dark:text-emerald-300">This device</span> : <button type="button" onClick={() => void revokeSession(session)} disabled={revokingSessionId === session.id} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#f0d9d6] px-3 text-xs font-semibold text-[#a63832] transition hover:bg-[#fff1ef] disabled:opacity-60 dark:border-red-400/20 dark:hover:bg-red-400/10">{revokingSessionId === session.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}Sign out</button>}</div>
          </article>;
        })}</div> : !sessionsError ? <p className="mt-4 text-sm text-[#73766f] dark:text-white/60">No active sessions were found. Sign in again to create one.</p> : null}
      </section>
    </div>
    {isSubmitting ? <AuthLoadingOverlay message="Updating your password…" /> : null}
    </>
  );
}
