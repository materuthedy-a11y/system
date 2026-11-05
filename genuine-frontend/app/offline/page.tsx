import Image from 'next/image';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_#fff9e8_0%,_#f3efe6_48%,_#ece8df_100%)] px-4 py-10 text-[#20231f] dark:bg-[radial-gradient(ellipse_at_top,_#26251f_0%,_#111214_48%,_#080908_100%)] dark:text-[#e1e5de] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-[#e6c76c]/15 blur-3xl dark:bg-[#d7ae45]/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-[#d7ae45]/10 blur-3xl dark:bg-[#d7ae45]/[0.08]" />

      <section role="alert" aria-labelledby="offline-title" className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#e7dfc8] bg-[#fffefa]/95 p-6 shadow-[0_24px_80px_rgba(54,43,17,0.12)] backdrop-blur sm:p-9 dark:border-white/10 dark:bg-[#191a1b]/95 dark:shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#a77a1d] via-[#e7c75d] to-[#a77a1d]" />

        <div className="flex items-center justify-between gap-4">
          <Image
            src="/MIZANIA_BRAND_PACKAGE/logos/svg/wordmark.svg"
            alt="Mizania — Rekodi, fuatilia, endelea"
            width={195}
            height={40}
            priority
            className="h-10 w-auto"
          />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#eadcae] bg-[#fbf5df] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#79570d] dark:border-[#6c5728] dark:bg-[#342b19] dark:text-[#f0d98f]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#c28e1c] dark:bg-[#e2bd55]" />
            Offline
          </span>
        </div>

        <div className="mt-9 flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#eadcae] bg-gradient-to-br from-[#fff4cd] to-[#f4e5ae] text-[#88620d] shadow-inner shadow-[#a77a1d]/10 dark:border-[#67552d] dark:from-[#3c321e] dark:to-[#2b261d] dark:text-[#f0d98f]">
            <WifiOff size={25} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b681b] dark:text-[#e3c76c]">Connection interrupted</p>
            <h1 id="offline-title" className="mt-2 text-3xl font-bold tracking-tight text-[#20211f] dark:text-[#f4f1e8]">You’re offline</h1>
            <p className="mt-2 text-sm leading-6 text-[#62645e] dark:text-[#b3b4ae]">
              Mizania needs an internet connection to load current workspace data and send changes. Reconnect, then try again.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-2xl border border-[#eadcae] bg-[#fbf7e9] p-4 dark:border-[#51452a] dark:bg-[#242117]">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#96701d] dark:text-[#e3c76c]" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold text-[#4e4631] dark:text-[#eee5c9]">About saved work</p>
            <p className="mt-1 text-xs leading-5 text-[#6b6658] dark:text-[#bab5a6]">
              Only purchase-order drafts that you explicitly save are kept on this device. Approvals, receipts, payments, returns, and stock changes need a connection and are not queued.
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row">
          <a href="/dashboard" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#171819] px-5 text-sm font-semibold text-[#f7f4ec] shadow-sm transition hover:bg-[#2b2c2d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c99d39] dark:bg-[#d7ae45] dark:text-[#171819] dark:hover:bg-[#e4c365]">
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </a>
          <a href="/login" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#d8d2c2] bg-white/70 px-5 text-sm font-semibold text-[#45443d] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c99d39] dark:border-white/15 dark:bg-white/[0.04] dark:text-[#e1e5de] dark:hover:bg-white/[0.08]">
            Go to sign in
          </a>
        </div>

        <p className="mt-5 text-center text-[11px] font-medium tracking-wide text-[#8b8a82] dark:text-[#85867f]">Your records stay protected while you reconnect.</p>
      </section>
    </main>
  );
}
