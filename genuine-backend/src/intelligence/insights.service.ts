import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { accessibleLocationIds, assertLocationAccess } from '../common/utils/location-access.util';
import { PurchaseService } from '../purchases/purchase.service';
import { CreatePurchaseOrderDto } from '../purchases/dto/create-purchase-order.dto';
import { DETECTORS, DetectorContext, InsightDraft } from './detectors';
import { computeReorderMath } from './reorder-math';
import {
  CreateDraftPurchaseOrdersDto,
  InsightActionDto,
  InsightFilterDto,
  ReorderSuggestionsQueryDto,
} from './dto/insight.dto';

export interface ReorderRow {
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  available: number;
  incoming: number;
  dailyVelocity: number;
  daysOfStock: number | null;
  leadTimeDays: number;
  safetyStock: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  estimatedUnitCost: number | null;
  estimatedOrderCost: number | null;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  calculation: {
    demandWindowUnits: number;
    safetyStockUnits: number;
    availableUnits: number;
    incomingUnits: number;
    reorderLevel: number;
    formula: string;
  };
  stockAnomaly: boolean;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly purchases: PurchaseService,
  ) {}

  // ---------- detection engine ----------

  async runDetection(
    businessId: string,
  ): Promise<{ created: number; updated: number; expired: number }> {
    // Detectors always evaluate business-wide so one user's scoped run cannot expire
    // insights belonging to locations they cannot see.
    const ctx: DetectorContext = {
      prisma: this.prisma,
      businessId,
      locationIds: null,
      now: new Date(),
    };
    const drafts: InsightDraft[] = [];
    for (const detector of DETECTORS) {
      try {
        drafts.push(...(await detector(ctx)));
      } catch (error) {
        this.logger.error(
          `Detector failed for business ${businessId}: ${(error as Error).message}`,
        );
      }
    }
    const runStartedAt = new Date();
    let created = 0;
    let updated = 0;
    for (const draft of drafts) {
      const existing = await this.prisma.insight.findUnique({
        where: { businessId_dedupeKey: { businessId, dedupeKey: draft.dedupeKey } },
        select: { id: true, status: true },
      });
      if (existing) {
        await this.prisma.insight.update({
          where: { id: existing.id },
          data: {
            severity: draft.severity,
            title: draft.title,
            summary: draft.summary,
            detail: draft.detail,
            evidence: draft.evidence,
            impact: draft.impact,
            recommendation: draft.recommendation,
            entityType: draft.entityType,
            entityId: draft.entityId,
            productId: draft.productId,
            customerId: draft.customerId,
            supplierId: draft.supplierId,
            locationId: draft.locationId ?? null,
            periodStart: draft.periodStart,
            periodEnd: draft.periodEnd,
            lastSeenAt: runStartedAt,
            // A still-true insight re-opens if it previously expired or was resolved.
            // Dismissed and acknowledged insights keep their status.
            ...(existing.status === 'EXPIRED' || existing.status === 'RESOLVED'
              ? { status: 'ACTIVE' }
              : {}),
          },
        });
        updated += 1;
      } else {
        await this.prisma.insight.create({
          data: {
            id: uuid(),
            businessId,
            type: draft.type,
            category: draft.category,
            severity: draft.severity,
            status: 'ACTIVE',
            dedupeKey: draft.dedupeKey,
            title: draft.title,
            summary: draft.summary,
            detail: draft.detail,
            evidence: draft.evidence,
            impact: draft.impact,
            recommendation: draft.recommendation,
            entityType: draft.entityType,
            entityId: draft.entityId,
            productId: draft.productId,
            customerId: draft.customerId,
            supplierId: draft.supplierId,
            locationId: draft.locationId ?? null,
            periodStart: draft.periodStart,
            periodEnd: draft.periodEnd,
            detectedAt: runStartedAt,
            lastSeenAt: runStartedAt,
          },
        });
        created += 1;
      }
    }
    const expired = await this.prisma.insight.updateMany({
      where: {
        businessId,
        status: 'ACTIVE',
        lastSeenAt: { lt: runStartedAt },
      },
      data: { status: 'EXPIRED' },
    });
    return { created, updated, expired: expired.count };
  }

  @Cron('30 4 * * *')
  async scheduledRun() {
    const businesses = await this.prisma.business.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    for (const business of businesses) {
      try {
        await this.runDetection(business.id);
      } catch (error) {
        this.logger.error(
          `Scheduled insight run failed for business ${business.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  // ---------- queries ----------

  private async scopedLocationIds(businessId: string, userId: string) {
    return accessibleLocationIds(this.prisma, businessId, userId);
  }

  private async insightWhere(
    businessId: string,
    userId: string,
    filter: InsightFilterDto,
    accessibleIds: string[] | null,
  ): Promise<Prisma.InsightWhereInput> {
    const where: Prisma.InsightWhereInput = { businessId };
    if (filter.severity) where.severity = filter.severity;
    if (filter.category) where.category = filter.category;
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.locationId) {
      await assertLocationAccess(this.prisma, businessId, userId, filter.locationId);
      where.locationId = filter.locationId;
    } else if (accessibleIds) {
      // Location-restricted users only see insights tied to their locations.
      // Business-wide insights (locationId null) are restricted to unrestricted users.
      where.locationId = { in: accessibleIds };
    }
    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
        { summary: { contains: filter.q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async listInsights(businessId: string, userId: string, filter: InsightFilterDto) {
    const accessibleIds = await this.scopedLocationIds(businessId, userId);
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 20, 100);
    const where = await this.insightWhere(businessId, userId, filter, accessibleIds);
    const [total, rows, summary] = await Promise.all([
      this.prisma.insight.count({ where }),
      this.prisma.insight.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.insight.groupBy({
        by: ['severity', 'status'],
        where: { businessId, ...(accessibleIds ? { locationId: { in: accessibleIds } } : {}) },
        _count: { _all: true },
      }),
    ]);
    return { data: rows, total, page, limit, summary };
  }

  async getInsight(businessId: string, userId: string, id: string) {
    const accessibleIds = await this.scopedLocationIds(businessId, userId);
    const insight = await this.prisma.insight.findFirst({
      where: {
        id,
        businessId,
        ...(accessibleIds ? { locationId: { in: accessibleIds } } : {}),
      },
    });
    if (!insight) throw new NotFoundException('Insight not found');
    return insight;
  }

  async getSummary(businessId: string, userId: string) {
    const accessibleIds = await this.scopedLocationIds(businessId, userId);
    const scope = accessibleIds ? { locationId: { in: accessibleIds } } : {};
    const [bySeverity, byCategory, byStatus, recent] = await Promise.all([
      this.prisma.insight.groupBy({
        by: ['severity'],
        where: { businessId, status: 'ACTIVE', ...scope },
        _count: { _all: true },
      }),
      this.prisma.insight.groupBy({
        by: ['category'],
        where: { businessId, status: 'ACTIVE', ...scope },
        _count: { _all: true },
      }),
      this.prisma.insight.groupBy({
        by: ['status'],
        where: { businessId, ...scope },
        _count: { _all: true },
      }),
      this.prisma.insight.findMany({
        where: { businessId, status: 'ACTIVE', ...scope },
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          summary: true,
          category: true,
          lastSeenAt: true,
        },
      }),
    ]);
    return { bySeverity, byCategory, byStatus, topInsights: recent };
  }

  private async transition(
    businessId: string,
    userId: string,
    id: string,
    action: 'ACKNOWLEDGE' | 'DISMISS' | 'RESOLVE',
    note?: string,
  ) {
    const accessibleIds = await this.scopedLocationIds(businessId, userId);
    const insight = await this.prisma.insight.findFirst({
      where: {
        id,
        businessId,
        ...(accessibleIds ? { locationId: { in: accessibleIds } } : {}),
      },
    });
    if (!insight) throw new NotFoundException('Insight not found');
    const now = new Date();
    const data: Prisma.InsightUpdateInput = {};
    if (action === 'ACKNOWLEDGE') {
      if (insight.status !== 'ACTIVE')
        throw new ConflictException(`Cannot acknowledge an insight in ${insight.status} status`);
      data.status = 'ACKNOWLEDGED';
      data.acknowledgedBy = userId;
      data.acknowledgedAt = now;
    } else if (action === 'DISMISS') {
      if (['DISMISSED', 'RESOLVED'].includes(insight.status))
        throw new ConflictException(`Insight is already ${insight.status}`);
      data.status = 'DISMISSED';
      data.dismissedBy = userId;
      data.dismissedAt = now;
    } else {
      if (insight.status === 'RESOLVED') throw new ConflictException('Insight is already resolved');
      data.status = 'RESOLVED';
      data.resolvedBy = userId;
      data.resolvedAt = now;
    }
    if (note) data.detail = `${insight.detail || ''}\n[${action} note] ${note}`.trim();
    return this.prisma.insight.update({ where: { id }, data });
  }

  acknowledge(businessId: string, userId: string, id: string, dto: InsightActionDto) {
    return this.transition(businessId, userId, id, 'ACKNOWLEDGE', dto.note);
  }
  dismiss(businessId: string, userId: string, id: string, dto: InsightActionDto) {
    return this.transition(businessId, userId, id, 'DISMISS', dto.note);
  }
  resolve(businessId: string, userId: string, id: string, dto: InsightActionDto) {
    return this.transition(businessId, userId, id, 'RESOLVE', dto.note);
  }

  // ---------- smart reorder ----------

  async getReorderSuggestions(
    businessId: string,
    userId: string,
    query: ReorderSuggestionsQueryDto,
  ): Promise<{ data: ReorderRow[]; generatedAt: Date }> {
    const accessibleIds = await this.scopedLocationIds(businessId, userId);
    const locations = await this.prisma.location.findMany({
      where: {
        businessId,
        isActive: true,
        ...(accessibleIds ? { id: { in: accessibleIds } } : {}),
        ...(query.locationId ? { id: query.locationId } : {}),
      },
      select: { id: true, name: true },
    });
    if (query.locationId && !locations.length)
      throw new NotFoundException('Location not found or not accessible');
    return this.computeSuggestions(
      businessId,
      locations.map((l) => l.id),
      query,
    );
  }

  private async computeSuggestions(
    businessId: string,
    locationIds: string[],
    query: ReorderSuggestionsQueryDto,
  ) {
    const now = new Date();
    if (!locationIds.length) return { data: [] as ReorderRow[], generatedAt: now };
    const start = new Date(now.getTime() - 30 * 86_400_000);
    const locFilter = locationIds.length ? { in: locationIds } : undefined;
    const locQuery = query.locationId ? [query.locationId] : locationIds;
    const [balances, movements, pos, products, suppliers, locations] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { businessId, ...(locFilter ? { locationId: locFilter } : {}) },
        select: { productId: true, locationId: true, quantity: true },
      }),
      this.prisma.inventoryMovement.findMany({
        where: {
          businessId,
          type: 'SALE',
          createdAt: { gte: start },
          ...(locFilter ? { locationId: locFilter } : {}),
        },
        select: { productId: true, locationId: true, quantity: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          businessId,
          status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
          ...(locFilter ? { locationId: locFilter } : {}),
        },
        select: {
          locationId: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
              grnItems: {
                where: { grn: { status: 'ACCEPTED' } },
                select: { receivedQuantity: true, acceptedQuantity: true },
              },
            },
          },
        },
      }),
      this.prisma.product.findMany({
        where: { businessId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          sku: true,
          buyingPrice: true,
          reorderLevel: true,
          minimumStock: true,
          supplierId: true,
        },
      }),
      this.prisma.supplier.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, supplierCode: true },
      }),
      this.prisma.location.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    const velocity = new Map<string, number>();
    for (const m of movements) {
      const key = `${m.productId}:${m.locationId}`;
      velocity.set(key, (velocity.get(key) || 0) + Math.abs(m.quantity));
    }
    const incoming = new Map<string, number>();
    const incomingCost = new Map<string, number>();
    for (const po of pos) {
      for (const item of po.items) {
        const received = item.grnItems.reduce(
          (s, gi) => s + (gi.acceptedQuantity ?? gi.receivedQuantity ?? 0),
          0,
        );
        const remaining = Math.max(0, item.quantity - received);
        if (remaining <= 0) continue;
        const key = `${item.productId}:${po.locationId}`;
        incoming.set(key, (incoming.get(key) || 0) + remaining);
        incomingCost.set(key, (incomingCost.get(key) || 0) + remaining * item.unitPrice);
      }
    }

    // Supplier lead times from historical POs (expectedDelivery - orderDate), fallback 7d.
    const supplierLead = new Map<string, { avg: number; count: number }>();
    const histPos = await this.prisma.purchaseOrder.findMany({
      where: {
        businessId,
        orderDate: { gte: new Date(now.getTime() - 365 * 86_400_000) },
        expectedDeliveryDate: { not: null },
      },
      select: { supplierId: true, orderDate: true, expectedDeliveryDate: true },
    });
    for (const po of histPos) {
      const days = (po.expectedDeliveryDate!.getTime() - po.orderDate.getTime()) / 86_400_000;
      if (days < 0 || days > 120) continue;
      const row = supplierLead.get(po.supplierId) || { avg: 0, count: 0 };
      row.avg += days;
      row.count += 1;
      supplierLead.set(po.supplierId, row);
    }

    const rows: ReorderRow[] = [];
    const seen = new Set<string>();
    for (const b of balances) {
      if (!locQuery.includes(b.locationId)) continue;
      const product = productMap.get(b.productId);
      if (!product) continue;
      const key = `${b.productId}:${b.locationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const daily = (velocity.get(key) || 0) / 30;
      const inQty = incoming.get(key) || 0;
      const available = b.quantity;
      const stockAnomaly = available < 0;
      let supplierId = product.supplierId;
      // Fallback: most recent PO supplier for this product when no default supplier is set.
      if (!supplierId) {
        const lastPo = await this.prisma.purchaseOrderItem.findFirst({
          where: {
            productId: product.id,
            purchaseOrder: { businessId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
          },
          orderBy: { purchaseOrder: { orderDate: 'desc' } },
          select: { purchaseOrder: { select: { supplierId: true } } },
        });
        supplierId = lastPo?.purchaseOrder.supplierId || null;
      }
      const supplier = supplierId ? supplierMap.get(supplierId) : null;
      const leadRaw = supplierId ? supplierLead.get(supplierId) : null;
      const leadTimeDays =
        leadRaw && leadRaw.count >= 2
          ? Math.min(60, Math.max(1, Math.round(leadRaw.avg / leadRaw.count)))
          : 7;
      const math = computeReorderMath({
        dailyVelocity: daily,
        leadTimeDays,
        available,
        incoming: inQty,
        reorderLevel: product.reorderLevel ?? product.minimumStock ?? 0,
      });
      const {
        demandWindowUnits: demandWindow,
        safetyStockUnits: safetyStockNum,
        effectiveAvailable,
        shortfall,
      } = math;
      const safetyStock = safetyStockNum;
      const threshold = product.reorderLevel ?? product.minimumStock ?? 0;
      const needsReorder = math.needsReorder;
      if (!needsReorder) continue;
      const suggestedQuantity = math.suggestedQuantity;
      const daysOfStock = math.daysOfStock;
      const confidence: ReorderRow['confidence'] =
        daily > 0 && leadRaw && leadRaw.count >= 3 ? 'HIGH' : daily > 0 ? 'MEDIUM' : 'LOW';
      const unitCost = incomingCost.get(key)
        ? incomingCost.get(key)! / Math.max(inQty, 0.0001)
        : product.buyingPrice;
      rows.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        locationId: b.locationId,
        locationName: locationMap.get(b.locationId)?.name || b.locationId,
        available,
        incoming: inQty,
        dailyVelocity: Math.round(daily * 1000) / 1000,
        daysOfStock,
        leadTimeDays,
        safetyStock,
        suggestedQuantity,
        supplierId: supplier?.id || null,
        supplierName: supplier?.name || null,
        estimatedUnitCost: unitCost,
        estimatedOrderCost: unitCost ? Math.round(suggestedQuantity * unitCost * 100) / 100 : null,
        reason: stockAnomaly
          ? `Stock balance is negative (${money2(available)}) — likely a data anomaly. Reorder urgently and reconcile stock.`
          : shortfall > 0
            ? `Projected demand over lead time + review period (${money2(demandWindow)} units) plus safety stock (${safetyStock}) exceeds available (${money2(effectiveAvailable)}) and incoming (${money2(inQty)}).`
            : `Stock (${money2(effectiveAvailable)}) is at or below the configured reorder level (${threshold}).`,
        confidence,
        calculation: {
          demandWindowUnits: money2(demandWindow),
          safetyStockUnits: safetyStock,
          availableUnits: money2(available),
          incomingUnits: money2(inQty),
          reorderLevel: threshold,
          formula:
            'ceil(dailyVelocity*(leadTimeDays+7) + safetyStock - max(0,available) - incomingPO)',
        },
        stockAnomaly,
      });
    }
    rows.sort(
      (a, b) =>
        (a.daysOfStock ?? 9999) - (b.daysOfStock ?? 9999) ||
        b.suggestedQuantity - a.suggestedQuantity,
    );
    const limit = query.limit || 100;
    return { data: rows.slice(0, limit), generatedAt: now };
  }

  async createDraftPurchaseOrders(
    businessId: string,
    userId: string,
    dto: CreateDraftPurchaseOrdersDto,
  ) {
    // Recompute suggestions server-side; client may only pick product/location and quantity.
    const created: Array<{
      poId: string;
      poNumber: string;
      supplierId: string;
      locationId: string;
      itemCount: number;
    }> = [];
    const bySupplierLocation = new Map<string, typeof dto.items>();
    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, businessId, status: 'ACTIVE' },
        select: { id: true, supplierId: true, buyingPrice: true },
      });
      if (!product)
        throw new BadRequestException(`Product ${item.productId} not found or inactive`);
      await assertLocationAccess(this.prisma, businessId, userId, item.locationId);
      if (!product.supplierId)
        throw new BadRequestException(
          `Product ${item.productId} has no default supplier; cannot auto-create a purchase order`,
        );
      const key = `${product.supplierId}:${item.locationId}`;
      const group = bySupplierLocation.get(key) || [];
      group.push(item);
      bySupplierLocation.set(key, group);
    }
    // Stable idempotency key per (user, items, notes) so retries/double-clicks return
    // the existing draft PO instead of creating duplicates.
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          notes: dto.notes ?? null,
          items: [...dto.items].map((i) => `${i.productId}:${i.locationId}:${i.quantity}`).sort(),
        }),
      )
      .digest('hex')
      .slice(0, 32);
    for (const [key, items] of bySupplierLocation) {
      const [supplierId, locationId] = key.split(':');
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: supplierId, businessId, isActive: true },
      });
      if (!supplier) throw new BadRequestException(`Supplier ${supplierId} not found or inactive`);
      // Aggregate duplicate product lines.
      const merged = new Map<string, number>();
      for (const item of items)
        merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);
      const orderItems = [] as CreatePurchaseOrderDto['items'];
      for (const [productId, quantity] of merged) {
        const product = await this.prisma.product.findFirst({
          where: { id: productId, businessId },
          select: { buyingPrice: true },
        });
        orderItems.push({
          productId,
          quantity,
          unitPrice: product?.buyingPrice ?? 0,
        });
      }
      let result;
      try {
        result = await this.purchases.createPurchaseOrder(businessId, userId, {
          idempotencyKey: `smart-reorder:${fingerprint}:${supplierId}:${locationId}`,
          supplierId,
          locationId,
          items: orderItems,
          notes: dto.notes ? `Smart reorder draft — ${dto.notes}` : 'Smart reorder draft',
          expectedDeliveryDate: undefined,
        } as CreatePurchaseOrderDto);
      } catch (error) {
        // Concurrent identical submissions race past the findFirst check and hit the
        // unique [businessId, idempotencyKey] constraint — return the winner's PO.
        if ((error as { code?: string }).code === 'P2002') {
          const existing = await this.prisma.purchaseOrder.findFirst({
            where: {
              businessId,
              idempotencyKey: `smart-reorder:${fingerprint}:${supplierId}:${locationId}`,
            },
          });
          if (existing) {
            created.push({
              poId: existing.id,
              poNumber: existing.poNumber,
              supplierId,
              locationId,
              itemCount: orderItems.length,
            });
            continue;
          }
        }
        throw error;
      }
      created.push({
        poId: (result as any).id,
        poNumber: (result as any).poNumber,
        supplierId,
        locationId,
        itemCount: orderItems.length,
      });
    }
    return { created, count: created.length };
  }
}

function money2(v: number) {
  return Math.round(v * 100) / 100;
}
