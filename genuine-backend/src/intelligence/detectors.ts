import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type InsightSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface InsightDraft {
  type: string;
  category: string;
  severity: InsightSeverity;
  dedupeKey: string;
  title: string;
  summary: string;
  detail?: string;
  evidence?: Prisma.InputJsonValue;
  impact?: Prisma.InputJsonValue;
  recommendation?: string;
  entityType?: string;
  entityId?: string;
  productId?: string;
  customerId?: string;
  supplierId?: string;
  locationId?: string | null;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface DetectorContext {
  prisma: PrismaService;
  businessId: string;
  locationIds: string[] | null;
  now: Date;
}

export type Detector = (ctx: DetectorContext) => Promise<InsightDraft[]>;

const DAY = 86_400_000;
const money = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY);
}

/** SALES_DECLINE — last 30d net revenue vs prior 30d, per location scope or business-wide. */
export const salesDeclineDetector: Detector = async ({ prisma, businessId, locationIds, now }) => {
  const drafts: InsightDraft[] = [];
  const end = now;
  const start = daysAgo(now, 30);
  const prevStart = daysAgo(now, 60);
  const scope = locationIds ? { in: locationIds } : undefined;
  const [cur, prev, curRet, prevRet] = await Promise.all([
    prisma.salesInvoice.groupBy({
      by: ['locationId'],
      where: {
        businessId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        issuedDate: { gte: start, lte: end },
        ...(scope ? { locationId: scope } : {}),
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.salesInvoice.groupBy({
      by: ['locationId'],
      where: {
        businessId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        issuedDate: { gte: prevStart, lt: start },
        ...(scope ? { locationId: scope } : {}),
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.salesReturn.aggregate({
      where: {
        businessId,
        status: { in: ['RECEIVED', 'COMPLETED'] },
        returnDate: { gte: start, lte: end },
        ...(scope ? { invoice: { locationId: scope } } : {}),
      },
      _sum: { totalAmount: true },
    }),
    prisma.salesReturn.aggregate({
      where: {
        businessId,
        status: { in: ['RECEIVED', 'COMPLETED'] },
        returnDate: { gte: prevStart, lt: start },
        ...(scope ? { invoice: { locationId: scope } } : {}),
      },
      _sum: { totalAmount: true },
    }),
  ]);
  const retCur = money(curRet._sum.totalAmount || 0);
  const retPrev = money(prevRet._sum.totalAmount || 0);
  const curRevenue = money(cur.reduce((s, r) => s + (r._sum.totalAmount || 0), 0) - retCur);
  const prevRevenue = money(prev.reduce((s, r) => s + (r._sum.totalAmount || 0), 0) - retPrev);
  const curCount = cur.reduce((s, r) => s + r._count._all, 0);
  const prevCount = prev.reduce((s, r) => s + r._count._all, 0);
  if (prevRevenue < 1 || prevCount < 3) return drafts;
  const declinePct = ((prevRevenue - curRevenue) / prevRevenue) * 100;
  if (declinePct < 20) return drafts;
  const severity: InsightSeverity = declinePct >= 40 ? 'HIGH' : 'MEDIUM';
  drafts.push({
    type: 'SALES_DECLINE',
    category: 'SALES',
    severity,
    dedupeKey: `SALES_DECLINE:${locationIds ? locationIds.join('+') : 'ALL'}:${monthKey(now)}`,
    title: `Sales down ${Math.round(declinePct)}% vs the previous 30 days`,
    summary: `Net revenue was ${money(curRevenue)} over the last 30 days versus ${money(prevRevenue)} in the prior 30 days (${curCount} vs ${prevCount} invoices).`,
    detail:
      'Compares issued (non-draft, non-cancelled) invoices net of received sales returns over two consecutive 30-day windows. Returns are included so the comparison reflects money actually kept.',
    evidence: {
      currentRevenue: curRevenue,
      previousRevenue: prevRevenue,
      currentInvoices: curCount,
      previousInvoices: prevCount,
      declinePercent: Math.round(declinePct * 10) / 10,
      window: '30d vs prior 30d',
    },
    impact: { revenueDelta: money(curRevenue - prevRevenue), unit: 'currency' },
    recommendation:
      'Review top products and customers for the period, check for stockouts or competitor activity, and verify no invoices were left in draft.',
    entityType: 'Business',
    periodStart: start,
    periodEnd: end,
    locationId: null,
  });
  return drafts;
};

/** LOW_MARGIN_PRODUCT — products selling below a thin gross margin on recent sales. */
export const lowMarginDetector: Detector = async ({ prisma, businessId, locationIds, now }) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 90);
  const grouped = await prisma.salesInvoiceItem.groupBy({
    by: ['productId'],
    where: {
      invoice: {
        businessId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        issuedDate: { gte: start },
        ...(locationIds ? { locationId: { in: locationIds } } : {}),
      },
    },
    _sum: { quantity: true, total: true },
  });
  const productIds = grouped.map((g) => g.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { businessId, id: { in: productIds } },
        select: { id: true, name: true, sku: true, buyingPrice: true, sellingPrice: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const byProduct = new Map<string, { qty: number; revenue: number; product: any }>();
  for (const g of grouped) {
    const product = productMap.get(g.productId);
    if (!product) continue;
    byProduct.set(g.productId, {
      qty: g._sum.quantity || 0,
      revenue: g._sum.total || 0,
      product,
    });
  }
  const flagged = [...byProduct.entries()]
    .map(([productId, row]) => {
      const cost = row.product.buyingPrice * row.qty;
      const marginPct = row.revenue > 0 ? ((row.revenue - cost) / row.revenue) * 100 : 0;
      return { productId, ...row, marginPct, revenue: money(row.revenue) };
    })
    .filter((row) => row.revenue > 0 && row.marginPct < 8 && row.qty > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  for (const row of flagged) {
    drafts.push({
      type: 'LOW_MARGIN_PRODUCT',
      category: 'PROFITABILITY',
      severity: row.marginPct < 0 ? 'HIGH' : 'MEDIUM',
      dedupeKey: `LOW_MARGIN:${row.productId}:${monthKey(now)}`,
      title: `Thin margin on ${row.product.name}`,
      summary: `${row.product.name} (${row.product.sku}) sold ${money(row.qty)} units for ${money(row.revenue)} in the last 90 days at an estimated ${money(row.marginPct)}% gross margin (revenue vs buying price).`,
      detail:
        'Margin is estimated as (line revenue − quantity × current buyingPrice) / revenue. It ignores discounts allocation, returns, and cost changes over time, so treat it as directional, not audited profit.',
      evidence: {
        productId: row.productId,
        sku: row.product.sku,
        quantity: money(row.qty),
        revenue: row.revenue,
        buyingPrice: row.product.buyingPrice,
        sellingPrice: row.product.sellingPrice,
        estimatedMarginPercent: money(row.marginPct),
      },
      impact: { marginPercent: money(row.marginPct), revenue: row.revenue },
      recommendation:
        'Review the selling price, supplier cost, and discount levels for this product.',
      entityType: 'Product',
      entityId: row.productId,
      productId: row.productId,
      periodStart: start,
      periodEnd: now,
    });
  }
  return drafts;
};

/** EXCESSIVE_DISCOUNT — invoices with effective discount above 25% in the last 30 days. */
export const excessiveDiscountDetector: Detector = async ({
  prisma,
  businessId,
  locationIds,
  now,
}) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 30);
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      businessId,
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      issuedDate: { gte: start },
      ...(locationIds ? { locationId: { in: locationIds } } : {}),
      subtotal: { gt: 0 },
    },
    select: {
      id: true,
      invoiceNumber: true,
      discountAmount: true,
      discountPercent: true,
      subtotal: true,
      totalAmount: true,
      locationId: true,
      customer: { select: { name: true } },
      createdBy: true,
    },
    orderBy: { discountAmount: 'desc' },
    take: 200,
  });
  const flagged = invoices
    .map((inv) => {
      const effective = inv.subtotal > 0 ? (inv.discountAmount / inv.subtotal) * 100 : 0;
      return { ...inv, effective };
    })
    .filter((inv) => inv.effective > 25)
    .sort((a, b) => b.discountAmount - a.discountAmount)
    .slice(0, 10);
  if (!flagged.length) return drafts;
  const totalDiscount = money(flagged.reduce((s, i) => s + i.discountAmount, 0));
  const worst = flagged[0];
  drafts.push({
    type: 'EXCESSIVE_DISCOUNT',
    category: 'PROFITABILITY',
    severity: flagged.length >= 5 ? 'HIGH' : 'MEDIUM',
    dedupeKey: `EXCESSIVE_DISCOUNT:${locationIds ? locationIds.join('+') : 'ALL'}:${monthKey(now)}`,
    title: `${flagged.length} invoice(s) discounted over 25% this month`,
    summary: `${flagged.length} issued invoice(s) in the last 30 days carried an effective discount above 25%, totaling ${totalDiscount} in discounts. Largest: ${worst.invoiceNumber} at ${money(worst.effective)}%.`,
    detail:
      'Effective discount = invoice discountAmount ÷ subtotal. This is a factual pattern report, not an accusation; discounts may be legitimate negotiated pricing.',
    evidence: {
      count: flagged.length,
      totalDiscount,
      invoices: flagged.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        customer: i.customer.name,
        effectiveDiscountPercent: money(i.effective),
        discountAmount: i.discountAmount,
        locationId: i.locationId,
      })),
    },
    impact: { discountCost: totalDiscount, unit: 'currency' },
    recommendation:
      'Review the listed invoices and confirm the discounts were authorized; consider tightening discount caps if the pattern is unintended.',
    entityType: 'Business',
    periodStart: start,
    periodEnd: now,
    locationId: null,
  });
  return drafts;
};

