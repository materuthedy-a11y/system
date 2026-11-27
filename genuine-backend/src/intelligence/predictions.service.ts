import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { accessibleLocationIds, assertLocationAccess } from '../common/utils/location-access.util';
import {
  forecastDemand,
  predictStockout,
  predictOverstock,
  toDailySeries,
  StockoutPrediction,
} from './forecast';
import { computeReorderMath } from './reorder-math';

const DAY = 86_400_000;

@Injectable()
export class PredictionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async scopedLocations(businessId: string, userId: string) {
    return accessibleLocationIds(this.prisma, businessId, userId);
  }

  /** Demand forecast for one product+location (or aggregated across locations). */
  async demandForecast(
    businessId: string,
    userId: string,
    productId: string,
    locationId: string | null,
    horizonDays = 30,
  ) {
    if (![7, 14, 30].includes(horizonDays))
      throw new BadRequestException('horizonDays must be 7, 14 or 30');
    const accessible = await this.scopedLocations(businessId, userId);
    if (locationId) await assertLocationAccess(this.prisma, businessId, userId, locationId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId, status: 'ACTIVE' },
    });
    if (!product) throw new NotFoundException('Product not found');
    const locs = locationId ? [locationId] : accessible;
    const days = 90;
    const since = new Date(Date.now() - days * DAY);
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        businessId,
        productId,
        type: 'SALE',
        createdAt: { gte: since },
        ...(locs ? { locationId: { in: locs } } : {}),
      },
      select: { createdAt: true, quantity: true },
      take: 100000,
    });
    const series = toDailySeries(
      movements.map((m) => ({ date: m.createdAt, qty: Math.abs(m.quantity) })),
      days,
    );
    const fc = forecastDemand(series, horizonDays);
    return {
      productId,
      productName: product.name,
      sku: product.sku,
      locationId,
      horizonDays,
      forecast: fc,
    };
  }

  /** Stockout predictions across catalog (bounded to active products with stock or recent sales). */
  async stockoutForecasts(businessId: string, userId: string) {
    const accessible = await this.scopedLocations(businessId, userId);
    const since = new Date(Date.now() - 30 * DAY);
    const [balances, velocity, pos] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { businessId, ...(accessible ? { locationId: { in: accessible } } : {}) },
        select: { productId: true, locationId: true, quantity: true },
        take: 50000,
      }),
      this.prisma.inventoryMovement.groupBy({
        by: ['productId', 'locationId'],
        where: {
          businessId,
          type: 'SALE',
          createdAt: { gte: since },
          ...(accessible ? { locationId: { in: accessible } } : {}),
        },
        _sum: { quantity: true },
      }),
      this.prisma.purchaseOrderItem.findMany({
        where: {
          purchaseOrder: {
            businessId,
            status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
            ...(accessible ? { locationId: { in: accessible } } : {}),
          },
        },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          purchaseOrder: { select: { locationId: true } },
        },
        take: 50000,
      }),
    ]);
    const velMap = new Map(
      velocity.map((v) => [`${v.productId}:${v.locationId}`, -(v._sum.quantity || 0) / 30]),
    );
    const incomingMap = new Map<string, number>();
    for (const i of pos) {
      const key = `${i.productId}:${i.purchaseOrder.locationId}`;
      incomingMap.set(key, (incomingMap.get(key) || 0) + i.quantity);
    }
    const productIds = [...new Set(balances.map((b) => b.productId))];
    const products = await this.prisma.product.findMany({
      where: { businessId, id: { in: productIds }, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderLevel: true,
        minimumStock: true,
        buyingPrice: true,
      },
    });
    const pMap = new Map(products.map((p) => [p.id, p]));
    const locMap = new Map(
      (await this.prisma.location.findMany({ where: { businessId } })).map((l) => [l.id, l.name]),
    );

    const rows: Array<
      StockoutPrediction & {
        productName: string;
        sku: string;
        locationName: string;
        suggestedQuantity: number;
      }
    > = [];
    for (const b of balances) {
      const p = pMap.get(b.productId);
      if (!p) continue;
      const key = `${b.productId}:${b.locationId}`;
      const daily = velMap.get(key) || 0;
      const incoming = incomingMap.get(key) || 0;
      const lead = 7; // default; supplier-specific lead times live in reorder engine
      const math = computeReorderMath({
        dailyVelocity: daily,
        leadTimeDays: lead,
        available: b.quantity,
        incoming,
        reorderLevel: p.reorderLevel ?? p.minimumStock ?? 0,
      });
      const pred = predictStockout({
        available: b.quantity,
        incoming,
        dailyDemand: daily,
        leadTimeDays: lead,
        forecast7: daily * 7,
        forecast30: daily * 30,
        productName: p.name,
        locationName: locMap.get(b.locationId) || '',
      });
      if (pred.risk === 'LOW' && !math.needsReorder) continue;
      rows.push({
        ...pred,
        productId: b.productId,
        locationId: b.locationId,
        productName: p.name,
        sku: p.sku,
        locationName: locMap.get(b.locationId) || '',
        suggestedQuantity: math.suggestedQuantity,
      });
    }
    rows.sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));
    return { data: rows.slice(0, 200), generatedAt: new Date().toISOString() };
  }

  /** Overstock predictions. */
  async overstockForecasts(businessId: string, userId: string) {
    const accessible = await this.scopedLocations(businessId, userId);
    const since = new Date(Date.now() - 30 * DAY);
    const [balances, velocity] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: {
          businessId,
          quantity: { gt: 0 },
          ...(accessible ? { locationId: { in: accessible } } : {}),
        },
        select: { productId: true, locationId: true, quantity: true },
        take: 50000,
      }),
      this.prisma.inventoryMovement.groupBy({
        by: ['productId', 'locationId'],
        where: {
          businessId,
          type: 'SALE',
          createdAt: { gte: since },
          ...(accessible ? { locationId: { in: accessible } } : {}),
        },
        _sum: { quantity: true },
      }),
    ]);
    const velMap = new Map(
      velocity.map((v) => [`${v.productId}:${v.locationId}`, -(v._sum.quantity || 0) / 30]),
    );
    const productIds = [...new Set(balances.map((b) => b.productId))];
    const products = await this.prisma.product.findMany({
      where: { businessId, id: { in: productIds }, status: 'ACTIVE' },
      select: { id: true, name: true, sku: true, buyingPrice: true },
    });
    const pMap = new Map(products.map((p) => [p.id, p]));
    const locMap = new Map(
      (await this.prisma.location.findMany({ where: { businessId } })).map((l) => [l.id, l.name]),
    );
    const rows = [];
    for (const b of balances) {
      const p = pMap.get(b.productId);
      if (!p) continue;
      const pred = predictOverstock({
        available: b.quantity,
        incoming: 0,
        dailyDemand: velMap.get(`${b.productId}:${b.locationId}`) || 0,
        unitCost: p.buyingPrice,
      });
      if (pred.risk === 'LOW') continue;
      rows.push({
        productId: b.productId,
        productName: p.name,
        sku: p.sku,
        locationId: b.locationId,
        locationName: locMap.get(b.locationId) || '',
        available: b.quantity,
        ...pred,
      });
    }
    rows.sort((a: any, b: any) => (b.excessValue ?? 0) - (a.excessValue ?? 0));
    return { data: rows.slice(0, 200), generatedAt: new Date().toISOString() };
  }

  /** Customer churn risk (heuristic scoring — documented, not predictive probability). */
  async churnForecasts(businessId: string, userId: string) {
    await this.scopedLocations(businessId, userId);
    const customers = await this.prisma.customer.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, customerCode: true },
      take: 5000,
    });
    const stats = await this.prisma.salesInvoice.groupBy({
      by: ['customerId'],
      where: { businessId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { invoiceDate: true },
    });
    const statMap = new Map(stats.filter((s) => s.customerId).map((s) => [s.customerId!, s]));
    const now = Date.now();
    const rows = customers
      .map((c) => {
        const s = statMap.get(c.id);
        const count = s?._count._all || 0;
        const revenue = s?._sum.totalAmount || 0;
        const lastDate = s?._max.invoiceDate;
        const daysSince = lastDate ? Math.floor((now - lastDate.getTime()) / DAY) : null;
        let risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' = 'INSUFFICIENT';
        const factors: string[] = [];
        if (count >= 3 && daysSince !== null) {
          if (daysSince > 90) {
            risk = 'HIGH';
            factors.push(`No purchase in ${daysSince} days`);
          } else if (daysSince > 45) {
            risk = 'MEDIUM';
            factors.push(`Last purchase ${daysSince} days ago`);
          } else {
            risk = 'LOW';
            factors.push('Recent activity');
          }
          const avgInterval = count > 1 && lastDate ? daysSince / Math.max(1, count - 1) : null;
          if (avgInterval && daysSince > avgInterval * 2)
            factors.push('Gap exceeds typical buying interval');
        } else {
          factors.push(
            count < 3 ? 'Insufficient purchase history (<3 invoices)' : 'No recorded purchases',
          );
        }
        return {
          customerId: c.id,
          name: c.name,
          customerCode: c.customerCode,
          invoiceCount: count,
          totalRevenue: revenue,
          daysSinceLastPurchase: daysSince,
          risk,
          factors,
          recommendedAction:
            risk === 'HIGH'
              ? 'Reach out — customer may be lapsing'
              : risk === 'MEDIUM'
                ? 'Monitor — consider a check-in'
                : risk === 'LOW'
                  ? 'Healthy'
                  : 'N/A',
        };
      })
      .filter((r) => r.risk === 'HIGH' || r.risk === 'MEDIUM');
    rows.sort((a, b) => (b.daysSinceLastPurchase ?? 0) - (a.daysSinceLastPurchase ?? 0));
    return {
      data: rows.slice(0, 100),
      generatedAt: new Date().toISOString(),
      methodology: 'Heuristic recency/frequency scoring — not a statistical churn probability.',
    };
  }

  /** Cash-flow forecast: actuals + scheduled receivables/payables. */
  async cashflowForecast(businessId: string, userId: string, days = 30) {
    if (![7, 14, 30].includes(days)) throw new BadRequestException('days must be 7, 14 or 30');
    await this.scopedLocations(businessId, userId);
    const now = new Date();
    const horizon = new Date(now.getTime() + days * DAY);
    const [inflowAgg, outflowAgg, overdue, upcoming] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          businessId,
          direction: 'INFLOW',
          status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
          paymentDate: { gte: new Date(now.getTime() - 30 * DAY), lt: horizon },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          businessId,
          direction: 'OUTFLOW',
          status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
          paymentDate: { gte: new Date(now.getTime() - 30 * DAY), lt: horizon },
        },
        _sum: { amount: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          businessId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          balance: { gt: 0 },
          dueDate: { lt: now },
        },
        _sum: { balance: true },
        _count: { _all: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          businessId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
          balance: { gt: 0 },
          dueDate: { gte: now, lte: horizon },
        },
        _sum: { balance: true },
        _count: { _all: true },
      }),
    ]);
    const inflow30 = inflowAgg._sum.amount || 0;
    const outflow30 = outflowAgg._sum.amount || 0;
    return {
      horizonDays: days,
      actuals: {
        inflowLast30Days: Math.round(inflow30 * 100) / 100,
        outflowLast30Days: Math.round(outflow30 * 100) / 100,
        netLast30Days: Math.round((inflow30 - outflow30) * 100) / 100,
      },
      expected: {
        overdueReceivables: {
          amount: Math.round((overdue._sum.balance || 0) * 100) / 100,
          count: overdue._count._all,
          note: 'Recorded as owed, not collected cash',
        },
        dueWithinHorizon: {
          amount: Math.round((upcoming._sum.balance || 0) * 100) / 100,
          count: upcoming._count._all,
          note: 'Expected if customers pay on time',
        },
      },
      assumptions: [
        'Forecast = historical average daily net flow extrapolated; receivables/payables shown separately as expected, not guaranteed.',
        'Unpaid invoices are NOT counted as cash.',
        'Expenses without due dates are excluded from scheduled outflows.',
      ],
      generatedAt: now.toISOString(),
    };
  }
}
