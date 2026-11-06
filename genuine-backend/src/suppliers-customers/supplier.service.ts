import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierResponseDto,
  SupplierFilterDto,
  SupplierStatementDto,
} from './dto';

const ACTIVE_PAYMENT_STATUSES = ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'];
const SUPPLIER_PO_STATUSES = { notIn: ['DRAFT', 'CANCELLED'] };
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

@Injectable()
export class SupplierService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  /**
   * CREATE SUPPLIER
   * 1. Generate supplier code if not provided
   * 2. Verify unique name + code
   * 3. Create supplier
   * 4. Create contacts
   * 5. Create address
   */
  async createSupplier(
    businessId: string,
    userId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    this.logger.log(`[SUPPLIERS] Creating supplier: ${dto.name}`);

    // 1. Generate supplier code
    const supplierCode = dto.supplierCode || (await this._generateSupplierCode(businessId));

    // 2. Check unique name + code
    const existing = await this.prisma.supplier.findFirst({
      where: {
        businessId,
        OR: [{ name: dto.name }, { supplierCode }],
      },
    });

    if (existing) {
      throw new ConflictException('Supplier name or code already exists');
    }

    // 3. Create supplier
    const supplier = await this.prisma.supplier.create({
      data: {
        id: uuid(),
        businessId,
        name: dto.name,
        supplierCode,
        description: dto.description,
        email: dto.email,
        phone: dto.phone,
        secondaryPhone: dto.secondaryPhone,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankSwiftCode: dto.bankSwiftCode,
        taxId: dto.taxId,
        creditLimit: dto.creditLimit || 0,
        paymentTerms: dto.paymentTerms,
        openingBalance: dto.openingBalance || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    // 4. Create contacts
    if (dto.contacts && dto.contacts.length > 0) {
      for (let i = 0; i < dto.contacts.length; i++) {
        const contact = dto.contacts[i];
        await this.prisma.supplierContact.create({
          data: {
            id: uuid(),
            supplierId: supplier.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            position: contact.position,
            isPrimary: i === 0,
          },
        });
      }
    }

    // 5. Create address
    if (dto.address) {
      await this.prisma.supplierAddress.create({
        data: {
          id: uuid(),
          supplierId: supplier.id,
          street: dto.address.street,
          city: dto.address.city,
          region: dto.address.region,
          postalCode: dto.address.postalCode,
          country: dto.address.country,
        },
      });
    }

    this.logger.log(`[SUPPLIERS] Supplier created: ${supplier.id} (Code: ${supplierCode})`);

    return this.getSupplierById(businessId, supplier.id);
  }

  /**
   * GET SUPPLIER BY ID
   */
  async getSupplierById(businessId: string, supplierId: string): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
      },
      include: {
        contacts: true,
        address: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Calculate financials
    const [totalPurchased, totalPaid, totalReturned, lastPurchaseDate] = await Promise.all([
      this._calculateSupplierPurchases(businessId, supplierId),
      this._calculateSupplierPayments(businessId, supplierId),
      this._calculateSupplierReturns(businessId, supplierId),
      this._getLastPurchaseDate(businessId, supplierId),
    ]);

    return this._formatSupplierResponse(supplier, supplier.contacts || [], supplier.address, {
      totalPurchased,
      totalPaid,
      totalReturned,
      lastPurchaseDate,
    });
  }

  /**
   * GET ALL SUPPLIERS
   * With filtering, search, pagination
   */
  async getAllSuppliers(
    businessId: string,
    filter: SupplierFilterDto,
  ): Promise<{ data: SupplierResponseDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: Prisma.SupplierWhereInput = {
      businessId,
      ...(filter.paymentTerms && { paymentTerms: filter.paymentTerms }),
      ...(filter.search && {
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { supplierCode: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
          { phone: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Filter by status (active/inactive/overdue)
    if (filter.status) {
      if (filter.status === 'ACTIVE') {
        where.isActive = true;
      } else if (filter.status === 'INACTIVE') {
        where.isActive = false;
      }
      // OVERDUE will be filtered in memory after fetching
    }

    // Build sort
    let orderBy: Prisma.SupplierOrderByWithRelationInput = { createdAt: 'desc' };
    if (filter.sortBy) {
      const direction = filter.sortOrder === 'asc' ? 'asc' : 'desc';
      switch (filter.sortBy) {
        case 'name':
          orderBy = { name: direction };
          break;
        case 'outstanding':
          // Will sort in memory
          break;
        case 'lastPurchase':
          // Sorted after the aggregate's actual last purchase date is loaded.
          break;
        case 'createdAt':
          orderBy = { createdAt: direction };
          break;
      }
    }

    // Query suppliers
    const fullSort = filter.status === 'OVERDUE' || filter.sortBy === 'outstanding' || filter.sortBy === 'lastPurchase';
    const [suppliers, matchedCount] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: {
          contacts: true,
          address: true,
        },
        orderBy,
        ...(fullSort ? {} : { skip, take: limit }),
      }),
      this.prisma.supplier.count({ where }),
    ]);

    // Get financials for all suppliers
    const suppliersWithFinancials = await Promise.all(
      suppliers.map(async (supplier) => {
        const [totalPurchased, totalPaid, totalReturned, lastPurchaseDate] = await Promise.all([
          this._calculateSupplierPurchases(businessId, supplier.id),
          this._calculateSupplierPayments(businessId, supplier.id),
          this._calculateSupplierReturns(businessId, supplier.id),
          this._getLastPurchaseDate(businessId, supplier.id),
        ]);

        return {
          supplier,
          totalPurchased,
          totalPaid,
          totalReturned,
          lastPurchaseDate,
        };
      }),
    );

    // Format responses
    let results = suppliersWithFinancials.map((item) =>
      this._formatSupplierResponse(
        item.supplier,
        item.supplier.contacts || [],
        item.supplier.address,
        {
          totalPurchased: item.totalPurchased,
          totalPaid: item.totalPaid,
          totalReturned: item.totalReturned,
          lastPurchaseDate: item.lastPurchaseDate,
        },
      ),
    );

    // Apply overdue filter if needed
    if (filter.status === 'OVERDUE') {
      results = results.filter((s) => s.outstandingBalance > 0);
    }

    // Sort by outstanding if requested
    if (filter.sortBy === 'outstanding') {
      results.sort((a, b) => {
        const direction = filter.sortOrder === 'asc' ? 1 : -1;
        return (a.outstandingBalance - b.outstandingBalance) * direction;
      });
    }

    if (filter.sortBy === 'lastPurchase') {
      const direction = filter.sortOrder === 'asc' ? 1 : -1;
      results.sort((a, b) => {
        const left = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0;
        const right = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0;
        return (left - right) * direction;
      });
    }

    const total = fullSort ? results.length : matchedCount;
    if (fullSort) results = results.slice(skip, skip + limit);

    return {
      data: results,
      total,
      page,
      limit,
    };
  }

  /**
   * UPDATE SUPPLIER
   */
  async updateSupplier(
    businessId: string,
    supplierId: string,
    userId: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    this.logger.log(`[SUPPLIERS] Updating supplier: ${supplierId}`);

    // Verify supplier exists
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
      },
      include: {
        contacts: true,
        address: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Supplier and child records must update atomically so a failed contact/address
    // write cannot leave the account half-saved.
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.secondaryPhone !== undefined && { secondaryPhone: dto.secondaryPhone }),
          ...(dto.bankName !== undefined && { bankName: dto.bankName }),
          ...(dto.bankAccountNumber !== undefined && { bankAccountNumber: dto.bankAccountNumber }),
          ...(dto.bankSwiftCode !== undefined && { bankSwiftCode: dto.bankSwiftCode }),
          ...(dto.taxId !== undefined && { taxId: dto.taxId }),
          ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
          ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      if (dto.contacts !== undefined) {
        await tx.supplierContact.deleteMany({ where: { supplierId } });
        for (let i = 0; i < dto.contacts.length; i++) {
          const contact = dto.contacts[i];
          await tx.supplierContact.create({
            data: {
              id: uuid(),
              supplierId,
              firstName: contact.firstName ?? supplier.contacts[0]?.firstName ?? '',
              lastName: contact.lastName ?? supplier.contacts[0]?.lastName ?? '',
              email: contact.email ?? supplier.contacts[0]?.email ?? '',
              phone: contact.phone ?? supplier.contacts[0]?.phone ?? '',
              position: contact.position,
              isPrimary: i === 0,
            },
          });
        }
      }

      if (dto.address !== undefined) {
        if (dto.address === null) {
          await tx.supplierAddress.deleteMany({ where: { supplierId } });
        } else if (supplier.address) {
          await tx.supplierAddress.update({
            where: { id: supplier.address.id },
            data: {
              ...(dto.address.street !== undefined && { street: dto.address.street }),
              ...(dto.address.city !== undefined && { city: dto.address.city }),
              ...(dto.address.region !== undefined && { region: dto.address.region }),
              ...(dto.address.postalCode !== undefined && { postalCode: dto.address.postalCode }),
              ...(dto.address.country !== undefined && { country: dto.address.country }),
            },
          });
        } else {
          await tx.supplierAddress.create({
            data: {
              id: uuid(), supplierId,
              street: dto.address.street || '', city: dto.address.city || '',
              region: dto.address.region || '', postalCode: dto.address.postalCode || '',
              country: dto.address.country,
            },
          });
        }
      }
    });

    this.logger.log(`[SUPPLIERS] Supplier updated: ${supplierId}`);

    return this.getSupplierById(businessId, supplierId);
  }

  /**
   * DELETE SUPPLIER
   * Only if no purchase orders
   */
  async deleteSupplier(
    businessId: string,
    supplierId: string,
    userId: string,
  ): Promise<{ message: string }> {
    this.logger.log(`[SUPPLIERS] Deleting supplier: ${supplierId}`);

    await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, businessId },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      const [poCount, paymentCount, returnCount] = await Promise.all([
        tx.purchaseOrder.count({ where: { supplierId, businessId } }),
        tx.payment.count({ where: { supplierId, businessId } }),
        tx.purchaseReturn.count({ where: { supplierId, businessId } }),
      ]);

      if (poCount > 0 || paymentCount > 0 || returnCount > 0 || Number(supplier.openingBalance) !== 0) {
        throw new BadRequestException(
          'Cannot delete a supplier with account history or an opening balance. Deactivate the supplier to preserve its records.',
        );
      }

      await tx.supplierContact.deleteMany({ where: { supplierId } });
      await tx.supplierAddress.deleteMany({ where: { supplierId } });
      await tx.supplier.delete({ where: { id: supplierId } });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'DELETE',
          entityType: 'SUPPLIER',
          entityId: supplierId,
          description: `Deleted supplier ${supplierId}`,
        },
      });
    });

    this.logger.log(`[SUPPLIERS] Supplier deleted: ${supplierId}`);

    return { message: 'Supplier deleted successfully' };
  }

  /**
   * GET SUPPLIER STATEMENT (Aging Report)
   */
  async getSupplierStatement(
    businessId: string,
    supplierId: string,
    month?: string,
  ): Promise<SupplierStatementDto> {
    this.logger.log(`[SUPPLIERS] Getting statement for supplier: ${supplierId}`);

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const period = month || new Date().toISOString().slice(0, 7); // YYYY-MM

    // Get all transactions for the period
    const startDate = new Date(`${period}-01`);
    const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));

    // Get purchase orders
    const [purchaseOrders, payments, returns, priorPurchases, priorPayments, priorReturns] =
      await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: {
            businessId,
            supplierId,
            status: SUPPLIER_PO_STATUSES,
            createdAt: {
              gte: startDate,
              lt: endDate,
            },
          },
        }),
        this.prisma.payment.findMany({
          where: {
            businessId,
            supplierId,
            status: { in: ACTIVE_PAYMENT_STATUSES },
            paymentDate: { gte: startDate, lt: endDate },
          },
        }),
        this.prisma.purchaseReturn.findMany({
          where: {
            businessId,
            supplierId,
            status: 'APPROVED',
            approvedAt: { gte: startDate, lt: endDate },
          },
        }),
        this.prisma.purchaseOrder.aggregate({
          where: {
            businessId,
            supplierId,
            status: SUPPLIER_PO_STATUSES,
            createdAt: { lt: startDate },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            businessId,
            supplierId,
            status: { in: ACTIVE_PAYMENT_STATUSES },
            paymentDate: { lt: startDate },
          },
          _sum: { amount: true },
        }),
        this.prisma.purchaseReturn.aggregate({
          where: {
            businessId,
            supplierId,
            status: 'APPROVED',
            approvedAt: { lt: startDate },
          },
          _sum: { totalReturnAmount: true },
        }),
      ]);

    const purchases = roundMoney(purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0));
    const totalPayments = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
    const totalReturns = roundMoney(returns.reduce((sum, ret) => sum + ret.totalReturnAmount, 0));
    const openingBalance = roundMoney(
      (supplier.openingBalance || 0) +
        (priorPurchases._sum.totalAmount || 0) -
        (priorPayments._sum.amount || 0) -
        (priorReturns._sum.totalReturnAmount || 0),
    );

    // Build invoice list
    const invoices: {
      date: Date;
      invoiceNumber: string;
      amount: number;
      type: 'PURCHASE' | 'PAYMENT' | 'RETURN';
    }[] = [];

    purchaseOrders.forEach((po) => {
      invoices.push({
        date: po.createdAt,
        invoiceNumber: (po as any).orderNumber || (po as any).poNumber || po.id,
        amount: roundMoney(po.totalAmount),
        type: 'PURCHASE',
      });
    });

    payments.forEach((p) => {
      invoices.push({
        date: p.paymentDate,
        invoiceNumber: (p as any).paymentNumber || p.id,
        amount: roundMoney(p.amount),
        type: 'PAYMENT',
      });
    });

    returns.forEach((ret) => {
      invoices.push({
        date: ret.approvedAt || ret.updatedAt,
        invoiceNumber: ret.returnNumber,
        amount: -roundMoney(ret.totalReturnAmount),
        type: 'RETURN',
      });
    });

    // Sort by date
    invoices.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      supplierId,
      supplierName: supplier.name,
      period,
      openingBalance,
      purchases,
      payments: totalPayments,
      returns: totalReturns,
      closingBalance: roundMoney(openingBalance + purchases - totalPayments - totalReturns),
      invoices,
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Generate supplier code
   */
  private async _generateSupplierCode(businessId: string): Promise<string> {
    const count = await this.prisma.supplier.count({
      where: { businessId },
    });

    return `SUP-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Calculate total purchases from supplier
   */
  private async _calculateSupplierPurchases(
    businessId: string,
    supplierId: string,
  ): Promise<number> {
    const result = await this.prisma.purchaseOrder.aggregate({
      where: { businessId, supplierId, status: SUPPLIER_PO_STATUSES },
      _sum: {
        totalAmount: true,
      },
    });

    return roundMoney(result._sum.totalAmount || 0);
  }

  /**
   * Calculate total payments to supplier
   */
  private async _calculateSupplierPayments(
    businessId: string,
    supplierId: string,
  ): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: { businessId, supplierId, status: { in: ACTIVE_PAYMENT_STATUSES } },
      _sum: {
        amount: true,
      },
    });

    return roundMoney(result._sum.amount || 0);
  }

  private async _calculateSupplierReturns(businessId: string, supplierId: string): Promise<number> {
    const result = await this.prisma.purchaseReturn.aggregate({
      where: { businessId, supplierId, status: 'APPROVED' },
      _sum: { totalReturnAmount: true },
    });
    return roundMoney(result._sum.totalReturnAmount || 0);
  }

  /**
   * Format supplier response
   */
  private _formatSupplierResponse(
    supplier: any,
    contacts: any[],
    address: any,
    financials?: { totalPurchased: number; totalPaid: number; totalReturned: number; lastPurchaseDate?: Date | null },
  ): SupplierResponseDto {
    const totalPurchased = roundMoney(financials?.totalPurchased || 0);
    const totalPaid = roundMoney(financials?.totalPaid || 0);
    const totalReturned = roundMoney(financials?.totalReturned || 0);
    const openingBalance = roundMoney(supplier.openingBalance || 0);
    const creditLimit = supplier.creditLimit || 0;
    const outstandingBalance = roundMoney(
      openingBalance + totalPurchased - totalPaid - totalReturned,
    );
    const creditUtilization = creditLimit > 0 ? (outstandingBalance / creditLimit) * 100 : 0;

    return {
      id: supplier.id,
      businessId: supplier.businessId,
      name: supplier.name,
      supplierCode: supplier.supplierCode,
      description: supplier.description,
      email: supplier.email,
      phone: supplier.phone,
      secondaryPhone: supplier.secondaryPhone,
      address: address
        ? {
            id: address.id,
            street: address.street,
            city: address.city,
            region: address.region,
            postalCode: address.postalCode,
            country: address.country,
          }
        : undefined,
      contacts: (contacts || []).map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        position: c.position,
        isPrimary: c.isPrimary,
      })),
      bankName: supplier.bankName,
      bankAccountNumber: supplier.bankAccountNumber,
      bankSwiftCode: supplier.bankSwiftCode,
      taxId: supplier.taxId,
      creditLimit,
      paymentTerms: supplier.paymentTerms,
      openingBalance,
      totalPurchased,
      totalPaid,
      totalReturned,
      outstandingBalance,
      creditUtilization: Math.round(creditUtilization * 100) / 100,
      isActive: supplier.isActive,
      lastPurchaseDate: financials?.lastPurchaseDate || undefined,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  private async _getLastPurchaseDate(businessId: string, supplierId: string): Promise<Date | null> {
    const latest = await this.prisma.purchaseOrder.findFirst({
      where: { businessId, supplierId, status: SUPPLIER_PO_STATUSES },
      orderBy: { orderDate: 'desc' },
      select: { orderDate: true },
    });
    return latest?.orderDate || null;
  }
}