/** STOCKOUT_RISK — products at or below reorder level or out within ~14 days of sales. */
export const stockoutRiskDetector: Detector = async ({ prisma, businessId, locationIds, now }) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 30);
  const scope = locationIds ? { in: locationIds } : undefined;
  const [balances, movementAgg] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { businessId, ...(scope ? { locationId: scope } : {}) },
      select: { productId: true, locationId: true, quantity: true },
    }),
    prisma.inventoryMovement.groupBy({
      by: ['productId', 'locationId'],
      where: {
        businessId,
        type: 'SALE',
        createdAt: { gte: start },
        ...(scope ? { locationId: scope } : {}),
      },
      _sum: { quantity: true },
    }),
  ]);
  const products = await prisma.product.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, name: true, sku: true, reorderLevel: true, buyingPrice: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const velocity = new Map<string, number>();
  for (const m of movementAgg) {
    const key = `${m.productId}:${m.locationId}`;
    // SALE movement quantities are stored negative; _sum is negative → negate for velocity.
    velocity.set(key, -(m._sum.quantity || 0));
  }
  const rows = balances
    .map((b) => {
      const key = `${b.productId}:${b.locationId}`;
      const daily = (velocity.get(key) || 0) / 30;
      const daysLeft = daily > 0 ? b.quantity / daily : Infinity;
      return { ...b, daily, daysLeft, product: productMap.get(b.productId) };
    })
    .filter(
      (r) =>
        r.product &&
        (r.quantity <= 0 || r.daysLeft <= 14 || r.quantity <= (r.product.reorderLevel ?? 0)),
    )
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 15);
  for (const row of rows) {
    const outNow = row.quantity <= 0;
    const days = Number.isFinite(row.daysLeft) ? Math.round(row.daysLeft) : null;
    drafts.push({
      type: 'STOCKOUT_RISK',
      category: 'INVENTORY',
      severity: outNow ? 'HIGH' : days !== null && days <= 3 ? 'HIGH' : 'MEDIUM',
      dedupeKey: `STOCKOUT:${row.productId}:${row.locationId}:${monthKey(now)}`,
      title: outNow
        ? `${row.product!.name} is out of stock`
        : `${row.product!.name} may stock out in ~${days} days`,
      summary: outNow
        ? `${row.product!.name} (${row.product!.sku}) has zero stock at this location with recent sales.`
        : `${row.product!.name} (${row.product!.sku}) has ${money(row.quantity)} units; at the current 30-day sales pace it runs out in about ${days} days.`,
      detail:
        'Velocity = total SALE movement quantity over the last 30 days ÷ 30. Days-of-stock = current quantity ÷ daily velocity. Incoming purchase orders are not subtracted; check open POs before ordering.',
      evidence: {
        productId: row.productId,
        sku: row.product!.sku,
        locationId: row.locationId,
        quantity: money(row.quantity),
        dailyVelocity: money(row.daily * 1000) / 1000,
        daysOfStock: days,
        reorderLevel: row.product!.reorderLevel,
      },
      impact: {
        daysOfStock: days,
        stockValueAtRisk: money(row.quantity * row.product!.buyingPrice),
      },
      recommendation:
        'Create a purchase order or transfer stock before the estimated stockout date.',
      entityType: 'Product',
      entityId: row.productId,
      productId: row.productId,
      locationId: row.locationId,
      periodStart: start,
      periodEnd: now,
    });
  }
  return drafts;
};

