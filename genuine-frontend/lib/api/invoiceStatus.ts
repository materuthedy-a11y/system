import type { InvoiceStatus } from '@/lib/api/sales';

export type InvoiceDisplayStatus = InvoiceStatus | 'RETURNED' | 'PARTIALLY_CREDITED' | 'SETTLED' | 'PARTIALLY_SETTLED';

export function invoiceDisplayStatus(invoice: {
  status: InvoiceStatus;
  totalAmount: number;
  totalPaid: number;
  returnCredits: number;
  balance: number;
}): InvoiceDisplayStatus {
  if (
    invoice.status === 'DRAFT' ||
    invoice.status === 'CANCELLED' ||
    invoice.status === 'OVERDUE' ||
    invoice.returnCredits <= 0
  ) {
    return invoice.status;
  }

  const hasPayment = invoice.totalPaid > 0;
  const isSettled = invoice.balance <= 0;
  if (isSettled) return hasPayment ? 'SETTLED' : 'RETURNED';
  return hasPayment ? 'PARTIALLY_SETTLED' : 'PARTIALLY_CREDITED';
}
