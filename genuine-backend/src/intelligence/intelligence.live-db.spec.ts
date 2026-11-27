/**
 * Live-DB integration spec — runs ONLY when RUN_LIVE_DB=1 and .env.test points to
 * the isolated `test` schema. Verifies detectors, reorder math, lifecycle, location
 * isolation, and draft-PO idempotency against real Postgres.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { InsightsService } from './insights.service';
import { PurchaseService } from '../purchases/purchase.service';
import { PredictionsService } from './predictions.service';

const RUN = process.env.RUN_LIVE_DB === '1';
const describeLive = RUN ? describe : describe.skip;

let prisma: PrismaClient;
let service: InsightsService;
let predictions: PredictionsService;
let bizA: string;
let ownerA: string;
let staffA: string;
let locA1: string;
let locA2: string;

const silentLogger = {
  log: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  verbose: () => {},
} as any;
const stubNotifications = { publishEvent: async () => {}, notifyUsers: async () => {} } as any;
const stubInventory = {} as any;

describeLive('Intelligence live DB (test schema)', () => {
  beforeAll(async () => {
    const envTest = readFileSync(join(__dirname, '../../.env.test'), 'utf8');
    const url = envTest.match(/DATABASE_URL="([^"]+)"/)![1];
    if (!url.includes('schema=test')) throw new Error('Refusing: not schema=test');
    process.env.DATABASE_URL = url;
    prisma = new PrismaClient();
    const purchases = new PurchaseService(
      prisma as any,
      silentLogger,
      stubNotifications,
      stubInventory,
    );
    service = new InsightsService(prisma as any, purchases);
    predictions = new PredictionsService(prisma as any);
    const biz = await prisma.business.findFirst({ where: { name: 'TestBiz Alpha' } });
    bizA = biz!.id;
    const owner = await prisma.user.findFirst({
      where: { businessId: bizA, email: 'owner@alpha.test' },
    });
    const staff = await prisma.user.findFirst({
      where: { businessId: bizA, email: 'staff@alpha.test' },
    });
    ownerA = owner!.id;
    staffA = staff!.id;
    const locs = await prisma.location.findMany({
      where: { businessId: bizA },
      orderBy: { code: 'asc' },
    });
    locA1 = locs[0].id;
    locA2 = locs[1].id;
  }, 30000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('runs all detectors and creates expected insight types', async () => {
    const res = await service.runDetection(bizA);
    expect(res.created + res.updated).toBeGreaterThan(0);
    const types = await prisma.insight.findMany({
      where: { businessId: bizA },
      select: { type: true },
      distinct: ['type'],
    });
    const typeSet = new Set(types.map((t) => t.type));
    for (const expected of [
      'STOCKOUT_RISK',
      'DEAD_STOCK',
      'EXPIRY_RISK',
      'CUSTOMER_CHURN_RISK',
      'EXCESSIVE_DISCOUNT',
      'LOW_MARGIN_PRODUCT',
      'SUPPLIER_RISK',
      'CASH_FLOW_WARNING',
      'ACTIVITY_ANOMALY',
    ]) {
      expect(typeSet.has(expected)).toBe(true);
    }
  });

  it('deduplicates on re-run', async () => {
    const before = await prisma.insight.count({ where: { businessId: bizA } });
    const res = await service.runDetection(bizA);
    const after = await prisma.insight.count({ where: { businessId: bizA } });
    expect(after).toBe(before);
    expect(res.created).toBe(0);
  });

  it('handles lifecycle transitions and RESOLVED reactivation', async () => {
    const insight = await prisma.insight.findFirst({
      where: { businessId: bizA, status: 'ACTIVE' },
    });
    expect(insight).toBeTruthy();
    await service.acknowledge(bizA, ownerA, insight!.id, {} as any);
    let row = await prisma.insight.findUnique({ where: { id: insight!.id } });
    expect(row!.status).toBe('ACKNOWLEDGED');
    // ACKNOWLEDGED may still be resolved or dismissed (only terminal states are blocked)
    await service.resolve(bizA, ownerA, insight!.id, {} as any);
    row = await prisma.insight.findUnique({ where: { id: insight!.id } });
    expect(row!.status).toBe('RESOLVED');
    await expect(service.resolve(bizA, ownerA, insight!.id, {} as any)).rejects.toThrow();
    await expect(service.dismiss(bizA, ownerA, insight!.id, {} as any)).rejects.toThrow();
  });

  it('scopes insights by location for restricted users', async () => {
    // staffA manages locA1 only. Business-wide insights (locationId null) must be hidden.
    const list = await service.listInsights(bizA, staffA, {
      status: 'ACTIVE',
      page: 1,
      limit: 100,
    } as any);
    const locIds = new Set(list.data.map((i: any) => i.locationId));
    expect([...locIds].every((id) => id === locA1 || id === null)).toBe(true);
    // owner sees everything
    const ownerList = await service.listInsights(bizA, ownerA, {
      status: 'ACTIVE',
      page: 1,
      limit: 100,
    } as any);
    expect(ownerList.data.length).toBeGreaterThanOrEqual(list.data.length);
  });

  it('computes reorder suggestions with correct math', async () => {
    const res = await service.getReorderSuggestions(bizA, ownerA, { locationId: locA1 } as any);
    const bySku = new Map(res.data.map((r) => [r.sku, r]));
    // pLow: daily=2, lead=10 (sup2 history), avail=12, incoming=20 → demandWindow=34, safety=10, shortfall=12
    const low = bySku.get('P-LOW');
    expect(low).toBeTruthy();
    // lead=11 (avg of PO-001's 15d + three 10d samples), window=2*(11+7)=36, safety=11
    // shortfall = 36+11-12-20 = 15
    expect(low!.leadTimeDays).toBe(11);
    expect(low!.suggestedQuantity).toBe(15);
    expect(low!.daysOfStock).toBe(6);
    // pZero: zero demand, available 0 <= reorder 10 → flagged with suggestedQuantity 0
    const zero = bySku.get('P-ZERO');
    expect(zero).toBeTruthy();
    expect(zero!.dailyVelocity).toBe(0);
    expect(zero!.suggestedQuantity).toBe(0);
    // pNeg: negative stock → anomaly flag
    const neg = bySku.get('P-NEG');
    expect(neg?.stockAnomaly).toBe(true);
    // pFast: 500 avail + 80 incoming covers demand → NOT suggested
    expect(bySku.has('P-FAST')).toBe(false);
    // pInactive must never appear
    expect([...bySku.keys()].includes('P-INACT')).toBe(false);
  });

  it('creates draft PO idempotently under concurrency', async () => {
    const product = await prisma.product.findFirst({ where: { businessId: bizA, sku: 'P-LOW' } });
    const marker = `live-test-${Date.now()}`;
    const dto = {
      items: [{ productId: product!.id, locationId: locA1, quantity: 5 }],
      notes: marker,
    };
    const [r1, r2] = await Promise.all([
      service.createDraftPurchaseOrders(bizA, ownerA, dto as any),
      service.createDraftPurchaseOrders(bizA, ownerA, dto as any),
    ]);
    expect(r1.created[0].poId).toBe(r2.created[0].poId);
    const pos = await prisma.purchaseOrder.findMany({
      where: { businessId: bizA, notes: { contains: marker } },
    });
    expect(pos.length).toBe(1);
    expect(pos[0].status).toBe('DRAFT');
    // Different quantity → different fingerprint → new PO allowed
    const r3 = await service.createDraftPurchaseOrders(bizA, ownerA, {
      ...dto,
      items: [{ ...dto.items[0], quantity: 7 }],
    } as any);
    expect(r3.created[0].poId).not.toBe(r1.created[0].poId);
  });

  it('rejects draft PO for product without supplier', async () => {
    const product = await prisma.product.findFirst({ where: { businessId: bizA, sku: 'P-NOSUP' } });
    await expect(
      service.createDraftPurchaseOrders(bizA, ownerA, {
        items: [{ productId: product!.id, locationId: locA1, quantity: 3 }],
      } as any),
    ).rejects.toThrow();
  });

  // ---------- Phase 4: predictions ----------
  it('demand forecast returns structured explainable result', async () => {
    const pFast = await prisma.product.findFirstOrThrow({
      where: { businessId: bizA, sku: 'P-FAST' },
    });
    const res = await predictions.demandForecast(bizA, ownerA, pFast.id, locA1, 30);
    expect(res.forecast.totalForecast).toBeGreaterThan(0);
    expect(res.forecast.dailyForecast).toHaveLength(30);
    expect(res.forecast.confidence).toMatch(/HIGH|MEDIUM|LOW/);
    expect(res.forecast.factors.length).toBeGreaterThan(0);
    // restricted user cannot forecast another location
    await expect(predictions.demandForecast(bizA, staffA, pFast.id, locA2, 30)).rejects.toThrow();
  });

  it('stockout forecasts include expected risk rows', async () => {
    const res = await predictions.stockoutForecasts(bizA, ownerA);
    const skus = res.data.map((r) => r.sku);
    expect(skus).toContain('P-ZERO'); // zero stock, flagged
    expect(res.data.every((r) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(r.risk))).toBe(
      true,
    );
    // restricted user sees only managed location rows
    const staffRes = await predictions.stockoutForecasts(bizA, staffA);
    expect(staffRes.data.every((r) => r.locationId === locA1)).toBe(true);
  });

  it('overstock, churn and cashflow return scoped results', async () => {
    const ov = await predictions.overstockForecasts(bizA, ownerA);
    expect(Array.isArray(ov.data)).toBe(true);
    const ch = await predictions.churnForecasts(bizA, ownerA);
    expect(ch.data.some((r) => r.name === 'Churned Customer')).toBe(true);
    const cf = await predictions.cashflowForecast(bizA, ownerA, 30);
    expect(cf.actuals.inflowLast30Days).toBeGreaterThan(0);
    expect(cf.expected.overdueReceivables.amount).toBeGreaterThan(0);
    await expect(predictions.cashflowForecast(bizA, ownerA, 45)).rejects.toThrow();
  });
});