/** DEAD_STOCK — positive stock with no sales in 90 days, ranked by stock value. */
export const deadStockDetector: Detector = async ({ prisma, businessId, locationIds, now }) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 90);
  const scope = locationIds ? { in: locationIds } : undefined;
  const [balances, soldAgg] = await Promise.all([
    prisma.stockBalance.groupBy({
      by: ['productId'],
      where: { businessId, quantity: { gt: 0 }, ...(scope ? { locationId: scope } : {}) },
      _sum: { quantity: true },
    }),
    prisma.inventoryMovement.groupBy({
      by: ['productId'],
      where: {
        businessId,
        type: 'SALE',
        createdAt: { gte: start },
        ...(scope ? { locationId: scope } : {}),
      },
      _count: { _all: true },
    }),
  ]);
  const soldSet = new Set(soldAgg.map((s) => s.productId));
  const candidates = balances.filter(
    (b) => !soldSet.has(b.productId) && (b._sum.quantity || 0) > 0,
  );
  if (!candidates.length) return drafts;
  const products = await prisma.product.findMany({
    where: { businessId, id: { in: candidates.map((c) => c.productId) } },
    select: { id: true, name: true, sku: true, buyingPrice: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const rows = candidates
    .map((c) => {
      const p = productMap.get(c.productId);
      const qty = c._sum.quantity || 0;
      return p ? { ...c, product: p, qty, value: qty * p.buyingPrice } : null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r && r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);
  for (const row of rows) {
    drafts.push({
      type: 'DEAD_STOCK',
      category: 'INVENTORY',
      severity: row.value >= 500000 ? 'MEDIUM' : 'LOW',
      dedupeKey: `DEAD_STOCK:${row.productId}:${monthKey(now)}`,
      title: `${row.product.name} has not sold in 90 days`,
      summary: `${row.product.name} (${row.product.sku}) holds ${money(row.qty)} units valued at about ${money(row.value)} with no recorded sales in the last 90 days.`,
      detail:
        'Dead stock = positive stock balance and zero SALE movements in the trailing 90 days within the authorized locations. Seasonal products may be misclassified; verify before discounting.',
      evidence: {
        productId: row.productId,
        sku: row.product.sku,
        quantity: money(row.qty),
        estimatedValue: money(row.value),
        windowDays: 90,
      },
      impact: { stockValue: money(row.value), unit: 'currency' },
      recommendation:
        'Consider a promotion, bundle, transfer to a higher-demand location, or discontinuation review.',
      entityType: 'Product',
      entityId: row.productId,
      productId: row.productId,
      periodStart: start,
      periodEnd: now,
    });
  }
  return drafts;
};

/** EXPIRY_RISK — tracked batches expiring within 30 days with remaining quantity. */
export const expiryRiskDetector: Detector = async ({ prisma, businessId, locationIds, now }) => {
  const drafts: InsightDraft[] = [];
  const horizon = daysAgo(now, -30);
  const scope = locationIds ? { in: locationIds } : undefined;
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      businessId,
      expiryDate: { not: null, lte: horizon, gte: daysAgo(now, 365) },
      batchNumber: { not: null },
      ...(scope ? { locationId: scope } : {}),
    },
    orderBy: { expiryDate: 'asc' },
    take: 50000,
    select: {
      productId: true,
      locationId: true,
      batchNumber: true,
      expiryDate: true,
      quantity: true,
      unitCost: true,
    },
  });
  const byBatch = new Map<string, { qty: number; value: number; meta: any }>();
  for (const m of movements) {
    const key = `${m.productId}:${m.locationId}:${m.batchNumber}:${m.expiryDate!.toISOString()}`;
    const row = byBatch.get(key) || {
      qty: 0,
      value: 0,
      meta: {
        productId: m.productId,
        locationId: m.locationId,
        batchNumber: m.batchNumber,
        expiryDate: m.expiryDate,
      },
    };
    row.qty += m.quantity;
    row.value += m.quantity * (m.unitCost || 0);
    byBatch.set(key, row);
  }
  const flagged = [...byBatch.values()].filter((r) => r.qty > 0.0001).slice(0, 15);
  if (!flagged.length) return drafts;
  const products = await prisma.product.findMany({
    where: { businessId, id: { in: flagged.map((f) => f.meta.productId) } },
    select: { id: true, name: true, sku: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const row of flagged) {
    const p = productMap.get(row.meta.productId);
    const daysLeft = Math.ceil((row.meta.expiryDate.getTime() - now.getTime()) / DAY);
    drafts.push({
      type: 'EXPIRY_RISK',
      category: 'INVENTORY',
      severity: daysLeft <= 7 ? 'HIGH' : 'MEDIUM',
      dedupeKey: `EXPIRY:${row.meta.productId}:${row.meta.locationId}:${row.meta.batchNumber}:${row.meta.expiryDate!.toISOString().slice(0, 10)}`,
      title: `${p?.name || 'Product'} batch expires in ${daysLeft} days`,
      summary: `Batch ${row.meta.batchNumber} of ${p?.name || row.meta.productId} at this location expires on ${row.meta.expiryDate!.toISOString().slice(0, 10)} with ~${money(row.qty)} units remaining (est. value ${money(row.value)}).`,
      detail:
        'Remaining quantity is the net of all batch-tracked movements (receipts, sales, returns, transfers, adjustments). Expired stock must not be sold; act before the expiry date.',
      evidence: {
        productId: row.meta.productId,
        sku: p?.sku,
        batchNumber: row.meta.batchNumber,
        expiryDate: row.meta.expiryDate,
        quantity: money(row.qty),
        estimatedValue: money(row.value),
        locationId: row.meta.locationId,
      },
      impact: { expiringValue: money(row.value), daysToExpiry: daysLeft },
      recommendation:
        'Prioritize selling this batch (FEFO already picks earliest expiry), run a promotion, or arrange a transfer/return before expiry.',
      entityType: 'Product',
      entityId: row.meta.productId,
      productId: row.meta.productId,
      locationId: row.meta.locationId,
      periodEnd: row.meta.expiryDate,
    });
  }
  return drafts;
};

/** CUSTOMER_CHURN — customers with ≥3 lifetime invoices, none in the last 60 days. */
export const customerChurnDetector: Detector = async ({ prisma, businessId, now }) => {
  const drafts: InsightDraft[] = [];
  const cutoff = daysAgo(now, 60);
  const customers = await prisma.customer.findMany({
    where: { businessId, isActive: true, status: 'ACTIVE' },
    select: { id: true, name: true, customerCode: true },
  });
  if (!customers.length) return drafts;
  const invoiceAgg = await prisma.salesInvoice.groupBy({
    by: ['customerId'],
    where: {
      businessId,
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      invoiceDate: { gte: daysAgo(now, 730) },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
    _max: { invoiceDate: true },
  });
  const stats = new Map<string, { count: number; revenue: number; last: Date }>();
  for (const row of invoiceAgg) {
    if (!row.customerId) continue;
    stats.set(row.customerId, {
      count: row._count._all,
      revenue: row._sum.totalAmount || 0,
      last: row._max.invoiceDate || new Date(0),
    });
  }
  const rows = customers
    .map((c) => ({
      customer: c,
      ...(stats.get(c.id) || { count: 0, revenue: 0, last: new Date(0) }),
    }))
    .filter((r) => r.count >= 3 && r.last < cutoff)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  for (const row of rows) {
    const daysSilent = Math.floor((now.getTime() - row.last.getTime()) / DAY);
    drafts.push({
      type: 'CUSTOMER_CHURN_RISK',
      category: 'CUSTOMERS',
      severity: row.revenue >= 1000000 ? 'MEDIUM' : 'LOW',
      dedupeKey: `CUSTOMER_CHURN:${row.customer.id}:${monthKey(now)}`,
      title: `${row.customer.name} has not purchased in ${daysSilent} days`,
      summary: `${row.customer.name} (${row.customer.customerCode}) has ${row.count} lifetime invoices worth ~${money(row.revenue)} but no invoice in the last 60 days.`,
      detail:
        'Heuristic: customers with 3+ lifetime invoices and no invoice for 60+ days are flagged as churn risks. This is a behavioral signal, not a predicted probability.',
      evidence: {
        customerId: row.customer.id,
        customerCode: row.customer.customerCode,
        lifetimeInvoices: row.count,
        lifetimeRevenue: money(row.revenue),
        daysSinceLastInvoice: daysSilent,
      },
      impact: { atRiskRevenue: money(row.revenue), unit: 'currency' },
      recommendation:
        'Reach out with a follow-up offer or check-in; review credit terms if the account is overdue.',
      entityType: 'Customer',
      entityId: row.customer.id,
      customerId: row.customer.id,
    });
  }
  return drafts;
};

/** SUPPLIER_RISK — suppliers with late deliveries or high rejection rates. */
export const supplierRiskDetector: Detector = async ({ prisma, businessId, now }) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 180);
  const pos = await prisma.purchaseOrder.findMany({
    where: { businessId, status: { notIn: ['DRAFT', 'CANCELLED'] }, orderDate: { gte: start } },
    select: {
      id: true,
      supplierId: true,
      orderDate: true,
      expectedDeliveryDate: true,
      supplier: { select: { name: true, supplierCode: true } },
      grns: {
        where: { status: 'ACCEPTED' },
        select: { receivedDate: true },
        orderBy: { receivedDate: 'asc' },
        take: 1,
      },
    },
  });
  const bySupplier = new Map<
    string,
    { name: string; code: string; total: number; late: number; delays: number[] }
  >();
  for (const po of pos) {
    const row = bySupplier.get(po.supplierId) || {
      name: po.supplier.name,
      code: po.supplier.supplierCode,
      total: 0,
      late: 0,
      delays: [] as number[],
    };
    row.total += 1;
    const received = po.grns[0]?.receivedDate;
    const expected = po.expectedDeliveryDate;
    if (received && expected) {
      const delayDays = Math.floor((received.getTime() - expected.getTime()) / DAY);
      row.delays.push(delayDays);
      if (delayDays > 0) row.late += 1;
    }
    bySupplier.set(po.supplierId, row);
  }
  const rows = [...bySupplier.entries()]
    .map(([supplierId, row]) => {
      const lateRate = row.total ? row.late / row.total : 0;
      const avgDelay = row.delays.length
        ? row.delays.reduce((a, b) => a + b, 0) / row.delays.length
        : 0;
      return { supplierId, ...row, lateRate, avgDelay };
    })
    .filter((r) => r.total >= 3 && (r.lateRate >= 0.34 || r.avgDelay >= 5))
    .sort((a, b) => b.lateRate - a.lateRate)
    .slice(0, 10);
  for (const row of rows) {
    drafts.push({
      type: 'SUPPLIER_RISK',
      category: 'SUPPLIERS',
      severity: row.lateRate >= 0.5 ? 'HIGH' : 'MEDIUM',
      dedupeKey: `SUPPLIER_RISK:${row.supplierId}:${monthKey(now)}`,
      title: `${row.name} has repeated late deliveries`,
      summary: `${row.name} was late on ${row.late} of ${row.total} purchase orders in the last 6 months (${Math.round(row.lateRate * 100)}%), averaging ${money(row.avgDelay)} days late when a delivery date was expected.`,
      detail:
        'Based on POs with an expectedDeliveryDate and an accepted GRN receivedDate. POs without dates are excluded. This is a delivery-performance signal, not a judgment of the supplier.',
      evidence: {
        supplierId: row.supplierId,
        supplierCode: row.code,
        posAnalyzed: row.total,
        lateDeliveries: row.late,
        lateRatePercent: Math.round(row.lateRate * 100),
        averageDelayDays: money(row.avgDelay),
      },
      impact: { lateRatePercent: Math.round(row.lateRate * 100) },
      recommendation:
        'Factor lead-time risk into reorder quantities, confirm delivery dates in writing, or qualify an alternative supplier.',
      entityType: 'Supplier',
      entityId: row.supplierId,
      supplierId: row.supplierId,
      periodStart: start,
      periodEnd: now,
    });
  }
  return drafts;
};

/** CASH_FLOW_WARNING — overdue receivables vs recent cash inflow. */
export const cashFlowDetector: Detector = async ({ prisma, businessId, locationIds, now }) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 30);
  const scope = locationIds ? { in: locationIds } : undefined;
  const [overdue, recentIn, recentOut] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: {
        businessId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        balance: { gt: 0 },
        dueDate: { lt: now },
        ...(scope ? { locationId: scope } : {}),
      },
      select: { balance: true, dueDate: true, customer: { select: { name: true } } },
    }),
    prisma.payment.aggregate({
      where: {
        businessId,
        status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
        paymentDate: { gte: start },
        direction: 'INFLOW',
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        businessId,
        status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
        paymentDate: { gte: start },
        direction: 'OUTFLOW',
      },
      _sum: { amount: true },
    }),
  ]);
  const overdueTotal = money(overdue.reduce((s, i) => s + i.balance, 0));
  const inflow = money(recentIn._sum.amount || 0);
  const outflow = money(recentOut._sum.amount || 0);
  const net = money(inflow - outflow);
  if (overdueTotal <= 0) return drafts;
  // Warn when net cash is negative or overdue AR exceeds twice the absolute net inflow.
  if (!(net < 0 || overdueTotal > Math.abs(net) * 2)) return drafts;
  const oldest = overdue.reduce((a, b) => ((a.dueDate || now) < (b.dueDate || now) ? a : b));
  drafts.push({
    type: 'CASH_FLOW_WARNING',
    category: 'FINANCE',
    severity: overdueTotal > Math.abs(net) * 3 ? 'HIGH' : 'MEDIUM',
    dedupeKey: `CASH_FLOW:${monthKey(now)}`,
    title: `${money(overdueTotal)} in receivables is overdue`,
    summary: `${overdue.length} invoice(s) are past due totaling ${money(overdueTotal)}. Net cash movement over the last 30 days was ${money(net)} (${money(inflow)} in, ${money(outflow)} out).`,
    detail:
      'Overdue = issued/partially-paid invoices with balance > 0 and dueDate before today. Cash figures are actual recorded payments, not bank balances. This is a liquidity signal, not a forecast.',
    evidence: {
      overdueInvoices: overdue.length,
      overdueAmount: overdueTotal,
      oldestDueDate: oldest?.dueDate,
      netCash30d: net,
      inflows30d: inflow,
      outflows30d: outflow,
    },
    impact: { overdueReceivables: overdueTotal, unit: 'currency' },
    recommendation:
      'Prioritize collections on the oldest overdue invoices and review upcoming supplier payments before committing new spending.',
    entityType: 'Business',
    periodStart: start,
    periodEnd: now,
    locationId: null,
  });
  return drafts;
};

