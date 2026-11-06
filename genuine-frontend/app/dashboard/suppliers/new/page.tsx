'use client';

import { useAuthStore } from '@/store/authStore';
import { SupplierForm } from '@/components/suppliers/SupplierForm';

export default function NewSupplierPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  return permissions.includes('suppliers.create') ? <SupplierForm /> : <main className="mx-auto w-full max-w-4xl p-4 sm:p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100"><h1 className="text-lg font-bold">Create access required</h1><p className="mt-1">Your account is not allowed to create suppliers.</p></section></main>;
}
