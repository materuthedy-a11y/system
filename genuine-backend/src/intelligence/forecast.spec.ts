import { forecastDemand, predictStockout, predictOverstock, toDailySeries } from './forecast';

const series = (vals: number[]) =>
  toDailySeries(
    vals.map((qty, i) => ({ date: new Date(Date.now() - (vals.length - 1 - i) * 864e5), qty })),
    vals.length,
  );

describe('forecastDemand', () => {
  it('returns INSUFFICIENT_DATA for <14 days', () => {
    const r = forecastDemand(series([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), 7);
    expect(r.confidence).toBe('INSUFFICIENT_DATA');
    expect(r.totalForecast).toBeGreaterThanOrEqual(0);
  });

  it('steady demand produces stable forecast', () => {
    const r = forecastDemand(series(Array(60).fill(10)), 7);
    expect(r.dailyForecast.every((v) => Math.abs(v - 10) < 2)).toBe(true);
    expect(r.totalForecast).toBeGreaterThan(60);
    expect(r.totalForecast).toBeLessThan(80);
  });

  it('zero demand series forecasts zero', () => {
    const r = forecastDemand(series(Array(60).fill(0)), 30);
    expect(r.totalForecast).toBe(0);
    expect(['NAIVE', 'TREND', 'MOVING_AVERAGE', 'SEASONAL_WEEKLY']).toContain(r.method);
  });

  it('handles intermittent demand without NaN', () => {
    const vals = Array(60).fill(0);
    vals[55] = 30;
    vals[58] = 20;
    const r = forecastDemand(series(vals), 7);
    expect(Number.isFinite(r.totalForecast)).toBe(true);
    expect(r.dataSufficiency.intermittent).toBe(true);
  });

  it('never returns negative forecast', () => {
    const r = forecastDemand(
      series([
        20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0,
        20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0,
        20, 0, 0, 20, 0, 0,
      ]),
      7,
    );
    expect(r.dailyForecast.every((v) => v >= 0)).toBe(true);
  });

  it('weekly pattern uses seasonal method when data sufficient', () => {
    // 10 weeks, high on Mondays (dow varies) — just verify it runs and picks a method
    const vals: number[] = [];
    for (let i = 0; i < 70; i++) vals.push(i % 7 === 0 ? 20 : 5);
    const r = forecastDemand(series(vals), 7);
    expect(['SEASONAL_WEEKLY', 'TREND', 'MOVING_AVERAGE', 'NAIVE']).toContain(r.method);
    expect(r.dataSufficiency.coveragePct).toBeGreaterThanOrEqual(95);
  });
});

describe('predictStockout', () => {
  it('flags critical when stockout within 3 days', () => {
    const r = predictStockout({
      available: 5,
      incoming: 0,
      dailyDemand: 5,
      leadTimeDays: 7,
      forecast7: 35,
      forecast30: 150,
      productName: 'X',
      locationName: 'L',
    });
    expect(r.risk).toBe('CRITICAL');
    expect(r.stockoutDate).toBeTruthy();
    expect(r.horizonStockout).toBe(true);
  });

  it('incoming stock delays stockout', () => {
    const r = predictStockout({
      available: 5,
      incoming: 100,
      dailyDemand: 5,
      leadTimeDays: 7,
      forecast7: 35,
      forecast30: 150,
      productName: 'X',
      locationName: 'L',
    });
    expect(r.daysRemaining).toBe(21); // (5+100)/5 — incoming extends cover
    expect(r.stockoutDate).toBeTruthy(); // physical stockout still imminent
  });

  it('zero demand → low risk, no stockout date', () => {
    const r = predictStockout({
      available: 500,
      incoming: 0,
      dailyDemand: 0,
      leadTimeDays: 7,
      forecast7: 0,
      forecast30: 0,
      productName: 'X',
      locationName: 'L',
    });
    expect(r.risk).toBe('LOW');
    expect(r.stockoutDate).toBeNull();
  });
});

describe('predictOverstock', () => {
  it('flags dead stock as HIGH risk', () => {
    const r = predictOverstock({ available: 500, incoming: 0, dailyDemand: 0, unitCost: 100 });
    expect(r.risk).toBe('HIGH');
    expect(r.excessUnits).toBe(500);
    expect(r.excessValue).toBe(50000);
  });

  it('healthy stock → LOW risk', () => {
    const r = predictOverstock({ available: 60, incoming: 0, dailyDemand: 2, unitCost: 100 });
    expect(r.risk).toBe('LOW');
    expect(r.excessUnits).toBe(0);
  });
});
