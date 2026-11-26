'use client';

import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Toaster, toast, type Toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

type NoticeKind = 'success' | 'error' | 'warning' | 'info';
let errorToastRevision = 0;
const recentErrorToasts = new Map<string, number>();
const errorToastDedupeWindowMs = 1_500;

const styles: Record<NoticeKind, { icon: typeof CheckCircle2; accent: string; tint: string }> = {
  success: { icon: CheckCircle2, accent: '#16734a', tint: '#e9f7ef' },
  error: { icon: AlertCircle, accent: '#dc2626', tint: '#fecaca' },
  warning: { icon: AlertTriangle, accent: '#a56a08', tint: '#fff7df' },
  info: { icon: Info, accent: '#3468a8', tint: '#edf5ff' },
};

function ToastCard({ item, kind, message }: { item: Toast; kind: NoticeKind; message: string }) {
  const style = styles[kind];
  const Icon = style.icon;
  const isSuccess = kind === 'success';
  const backdrop =
    kind === 'error' && typeof document !== 'undefined'
      ? createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[299] bg-[#11140f]/10 backdrop-blur-[2px] dark:bg-black/20"
          />,
          document.body,
        )
      : null;
  return (
    <>
      {backdrop}
      <div
        role={kind === 'error' ? 'alert' : 'status'}
        className={`relative z-10 flex w-[min(390px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border p-4 text-left ring-1 ring-black/[0.06] ${
          isSuccess
            ? 'border-[#22C55E] bg-[#DCFCE7] shadow-[0_12px_32px_rgba(20,30,15,0.18)] dark:border-[#22C55E] dark:bg-[#14532D]'
            : 'border-[#e2e5dd] bg-white/95 shadow-[0_18px_50px_rgba(20,30,15,0.22)] backdrop-blur-md dark:border-white/10 dark:bg-[#191d19]/95'
        }`}
        style={{ borderLeft: `4px solid ${isSuccess ? '#22C55E' : style.accent}` }}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            isSuccess ? 'bg-[#bbf7d0] text-[#166534] dark:bg-[#166534] dark:text-[#DCFCE7]' : ''
          }`}
          style={isSuccess ? undefined : { color: style.accent, backgroundColor: style.tint }}
        >
          {isSuccess ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[19px] w-[19px] overflow-visible">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" />
              <path className="toast-success-tick" d="m7.5 12.4 3 3.1 6.2-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
            </svg>
          ) : kind === 'error' ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[19px] w-[19px] overflow-visible">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" />
              <path className="toast-error-x" d="m8.2 8.2 7.6 7.6m0-7.6-7.6 7.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
            </svg>
          ) : (
            <Icon size={19} />
          )}
        </span>
        <p className={`min-w-0 flex-1 pt-1 text-sm font-medium leading-5 ${isSuccess ? 'text-[#166534] dark:text-[#DCFCE7]' : 'text-[#30342e] dark:text-[#edf2ec]'}`}>
          {message}
        </p>
        <button
          type="button"
          onClick={() => toast.dismiss(item.id)}
          aria-label="Dismiss message"
          className={`rounded-lg p-1 transition ${isSuccess ? 'text-[#166534] hover:bg-[#bbf7d0] dark:text-[#DCFCE7] dark:hover:bg-[#166534]' : 'text-[#858880] hover:bg-[#f1f2ee] hover:text-[#30342e]'}`}
        >
          <X size={16} />
        </button>
      </div>
    </>
  );
}

export const notify = {
  success: (message: string) => toast.custom((item) => <ToastCard item={item} kind="success" message={message} />, { duration: 5_500 }),
  error: (message: string) => {
    errorToastRevision += 1;
    const now = Date.now();
    const lastShownAt = recentErrorToasts.get(message);
    if (lastShownAt !== undefined && now - lastShownAt < errorToastDedupeWindowMs) return;
    recentErrorToasts.set(message, now);
    window.setTimeout(() => {
      if (recentErrorToasts.get(message) === now) recentErrorToasts.delete(message);
    }, errorToastDedupeWindowMs);
    return toast.custom((item) => <ToastCard item={item} kind="error" message={message} />, { duration: 6_000 });
  },
  warning: (message: string) => toast.custom((item) => <ToastCard item={item} kind="warning" message={message} />, { duration: 5_500 }),
  info: (message: string) => toast.custom((item) => <ToastCard item={item} kind="info" message={message} />, { duration: 5_500 }),
};

export function AppToaster() {
  useEffect(() => {
    const timers = new Set<number>();
    const onApiError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message?.trim();
      if (!message) return;
      const revisionAtDispatch = errorToastRevision;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        // A page-level error handler already showed a toast for this failure.
        if (revisionAtDispatch === errorToastRevision) notify.error(message);
      }, 60);
      timers.add(timer);
    };
    window.addEventListener('mizania:api-error', onApiError);
    return () => {
      window.removeEventListener('mizania:api-error', onApiError);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return <Toaster position="top-right" gutter={10} containerClassName="!top-4 !right-4 !z-[300]" />;
}
