'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { AuthField, AuthFrame, FormError, reportAuthError } from '@/components/auth/AuthFrame';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { authAPI, getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const authStatus = useAuthStore((state) => state.status);
  const initialize = useAuthStore((state) => state.initialize);
  const initializationStarted = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);
  const [reopenMessage, setReopenMessage] = useState('');
  const [reopenSuccess, setReopenSuccess] = useState(false);

  useEffect(() => {
    if (!initializationStarted.current) {
      initializationStarted.current = true;
      if (useAuthStore.getState().status === 'loading') void initialize();
    }
  }, [initialize]);

  useEffect(() => {
    if (authStatus === 'authenticated' && !isSubmitting && !isRedirecting) router.replace('/dashboard');
  }, [authStatus, isSubmitting, isRedirecting, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isRedirecting || authStatus === 'loading' || authStatus === 'authenticated') return;
    setError('');
    if (!email.trim() || !password) {
      reportAuthError('Enter both your email address and password.', setError);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      reportAuthError('Enter a valid email address.', setError);
      return;
    }
    setIsSubmitting(true);
    try {
      await login(email, password);
      try {
        window.sessionStorage.setItem('mizania.welcome.after-login.v1', 'yes');
      } catch {
        // Login remains available if browser storage is disabled.
      }
      const requestedPath = new URLSearchParams(window.location.search).get('next');
      const safePath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') && requestedPath !== '/login' ? requestedPath : '/dashboard';
      setIsRedirecting(true);
      router.replace(safePath);
    } catch (cause) {
      reportAuthError(cause instanceof Error ? cause.message : 'We could not sign you in. Please try again.', setError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReopen() {
    setReopenMessage(''); setReopenSuccess(false); setError('');
    if (!email.trim() || !password) { reportAuthError('Enter your email and password to reopen the workspace.', setError); return; }
    setReopenBusy(true);
    try {
      const result = await authAPI.restoreWorkspace(email.trim().toLowerCase(), password);
      setReopenMessage(result.message);
      setReopenSuccess(true);
    } catch (cause) {
      setReopenMessage(getApiError(cause, 'Unable to restore this workspace. Check your details or contact support.'));
    } finally {
      setReopenBusy(false);
    }
  }

  return (
    <>
    <AuthFrame eyebrow="Welcome back" title="Sign in to your workspace" description="Use your business account details to continue.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <AuthField label="Email address" id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={setEmail} disabled={isSubmitting} />
        <AuthField
          label="Password"
          id="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          disabled={isSubmitting}
          maxLength={128}
          suffix={<button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#777b73] hover:text-[#20231f]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-[#ffad66] hover:text-white">Forgot password?</Link>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || isRedirecting || authStatus === 'loading'}
          aria-busy={isSubmitting || isRedirecting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ffd166] via-[#ffad36] to-[#f28a1b] px-5 text-sm font-bold text-[#20170a] shadow-[0_10px_32px_rgba(255,167,45,0.28)] transition hover:brightness-105 hover:shadow-[0_12px_38px_rgba(255,167,45,0.38)] focus:outline-none focus:ring-4 focus:ring-[#ffad66]/35 disabled:cursor-wait disabled:opacity-70"
        >
          Sign in <span aria-hidden="true">→</span>
        </button>
        <p className="pt-1 text-center text-sm text-white/75">New to Mizania? <Link href="/register" className="font-semibold text-white underline-offset-4 hover:underline">Create an account</Link></p>
      </form>
      <div className="mt-6 border-t border-white/15 pt-4">
        <button type="button" onClick={() => { setShowReopen((v) => !v); setReopenMessage(''); }} className="w-full text-center text-xs font-semibold text-emerald-300 hover:text-emerald-200">
          {showReopen ? 'Hide workspace recovery' : 'Closed workspace? Reopen it'}
        </button>
        {showReopen ? <div className="mt-3 space-y-3">
          <p className="text-center text-[11px] leading-4 text-white/55">Enter the owner email and password. The workspace reopens only if it was closed within the retention period.</p>
          {reopenMessage ? <div className="flex flex-col items-center gap-2 py-1">
            {reopenSuccess ? <svg className="auth-tick h-16 w-16" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <circle cx="26" cy="26" r="24" stroke="#34d399" strokeWidth="3" />
              <path d="M15 27l7 7 15-16" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg> : reopenMessage ? <svg className="auth-tick auth-x h-16 w-16" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <circle cx="26" cy="26" r="24" stroke="#f87171" strokeWidth="3" />
              <path d="M17 17l18 18" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
              <path d="M35 17L17 35" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
            </svg> : null}
            <p role="status" className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${reopenSuccess ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200' : 'border-red-400/60 bg-red-500/20 text-red-300'}`}>{reopenMessage}</p>
          </div> : null}
          <button type="button" onClick={() => void handleReopen()} disabled={reopenBusy} className="flex h-11 w-full items-center justify-center rounded-xl border border-emerald-300/50 bg-emerald-400/15 px-4 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-60">
            {reopenBusy ? 'Restoring…' : 'Reopen workspace'}
          </button>
        </div> : null}
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/70"><LockKeyhole size={14} /> Your sign-in is encrypted and protected.</div>
    </AuthFrame>
    {isSubmitting || isRedirecting ? <AuthLoadingOverlay message={isRedirecting ? 'Opening your workspace…' : 'Signing you in…'} /> : null}
    </>
  );
}
