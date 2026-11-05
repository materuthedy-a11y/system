'use client';

import Link from 'next/link';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { formatBusinessDate } from '@/lib/format/businessDate';

export const money = (value: number) => new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 2 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
export const dateLabel = (value?: string | null) => formatBusinessDate(value);
export const statusTone: Record<string, string> = {
  DRAFT: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-[#20211f]',
  PENDING: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-[#20211f]',
  APPROVED: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  SENT: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  PARTIAL: 'bg-orange-600 text-white dark:bg-orange-500 dark:text-white',
  COMPLETED: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
  POSTED: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
  REJECTED: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white',
  CANCELLED: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white',
};
export function Status({ value }: { value: string }) { return <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold ${statusTone[value] || 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-200'}`}>{value.replace(/_/g, ' ')}</span>; }

export function useInventoryPermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  return { canView: permissions.includes('inventory.view'), canAdjust: permissions.includes('inventory.adjust'), canTransfer: permissions.includes('inventory.transfer') };
}

export function InventoryHeading({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <header className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#e6e8e1] bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7 dark:border-white/[0.08] dark:bg-[#1b1e1a]">
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#755700] dark:text-[#d8b454]">Inventory</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#20211f] sm:text-3xl dark:text-[#f0f1ed]">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#73766f] dark:text-[#afb5ac]">{description}</p></div>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </header>;
}
export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#20211f] px-4 text-sm font-semibold text-white transition hover:bg-[#3c3522] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border dark:border-[#8b702d] dark:bg-[#11120f] dark:hover:bg-[#2b2618]">{children}</Link>; }
export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`min-w-0 rounded-2xl border border-[#e6e8e1] bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#1b1e1a] ${className}`}>{children}</section>; }
export function Loading({ label = 'Loading inventory…' }: { label?: string }) { return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#73766f] dark:text-[#afb5ac]"><Loader2 size={18} className="animate-spin text-[#a17a16]"/>{label}</div>; }
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) { return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-950/25 dark:text-rose-200"><AlertCircle size={17}/><span className="min-w-0 flex-1">{message}</span>{retry ? <button onClick={retry} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"><RefreshCw size={14}/>Retry</button> : null}</div>; }
export function Empty({ title, detail }: { title: string; detail: string }) { return <div className="px-5 py-12 text-center"><p className="font-semibold text-[#30332e] dark:text-[#e1e4dc]">{title}</p><p className="mt-1 text-sm text-[#73766f] dark:text-[#afb5ac]">{detail}</p></div>; }
export function InventoryDenied() { return <Panel className="mx-auto max-w-2xl p-7 text-center"><AlertCircle className="mx-auto text-rose-600"/><h1 className="mt-3 text-xl font-semibold text-[#20211f] dark:text-white">Inventory access required</h1><p className="mt-2 text-sm text-[#73766f] dark:text-[#afb5ac]">Your account does not have the <code>inventory.view</code> permission. Ask a business administrator to grant access.</p></Panel>; }
export function PageNav({ page, pages, onChange, shown, total }: { page: number; pages: number; onChange: (page: number) => void; shown: number; total: number }) { return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceee8] px-4 py-3 text-sm text-[#73766f] dark:border-white/[0.08] dark:text-[#afb5ac]"><span>Showing {total ? (page - 1) * 20 + 1 : 0}–{(page - 1) * 20 + shown} of {total}</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => onChange(page - 1)} className="min-h-9 rounded-lg border border-[#dfe2da] px-3 disabled:opacity-40 dark:border-white/10">Previous</button><span className="px-1">{page} / {pages}</span><button disabled={page >= pages} onClick={() => onChange(page + 1)} className="min-h-9 rounded-lg border border-[#dfe2da] px-3 disabled:opacity-40 dark:border-white/10">Next</button></div></div>; }
export const fieldClass = 'min-h-10 w-full rounded-xl border border-[#dfe2da] bg-white px-3 text-sm text-[#242622] outline-none transition placeholder:text-[#969a92] focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40 dark:border-white/10 dark:bg-[#111310] dark:text-[#f0f1ed] dark:placeholder:text-[#858b80] dark:focus:border-amber-400 dark:focus:ring-amber-300/30';
export const labelClass = 'grid min-w-0 gap-1.5 text-xs font-semibold text-[#53584e] dark:text-[#c6cbc2]';
