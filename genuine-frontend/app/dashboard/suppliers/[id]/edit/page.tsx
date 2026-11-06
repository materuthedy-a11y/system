'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getApiError } from '@/lib/api';
import { suppliersAPI, type Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/authStore';
import { SupplierForm } from '@/components/suppliers/SupplierForm';

export default function EditSupplierPage() {
  const { id } = useParams<{ id: string }>();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setSupplier(await suppliersAPI.get(id)); } catch (cause) { setError(getApiError(cause, 'Could not load this supplier.')); } finally { setLoading(false); } }, [id]);
  useEffect(() => { if (permissions.includes('suppliers.view')) void load(); else setLoading(false); }, [load, permissions]);
  if (!permissions.includes('suppliers.edit')) return <main className="mx-auto w-full max-w-4xl p-4 sm:p-6"><section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-[#14171d] dark:text-blue-100"><h1 className="text-lg font-bold">Edit access required</h1><p className="mt-1">Your account is not allowed to edit suppliers.</p></section></main>;
  if (loading) return <main role="status" className="p-6 text-sm"><Loader2 className="mr-2 inline animate-spin" size={16}/>Loading supplier…</main>;
  if (!supplier) return <main className="p-6"><p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error || 'Supplier not found.'}<button type="button" onClick={() => void load()} className="ml-3 underline">Retry</button></p></main>;
  return <SupplierForm supplier={supplier}/>;
}
