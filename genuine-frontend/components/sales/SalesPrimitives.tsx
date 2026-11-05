'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import type { InvoiceStatus, ReturnStatus } from '@/lib/api/sales';
import { formatBusinessCalendarDate, formatBusinessDate } from '@/lib/format/businessDate';

export const money = (value: number, currency?: string) => new Intl.NumberFormat(undefined, {
  ...(currency ? { style: 'currency' as const, currency } : { style: 'decimal' as const }),
  maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);

export const dateLabel = (value?: string) => formatBusinessDate(value);
export const calendarDateLabel = (value?: string) => formatBusinessCalendarDate(value);

export function useSalesPermissions() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  return {
    canView: permissions.includes('sales.view'),
    canCreate: permissions.includes('sales.create'),
    canEdit: permissions.includes('sales.edit'),
    canApprove: permissions.includes('sales.approve'),
    canCancel: permissions.includes('sales.cancel'),
    canDiscount: permissions.includes('sales.discount'),
    canPay: permissions.includes('payments.create'),
    canViewCustomers: permissions.includes('customers.view'),
    canViewProducts: permissions.includes('products.view'),
    canViewSettings: permissions.includes('settings.view'),
    canEditSettings: permissions.includes('settings.edit'),
  };
}

const invoiceColors: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-amber-400 text-amber-950', ISSUED: 'bg-blue-600 text-white',
  PARTIALLY_PAID: 'bg-amber-500 text-white', PAID: 'bg-emerald-600 text-white',
  OVERDUE: 'bg-rose-600 text-white', CANCELLED: 'bg-zinc-600 text-white',
};
const returnColors: Record<ReturnStatus, string> = {
  DRAFT: 'bg-amber-400 text-amber-950', AUTHORIZED: 'bg-blue-600 text-white',
  RECEIVED: 'bg-emerald-600 text-white', COMPLETED: 'bg-emerald-700 text-white',
  REJECTED: 'bg-rose-600 text-white',
};

export function StatusBadge({ status }: { status: InvoiceStatus | ReturnStatus }) {
  const className = status in invoiceColors
    ? invoiceColors[status as InvoiceStatus]
    : returnColors[status as ReturnStatus];
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${className}`}>{status.replace(/_/g, ' ')}</span>;
}

export function SalesHeading({ title, description, action }: {
  title: string; description: string; action?: { href: string; label: string };
}) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#637b12]">Sales</p><h1 className="mt-1 text-2xl font-semibold text-[#292d27]">{title}</h1><p className="mt-1 text-sm text-[#747a68]">{description}</p></div>
    {action ? <Link href={action.href} className="inline-flex min-h-10 items-center rounded-lg bg-[#20211f] px-4 text-sm font-semibold text-white hover:bg-[#353832] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#718b11]">{action.label}</Link> : null}
  </div>;
}

export function SalesNotice({ children, kind = 'error' }: { children: React.ReactNode; kind?: 'error' | 'info' }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'} className={`mb-4 rounded-lg border px-4 py-3 text-sm ${kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-[#dce8a2] bg-[#f6f9e8] text-[#48580d]'}`}>{children}</div>;
}
