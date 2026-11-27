import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { accessibleLocationIds } from '../common/utils/location-access.util';
import { InsightsService } from '../intelligence/insights.service';
import { PredictionsService } from '../intelligence/predictions.service';

const DAY = 86_400_000;

export interface ToolContext {
  businessId: string;
  userId: string;
}
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (prisma: PrismaService, ctx: ToolContext, args: Record<string, any>) => Promise<unknown>;
}

const locFilter = async (prisma: PrismaService, ctx: ToolContext, locationId?: string) => {
  const accessible = await accessibleLocationIds(prisma, ctx.businessId, ctx.userId);
  if (locationId) {
    if (accessible && !accessible.includes(locationId))
      throw new BadRequestException('No access to this location');
    return locationId;
  }
  return accessible; // null = unrestricted
};

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));

export const TOOLS: ToolDef[] = [
  {
    name: 'getSalesSummary',
    description:
      'Total sales revenue and invoice count for a period (default: this month). Distinguishes revenue from cash collected.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Look back N days (default 30)' } },
    },
    run: async (p, ctx, a) => {
      const days = Math.min(Math.max(num(a.days) || 30, 1), 365);
      const since = new Date(Date.now() - days * DAY);
      const locs = await locFilter(p, ctx, a.locationId);
      const [agg, paid] = await Promise.all([
        p.salesInvoice.aggregate({
          where: {
            businessId: ctx.businessId,
            status: { notIn: ['DRAFT', 'CANCELLED'] },
            invoiceDate: { gte: since },
            ...(locs ? { locationId: { in: Array.isArray(locs) ? locs : [locs] } } : {}),
          },
          _sum: { totalAmount: true, totalPaid: true },
          _count: { _all: true },
        }),
        p.payment.aggregate({
          where: {
            businessId: ctx.businessId,
            direction: 'INFLOW',
            status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
            paymentDate: { gte: since },
          },
          _sum: { amount: true },
        }),
      ]);
      return {
        period: `last ${days} days`,
        invoiceCount: agg._count._all,
        revenue: num(agg._sum.totalAmount),
        collectedOnInvoices: num(agg._sum.totalPaid),
        cashReceived: num(paid._sum.amount),
        note: 'Revenue ≠ cash. Collected-on-invoices counts payments applied to invoices; cashReceived counts all inflow payments.',
      };
    },
  },
  {
    name: 'getTopProducts',
    description: 'Best or worst selling products by quantity over a period.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number' },
        limit: { type: 'number' },
        worst: { type: 'boolean' },
      },
    },
    run: async (p, ctx, a) => {
      const days = Math.min(Math.max(num(a.days) || 30, 1), 365);
      const limit = Math.min(Math.max(num(a.limit) || 10, 1), 50);
      const since = new Date(Date.now() - days * DAY);
      const locs = await locFilter(p, ctx, a.locationId);
      const rows = await p.inventoryMovement.groupBy({
        by: ['productId'],
        where: {
          businessId: ctx.businessId,
          type: 'SALE',
          createdAt: { gte: since },
          ...(locs ? { locationId: { in: Array.isArray(locs) ? locs : [locs] } } : {}),
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: a.worst ? 'asc' : 'desc' } },
        take: limit,
      });
      const products = await p.product.findMany({
        where: { businessId: ctx.businessId, id: { in: rows.map((r) => r.productId) } },
        select: { id: true, name: true, sku: true },
      });
      const map = new Map(products.map((x) => [x.id, x]));
      return rows.map((r) => ({
        name: map.get(r.productId)?.name,
        sku: map.get(r.productId)?.sku,
        unitsSold: Math.abs(num(r._sum.quantity)),
      }));
    },
  },
  {
    name: 'getInventoryStatus',
    description: 'Current stock levels, optionally filtered to low/out-of-stock items.',
    parameters: { type: 'object', properties: { lowOnly: { type: 'boolean' } } },
    run: async (p, ctx, a) => {
      const locs = await locFilter(p, ctx, a.locationId);
      const balances = await p.stockBalance.findMany({
        where: {
          businessId: ctx.businessId,
          ...(locs ? { locationId: { in: Array.isArray(locs) ? locs : [locs] } } : {}),
        },
        include: {
          product: { select: { name: true, sku: true, reorderLevel: true, minimumStock: true } },
          location: { select: { name: true } },
        },
        take: 5000,
      });
      const filtered = a.lowOnly
        ? balances.filter(
            (b) => b.quantity <= (b.product.reorderLevel || b.product.minimumStock || 0),
          )
        : balances;
      return {
        totalProducts: new Set(balances.map((b) => b.productId)).size,
        lowStockCount: balances.filter(
          (b) => b.quantity <= (b.product.reorderLevel || b.product.minimumStock || 0),
        ).length,
        items: filtered.slice(0, 50).map((b) => ({
          product: b.product.name,
          sku: b.product.sku,
          location: b.location.name,
          quantity: b.quantity,
          reorderLevel: b.product.reorderLevel,
        })),
        note: `Showing ${Math.min(filtered.length, 50)} of ${filtered.length}.`,
      };
    },
  },
  {
    name: 'getOutstandingInvoices',
    description: 'Unpaid/partially-paid invoices and total outstanding receivables.',
    parameters: { type: 'object', properties: {} },
    run: async (p, ctx) => {
      const locs = await locFilter(p, ctx);
      const rows = await p.salesInvoice.findMany({
        where: {
          businessId: ctx.businessId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          balance: { gt: 0 },
          ...(locs ? { locationId: { in: Array.isArray(locs) ? locs : [locs] } } : {}),
        },
        select: {
          invoiceNumber: true,
          balance: true,
          dueDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { balance: 'desc' },
        take: 50,
      });
      const total = rows.reduce((s, r) => s + r.balance, 0);
      return {
        count: rows.length,
        totalOutstanding: Math.round(total * 100) / 100,
        top: rows.slice(0, 15).map((r) => ({
          invoice: r.invoiceNumber,
          customer: r.customer?.name,
          balance: r.balance,
          dueDate: r.dueDate,
        })),
      };
    },
  },
  {
    name: 'getExpenseSummary',
    description: 'Total expenses recorded over a period.',
    parameters: { type: 'object', properties: { days: { type: 'number' } } },
    run: async (p, ctx, a) => {
      const days = Math.min(Math.max(num(a.days) || 30, 1), 365);
      const since = new Date(Date.now() - days * DAY);
      const agg = await p.expense.aggregate({
        where: {
          businessId: ctx.businessId,
          expenseDate: { gte: since },
          status: { not: 'CANCELLED' },
        },
        _sum: { amount: true },
        _count: { _all: true },
      });
      return { period: `last ${days} days`, count: agg._count._all, total: num(agg._sum.amount) };
    },
  },
  {
    name: 'getPurchaseOrders',
    description: 'Open purchase orders and incoming stock.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'ORDERED, PARTIALLY_RECEIVED, DRAFT, etc.' },
      },
    },
    run: async (p, ctx, a) => {
      const locs = await locFilter(p, ctx, a.locationId);
      const status =
        typeof a.status === 'string' && /^[A-Z_]{3,30}$/.test(a.status) ? a.status : undefined;
      const rows = await p.purchaseOrder.findMany({
        where: {
          businessId: ctx.businessId,
          ...(status ? { status } : { status: { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] } }),
          ...(locs ? { locationId: { in: Array.isArray(locs) ? locs : [locs] } } : {}),
        },
        select: {
          poNumber: true,
          status: true,
          totalAmount: true,
          orderDate: true,
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { orderDate: 'desc' },
        take: 30,
      });
      return {
        count: rows.length,
        orders: rows.map((r) => ({
          po: r.poNumber,
          supplier: r.supplier?.name,
          status: r.status,
          total: r.totalAmount,
          items: r._count.items,
        })),
      };
    },
  },
];

