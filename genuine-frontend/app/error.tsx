'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-12 text-[#20231f] dark:text-[#e1e5de]">
      <section role="alert" className="w-full max-w-xl rounded-3xl border border-[#dfe6d9] bg-white/90 p-6 shadow-[0_18px_55px_rgba(23,35,23,0.10)] backdrop-blur sm:p-8 dark:border-white/10 dark:bg-[#171a17]">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff3e8] text-[#a75c16] dark:bg-[#38291b] dark:text-[#f2bb72]">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#047857] dark:text-[#d8f04b]">Mizania Business Suite</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Page haikuweza kufunguka</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-[#626a60] dark:text-[#aab2a6]">
          Hitilafu imetokea wakati wa kufungua sehemu hii. Jaribu tena; taarifa zako hazijabadilishwa na ujumbe huu.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-[#73766f] dark:text-[#929b90]">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => reset()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white transition hover:bg-[#066b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] dark:bg-[#d8f04b] dark:text-[#20211f] dark:hover:bg-[#e3f77c]">
            <RefreshCw size={15} aria-hidden="true" /> Jaribu tena
          </button>
          <Link href="/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8ddd3] px-4 text-sm font-semibold text-[#3f5846] transition hover:bg-[#f2f7ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] dark:border-white/15 dark:text-[#d8f04b] dark:hover:bg-white/5">
            <ArrowLeft size={15} aria-hidden="true" /> Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
