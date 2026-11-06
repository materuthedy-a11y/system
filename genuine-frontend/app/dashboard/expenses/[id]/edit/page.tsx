'use client';

import { useCallback, useEffect, useState } from 'react';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { expensesAPI, type ExpenseRecord } from '@/lib/api/expenses';
import { getApiError } from '@/lib/api';
import { useParams } from 'next/navigation';

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setExpense(await expensesAPI.get(id)); }
    catch (cause) { setError(getApiError(cause, 'Could not load this expense draft.')); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <div role="status" className="rounded-2xl border border-[#e4e7df] bg-white p-8 text-center text-sm dark:border-white/10 dark:bg-[#171a17]">Loading expense draft…</div>;
  if (error || !expense) return <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">{error || 'Expense not found.'}<button type="button" onClick={() => void load()} className="ml-3 underline">Retry</button></section>;
  if (expense.status !== 'DRAFT') return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">Only a draft expense can be edited. <a className="ml-1 underline" href={`/dashboard/expenses/${expense.id}`}>Open expense</a></section>;
  return <ExpenseForm mode="edit" expense={expense} />;
}
