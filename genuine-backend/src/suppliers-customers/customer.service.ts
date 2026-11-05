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
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerResponseDto,
  CustomerFilterDto,
  CustomerStatementDto,
} from './dto';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  /**
   * CREATE CUSTOMER
   * 1. Generate customer code if not provided
   * 2. Verify unique name + code
   * 3. Create customer
   * 4. Create contacts
   * 5. Create address
   */
  async createCustomer(
    businessId: string,
    userId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    this.logger.log(`[CUSTOMERS] Creating customer: ${dto.name}`);
    const photo = this.decodeCustomerPhoto(dto.photo);

    // 1. Generate customer code
    const customerCode = dto.customerCode || (await this._generateCustomerCode(businessId));

    // 2. Check unique name + code
    const existing = await this.prisma.customer.findFirst({
      where: {
        businessId,
        OR: [{ name: dto.name }, { customerCode }],
      },
    });

    if (existing) {
      throw new ConflictException('Customer name or code already exists');
    }

    // Keep the parent, optional relations, and audit trail in one transaction.
    let customer: { id: string };
    try {
      customer = await this.prisma.$transaction(async (tx) => {
        const status = dto.status || (dto.isActive ? 'ACTIVE' : 'SUSPENDED');
        const created = await tx.customer.create({
          data: {
            id: uuid(), businessId, name: dto.name.trim(), customerCode,
            customerType: dto.customerType, description: dto.description?.trim() || null,
            email: dto.email.trim().toLowerCase(), phone: dto.phone.trim(),
            secondaryPhone: dto.secondaryPhone?.trim() || null, taxId: dto.taxId?.trim() || null,
            creditLimit: dto.creditLimit, paymentTerms: dto.paymentTerms,
            openingBalance: dto.openingBalance, isActive: status === 'ACTIVE', status,
            ...(dto.contacts?.length ? { contacts: { create: dto.contacts.map((contact, index) => ({
              firstName: contact.firstName.trim(), lastName: contact.lastName.trim(),
              email: contact.email.trim().toLowerCase(), phone: contact.phone.trim(),
              position: contact.position?.trim() || null, isPrimary: index === 0,
            })) } } : {}),
            ...(dto.address ? { address: { create: {
              street: dto.address.street.trim(), city: dto.address.city.trim(),
              region: dto.address.region.trim(), postalCode: dto.address.postalCode.trim(),
              country: dto.address.country?.trim() || null,
            } } } : {}),
          },
          select: { id: true },
        });
        if (photo) {
          await tx.customerPhoto.create({
            data: { id: uuid(), businessId, customerId: created.id, data: photo, contentType: 'image/webp' },
          });
        }
        await tx.auditLog.create({ data: {
          businessId, userId, action: 'CREATE', entityType: 'CUSTOMER', entityId: created.id,
          description: `Created customer ${customerCode}`,
        } });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Customer name or code already exists');
      throw error;
    }

    this.logger.log(`[CUSTOMERS] Customer created: ${customer.id} (Code: ${customerCode})`);

    return this.getCustomerById(businessId, customer.id);
  }

  /**
   * GET CUSTOMER BY ID
   */
  async getCustomerById(businessId: string, customerId: string): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
      include: {
        contacts: true,
        address: true,
        photo: { select: { id: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate financials
    const financials = await this._calculateCustomerFinancials(businessId, customerId);

    return this._formatCustomerResponse(customer, customer.contacts || [], customer.address, {
      ...financials,
    });
  }

  /**
   * GET ALL CUSTOMERS
   * With filtering, search, pagination
   */
  async getAllCustomers(
    businessId: string,
    filter: CustomerFilterDto,
  ): Promise<{ data: CustomerResponseDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Math.floor(Number(filter.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(filter.limit) || 20)));
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: Prisma.CustomerWhereInput = {
      businessId,
      ...(filter.customerType && { customerType: filter.customerType }),
      ...(filter.paymentTerms && { paymentTerms: filter.paymentTerms }),
      ...(filter.search && {
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { customerCode: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
          { phone: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Filter by status
    if (filter.status) {
      if (filter.status === 'ACTIVE') {
        where.status = 'ACTIVE';
      } else if (filter.status === 'INACTIVE' || filter.status === 'SUSPENDED') {
        where.status = 'SUSPENDED';
      } else if (filter.status === 'BLACKLISTED' || filter.status === 'ARCHIVED') {
        where.status = filter.status;
      }
      // OVERDUE will be filtered in memory
    }

    // Build sort
    let orderBy: Prisma.CustomerOrderByWithRelationInput = { createdAt: 'desc' };
    if (filter.sortBy) {
      const direction = filter.sortOrder === 'asc' ? 'asc' : 'desc';
      switch (filter.sortBy) {
        case 'name':
          orderBy = { name: direction };
          break;
        case 'outstanding':
          // Will sort in memory
          break;
        case 'lastSale':
          orderBy = { createdAt: direction };
          break;
        case 'createdAt':
          orderBy = { createdAt: direction };
          break;
      }
    }

    // Query customers
    const needsMemoryFilterOrSort = filter.status === 'OVERDUE' || filter.sortBy === 'outstanding' || filter.sortBy === 'lastSale';
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          contacts: true,
          address: true,
          photo: { select: { id: true } },
        },
        orderBy,
        ...(needsMemoryFilterOrSort ? {} : { skip, take: limit }),
      }),
      this.prisma.customer.count({ where }),
    ]);

    // Get financials for all customers
    const customersWithFinancials = await Promise.all(
      customers.map(async (customer) => {
        const financials = await this._calculateCustomerFinancials(businessId, customer.id);

        return {
          customer,
          ...financials,
        };
      }),
    );

    // Format responses
    let results = customersWithFinancials.map((item) =>
      this._formatCustomerResponse(
        item.customer,
        item.customer.contacts || [],
        item.customer.address,
        {
          totalSales: item.totalSales,
          totalPaid: item.totalPaid,
          totalReturned: item.totalReturned,
          lastSaleDate: item.lastSaleDate,
        },
      ),
    );

    // Apply overdue filter if needed
    if (filter.status === 'OVERDUE') {
      results = results.filter((c) => c.outstandingBalance > 0);
    }

    // Sort by outstanding if requested
    if (filter.sortBy === 'outstanding') {
      results.sort((a, b) => {
        const direction = filter.sortOrder === 'asc' ? 1 : -1;
        return (a.outstandingBalance - b.outstandingBalance) * direction;
      });
    }

    if (filter.sortBy === 'lastSale') {
      const direction = filter.sortOrder === 'asc' ? 1 : -1;
      results.sort((a, b) => direction * ((a.lastSaleDate?.getTime() || 0) - (b.lastSaleDate?.getTime() || 0)));
    }

    const resultTotal = needsMemoryFilterOrSort ? results.length : total;
    if (needsMemoryFilterOrSort) results = results.slice(skip, skip + limit);

    return {
      data: results,
      total: resultTotal,
      page,
      limit,
    };
  }

  /**
   * UPDATE CUSTOMER
   */
  async updateCustomer(
    businessId: string,
    customerId: string,
    userId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    this.logger.log(`[CUSTOMERS] Updating customer: ${customerId}`);
    const photo: Buffer | undefined = dto.photo ? this.decodeCustomerPhoto(dto.photo) : undefined;

    // Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
      include: {
        contacts: true,
        address: true,
        photo: { select: { id: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const status = dto.status ?? (dto.isActive === undefined ? undefined : dto.isActive ? 'ACTIVE' : 'SUSPENDED');
      await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.customerType !== undefined && { customerType: dto.customerType }),
          ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
          ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
          ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
          ...(dto.secondaryPhone !== undefined && { secondaryPhone: dto.secondaryPhone?.trim() || null }),
          ...(dto.taxId !== undefined && { taxId: dto.taxId?.trim() || null }),
          ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
          ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(status !== undefined && { status, isActive: status === 'ACTIVE' }),
        },
      });

      if (dto.contacts !== undefined) {
        await tx.customerContact.deleteMany({ where: { customerId } });
        if (dto.contacts.length) await tx.customerContact.createMany({ data: dto.contacts.map((contact, index) => ({
          id: uuid(), customerId, firstName: contact.firstName?.trim() || '',
          lastName: contact.lastName?.trim() || '', email: contact.email?.trim().toLowerCase() || '',
          phone: contact.phone?.trim() || '', position: contact.position?.trim() || null,
          isPrimary: index === 0,
        })) });
      }

      if (dto.address === null) await tx.customerAddress.deleteMany({ where: { customerId } });
      else if (dto.address) {
        const addressData = {
          street: dto.address.street?.trim() || '', city: dto.address.city?.trim() || '',
          region: dto.address.region?.trim() || '', postalCode: dto.address.postalCode?.trim() || '',
          country: dto.address.country?.trim() || null,
        };
        await tx.customerAddress.upsert({
          where: { customerId }, create: { id: uuid(), customerId, ...addressData }, update: addressData,
        });
      }
      if (dto.photo === null) {
        await tx.customerPhoto.deleteMany({ where: { businessId, customerId } });
      } else if (photo) {
        await tx.customerPhoto.upsert({
          where: { customerId },
          create: { id: uuid(), businessId, customerId, data: photo, contentType: 'image/webp' },
          update: { id: uuid(), data: photo, contentType: 'image/webp' },
        });
      }
      await tx.auditLog.create({ data: {
        businessId, userId, action: 'UPDATE', entityType: 'CUSTOMER', entityId: customerId,
        description: `Updated customer ${customer.customerCode}`,
      } });
    });

    this.logger.log(`[CUSTOMERS] Customer updated: ${customerId}`);

    return this.getCustomerById(businessId, customerId);
  }

  async getCustomerPhoto(businessId: string, customerId: string) {
    const photo = await this.prisma.customerPhoto.findFirst({
      where: { businessId, customerId, customer: { businessId } },
      select: { data: true, contentType: true },
    });
    if (!photo) throw new NotFoundException('Customer photo not found');
    return photo;
  }

  /**
   * DELETE CUSTOMER
   * Only if no sales invoices
   */
  async deleteCustomer(
    businessId: string,
    customerId: string,
    userId: string,
  ): Promise<{ message: string }> {
    this.logger.log(`[CUSTOMERS] Deleting customer: ${customerId}`);

    await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const [invoiceCount, paymentCount, returnCount] = await Promise.all([
        tx.salesInvoice.count({ where: { customerId, businessId } }),
        tx.payment.count({ where: { customerId, businessId } }),
        tx.salesReturn.count({ where: { businessId, OR: [{ customerId }, { invoice: { customerId } }] } }),
      ]);

      if (invoiceCount || paymentCount || returnCount) {
        throw new BadRequestException('Cannot delete a customer with sales, payments or returns. Change the customer status instead.');
      }

      await tx.customerContact.deleteMany({ where: { customerId } });
      await tx.customerAddress.deleteMany({ where: { customerId } });
      await tx.customer.delete({ where: { id: customerId } });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'DELETE',
          entityType: 'CUSTOMER',
          entityId: customerId,
          description: `Deleted customer ${customerId}`,
        },
      });
    });

    this.logger.log(`[CUSTOMERS] Customer deleted: ${customerId}`);

    return { message: 'Customer deleted successfully' };
  }

  /**
   * GET CUSTOMER STATEMENT (Aging Report)
   */
  async getCustomerStatement(
    businessId: string,
    customerId: string,
    month?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<CustomerStatementDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if ((dateFrom && !dateTo) || (!dateFrom && dateTo))
      throw new BadRequestException('Provide both dateFrom and dateTo');
    if ((month && (dateFrom || dateTo)) || (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))
      throw new BadRequestException('Provide a valid month or a dateFrom/dateTo range');
    const startDate = dateFrom
      ? this.statementDate(dateFrom, false)
      : month
        ? new Date(`${month}-01T00:00:00.000Z`)
        : new Date(`${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`);
    const endDate = dateTo
      ? this.statementDate(dateTo, true)
      : new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
    if (startDate >= endDate) throw new BadRequestException('dateFrom must be on or before dateTo');
    const invoiceFilter = {
      businessId,
      customerId,
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
    };
    const returnFilter = {
      businessId,
      status: { in: ['RECEIVED', 'COMPLETED'] },
      invoice: { businessId, customerId },
    };
    const paymentFilter = {
      businessId,
      customerId,
      status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
    };
    const [periodSales, priorSales, periodPayments, priorPayments, periodReturns, priorReturns] =
      await Promise.all([
        this.prisma.salesInvoice.findMany({
          where: { ...invoiceFilter, issuedDate: { gte: startDate, lt: endDate } },
          select: { invoiceNumber: true, totalAmount: true, issuedDate: true },
        }),
        this.prisma.salesInvoice.aggregate({
          where: { ...invoiceFilter, issuedDate: { lt: startDate } },
          _sum: { totalAmount: true },
        }),
        this.prisma.payment.findMany({
          where: { ...paymentFilter, paymentDate: { gte: startDate, lt: endDate } },
          select: { paymentNumber: true, amount: true, paymentDate: true },
        }),
        this.prisma.payment.aggregate({
          where: { ...paymentFilter, paymentDate: { lt: startDate } },
          _sum: { amount: true },
        }),
        this.prisma.salesReturn.findMany({
          where: { ...returnFilter, returnDate: { gte: startDate, lt: endDate } },
          select: { returnNumber: true, totalAmount: true, returnDate: true },
        }),
        this.prisma.salesReturn.aggregate({
          where: { ...returnFilter, returnDate: { lt: startDate } },
          _sum: { totalAmount: true },
        }),
      ]);
    const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const sales = roundMoney(periodSales.reduce((sum, row) => sum + row.totalAmount, 0));
    const totalPayments = roundMoney(periodPayments.reduce((sum, row) => sum + row.amount, 0));
    const returns = roundMoney(periodReturns.reduce((sum, row) => sum + row.totalAmount, 0));
    const openingBalance = roundMoney(
      (customer.openingBalance || 0) +
        (priorSales._sum.totalAmount || 0) -
        (priorPayments._sum.amount || 0) -
        (priorReturns._sum.totalAmount || 0),
    );
    const entries: CustomerStatementDto['invoices'] = [
      ...periodSales
        .filter((row) => row.issuedDate)
        .map((row) => ({
          date: row.issuedDate!,
          invoiceNumber: row.invoiceNumber,
          amount: row.totalAmount,
          type: 'SALE' as const,
        })),
      ...periodPayments.map((row) => ({
        date: row.paymentDate,
        invoiceNumber: row.paymentNumber,
        amount: row.amount,
        type: 'PAYMENT' as const,
      })),
      ...periodReturns.map((row) => ({
        date: row.returnDate,
        invoiceNumber: row.returnNumber,
        amount: row.totalAmount,
        type: 'RETURN' as const,
      })),
    ].sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() || a.invoiceNumber.localeCompare(b.invoiceNumber),
    );
    const period =
      dateFrom && dateTo
        ? `${dateFrom} to ${dateTo}`
        : month || startDate.toISOString().slice(0, 7);
    return {
      customerId,
      customerName: customer.name,
      period,
      openingBalance,
      sales,
      payments: totalPayments,
      returns,
      closingBalance: roundMoney(openingBalance + sales - totalPayments - returns),
      invoices: entries,
    };
  }

  async getCustomerActivities(businessId: string, customerId: string, limit = 30) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId }, select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 30)));
    return this.prisma.customerActivity.findMany({
      where: { businessId, customerId }, orderBy: { createdAt: 'desc' }, take: safeLimit,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async addCustomerActivity(
    businessId: string,
    customerId: string,
    userId: string,
    dto: { type: string; description: string; reference?: string },
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId }, select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const description = dto.description.trim();
    if (!description) throw new BadRequestException('Interaction details are required.');
    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.customerActivity.create({ data: {
        id: uuid(), businessId, customerId, userId, type: dto.type,
        description, reference: dto.reference?.trim() || null,
      } });
      await tx.auditLog.create({ data: {
        businessId, userId, action: 'CREATE', entityType: 'CUSTOMER_ACTIVITY', entityId: activity.id,
        description: `Added ${dto.type.toLowerCase()} activity to customer ${customerId}`,
      } });
      return activity;
    });
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private statementDate(value: string, exclusiveEnd: boolean): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('Dates must use YYYY-MM-DD');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new BadRequestException('Invalid calendar date');
    if (exclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
    return date;
  }

  /**
   * Generate customer code
   */
  private async _generateCustomerCode(businessId: string): Promise<string> {
    const count = await this.prisma.customer.count({
      where: { businessId },
    });

    return `CUST-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Calculate total sales to customer
   */
  private async _calculateCustomerFinancials(businessId: string, customerId: string) {
    const [sales, payments, returns, lastSale] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: {
          businessId,
          customerId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          businessId,
          customerId,
          status: { in: ['RECORDED', 'VERIFIED', 'RECONCILED', 'COMPLETED'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.salesReturn.aggregate({
        where: {
          businessId,
          status: { in: ['RECEIVED', 'COMPLETED'] },
          OR: [
            { customerId, businessId },
            { customerId: null, invoice: { businessId, customerId } },
          ],
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: { businessId, customerId, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] } },
        _max: { issuedDate: true },
      }),
    ]);
    return {
      totalSales: sales._sum.totalAmount || 0,
      totalPaid: payments._sum.amount || 0,
      totalReturned: returns._sum.totalAmount || 0,
      lastSaleDate: lastSale._max.issuedDate || undefined,
    };
  }

  /**
   * Format customer response
   */
  private _formatCustomerResponse(
    customer: any,
    contacts: any[],
    address: any,
    financials?: { totalSales: number; totalPaid: number; totalReturned: number; lastSaleDate?: Date },
  ): CustomerResponseDto {
    const totalSales = financials?.totalSales || 0;
    const totalPaid = financials?.totalPaid || 0;
    const totalReturned = financials?.totalReturned || 0;
    const openingBalance = customer.openingBalance || 0;
    const creditLimit = customer.creditLimit || 0;
    const outstandingBalance = openingBalance + totalSales - totalPaid - totalReturned;
    const creditUtilization = creditLimit > 0 ? (outstandingBalance / creditLimit) * 100 : 0;

    return {
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      customerCode: customer.customerCode,
      customerType: customer.customerType,
      description: customer.description,
      email: customer.email,
      phone: customer.phone,
      secondaryPhone: customer.secondaryPhone,
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
      taxId: customer.taxId,
      creditLimit,
      paymentTerms: customer.paymentTerms,
      openingBalance,
      totalSales,
      totalPaid,
      totalReturned,
      outstandingBalance,
      creditUtilization: Math.round(creditUtilization * 100) / 100,
      isActive: customer.isActive,
      status: customer.status || (customer.isActive ? 'ACTIVE' : 'SUSPENDED'),
      photoId: customer.photo?.id,
      lastSaleDate: financials?.lastSaleDate,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  private decodeCustomerPhoto(value?: string | null): Buffer | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new BadRequestException('Customer photo must be a valid WebP image');
    const data = Buffer.from(match[1], 'base64');
    if (
      data.length < 16 ||
      data.length > 128 * 1024 ||
      data.toString('ascii', 0, 4) !== 'RIFF' ||
      data.readUInt32LE(4) !== data.length - 8 ||
      data.toString('ascii', 8, 12) !== 'WEBP' ||
      !['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('ascii', 12, 16))
    ) {
      throw new BadRequestException('Customer photo is invalid or exceeds 128 KB after compression');
    }
    return data;
  }
}
