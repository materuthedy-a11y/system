'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Clock3, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { formatBusinessDateTime, getBusinessFinancialYear, getBusinessLanguage, getBusinessWeekStart } from '@/lib/format/businessDate';
import { dashboardAPI, type DashboardExecutiveData, type DashboardFilter, type DashboardMetric, type DashboardTransaction, type ExpenseBreakdownRow, type LowStockRow } from '@/lib/api/dashboard';
import { getApiError } from '@/lib/api';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { CashFlowPanel, ExpenseBreakdown, InventoryAlerts, MetricCard, RecentActivity, RevenueExpenseChart, SalesTrendChart, TopProducts } from '@/components/dashboard/DashboardWidgets';

type PeriodKey = 'week' | 'month' | 'quarter' | 'year';
const EMPTY_PERMISSIONS: string[] = [];

const periods: Array<{ value: PeriodKey; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
];

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodFilter(period: PeriodKey, asOfTime: number): DashboardFilter {
  const now = new Date(asOfTime || Date.now());
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let groupBy: DashboardFilter['groupBy'] = 'DAILY';

  if (period === 'week') {
    const firstDay = getBusinessWeekStart() === 'SUNDAY' ? 0 : 1;
    const daysSinceStart = (start.getDay() - firstDay + 7) % 7;
    start.setDate(start.getDate() - daysSinceStart);
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'quarter') {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
    groupBy = 'WEEKLY';
  } else {
    const financialYear = getBusinessFinancialYear();
    const startMonth = financialYear === 'JULY' ? 6 : financialYear === 'APRIL' ? 3 : 0;
    const year = now.getMonth() < startMonth ? now.getFullYear() - 1 : now.getFullYear();
    start.setFullYear(year, startMonth, 1);
    groupBy = 'MONTHLY';
  }

  return { dateFrom: dateInput(start), dateTo: dateInput(now), groupBy };
}

function dateRangeLabel(filter: DashboardFilter) {
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  return `${format(filter.dateFrom)} – ${format(filter.dateTo)}`;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const activeLocation = useWorkspaceStore((state) => state.activeLocation);
  const permissions = user?.permissions ?? EMPTY_PERMISSIONS;
  const canViewReports = permissions.includes('reports.view');
  const canViewInventory = permissions.includes('inventory.view');
  const canViewProducts = permissions.includes('products.view');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [definitionsLanguage, setDefinitionsLanguage] = useState<'sw' | 'en'>('sw');
  const [businessSettingsVersion, setBusinessSettingsVersion] = useState(0);
  const [asOfTime, setAsOfTime] = useState(0);
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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasData = useRef(false);
  const filter = useMemo(() => periodFilter(period, asOfTime), [period, asOfTime, businessSettingsVersion]);

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
      } catch (cause) {
        if (active) setError(getApiError(cause, 'We could not load the dashboard. Try again.'));
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();
    return () => { active = false; };
  }, [canViewReports, canViewInventory, filter, permissions]);

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
  const metricCards: Array<{ metric: DashboardMetric; tone: string; valueColor: string; href: string; invertTrend?: boolean }> = availableMetrics ? [
    { metric: availableMetrics.totalRevenue, tone: 'bg-[#b9e52e] text-[#354900]', valueColor: 'text-[#24713c]', href: permissions.includes('sales.view') ? '/dashboard/sales/invoices' : '/dashboard/reports?tab=sales' },
    { metric: availableMetrics.totalExpenses, tone: 'bg-[#e7a7b6] text-[#842a20]', valueColor: 'text-[#842a20]', href: '/dashboard/reports?tab=finance', invertTrend: true },
    { metric: availableMetrics.totalProfit, tone: 'bg-[#ffd541] text-[#624500]', valueColor: 'text-[#9a6a00]', href: '/dashboard/reports?tab=finance' },
    { metric: availableMetrics.profitMargin, tone: 'bg-[#a8ccff] text-[#214e88]', valueColor: 'text-[#315fa5]', href: '/dashboard/reports?tab=finance' },
    { metric: availableMetrics.cashOnHand, tone: 'bg-[#77ddb0] text-[#10563f]', valueColor: 'text-[#147554]', href: '/dashboard/reports?tab=finance' },
    { metric: availableMetrics.outstandingReceivables, tone: 'bg-[#ffcf24] text-[#5c4000]', valueColor: 'text-[#926100]', href: '/dashboard/reports?tab=finance', invertTrend: true },
    { metric: availableMetrics.outstandingPayables, tone: 'bg-[#91b9ff] text-[#1e477f]', valueColor: 'text-[#315fa5]', href: '/dashboard/reports?tab=finance', invertTrend: true },
    { metric: { ...availableMetrics.inventoryValue, changePercent: null }, tone: 'bg-[#c8a8ee] text-[#513276]', valueColor: 'text-[#7043a3]', href: canViewInventory ? '/dashboard/inventory' : '/dashboard/reports?tab=inventory' },
  ] : [];

  if (isLoading && !executive) return <AuthLoadingOverlay message="Loading your dashboard…" />;

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm shadow-amber-950/[0.03] sm:flex-row sm:items-end sm:justify-between sm:p-7 dark:border-amber-900/60 dark:bg-[#282317] dark:shadow-black/20">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#527000]">Executive overview · all locations</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#20231f] sm:text-3xl">Business at a glance</h1><p className="mt-2 text-sm font-medium text-[#626b51]">{user?.businessName || 'Your business'} · {dateRangeLabel(filter)}</p><p className="mt-1 text-xs text-[#747a68]">Business-wide totals across locations. Active location for new activity: <span className="font-semibold text-[#315c45]">{activeLocation?.name || 'Choose a location'}</span>.</p></div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="dashboard-period" className="sr-only">Dashboard date range</label>
          <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)} disabled={isRefreshing} className="h-10 rounded-xl border border-[#e1e4dc] bg-white px-3 text-sm font-medium text-[#42463f] outline-none transition focus:border-[#315c45] focus:ring-2 focus:ring-[#315c45]/10 disabled:opacity-60">
            {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" onClick={() => setAsOfTime(Date.now())} disabled={isRefreshing} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20211f] px-3.5 text-sm font-semibold text-white transition hover:bg-[#245543] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Refresh dashboard">
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{isRefreshing ? 'Updating' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#efcfcb] bg-[#fff5f3] p-4 text-sm text-[#9d443e]"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div className="flex-1"><p className="font-semibold">Dashboard unavailable</p><p className="mt-1">{error}</p><button type="button" onClick={() => setAsOfTime(Date.now())} className="mt-2 font-semibold underline underline-offset-2">Try again</button></div></div> : null}
      {optionalDataWarning && executive ? <p role="status" className="rounded-xl border border-[#eadfbf] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#806522]">Some optional panels could not be loaded. The summary remains based on the analytics service; refresh to retry the missing panels.</p> : null}

      {executive ? <>
        <section aria-labelledby="kpi-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#527000]">Key indicators</p><h2 id="kpi-heading" className="mt-1 text-lg font-semibold text-[#292d27]">Financial and stock position</h2></div><p className="text-[11px] text-[#747a68]">Based on {executive.period}</p></div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ metric, tone, valueColor, href, invertTrend }) => <MetricCard key={metric.name} metric={metric} currency={executive.currency} tone={tone} valueColor={valueColor} href={href} invertTrend={invertTrend} />)}</div>
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
      </> : !error ? <DashboardSkeleton /> : null}
    </div>
  );
}
