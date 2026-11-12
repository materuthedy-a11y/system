import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3efe6] px-4 py-12 text-[#20231f] dark:bg-[#080908] dark:text-[#e1e5de]">
      <section className="w-full max-w-xl rounded-3xl border border-[#dfe6d9] bg-white/90 p-6 shadow-[0_18px_55px_rgba(23,35,23,0.10)] backdrop-blur sm:p-8 dark:border-white/10 dark:bg-[#171a17]">
        <div className="flex items-center gap-3 text-[#087f5b] dark:text-[#ffad66]">
          <Compass size={20} aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[0.18em]">Mizania Business Suite</p>
        </div>
        <p className="mt-6 text-6xl font-black tracking-tight text-[#087f5b] dark:text-[#ffad66]">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Ukurasa haujapatikana</h1>
        <p className="mt-2 text-sm leading-6 text-[#626a60] dark:text-[#aab2a6]">
          Kiungo hiki huenda kimebadilika au ukurasa umeondolewa. Rudi kwenye dashboard uendelee na kazi.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white transition hover:bg-[#066b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] dark:bg-[#ffad66] dark:text-[#20211f] dark:hover:bg-[#ffc28f]">
          <ArrowLeft size={15} aria-hidden="true" /> Rudi dashboard
        </Link>
      </section>
    </main>
  );
}
