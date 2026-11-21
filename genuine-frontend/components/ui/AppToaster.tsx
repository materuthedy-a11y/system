'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Toaster, toast, type Toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

type NoticeKind = 'success' | 'error' | 'warning' | 'info';

const styles: Record<NoticeKind, { icon: typeof CheckCircle2; accent: string; tint: string }> = {
  success: { icon: CheckCircle2, accent: '#16734a', tint: '#e9f7ef' },
  error: { icon: AlertCircle, accent: '#dc2626', tint: '#fecaca' },
  warning: { icon: AlertTriangle, accent: '#a56a08', tint: '#fff7df' },
  info: { icon: Info, accent: '#3468a8', tint: '#edf5ff' },
};

function ToastCard({ item, kind, message }: { item: Toast; kind: NoticeKind; message: string }) {
  const style = styles[kind];
  const Icon = style.icon;
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
      <div role={kind === 'error' ? 'alert' : 'status'} className="relative z-10 flex w-[min(390px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-[#e2e5dd] bg-white/95 p-4 text-left shadow-[0_18px_50px_rgba(20,30,15,0.22)] ring-1 ring-black/[0.06] backdrop-blur-md dark:border-white/10 dark:bg-[#191d19]/95" style={{ borderLeft: `4px solid ${style.accent}` }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ color: style.accent, backgroundColor: style.tint }}><Icon size={19} /></span>
        <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-5 text-[#30342e] dark:text-[#edf2ec]">{message}</p>
        <button type="button" onClick={() => toast.dismiss(item.id)} aria-label="Dismiss message" className="rounded-lg p-1 text-[#858880] transition hover:bg-[#f1f2ee] hover:text-[#30342e]"><X size={16} /></button>
      </div>
    </>
  );
}

export const notify = {
  success: (message: string) => toast.custom((item) => <ToastCard item={item} kind="success" message={message} />, { duration: 5_500 }),
  error: (message: string) => toast.custom((item) => <ToastCard item={item} kind="error" message={message} />, { duration: 6_000 }),
  warning: (message: string) => toast.custom((item) => <ToastCard item={item} kind="warning" message={message} />, { duration: 5_500 }),
  info: (message: string) => toast.custom((item) => <ToastCard item={item} kind="info" message={message} />, { duration: 5_500 }),
};

export function AppToaster() {
  return <Toaster position="top-right" gutter={10} containerClassName="!top-4 !right-4 !z-[300]" />;
}
