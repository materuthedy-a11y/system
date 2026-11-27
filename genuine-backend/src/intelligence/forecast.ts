/**
 * Phase 4 — rules-based demand forecasting.
 * Pure functions: no DB access. All methods are explainable baselines;
 * model selection is decided by chronological backtesting, not assumption.
 */

export interface DailyPoint {
  date: string;
  qty: number;
} // qty = units sold (positive)

export type ForecastMethod = 'SEASONAL_WEEKLY' | 'TREND' | 'MOVING_AVERAGE' | 'NAIVE';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface ForecastResult {
  horizonDays: number;
  method: ForecastMethod;
  dailyForecast: number[]; // length = horizonDays
  totalForecast: number;
  confidence: Confidence;
  dataSufficiency: {
    daysWithData: number;
    totalDays: number;
    coveragePct: number;
    hasZeroDemandPeriods: boolean;
    intermittent: boolean;
  };
  factors: string[];
  backtest?: { mae: number; wape: number; baselineMae: number; improvementPct: number };
}

const DAY = 86_400_000;

export function toDailySeries(
  points: { date: Date; qty: number }[],
  windowDays: number,
  now = new Date(),
): DailyPoint[] {
  const map = new Map<string, number>();
  for (const p of points) {
    const key = p.date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + p.qty);
  }
  const out: DailyPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, qty: map.get(key) || 0 });
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Candidate predictors over a daily series. */
function seasonalWeekly(series: DailyPoint[], horizon: number): number[] | null {
  // Need >= 8 weeks (56 days) of history to trust day-of-week pattern.
  if (series.length < 56) return null;
  const byDow: number[][] = Array.from({ length: 7 }, () => []);
  series.forEach((p) => byDow[new Date(p.date + 'T00:00:00Z').getUTCDay()].push(p.qty));
  const dowAvg = byDow.map((xs) => (xs.length >= 4 ? mean(xs) : null));
  if (dowAvg.some((v) => v === null)) return null;
  const overall = mean(series.map((p) => p.qty));
  // Blend dow average with overall mean (shrinks noisy patterns toward baseline).
  return Array.from({ length: horizon }, (_, h) => {
    const dow = new Date(Date.now() + (h + 1) * DAY).getUTCDay();
    const v = dowAvg[dow]!;
    return 0.7 * v + 0.3 * overall;
  });
}

function trendAdjusted(series: DailyPoint[], horizon: number): number[] {
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.qty);
  const mx = mean(xs),
    my = mean(ys);
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const damped = slope * 0.5; // damp trend to avoid runaway forecasts
  const last = ys[n - 1];
  return Array.from({ length: horizon }, (_, h) => Math.max(0, last + damped * (h + 1)));
}

function movingAverage(series: DailyPoint[], horizon: number, window = 14): number[] {
  const w = series.slice(-window);
  const avg = mean(w.map((p) => p.qty));
  return Array.from({ length: horizon }, () => avg);
}

function naive(series: DailyPoint[], horizon: number): number[] {
  const last = series[series.length - 1]?.qty ?? 0;
  return Array.from({ length: horizon }, () => last);
}

/** Chronological backtest: predict each of last `folds` days from prior data only. */
function backtestMAE(
  series: DailyPoint[],
  predictor: (s: DailyPoint[], h: number) => number[] | null,
  folds = 14,
): number | null {
  if (series.length < folds + 14) return null;
  const errors: number[] = [];
  for (let f = folds; f >= 1; f--) {
    const train = series.slice(0, series.length - f);
    const pred = predictor(train, f);
    if (!pred) return null;
    // compare day-ahead forecast for the first held-out day only (honest 1-step)
    errors.push(Math.abs(pred[0] - series[series.length - f].qty));
  }
  return mean(errors);
}

export function forecastDemand(series: DailyPoint[], horizonDays: number): ForecastResult {
  const windowDays = series.length;
  const total = series.reduce((s, p) => s + p.qty, 0);
  const daysWithData = series.filter((p) => p.qty > 0).length;
  const nonzero = series.filter((p) => p.qty > 0);
  const avg = total / Math.max(1, windowDays);
  const intermittent = daysWithData > 0 && daysWithData / windowDays < 0.3;
  const volatile =
    nonzero.length > 1 && mean(nonzero.map((p) => (p.qty - avg) ** 2)) > avg * avg * 4;

  const candidates: Array<{
    method: ForecastMethod;
    fn: (s: DailyPoint[], h: number) => number[] | null;
  }> = [
    { method: 'SEASONAL_WEEKLY', fn: seasonalWeekly },
    { method: 'TREND', fn: trendAdjusted },
    { method: 'MOVING_AVERAGE', fn: (s, h) => movingAverage(s, h, 14) },
    { method: 'NAIVE', fn: (s, h) => naive(s, h) },
  ];

  // Backtest each candidate; pick lowest MAE. Baseline = moving average.
  let best: { method: ForecastMethod; daily: number[] } | null = null;
  let bestMae = Infinity;
  let baselineMae: number | null = null;
  for (const c of candidates) {
    const maeVal = backtestMAE(series, c.fn);
    if (maeVal === null) continue;
    if (c.method === 'MOVING_AVERAGE') baselineMae = maeVal;
    if (maeVal < bestMae) {
      bestMae = maeVal;
      best = { method: c.method, daily: c.fn(series, horizonDays)! };
    }
  }
  if (!best) {
    // Insufficient history for backtesting — fall back to simple average, LOW confidence.
    best = {
      method: avg > 0 ? 'MOVING_AVERAGE' : 'NAIVE',
      daily: Array.from({ length: horizonDays }, () => avg),
    };
  }

  const coveragePct = Math.round((daysWithData / Math.max(1, windowDays)) * 100);
  const confidence: Confidence =
    windowDays < 14
      ? 'INSUFFICIENT_DATA'
      : windowDays < 30
        ? 'LOW'
        : coveragePct < 20
          ? 'LOW'
          : volatile || intermittent
            ? 'MEDIUM'
            : bestMae !== Infinity && baselineMae !== null && bestMae <= baselineMae * 0.9
              ? 'HIGH'
              : 'MEDIUM';

  const factors: string[] = [
    `Based on ${windowDays} days of sales history (${daysWithData} days with sales).`,
    `Method: ${best.method}${best.method === 'SEASONAL_WEEKLY' ? ' (day-of-week pattern, ≥8 weeks data)' : ''}.`,
  ];
  if (intermittent)
    factors.push('Demand is intermittent — many zero-sale days; forecast is uncertain.');
  if (volatile) factors.push('Demand is volatile — wide day-to-day swings reduce confidence.');
  if (bestMae !== Infinity && baselineMae !== null)
    factors.push(
      `Backtest 1-day-ahead MAE: ${bestMae.toFixed(1)} vs baseline ${baselineMae.toFixed(1)}.`,
    );

  const dailyForecast = best.daily.map((v) => Math.max(0, Math.round(v * 1000) / 1000));
  return {
    horizonDays,
    method: best.method,
    dailyForecast,
    totalForecast: Math.round(dailyForecast.reduce((a, b) => a + b, 0) * 100) / 100,
    confidence,
    dataSufficiency: {
      daysWithData,
      totalDays: windowDays,
      coveragePct,
      hasZeroDemandPeriods: daysWithData < windowDays,
      intermittent,
    },
    factors,
    backtest:
      bestMae !== Infinity && baselineMae !== null
        ? {
            mae: Math.round(bestMae * 100) / 100,
            wape: 0,
            baselineMae: Math.round(baselineMae * 100) / 100,
            improvementPct: baselineMae ? Math.round((1 - bestMae / baselineMae) * 100) : 0,
          }
        : undefined,
  };
}

