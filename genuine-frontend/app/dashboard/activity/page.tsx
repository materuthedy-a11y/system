'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, MousePointerClick, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { dashboardAPI, MyActivityResponse } from '@/lib/api/dashboard';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { formatBusinessDateTime } from '@/lib/format/businessDate';

const card = 'rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1d201d]';
const PERIODS = [7, 30, 90] as const;

function niceDevice(userAgent: string | null) {
  if (!userAgent) return 'Unknown device';
  const browser = /edg/i.test(userAgent) ? 'Edge' : /chrome/i.test(userAgent) ? 'Chrome' : /firefox/i.test(userAgent) ? 'Firefox' : /safari/i.test(userAgent) ? 'Safari' : 'Browser';
  const os = /windows/i.test(userAgent) ? 'Windows' : /android/i.test(userAgent) ? 'Android' : /iphone|ipad/i.test(userAgent) ? 'iOS' : /mac os/i.test(userAgent) ? 'macOS' : /linux/i.test(userAgent) ? 'Linux' : 'Other OS';
  return `${browser} · ${os}`;
}

function moduleLabel(module: string) {
  return module.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
}

export default function MyActivityPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<MyActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (period: number) => {
    setLoading(true); setError('');
    try { setData(await dashboardAPI.getMyActivity(period)); }
    catch (cause) { const message = getApiError(cause, 'Activity could not be loaded.'); setError(message); notify.error(message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const maxDaily = useMemo(() => Math.max(1, ...(data?.daily.map((d) => d.count) ?? [1])), [data]);
  const maxModule = useMemo(() => Math.max(1, ...(data?.modules.map((m) => m.count) ?? [1])), [data]);
  const totalModuleActions = data?.summary.actions ?? 0;
  const chart = useMemo(() => {
    const width = 720, height = 220, padX = 8, padTop = 12, padBottom = 26;
    const bottom = height - padBottom;
    const points = (data?.daily ?? []).map((d, i, arr) => ({
      x: padX + (arr.length <= 1 ? (width - padX * 2) / 2 : (i / (arr.length - 1)) * (width - padX * 2)),
      y: maxDaily === 0 ? bottom : padTop + (1 - d.count / maxDaily) * (bottom - padTop),
      ...d,
    }));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = points.length ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z` : '';
    const ticks = [0, 1, 2, 3].map((s) => ({ y: padTop + (s / 3) * (bottom - padTop), value: Math.round(maxDaily * (1 - s / 3)) }));
    return { width, height, padX, padTop, bottom, points, line, area, ticks };
  }, [data, maxDaily]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-1 pb-12">
      <header className={`${card} flex flex-wrap items-end justify-between gap-3`}>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Personal</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#20231f] dark:text-white">My activity</h1>
          <p className="mt-1 text-sm text-[#687064] dark:text-white/60">Your sessions, actions and workspace usage over the selected period.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[#d8ddd4] p-1 dark:border-white/10" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p}
                className={`min-h-8 rounded-lg px-3 text-xs font-bold transition ${days === p ? 'bg-amber-500 text-[#2d2200]' : 'text-[#50574d] hover:bg-[#f7f7f1] dark:text-white/70 dark:hover:bg-white/5'}`}>
                {p}d
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load(days)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8ddd4] px-3 text-sm font-semibold text-[#41483e] hover:bg-[#f7f7f1] disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">{error}</div> : null}

      {loading && !data ? <div className={`${card} flex items-center justify-center gap-2 py-16 text-sm text-[#687064]`}><RefreshCw className="animate-spin" size={18} /> Loading your activity…</div> : null}

      {data ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: 'Active days', value: data.summary.activeDays, icon: CalendarDays, hint: `of last ${data.days} days` },
            { label: 'Sessions', value: data.summary.sessions, icon: MonitorSmartphone, hint: 'sign-ins recorded' },
            { label: 'Actions', value: data.summary.actions, icon: MousePointerClick, hint: 'audited events' },
            { label: 'Top module', value: data.summary.topModule ? moduleLabel(data.summary.topModule) : '—', icon: Activity, hint: 'most used area' },
          ] as const).map(({ label, value, icon: Icon, hint }) => (
            <div key={label} className={card}>
              <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8d85] dark:text-white/50">{label}</p><Icon size={16} className="text-amber-600 dark:text-amber-400" /></div>
              <p className="mt-2 truncate text-2xl font-extrabold text-[#20231f] dark:text-white">{value}</p>
              <p className="mt-1 text-[11px] text-[#8a8d85] dark:text-white/45">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          <section className={`${card} lg:col-span-3`} aria-labelledby="daily-activity">
            <h2 id="daily-activity" className="text-sm font-bold text-[#20231f] dark:text-white">Daily activity</h2>
            <p className="mt-1 text-xs text-[#8a8d85] dark:text-white/50">Audited actions per day</p>
            {chart.points.length ? <svg viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" role="img" aria-label="Daily activity area chart" className="mt-4 h-48 w-full max-w-full sm:h-56">
              <defs>
                <linearGradient id="activity-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {chart.ticks.map((t) => <line key={t.value} x1={chart.padX} x2={chart.width - chart.padX} y1={t.y} y2={t.y} stroke="#e9ecdf" strokeDasharray="4 6" className="dark:stroke-white/10" />)}
              {chart.area ? <path className="chart-area-reveal" d={chart.area} fill="url(#activity-area-fill)" /> : null}
              {chart.line ? <path pathLength={1} className="chart-line-draw" d={chart.line} fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
              {chart.points.map((p, i) => p.count > 0 ? <circle key={p.date} className="chart-point-appear" style={{ animationDelay: `${300 + i * 40}ms` }} cx={p.x} cy={p.y} r={data && data.daily.length <= 14 ? 4 : 2.5} fill="#fff" stroke="#d97706" strokeWidth="2"><title>{`${p.date}: ${p.count} actions`}</title></circle> : null)}
            </svg> : <p className="mt-8 text-center text-sm text-[#8a8d85] dark:text-white/45">No activity recorded in this period.</p>}
            <div className="mt-2 flex justify-between text-[10px] text-[#8a8d85] dark:text-white/40">
              <span>{data.daily[0]?.date}</span><span>{data.daily[Math.floor(data.daily.length / 2)]?.date}</span><span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          </section>

          <section className={`${card} lg:col-span-2`} aria-labelledby="top-modules">
            <h2 id="top-modules" className="text-sm font-bold text-[#20231f] dark:text-white">Most used modules</h2>
            <p className="mt-1 text-xs text-[#8a8d85] dark:text-white/50">By audited actions</p>
            {data.modules.length ? <ul className="mt-4 space-y-3">
              {data.modules.map((m, i) => (
                <li key={m.module}>
                  <div className="flex items-center justify-between text-xs"><span className="font-semibold text-[#41483e] dark:text-white/75">{moduleLabel(m.module)}</span><span className="text-[#8a8d85] dark:text-white/45">{m.count} · {totalModuleActions ? Math.round((m.count / totalModuleActions) * 100) : 0}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef0ea] dark:bg-white/10">
                    <div className="chart-bar-grow h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${(m.count / maxModule) * 100}%`, animationDelay: `${i * 90}ms` }} />
                  </div>
                </li>
              ))}
            </ul> : <p className="mt-6 text-sm text-[#8a8d85] dark:text-white/45">No module activity in this period.</p>}
          </section>
        </div>

        <section className={card} aria-labelledby="recent-sessions">
          <h2 id="recent-sessions" className="text-sm font-bold text-[#20231f] dark:text-white">Recent sessions</h2>
          <p className="mt-1 text-xs text-[#8a8d85] dark:text-white/50">Last sign-ins within the period</p>
          {data.sessions.length ? <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-[#eceee9] text-[11px] uppercase tracking-wider text-[#8a8d85] dark:border-white/10 dark:text-white/45">
                <th className="pb-2 pr-4 font-bold">Started</th><th className="pb-2 pr-4 font-bold">Device</th><th className="pb-2 font-bold">IP address</th>
              </tr></thead>
              <tbody>
                {data.sessions.slice(0, 10).map((s) => (
                  <tr key={s.id} className="border-b border-[#f2f4ef] last:border-0 dark:border-white/5">
                    <td className="py-2.5 pr-4 text-[#41483e] dark:text-white/75">{formatBusinessDateTime(s.startedAt)}</td>
                    <td className="py-2.5 pr-4 text-[#41483e] dark:text-white/75">{niceDevice(s.userAgent)}</td>
                    <td className="py-2.5 font-mono text-xs text-[#8a8d85] dark:text-white/45">{s.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> : <p className="mt-6 text-sm text-[#8a8d85] dark:text-white/45">No sessions recorded in this period.</p>}
        </section>
      </> : null}
    </div>
  );
}