@Injectable()
export class CopilotTools {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly predictions: PredictionsService,
  ) {}

  /** Intelligence/prediction tools resolved via existing verified services. */
  async runIntelligence(
    name: string,
    ctx: ToolContext,
    args: Record<string, any>,
  ): Promise<unknown> {
    switch (name) {
      case 'getBusinessInsights': {
        const list = await this.insights.listInsights(ctx.businessId, ctx.userId, {
          status: 'ACTIVE',
          page: 1,
          limit: 20,
        } as any);
        return {
          count: list.total,
          insights: list.data.map((i: any) => ({
            type: i.type,
            severity: i.severity,
            title: i.title,
            summary: i.summary,
          })),
        };
      }
      case 'getStockoutPredictions':
        return this.predictions.stockoutForecasts(ctx.businessId, ctx.userId);
      case 'getDemandForecast': {
        const product = await this.prisma.product.findFirst({
          where: { businessId: ctx.businessId, sku: String(args.sku || '') },
        });
        if (!product) throw new NotFoundException('Product not found — provide a valid SKU');
        return this.predictions.demandForecast(
          ctx.businessId,
          ctx.userId,
          product.id,
          args.locationId || null,
          [7, 14, 30].includes(Number(args.horizon)) ? Number(args.horizon) : 30,
        );
      }
      case 'getCashflowForecast':
        return this.predictions.cashflowForecast(
          ctx.businessId,
          ctx.userId,
          [7, 14, 30].includes(Number(args.days)) ? Number(args.days) : 30,
        );
      case 'getChurnRisks':
        return this.predictions.churnForecasts(ctx.businessId, ctx.userId);
      case 'getReorderRecommendations':
        return this.insights.getReorderSuggestions(ctx.businessId, ctx.userId, {
          locationId: args.locationId,
        } as any);
      default:
        throw new BadRequestException(`Unknown intelligence tool: ${name}`);
    }
  }

  async execute(name: string, ctx: ToolContext, args: Record<string, any>): Promise<unknown> {
    const tool = TOOLS.find((t) => t.name === name);
    if (tool) return tool.run(this.prisma, ctx, args || {});
    if (
      [
        'getBusinessInsights',
        'getStockoutPredictions',
        'getDemandForecast',
        'getCashflowForecast',
        'getChurnRisks',
        'getReorderRecommendations',
      ].includes(name)
    )
      return this.runIntelligence(name, ctx, args || {});
    throw new BadRequestException(`Unknown tool: ${name}`);
  }
}
