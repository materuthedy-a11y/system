'use client';

import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { CustomerForm } from '@/components/customers/CustomerForm';

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  if (!permissions.includes('customers.edit')) return <div className="mx-auto w-full max-w-4xl p-4 sm:p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100"><h1 className="text-lg font-bold">Edit access required</h1><p className="mt-1">Your account is not allowed to edit customers.</p></section></div>;
  return <main className="mx-auto w-full max-w-4xl p-4 sm:p-6"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Customers</p><h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">Edit customer</h1><p className="mt-1 text-sm text-[#667064] dark:text-white/60">Update contact details, address, credit settings or status.</p></div><CustomerForm customerId={params.id} /></main>;
}
