'use client';

import { useAuthStore } from '@/store/authStore';
import { CustomerForm } from '@/components/customers/CustomerForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewCustomerPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes('customers.create');

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <Link
        href="/dashboard/customers"
        className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#536052] transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to customers
      </Link>

      {!canCreate ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100">
          <h1 className="text-lg font-bold">Create access required</h1>
          <p className="mt-1">Your account is not allowed to create customers.</p>
        </section>
      ) : (
        <>
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Customers</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#20231f] dark:text-white">New customer</h1>
            <p className="mt-1 text-sm text-[#667064] dark:text-white/60">Set up a customer account and its credit terms.</p>
          </div>
          <CustomerForm />
        </>
      )}
    </main>
  );
}
