'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, ArrowRight, Clock3, Moon, RefreshCw, Sun, Sunrise, Sunset, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { formatBusinessCalendarDate, formatBusinessDateTime, getBusinessFinancialYear, getBusinessLanguage, getBusinessTimezone, getBusinessWeekStart } from '@/lib/format/businessDate';
import { dashboardAPI, type DashboardExecutiveData, type DashboardFilter, type DashboardMetric, type DashboardTransaction, type ExpenseBreakdownRow, type LowStockRow } from '@/lib/api/dashboard';
import { getApiError } from '@/lib/api';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { CashFlowPanel, ExpenseBreakdown, InventoryAlerts, MetricCard, RecentActivity, RevenueExpenseChart, SalesTrendChart, TopProducts } from '@/components/dashboard/DashboardWidgets';
import { notify } from '@/components/ui/AppToaster';

type PeriodKey = 'week' | 'month' | 'quarter' | 'year';
const EMPTY_PERMISSIONS: string[] = [];

const periods: Array<{ value: PeriodKey; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
];

function dateInput(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodFilter(period: PeriodKey, asOfTime: number): DashboardFilter {
  const now = new Date(asOfTime || Date.now());
  const dateParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: getBusinessTimezone(), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => Number(dateParts.find((item) => item.type === type)?.value || 0);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const start = new Date(Date.UTC(year, month - 1, day));
  let groupBy: DashboardFilter['groupBy'] = 'DAILY';

  if (period === 'week') {
    const firstDay = getBusinessWeekStart() === 'SUNDAY' ? 0 : 1;
    const daysSinceStart = (start.getUTCDay() - firstDay + 7) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceStart);
  } else if (period === 'month') {
    start.setUTCDate(1);
  } else if (period === 'quarter') {
    start.setUTCMonth(Math.floor((month - 1) / 3) * 3, 1);
    groupBy = 'WEEKLY';
  } else {
    const financialYear = getBusinessFinancialYear();
    const startMonth = financialYear === 'JULY' ? 6 : financialYear === 'APRIL' ? 3 : 0;
    const startYear = month - 1 < startMonth ? year - 1 : year;
    start.setUTCFullYear(startYear, startMonth, 1);
    groupBy = 'MONTHLY';
  }

  return { dateFrom: dateInput(start), dateTo: dateInput(new Date(Date.UTC(year, month - 1, day))), groupBy };
}

function dateRangeLabel(filter: DashboardFilter) {
  return `${formatBusinessCalendarDate(filter.dateFrom)} – ${formatBusinessCalendarDate(filter.dateTo)}`;
}

