import { computeReorderMath } from './reorder-math';

describe('computeReorderMath', () => {
  const base = {
    dailyVelocity: 10,
    leadTimeDays: 5,
    available: 100,
    incoming: 0,
    reorderLevel: 15,
  };

  it('does not reorder when stock covers demand window + safety', () => {
    // demandWindow = 10*(5+7)=120; safety=ceil(10*5*.5)=25; need 145; have 200 → no
    const r = computeReorderMath({ ...base, available: 200 });
    expect(r.needsReorder).toBe(false);
    expect(r.suggestedQuantity).toBe(0);
  });

  it('reorders when stock below reorder level even with cover', () => {
    const r = computeReorderMath({ ...base, available: 10, incoming: 500 });
    expect(r.needsReorder).toBe(true); // available <= reorderLevel
    expect(r.suggestedQuantity).toBe(0); // incoming covers everything
  });

  it('suggests positive qty for approaching stockout', () => {
    // need 145, have 50 → shortfall 95
    const r = computeReorderMath({ ...base, available: 50 });
    expect(r.needsReorder).toBe(true);
    expect(r.suggestedQuantity).toBe(95);
    expect(r.daysOfStock).toBe(5);
  });

  it('zero stock yields full requirement', () => {
    const r = computeReorderMath({ ...base, available: 0 });
    expect(r.suggestedQuantity).toBe(145);
    expect(r.daysOfStock).toBe(0);
  });

  it('negative stock clamps to zero and flags anomaly', () => {
    const r = computeReorderMath({ ...base, available: -20 });
    expect(r.stockAnomaly).toBe(true);
    expect(r.effectiveAvailable).toBe(0);
    expect(r.suggestedQuantity).toBe(145);
  });

  it('zero demand only triggers on reorder level', () => {
    const stocked = computeReorderMath({
      ...base,
      dailyVelocity: 0,
      available: 50,
      reorderLevel: 15,
    });
    expect(stocked.needsReorder).toBe(false);
    expect(stocked.daysOfStock).toBeNull();
    const low = computeReorderMath({ ...base, dailyVelocity: 0, available: 5, reorderLevel: 15 });
    expect(low.needsReorder).toBe(true);
    expect(low.suggestedQuantity).toBe(0);
  });

  it('incoming PO reduces suggested quantity', () => {
    const r = computeReorderMath({ ...base, available: 50, incoming: 60 });
    expect(r.suggestedQuantity).toBe(35); // 145-50-60
  });

  it('large incoming can eliminate shortfall', () => {
    const r = computeReorderMath({ ...base, available: 50, incoming: 200 });
    expect(r.shortfall).toBeLessThanOrEqual(0);
    expect(r.suggestedQuantity).toBe(0);
  });

  it('never returns negative quantity', () => {
    const r = computeReorderMath({ ...base, available: 9999, incoming: 9999 });
    expect(r.suggestedQuantity).toBeGreaterThanOrEqual(0);
  });

  it('high demand and long lead time scale correctly', () => {
    const r = computeReorderMath({
      dailyVelocity: 100,
      leadTimeDays: 30,
      available: 10,
      incoming: 0,
      reorderLevel: 0,
    });
    // demandWindow=100*37=3700; safety=ceil(100*30*.5)=1500; total 5200-10=5190
    expect(r.suggestedQuantity).toBe(5190);
  });

  it('zero lead time still covers 7-day review window', () => {
    const r = computeReorderMath({
      dailyVelocity: 10,
      leadTimeDays: 0,
      available: 0,
      incoming: 0,
      reorderLevel: 0,
    });
    expect(r.suggestedQuantity).toBe(70); // 10*7 + 0
  });
});
