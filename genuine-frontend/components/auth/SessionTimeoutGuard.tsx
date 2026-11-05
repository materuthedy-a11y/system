'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, LogIn, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const WARNING_WINDOW_MS = 2 * 60 * 1000;
const ACTIVITY_CHANNEL = 'mizania-session-activity';

export function SessionTimeoutGuard() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const idleTimeoutSeconds = useAuthStore((state) => state.idleTimeoutSeconds);
  const absoluteExpiresAt = useAuthStore((state) => state.absoluteExpiresAt);
  const logout = useAuthStore((state) => state.logout);
  const syncToken = useAuthStore((state) => state.syncToken);
  const lastActivityAt = useRef(Date.now());
  const lastPointerBroadcastAt = useRef(0);
  const warningOpenRef = useRef(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') return;
    lastActivityAt.current = Date.now();
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(ACTIVITY_CHANNEL) : null;
    const markActivity = () => {
      if (warningOpenRef.current) return;
      lastActivityAt.current = Date.now();
      setMessage('');
      channel?.postMessage({ type: 'activity', at: lastActivityAt.current });
    };
    const markPointerActivity = () => {
      if (warningOpenRef.current) return;
      const current = Date.now();
      if (current - lastPointerBroadcastAt.current < 5000) {
        lastActivityAt.current = current;
        setMessage('');
        return;
      }
      lastPointerBroadcastAt.current = current;
      markActivity();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'activity' && Number.isFinite(event.data.at)) {
        lastActivityAt.current = Math.max(lastActivityAt.current, Number(event.data.at));
        setMessage('');
      }
    };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity);
    window.addEventListener('touchstart', markActivity, { passive: true });
    window.addEventListener('pointermove', markPointerActivity, { passive: true });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('touchstart', markActivity);
      window.removeEventListener('pointermove', markPointerActivity);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [status]);

  const absoluteRemaining = absoluteExpiresAt ? new Date(absoluteExpiresAt).getTime() - now : Number.POSITIVE_INFINITY;
  const idleRemaining = idleTimeoutSeconds * 1000 - (now - lastActivityAt.current);
  const absoluteWarning = absoluteRemaining <= idleRemaining;
  const remaining = Math.min(absoluteRemaining, idleRemaining);
  const shouldWarn = status === 'authenticated' && remaining <= WARNING_WINDOW_MS && remaining > 0;
  const hasExpired = status === 'authenticated' && remaining <= 0;

  useEffect(() => { warningOpenRef.current = shouldWarn; }, [shouldWarn]);

  useEffect(() => {
    if (!hasExpired || busy) return;
    setBusy(true);
    void logout().finally(() => router.replace('/login?reason=session-expired'));
  }, [hasExpired, busy, logout, router]);

  async function continueSession() {
    if (absoluteWarning) {
      setBusy(true);
      await logout();
      router.replace('/login?reason=session-expired');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await authAPI.refreshSession();
      syncToken();
      lastActivityAt.current = Date.now();
      setNow(Date.now());
    } catch {
      setMessage('Your session has expired. Please sign in again.');
      await logout();
      router.replace('/login?reason=session-expired');
    } finally {
      setBusy(false);
    }
  }

  if (!shouldWarn) return null;
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));

  return (
    <div role="presentation" className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <section role="alertdialog" aria-modal="true" aria-labelledby="session-timeout-title" aria-describedby="session-timeout-description" className="w-full max-w-md rounded-2xl border border-[#e5e7e0] bg-white p-5 text-[#20211f] shadow-2xl dark:border-[#343b33] dark:bg-[#171a17] dark:text-[#f0f1ed] sm:p-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef4d7] text-[#5c7000] dark:bg-[#33391d] dark:text-[#e1ec8b]">
          {absoluteWarning ? <ShieldCheck size={20} /> : <Clock3 size={20} />}
        </span>
        <h2 id="session-timeout-title" className="mt-4 text-lg font-semibold">
          {absoluteWarning ? 'Sign-in time limit is near' : 'Your session is about to end'}
        </h2>
        <p id="session-timeout-description" className="mt-2 text-sm leading-6 text-[#62685d] dark:text-[#afb5ac]">
          {absoluteWarning
            ? `For your security, you will need to sign in again in about ${minutes} minute${minutes === 1 ? '' : 's'}. Save your work now.`
            : `You have been inactive. Your session will end in about ${minutes} minute${minutes === 1 ? '' : 's'}. Continue to stay signed in.`}
        </p>
        {message ? <p role="alert" className="mt-3 text-sm font-medium text-[#a63832]">{message}</p> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={() => { setBusy(true); void logout().finally(() => router.replace('/login')); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold text-[#454a42] transition hover:bg-[#f5f6f2] disabled:opacity-60 dark:border-[#41473f] dark:text-[#e1e4dc] dark:hover:bg-[#222622]">
            <LogIn size={15} /> Sign out
          </button>
          {!absoluteWarning ? <button type="button" disabled={busy} onClick={() => void continueSession()} className="min-h-10 rounded-xl bg-[#087b59] px-4 text-sm font-semibold text-white transition hover:bg-[#06684b] disabled:opacity-60">
            {busy ? 'Checking session…' : 'Continue session'}
          </button> : null}
        </div>
      </section>
    </div>
  );
}