function greetingFor(timestamp: number, language: 'sw' | 'en', timezone: string) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp)));
  const period = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 16 ? 'afternoon' : hour >= 16 && hour < 21 ? 'evening' : 'night';
  const Icon = period === 'morning' ? Sunrise : period === 'afternoon' ? Sun : period === 'evening' ? Sunset : Moon;
  const swahili = { morning: 'Habari za asubuhi', afternoon: 'Habari za mchana', evening: 'Habari za jioni', night: 'Habari za usiku' };
  const english = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Welcome back tonight' };
  return { text: (language === 'sw' ? swahili : english)[period], Icon };
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const activeLocation = useWorkspaceStore((state) => state.activeLocation);
  const permissions = user?.permissions ?? EMPTY_PERMISSIONS;
  const canViewReports = permissions.includes('reports.view');
  const canViewInventory = permissions.includes('inventory.view');
  const canViewProducts = permissions.includes('products.view');

  useEffect(() => {
    if (!user || canViewReports) return;
    const destination = permissions.includes('sales.view') || permissions.includes('sales.create') ? (permissions.includes('sales.view') ? '/dashboard/sales/invoices' : '/dashboard/sales/invoices/new')
      : permissions.includes('products.view') || permissions.includes('products.create') ? (permissions.includes('products.view') ? '/dashboard/products' : '/dashboard/products/new')
      : permissions.includes('inventory.view') ? '/dashboard/inventory'
      : permissions.includes('inventory.adjust') ? '/dashboard/inventory/adjustments/new'
      : permissions.includes('inventory.transfer') ? '/dashboard/inventory/transfers/new'
      : permissions.includes('purchases.view') || permissions.includes('purchases.create') ? (permissions.includes('purchases.view') ? '/dashboard/purchases' : '/dashboard/purchases/orders/new')
      : permissions.includes('customers.view') || permissions.includes('customers.create') ? (permissions.includes('customers.view') ? '/dashboard/customers' : '/dashboard/customers/new')
      : permissions.includes('suppliers.view') || permissions.includes('suppliers.create') ? (permissions.includes('suppliers.view') ? '/dashboard/suppliers' : '/dashboard/suppliers/new')
      : permissions.includes('expenses.view') || permissions.includes('expenses.create') ? (permissions.includes('expenses.view') ? '/dashboard/expenses' : '/dashboard/expenses/new')
      : permissions.includes('payments.view') ? '/dashboard/finance'
      : permissions.includes('settings.view') || permissions.includes('settings.edit') ? '/dashboard/settings'
      : permissions.some((permission) => permission.startsWith('users.') || permission === 'roles.manage') ? '/dashboard/settings/users'
      : '/dashboard/security';
    router.replace(destination);
  }, [user, canViewReports, permissions, router]);
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [definitionsLanguage, setDefinitionsLanguage] = useState<'sw' | 'en'>('sw');
  const [businessSettingsVersion, setBusinessSettingsVersion] = useState(0);
  const [greetingTime, setGreetingTime] = useState(0);
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);
  const welcomeButtonRef = useRef<HTMLButtonElement>(null);
  const [asOfTime, setAsOfTime] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [executive, setExecutive] = useState<DashboardExecutiveData | null>(null);
  const [expenseRows, setExpenseRows] = useState<ExpenseBreakdownRow[]>([]);
  const [lowStockRows, setLowStockRows] = useState<LowStockRow[]>([]);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [inventoryUnavailable, setInventoryUnavailable] = useState(false);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [unavailableActivitySources, setUnavailableActivitySources] = useState<string[]>([]);
  const [expenseUnavailable, setExpenseUnavailable] = useState(false);
  const [optionalDataWarning, setOptionalDataWarning] = useState(false);

  useEffect(() => {
    const syncLanguage = () => {
      setDefinitionsLanguage(getBusinessLanguage());
      setBusinessSettingsVersion((version) => version + 1);
    };
    syncLanguage();
    window.addEventListener('mizania-business-settings-updated', syncLanguage);
    return () => window.removeEventListener('mizania-business-settings-updated', syncLanguage);
  }, [user?.businessId]);
  useEffect(() => {
    setGreetingTime(Date.now());
    const timer = window.setInterval(() => setGreetingTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasData = useRef(false);
  const manualRefreshPending = useRef(false);
  const filter = useMemo(() => periodFilter(period, asOfTime), [period, asOfTime, businessSettingsVersion]);
  const greeting = greetingTime ? greetingFor(greetingTime, definitionsLanguage, getBusinessTimezone()) : null;
  const firstName = user?.firstName?.trim() || user?.name?.trim().split(/\s+/)[0] || '';

  useEffect(() => {
    if (!user || !executive || isLoading || error) return;
    const pendingKey = 'mizania.welcome.after-login.v1';
    const lastShownKey = `mizania.welcome.last-shown.v1.${user.businessId || 'business'}.${user.id}`;
    try {
      if (window.sessionStorage.getItem(pendingKey) !== 'yes') return;
      window.sessionStorage.removeItem(pendingKey);
      const lastShown = Number(window.localStorage.getItem(lastShownKey) || 0);
      const welcomeCooldownMs = 24 * 60 * 60 * 1000;
      if (Number.isFinite(lastShown) && Date.now() - lastShown < welcomeCooldownMs) return;
      window.localStorage.setItem(lastShownKey, String(Date.now()));
    } catch {
      // Allow the welcome prompt when browser storage is unavailable.
    }
    setShowWelcomePrompt(true);
  }, [user, executive, isLoading, error]);

  const welcomeLanguage = definitionsLanguage;
  const welcomeSalutation = greeting?.text || (welcomeLanguage === 'sw' ? 'Karibu' : 'Welcome');
  const welcomeName = firstName ? `, ${firstName}` : '';
  const hasReceivables = !!executive && executive.summary.outstandingReceivables.value > 0
    && (permissions.includes('sales.view') || permissions.includes('customers.view'));
  const hasStockAttention = canViewInventory && lowStockTotal > 0;
  const hasSales = !!executive && executive.summary.totalRevenue.value > 0;
  const currencyAmount = (value: number) => new Intl.NumberFormat(welcomeLanguage === 'sw' ? 'sw-TZ' : 'en-TZ', { maximumFractionDigits: 2 }).format(value);
  const welcomeDetail = welcomeLanguage === 'sw'
    ? hasReceivables && executive
      ? `Kuna salio la wateja la ${executive.currency} ${currencyAmount(executive.summary.outstandingReceivables.value)} linaloweza kufuatiliwa.`
      : hasStockAttention
        ? `Bidhaa ${lowStockTotal} zinahitaji uangalizi wa stock.`
        : hasSales && executive
          ? `Mapato ya kipindi hiki ni ${currencyAmount(executive.summary.totalRevenue.value)} ${executive.currency}. Endelea kufuatilia mwenendo wake.`
          : 'Rekodi mauzo, manunuzi na stock hapa ili uone biashara yako ikikua.'
    : hasReceivables && executive
      ? `Customer balances of ${executive.currency} ${currencyAmount(executive.summary.outstandingReceivables.value)} are ready for follow-up.`
      : hasStockAttention
        ? `${lowStockTotal} products need stock attention.`
        : hasSales && executive
          ? `Revenue for this period is ${executive.currency} ${currencyAmount(executive.summary.totalRevenue.value)}. Keep tracking its progress.`
          : 'Record sales, purchases and stock here to see your business take shape.';
  const welcomeAction = hasReceivables
    ? { href: permissions.includes('sales.view') ? '/dashboard/sales/invoices' : '/dashboard/customers', label: welcomeLanguage === 'sw' ? 'Fuatilia salio' : 'Follow up balances' }
    : hasStockAttention
      ? { href: '/dashboard/inventory', label: welcomeLanguage === 'sw' ? 'Angalia stock' : 'Review stock' }
      : hasSales
        ? { href: '/dashboard/reports?tab=sales', label: welcomeLanguage === 'sw' ? 'Angalia mwenendo' : 'View performance' }
        : permissions.includes('sales.create')
          ? { href: '/dashboard/sales/invoices/new', label: welcomeLanguage === 'sw' ? 'Anza mauzo' : 'Start a sale' }
          : permissions.includes('products.create')
            ? { href: '/dashboard/products/new', label: welcomeLanguage === 'sw' ? 'Ongeza bidhaa' : 'Add a product' }
            : permissions.includes('purchases.create')
              ? { href: '/dashboard/purchases/orders/new', label: welcomeLanguage === 'sw' ? 'Rekodi manunuzi' : 'Record a purchase' }
              : null;

  useEffect(() => {
    if (!showWelcomePrompt) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    welcomeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowWelcomePrompt(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showWelcomePrompt]);

  useEffect(() => {
    let active = true;
    if (!canViewReports) {
      hasData.current = false;
      setExecutive(null);
      setExpenseRows([]);
      setLowStockRows([]);
      setLowStockTotal(0);
      setTransactions([]);
      setIsLoading(false);
      setError('Your account does not have permission to view business reports. Contact your business administrator.');
      return () => { active = false; };
    }

    setError('');
    setIsLoading(!hasData.current);
    setIsRefreshing(hasData.current);

    const load = async () => {
      try {
        const [executiveResult, expenseResult, stockResult, activityResult] = await Promise.allSettled([
          dashboardAPI.getExecutive(filter),
          dashboardAPI.getExpenseBreakdown(filter),
          canViewInventory ? dashboardAPI.getLowStock(8) : Promise.resolve({ data: [] as LowStockRow[], total: 0 }),
          dashboardAPI.getRecentTransactions(permissions),
        ]);

        if (!active) return;
        if (executiveResult.status === 'rejected') throw executiveResult.reason;
        setExecutive(executiveResult.value);
        hasData.current = true;

        const expenseFailed = expenseResult.status === 'rejected';
        setExpenseUnavailable(expenseFailed);
        setExpenseRows(expenseResult.status === 'fulfilled' ? expenseResult.value : []);
        const stockFailed = canViewInventory && stockResult.status === 'rejected';
        setInventoryUnavailable(stockFailed);
        if (stockResult.status === 'fulfilled') {
          setLowStockRows(stockResult.value.data || []);
          setLowStockTotal(stockResult.value.total || 0);
        } else {
          setLowStockRows([]);
          setLowStockTotal(0);
        }
        const activityFailed = activityResult.status === 'rejected';
        setTransactions(activityResult.status === 'fulfilled' ? activityResult.value.transactions : []);
        setUnavailableActivitySources(activityResult.status === 'fulfilled' ? activityResult.value.unavailableSources : ['recent activity']);
        setOptionalDataWarning(expenseFailed || stockFailed || activityFailed || (activityResult.status === 'fulfilled' && activityResult.value.unavailableSources.length > 0));
        if (manualRefreshPending.current) {
          manualRefreshPending.current = false;
          if (expenseFailed || stockFailed || activityFailed || (activityResult.status === 'fulfilled' && activityResult.value.unavailableSources.length > 0)) {
            notify.warning('Dashboard summary updated, but some panels could not refresh.');
          } else {
            notify.success('Dashboard updated.');
          }
        }
      } catch (cause) {
        if (active) {
          const message = getApiError(cause, 'We could not load the dashboard. Try again.');
          setError(message);
          if (manualRefreshPending.current) {
            manualRefreshPending.current = false;
            notify.error(message);
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();
    return () => { active = false; };
  }, [canViewReports, canViewInventory, filter, permissions, refreshVersion]);

  const availableMetrics = executive?.summary;
  const costingMethod = executive?.definitions.inventoryValue.match(/using\s+(.+?)(?:\.|$)/i)?.[1]?.trim().toUpperCase() || '';
  const costingMethodExplanation = definitionsLanguage === 'sw'
    ? costingMethod === 'FIFO'
      ? 'FIFO: bidhaa zilizonunuliwa kwanza huhesabiwa kuwa ndizo zimeuzwa kwanza.'
      : costingMethod === 'WEIGHTED_AVERAGE'
        ? 'Wastani wa gharama: thamani hukokotolewa kwa kutumia wastani wa bei za manunuzi ya bidhaa.'
        : `Njia ya kukokotoa stock: ${costingMethod || 'inatolewa na mfumo wa hesabu za stock.'}`
    : costingMethod === 'FIFO'
      ? 'FIFO: items bought first are counted as sold first.'
      : costingMethod === 'WEIGHTED_AVERAGE'
        ? 'Weighted average: stock value uses the average purchase cost of the items.'
        : `Stock valuation method: ${costingMethod || 'provided by the inventory service.'}`;
  const metricCards: Array<{ metric: DashboardMetric; href: string; invertTrend?: boolean }> = availableMetrics ? [
    { metric: availableMetrics.totalRevenue, href: permissions.includes('sales.view') ? '/dashboard/sales/invoices' : '/dashboard/reports?tab=sales' },
    { metric: availableMetrics.totalExpenses, href: '/dashboard/reports?tab=finance', invertTrend: true },
    { metric: availableMetrics.totalProfit, href: '/dashboard/reports?tab=finance' },
    { metric: availableMetrics.profitMargin, href: '/dashboard/reports?tab=finance' },
    { metric: availableMetrics.cashOnHand, href: '/dashboard/reports?tab=finance' },
    { metric: availableMetrics.outstandingReceivables, href: '/dashboard/reports?tab=finance', invertTrend: true },
    { metric: availableMetrics.outstandingPayables, href: '/dashboard/reports?tab=finance', invertTrend: true },
    { metric: { ...availableMetrics.inventoryValue, changePercent: null }, href: canViewInventory ? '/dashboard/inventory' : '/dashboard/reports?tab=inventory' },
  ] : [];

  if (isLoading && !executive) return <AuthLoadingOverlay message="Loading your dashboard…" />;

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm shadow-amber-950/[0.03] sm:flex-row sm:items-end sm:justify-between sm:p-7 dark:border-amber-900/60 dark:bg-[#282317] dark:shadow-black/20">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#c24e00]">Mizania · {definitionsLanguage === 'sw' ? 'muhtasari wa biashara' : 'business pulse'}</p><h1 className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-2xl font-semibold tracking-tight text-[#20231f] sm:text-3xl">{greeting ? <greeting.Icon aria-hidden="true" size={25} className="shrink-0 text-amber-600 dark:text-amber-300" /> : null}<span>{greeting?.text || (definitionsLanguage === 'sw' ? 'Karibu' : 'Welcome')}{firstName ? `, ${firstName}` : ''}</span></h1><p className="mt-2 text-sm font-medium text-[#626b51]">{user?.businessName || 'Your business'} · {dateRangeLabel(filter)}</p><p className="mt-1 text-xs text-[#747a68]">{definitionsLanguage === 'sw' ? 'Takwimu za biashara nzima. Location ya shughuli mpya:' : 'Business-wide totals across locations. Active location for new activity:'} <span className="font-semibold text-[#315c45]">{activeLocation?.name || (definitionsLanguage === 'sw' ? 'Chagua location' : 'Choose a location')}</span>.</p></div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="dashboard-period" className="sr-only">Dashboard date range</label>
          <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)} disabled={isRefreshing} className="h-10 rounded-xl border border-[#e1e4dc] bg-white px-3 text-sm font-medium text-[#42463f] outline-none transition focus:border-[#315c45] focus:ring-2 focus:ring-[#315c45]/10 disabled:opacity-60">
            {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" onClick={() => { manualRefreshPending.current = true; setIsRefreshing(true); setAsOfTime(Date.now()); setRefreshVersion((version) => version + 1); }} disabled={isRefreshing} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20211f] px-3.5 text-sm font-semibold text-white transition hover:bg-[#245543] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Refresh dashboard">
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{isRefreshing ? 'Updating' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#efcfcb] bg-[#fff5f3] p-4 text-sm text-[#9d443e]"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div className="flex-1"><p className="font-semibold">Dashboard unavailable</p><p className="mt-1">{error}</p><button type="button" onClick={() => setAsOfTime(Date.now())} className="mt-2 font-semibold underline underline-offset-2">Try again</button></div></div> : null}
      {optionalDataWarning && executive ? <p role="status" className="rounded-xl border border-[#eadfbf] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#806522]">Some optional panels could not be loaded. The summary remains based on the analytics service; refresh to retry the missing panels.</p> : null}

      {executive ? <>
        <section aria-labelledby="kpi-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c24e00]">Key indicators</p><h2 id="kpi-heading" className="mt-1 text-lg font-semibold text-[#292d27]">Financial and stock position</h2></div><p className="text-[11px] text-[#747a68]">Based on {executive.period}</p></div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ metric, href, invertTrend }) => <MetricCard key={metric.name} metric={metric} currency={executive.currency} href={href} invertTrend={invertTrend} />)}</div>
          <p className="mt-3 text-[11px] leading-5 text-[#8a8d85]">Revenue, expenses and profit use the selected period. Inventory value is a current snapshot as of {formatBusinessDateTime(executive.inventoryAsOf)}; it is not a historical comparison.</p>
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[1.4fr_1fr]">
          <RevenueExpenseChart data={executive} currency={executive.currency} />
          <SalesTrendChart data={executive} currency={executive.currency} />
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <ExpenseBreakdown rows={expenseRows} currency={executive.currency} unavailable={expenseUnavailable} />
          <CashFlowPanel data={executive} currency={executive.currency} />
          <TopProducts data={executive} currency={executive.currency} />
          <InventoryAlerts rows={lowStockRows} total={lowStockTotal} canView={canViewInventory} canViewProducts={canViewProducts} unavailable={inventoryUnavailable} />
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <RecentActivity transactions={transactions} unavailableSources={unavailableActivitySources} currency={executive.currency} />
          <section className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-5 shadow-sm shadow-violet-950/[0.03] sm:p-6 dark:border-violet-900/60 dark:bg-[#211d2d] dark:shadow-black/20" aria-label="Dashboard data definitions">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">{definitionsLanguage === 'sw' ? 'Mwongozo wa takwimu' : 'About these figures'}</p><h2 className="mt-1 text-base font-semibold text-[#292d27] dark:text-[#f0f1ed]">{definitionsLanguage === 'sw' ? 'Hesabu kwa lugha rahisi' : 'Clear numbers, real rules'}</h2><p className="mt-1 text-xs text-[#62675f] dark:text-[#afb5ac]">{definitionsLanguage === 'sw' ? 'Takwimu hizi zinamaanisha nini kwenye biashara yako.' : 'What each figure means for your business.'}</p></div>
              <div role="group" aria-label="Choose explanation language" className="inline-flex items-center gap-1 border-b border-violet-200 dark:border-violet-900/60">
                <button type="button" aria-pressed={definitionsLanguage === 'sw'} onClick={() => setDefinitionsLanguage('sw')} className={`language-switch-button min-h-9 border-b-2 px-3 text-xs font-semibold transition ${definitionsLanguage === 'sw' ? 'border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300' : 'border-transparent text-[#62675f] hover:text-emerald-800 dark:text-white/65 dark:hover:text-emerald-300'}`}>Kiswahili</button>
                <button type="button" aria-pressed={definitionsLanguage === 'en'} onClick={() => setDefinitionsLanguage('en')} className={`language-switch-button min-h-9 border-b-2 px-3 text-xs font-semibold transition ${definitionsLanguage === 'en' ? 'border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300' : 'border-transparent text-[#62675f] hover:text-emerald-800 dark:text-white/65 dark:hover:text-emerald-300'}`}>English</button>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e0ebe3] bg-white/80 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]"><dt className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{definitionsLanguage === 'sw' ? 'Mapato' : 'Revenue'}</dt><dd className="mt-1.5 text-xs leading-5 text-[#515b53] dark:text-[#c2c8bd]">{definitionsLanguage === 'sw' ? 'Jumla ya ankara zilizotolewa ndani ya kipindi, ukitoa marejesho ya bidhaa yaliyokubaliwa.' : 'Issued invoice totals for the selected period, minus accepted customer returns.'}</dd></div>
              <div className="rounded-xl border border-[#e0ebe3] bg-white/80 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]"><dt className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{definitionsLanguage === 'sw' ? 'Faida halisi' : 'Net profit'}</dt><dd className="mt-1.5 text-xs leading-5 text-[#515b53] dark:text-[#c2c8bd]">{definitionsLanguage === 'sw' ? 'Mapato yakitoa gharama ya bidhaa zilizouzwa na matumizi yanayotambuliwa kwenye taarifa ya mapato.' : 'Revenue minus the cost of goods sold and expenses recognized in the income statement.'}</dd></div>
              <div className="rounded-xl border border-[#e0ebe3] bg-white/80 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]"><dt className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{definitionsLanguage === 'sw' ? 'Hali ya fedha' : 'Cash position'}</dt><dd className="mt-1.5 text-xs leading-5 text-[#515b53] dark:text-[#c2c8bd]">{definitionsLanguage === 'sw' ? 'Fedha zilizoingia kwenye kumbukumbu za biashara ukitoa zilizotoka, hadi tarehe ya mwisho. Hii ni hesabu ya mfumo, si lazima iwe salio la benki.' : 'Money recorded in the business ledger in minus money out, through the period end. It may differ from the bank balance.'}</dd></div>
              <div className="rounded-xl border border-[#e0ebe3] bg-white/80 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]"><dt className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{definitionsLanguage === 'sw' ? 'Thamani ya stock' : 'Stock value'}</dt><dd className="mt-1.5 text-xs leading-5 text-[#515b53] dark:text-[#c2c8bd]">{definitionsLanguage === 'sw' ? 'Thamani ya bidhaa zilizopo sasa. Kipindi ulichochagua hakionyeshi stock ya tarehe za zamani.' : 'The value of stock currently on hand. The selected date range does not show historical stock value.'}</dd></div>
            </dl>
            <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-3 text-xs leading-5 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"><span className="font-bold">{definitionsLanguage === 'sw' ? 'Namna ya kukokotoa stock: ' : 'Stock costing: '}</span>{costingMethodExplanation}</p>
            <p className="mt-4 flex items-center gap-1.5 border-t border-violet-200 pt-4 text-[11px] text-[#62675f] dark:border-violet-900/60 dark:text-[#afb5ac]"><Clock3 size={13} />{definitionsLanguage === 'sw' ? 'Takwimu zimekokotolewa hadi' : 'Figures calculated as of'} {formatBusinessDateTime(executive.asOf)}</p>
          </section>
        </section>
      </> : !error ? <AuthLoadingOverlay message="Loading your dashboard…" /> : null}
      {showWelcomePrompt && executive && typeof document !== 'undefined' ? createPortal(<div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWelcomePrompt(false); }} className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-[#0b100d]/65 p-4 backdrop-blur-md sm:p-6">
        <section role="dialog" aria-modal="true" aria-labelledby="welcome-prompt-title" aria-describedby="welcome-prompt-description" className="relative my-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfcf9] text-[#202720] shadow-[0_32px_100px_rgba(0,0,0,0.38)] dark:border-white/10 dark:bg-[#18211d] dark:text-[#f3f6f1]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl dark:bg-emerald-500/10" />
          <div className="relative p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Image src="/MIZANIA_BRAND_PACKAGE/logos/png/mizania-app-icon-64x64.png" alt="Mizania" width={48} height={48} priority className="h-12 w-12 rounded-xl" />
                <div><p className="text-sm font-extrabold tracking-tight text-[#202720] dark:text-[#f3f6f1]">Mizania</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#8a6920] dark:text-[#e0c16e]">REKODI · FUATILIA · ENDELEA</p></div>
              </div>
              <button type="button" onClick={() => setShowWelcomePrompt(false)} aria-label={welcomeLanguage === 'sw' ? 'Funga salamu' : 'Close welcome'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#647067] transition hover:bg-black/5 hover:text-[#202720] dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white"><X size={19} /></button>
            </div>
            <p className="mt-8 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{welcomeSalutation}{welcomeName}</p>
            <h2 id="welcome-prompt-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{welcomeLanguage === 'sw' ? 'Karibu kwenye biashara yako.' : 'Welcome to your business.'}</h2>
            <p id="welcome-prompt-description" className="mt-3 max-w-lg text-sm leading-6 text-[#59645b] dark:text-[#c0cbc2]">{welcomeLanguage === 'sw' ? `Muhtasari wa ${user?.businessName || 'biashara yako'} uko tayari.` : `The latest overview for ${user?.businessName || 'your business'} is ready.`}</p>

            <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-white/75 p-4 dark:border-emerald-900/70 dark:bg-black/15">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-300">{welcomeLanguage === 'sw' ? 'Cha kuangalia' : 'Worth a look'}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#354139] dark:text-[#e1e9e2]">{welcomeDetail}</p>
              {activeLocation?.name ? <p className="mt-3 text-xs text-[#68756b] dark:text-[#aab7ad]">{welcomeLanguage === 'sw' ? 'Location ya shughuli mpya:' : 'Location for new activity:'} <span className="font-semibold text-[#40594a] dark:text-[#d6e3d8]">{activeLocation.name}</span></p> : null}
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setShowWelcomePrompt(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[#5d685f] transition hover:bg-black/5 dark:text-[#c1ccc2] dark:hover:bg-white/[0.06]">{welcomeLanguage === 'sw' ? 'Endelea kwenye dashboard' : 'Continue to dashboard'}</button>
              {welcomeAction ? <button ref={welcomeButtonRef} type="button" onClick={() => { setShowWelcomePrompt(false); router.push(welcomeAction.href); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#16734a] px-5 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[#125e3d] focus:outline-none focus:ring-4 focus:ring-emerald-500/25">{welcomeAction.label}<ArrowRight size={17} /></button> : <button ref={welcomeButtonRef} type="button" onClick={() => setShowWelcomePrompt(false)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#16734a] px-5 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[#125e3d] focus:outline-none focus:ring-4 focus:ring-emerald-500/25">{welcomeLanguage === 'sw' ? 'Twende kazi' : 'Let’s get started'}<ArrowRight size={17} /></button>}
            </div>
            <p className="mt-5 text-center text-[11px] leading-5 text-[#849087] dark:text-[#87958a]">{welcomeLanguage === 'sw' ? 'Unaweza kufunga salamu hii na kuendelea na dashboard yako.' : 'You can close this welcome and continue to your dashboard.'}</p>
          </div>
        </section>
      </div>, document.body) : null}
    </div>
  );
}
