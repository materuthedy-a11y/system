'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Mizania application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f3efe6] text-[#20231f] dark:bg-[#080908] dark:text-[#e1e5de]">
        <main className="grid min-h-screen place-items-center px-4 py-12">
          <section role="alert" className="w-full max-w-xl rounded-3xl border border-[#dfe6d9] bg-white/90 p-6 shadow-[0_18px_55px_rgba(23,35,23,0.10)] backdrop-blur sm:p-8 dark:border-white/10 dark:bg-[#171a17]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff3e8] text-[#a75c16] dark:bg-[#38291b] dark:text-[#f2bb72]"><AlertTriangle size={22} aria-hidden="true" /></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#047857] dark:text-[#d8f04b]">Mizania Business Suite</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Mfumo umepata hitilafu</h1>
            <p className="mt-2 text-sm leading-6 text-[#626a60] dark:text-[#aab2a6]">Jaribu kupakia upya ili kurejesha ukurasa. Taarifa zilizohifadhiwa kwenye server hazijaathiriwa na ujumbe huu.</p>
            {error.digest ? <p className="mt-3 text-xs text-[#73766f] dark:text-[#929b90]">Reference: {error.digest}</p> : null}
            <button type="button" onClick={() => reset()} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white transition hover:bg-[#066b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] dark:bg-[#d8f04b] dark:text-[#20211f] dark:hover:bg-[#e3f77c]">
              <RefreshCw size={15} aria-hidden="true" /> Pakia upya
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