export interface StockoutPrediction {
  productId: string;
  locationId: string;
  available: number;
  incoming: number;
  dailyDemand: number;
  daysRemaining: number | null;
  stockoutDate: string | null;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  horizonStockout: boolean; // stockout within lead time + review window
  explanation: string[];
}

export function predictStockout(input: {
  available: number;
  incoming: number;
  dailyDemand: number;
  leadTimeDays: number;
  forecast7: number;
  forecast30: number;
  productName: string;
  locationName: string;
}): StockoutPrediction {
  const { available, incoming, dailyDemand, leadTimeDays, forecast30 } = input;
  const effective = Math.max(0, available) + incoming;
  const daily = dailyDemand > 0 ? dailyDemand : forecast30 / 30;
  const coverDays = daily > 0 ? effective / daily : null;
  const stockoutDays = daily > 0 ? Math.max(0, available) / daily : null;
  const stockoutDate =
    stockoutDays !== null && stockoutDays <= 365
      ? new Date(Date.now() + stockoutDays * DAY).toISOString().slice(0, 10)
      : null;
  const horizon = leadTimeDays + 7;
  const horizonStockout = daily > 0 && stockoutDays !== null && stockoutDays <= horizon;
  const risk: StockoutPrediction['risk'] =
    stockoutDays === null
      ? 'LOW'
      : stockoutDays <= 3
        ? 'CRITICAL'
        : stockoutDays <= leadTimeDays
          ? 'HIGH'
          : stockoutDays <= horizon
            ? 'MEDIUM'
            : 'LOW';
  const explanation = [
    `Available ${input.available}, incoming ${incoming}, daily demand ~${daily.toFixed(1)}.`,
    stockoutDate
      ? `Estimated stockout ~${stockoutDate} (${Math.floor(stockoutDays!)} days).`
      : 'No stockout projected within a year.',
    horizonStockout
      ? `Stockout occurs before replenishment can arrive (lead time ${leadTimeDays}d + 7d review).`
      : '',
  ].filter(Boolean);
  return {
    productId: '',
    locationId: '',
    available,
    incoming,
    dailyDemand: daily,
    daysRemaining: coverDays !== null ? Math.floor(coverDays) : null,
    stockoutDate,
    risk,
    horizonStockout,
    explanation,
  };
}

export interface OverstockPrediction {
  excessUnits: number;
  excessValue: number | null;
  coverageDays: number | null;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string[];
}

export function predictOverstock(input: {
  available: number;
  incoming: number;
  dailyDemand: number;
  unitCost: number | null;
  coverTargetDays?: number;
}): OverstockPrediction {
  const target = input.coverTargetDays ?? 60;
  const daily = input.dailyDemand;
  const total = input.available + input.incoming;
  const needed = daily > 0 ? daily * target : 0;
  const excessUnits = Math.max(0, total - needed);
  const coverageDays = daily > 0 ? Math.floor(total / daily) : null;
  const excessValue =
    input.unitCost !== null ? Math.round(excessUnits * input.unitCost * 100) / 100 : null;
  const risk: OverstockPrediction['risk'] =
    daily === 0 && total > 0
      ? 'HIGH'
      : coverageDays !== null && coverageDays > target * 2
        ? 'HIGH'
        : coverageDays !== null && coverageDays > target
          ? 'MEDIUM'
          : 'LOW';
  const explanation = [
    `Stock ${total} units covers ~${coverageDays ?? '∞'} days at current demand (${daily.toFixed(1)}/day).`,
    `Target coverage is ${target} days; excess ≈ ${excessUnits} units${excessValue !== null ? ` (~${excessValue})` : ''}.`,
    daily === 0 ? 'No recent demand — stock may be dead.' : '',
  ].filter(Boolean);
  return { excessUnits, excessValue, coverageDays, risk, explanation };
}