/** ACTIVITY_ANOMALY — factual review flags for unusual void/cancel/adjustment volumes. */
export const activityAnomalyDetector: Detector = async ({
  prisma,
  businessId,
  locationIds,
  now,
}) => {
  const drafts: InsightDraft[] = [];
  const start = daysAgo(now, 30);
  const scope = locationIds ? { in: locationIds } : undefined;
  const [voids, cancels, adjustments, returns] = await Promise.all([
    prisma.payment.groupBy({
      by: ['createdBy'],
      where: {
        businessId,
        status: 'VOIDED',
        voidedAt: { gte: start },
        ...(scope
          ? {
              OR: [
                { invoice: { is: { locationId: scope } } },
                { po: { is: { locationId: scope } } },
                { expense: { is: { locationId: scope } } },
              ],
            }
          : {}),
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.salesInvoice.groupBy({
      by: ['cancelledBy'],
      where: {
        businessId,
        status: 'CANCELLED',
        cancelledAt: { gte: start },
        ...(scope ? { locationId: scope } : {}),
      },
      _count: { _all: true },
    }),
    prisma.stockAdjustment.groupBy({
      by: ['createdBy'],
      where: { businessId, createdAt: { gte: start } },
      _count: { _all: true },
    }),
    prisma.salesReturn.groupBy({
      by: ['authorizedBy'],
      where: {
        businessId,
        authorizedAt: { gte: start },
        ...(scope ? { invoice: { locationId: scope } } : {}),
      },
      _count: { _all: true },
    }),
  ]);
  const perUser = new Map<
    string,
    { voids: number; voidAmount: number; cancels: number; adjustments: number; returns: number }
  >();
  const bump = (
    userId: string | null | undefined,
    patch: Partial<{
      voids: number;
      voidAmount: number;
      cancels: number;
      adjustments: number;
      returns: number;
    }>,
  ) => {
    if (!userId) return;
    const row = perUser.get(userId) || {
      voids: 0,
      voidAmount: 0,
      cancels: 0,
      adjustments: 0,
      returns: 0,
    };
    Object.assign(row, {
      voids: row.voids + (patch.voids || 0),
      voidAmount: row.voidAmount + (patch.voidAmount || 0),
      cancels: row.cancels + (patch.cancels || 0),
      adjustments: row.adjustments + (patch.adjustments || 0),
      returns: row.returns + (patch.returns || 0),
    });
    perUser.set(userId, row);
  };
  for (const v of voids)
    bump(v.createdBy, { voids: v._count._all, voidAmount: v._sum.amount || 0 });
  for (const c of cancels) bump(c.cancelledBy, { cancels: c._count._all });
  for (const a of adjustments) bump(a.createdBy, { adjustments: a._count._all });
  for (const r of returns) bump(r.authorizedBy, { returns: r._count._all });
  const flagged = [...perUser.entries()]
    .map(([userId, row]) => ({ userId, ...row }))
    .filter((r) => r.voids >= 3 || r.cancels >= 5 || r.adjustments >= 8 || r.returns >= 5)
    .slice(0, 10);
  if (!flagged.length) return drafts;
  const users = await prisma.user.findMany({
    where: { businessId, id: { in: flagged.map((f) => f.userId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  for (const row of flagged) {
    drafts.push({
      type: 'ACTIVITY_ANOMALY',
      category: 'OPERATIONS',
      severity: 'INFO',
      dedupeKey: `ACTIVITY_ANOMALY:${row.userId}:${monthKey(now)}`,
      title: `Unusual activity volume for ${nameOf.get(row.userId) || 'a user'}`,
      summary: `In the last 30 days this user recorded ${row.voids} voided payment(s) (${money(row.voidAmount)}), ${row.cancels} cancelled invoice(s), ${row.adjustments} stock adjustment(s), and ${row.returns} authorized return(s).`,
      detail:
        'Factual activity summary for review — high counts can have legitimate explanations (busy branch, stocktake corrections). This is not an accusation.',
      evidence: {
        userId: row.userId,
        userName: nameOf.get(row.userId) ?? null,
        voidedPayments: row.voids,
        voidedAmount: money(row.voidAmount),
        cancelledInvoices: row.cancels,
        stockAdjustments: row.adjustments,
        authorizedReturns: row.returns,
      },
      recommendation:
        "Spot-check the audit log for this user's transactions if the volume is unexpected.",
      entityType: 'User',
      entityId: row.userId,
      periodStart: start,
      periodEnd: now,
    });
  }
  return drafts;
};

export const DETECTORS: Detector[] = [
  salesDeclineDetector,
  lowMarginDetector,
  excessiveDiscountDetector,
  stockoutRiskDetector,
  deadStockDetector,
  expiryRiskDetector,
  customerChurnDetector,
  supplierRiskDetector,
  cashFlowDetector,
  activityAnomalyDetector,
];
