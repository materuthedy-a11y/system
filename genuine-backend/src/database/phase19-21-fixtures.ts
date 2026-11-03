import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://localhost:3002/api/v1';

function assertSafeTarget() {
  if (process.env.NODE_ENV !== 'development' || !process.env.DATABASE_URL) {
    throw new Error('Fixtures require NODE_ENV=development and DATABASE_URL.');
  }
  const url = new URL(process.env.DATABASE_URL);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || database !== 'genuine') {
    throw new Error('Fixtures only run against localhost database genuine.');
  }
}

async function request<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await response.json()) as { data?: T; message?: string };
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${json.message ?? 'API error'}`);
  }
  return json.data as T;
}

async function main() {
  assertSafeTarget();

  const business = await prisma.business.findUnique({ where: { name: 'Genuine Liquor Store' } });
  const owner = await prisma.user.findUnique({
    where: { email: 'admin@genuineliquor.co.tz' },
    include: { userRoles: { include: { role: true } } },
  });
  if (!business || !owner || owner.businessId !== business.id || !owner.isActive) {
    throw new Error('Seeded Genuine Liquor Store owner was not found; no fixtures were created.');
  }

  const [category, supplier, location, bottle, baseProduct, customer, cash] = await Promise.all([
    prisma.category.findFirst({ where: { businessId: business.id, name: 'Beverages' } }),
    prisma.supplier.findFirst({ where: { businessId: business.id, supplierCode: 'SUP-00001' } }),
    prisma.location.findFirst({ where: { businessId: business.id, code: 'MAIN' } }),
    prisma.unit.findFirst({ where: { name: 'Bottle', isActive: true } }),
    prisma.product.findFirst({ where: { businessId: business.id, sku: 'BEV-001' } }),
    prisma.customer.findFirst({ where: { businessId: business.id, customerCode: 'CUST-00001' } }),
    prisma.paymentMethod.findFirst({ where: { businessId: business.id, name: 'Cash', isActive: true } }),
  ]);
  if (!category || !supplier || !location || !bottle || !baseProduct || !customer || !cash) {
    throw new Error('A seeded reference record is missing; no phase fixtures were created.');
  }

  const tenantB = await prisma.business.upsert({
    where: { name: 'PH19 Tenant Test Business B' },
    create: {
      name: 'PH19 Tenant Test Business B',
      businessType: 'Distribution',
      description: 'Synthetic second tenant for development isolation fixtures.',
      currency: 'TZS',
      taxPercentage: 18,
      allowNegativeStock: false,
      costingMethod: 'WEIGHTED_AVERAGE',
    },
    update: {},
  });
  const tenantPermissions = [
    ['products.view', 'products', 'view'],
    ['products.create', 'products', 'create'],
    ['customers.view', 'customers', 'view'],
    ['sales.view', 'sales', 'view'],
    ['sales.create', 'sales', 'create'],
    ['sales.edit', 'sales', 'edit'],
    ['sales.approve', 'sales', 'approve'],
    ['sales.cancel', 'sales', 'cancel'],
    ['sales.discount', 'sales', 'discount'],
    ['payments.create', 'payments', 'create'],
    ['purchases.view', 'purchases', 'view'],
    ['purchases.create', 'purchases', 'create'],
    ['purchases.edit', 'purchases', 'edit'],
    ['purchases.approve', 'purchases', 'approve'],
    ['purchases.cancel', 'purchases', 'cancel'],
  ];
  const tenantPermissionIds: string[] = [];
  for (const [key, permissionCategory, action] of tenantPermissions) {
    const permission = await prisma.permission.upsert({
      where: { businessId_key: { businessId: tenantB.id, key } },
      create: { businessId: tenantB.id, key, name: key.toUpperCase(), category: permissionCategory, action, isSystem: true },
      update: {},
      select: { id: true },
    });
    tenantPermissionIds.push(permission.id);
  }
  const tenantOwnerRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: tenantB.id, name: 'Owner' } },
    create: {
      businessId: tenantB.id,
      name: 'Owner',
      description: 'Synthetic tenant test owner.',
      isDefault: true,
      isSystem: true,
      permissions: { connect: tenantPermissionIds.map((id) => ({ id })) },
    },
    update: { permissions: { connect: tenantPermissionIds.map((id) => ({ id })) } },
  });
  const tenantBEmail = 'ph19.tenantb@example.test';
  let tenantBUser = await prisma.user.findUnique({ where: { email: tenantBEmail } });
  if (!tenantBUser) {
    tenantBUser = await prisma.user.create({
      data: {
        businessId: tenantB.id,
        email: tenantBEmail,
        passwordHash: await bcrypt.hash('PH19test!2026', 10),
        firstName: 'PH19',
        lastName: 'Tenant B QA',
        isActive: true,
        isVerified: true,
        userRoles: { create: { roleId: tenantOwnerRole.id } },
      },
    });
  }
  const tenantCategory = await prisma.category.upsert({
    where: { businessId_name: { businessId: tenantB.id, name: 'PH19 Tenant Test Category' } },
    create: { businessId: tenantB.id, name: 'PH19 Tenant Test Category' },
    update: {},
  });
  const tenantSupplier = await prisma.supplier.upsert({
    where: { businessId_supplierCode: { businessId: tenantB.id, supplierCode: 'PH19-B-SUP-001' } },
    create: {
      businessId: tenantB.id,
      name: 'PH19 Tenant B Supplier',
      supplierCode: 'PH19-B-SUP-001',
      email: 'ph19-supplier-b@example.test',
      phone: '+255700000019',
      paymentTerms: 'NET-30',
      isActive: true,
    },
    update: {},
  });
  const tenantLocation = await prisma.location.upsert({
    where: { businessId_code: { businessId: tenantB.id, code: 'PH19-B-MAIN' } },
    create: { businessId: tenantB.id, name: 'PH19 Tenant B Warehouse', code: 'PH19-B-MAIN', type: 'WAREHOUSE', managerId: tenantBUser.id },
    update: {},
  });
  const tenantProduct = await prisma.product.upsert({
    where: { businessId_sku: { businessId: tenantB.id, sku: 'PH19-TENANT-B-001' } },
    create: {
      businessId: tenantB.id,
      sku: 'PH19-TENANT-B-001',
      name: 'PH19 Tenant B Isolation Product',
      categoryId: tenantCategory.id,
      supplierId: tenantSupplier.id,
      buyingPrice: 1000,
      sellingPrice: 1500,
      minimumStock: 5,
      reorderLevel: 10,
      defaultUnitId: bottle.id,
      status: 'ACTIVE',
      description: 'Foreign-tenant isolation fixture; synthetic only.',
    },
    update: {},
  });
  await prisma.stockBalance.upsert({
    where: { productId_locationId: { productId: tenantProduct.id, locationId: tenantLocation.id } },
    create: { productId: tenantProduct.id, locationId: tenantLocation.id, quantity: 25 },
    update: {},
  });
  const tenantCustomer = await prisma.customer.upsert({
    where: { businessId_customerCode: { businessId: tenantB.id, customerCode: 'PH19-B-CUST-001' } },
    create: {
      businessId: tenantB.id,
      name: 'PH19 Tenant B Customer',
      customerCode: 'PH19-B-CUST-001',
      customerType: 'RETAIL',
      email: 'ph19-customer-b@example.test',
      phone: '+255700000020',
      paymentTerms: 'NET-30',
      creditLimit: 1000000,
      openingBalance: 0,
      isActive: true,
    },
    update: {},
  });
  const tenantInvoice = await prisma.salesInvoice.findFirst({
    where: { businessId: tenantB.id, referenceNumber: 'PH21-B-TENANT-001' },
    select: { id: true },
  });
  if (!tenantInvoice) {
    const tenantLoginResponse = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tenantBEmail, password: 'PH19test!2026' }),
    });
    const tenantLoginJson = (await tenantLoginResponse.json()) as { data?: { accessToken?: string; user?: { businessId?: string } }; message?: string };
    const tenantToken = tenantLoginJson.data?.accessToken;
    if (!tenantLoginResponse.ok || !tenantToken || tenantLoginJson.data?.user?.businessId !== tenantB.id) {
      throw new Error('Could not authenticate the tenant B fixture user.');
    }
    await request('/sales/invoices', tenantToken, 'POST', {
      customerId: tenantCustomer.id,
      locationId: tenantLocation.id,
      items: [{ productId: tenantProduct.id, quantity: 1, unitPrice: 1500 }],
      paymentTerms: 'NET-30',
      referenceNumber: 'PH21-B-TENANT-001',
      notes: 'Foreign-tenant draft invoice fixture for isolation work.',
    });
  }

  const qaRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'PH21 Salesperson QA' } },
    create: {
      businessId: business.id,
      name: 'PH21 Salesperson QA',
      description: 'Synthetic Phase 21 salesperson fixture role.',
      permissions: {
        connect: await prisma.permission
          .findMany({
            where: {
              businessId: business.id,
              key: { in: ['customers.view', 'products.view', 'sales.view', 'sales.create', 'sales.edit', 'payments.create'] },
            },
            select: { id: true },
          })
          .then((rows) => rows),
      },
    },
    update: {},
  });
  const qaEmail = 'ph21.salesperson@example.test';
  const qa = await prisma.user.findUnique({ where: { email: qaEmail } });
  if (!qa) {
    const passwordHash = await bcrypt.hash('PH21test!2026', 10);
    await prisma.user.create({
      data: {
        businessId: business.id,
        email: qaEmail,
        passwordHash,
        firstName: 'PH21',
        lastName: 'Salesperson QA',
        isActive: true,
        isVerified: true,
        userRoles: { create: { roleId: qaRole.id } },
      },
    });
  }

  const locationSpecs = [
    { code: 'PH21-BR-01', name: 'PH21 Test Branch', type: 'STORE' },
    { code: 'PH19-WH-01', name: 'PH19 Test Warehouse', type: 'WAREHOUSE' },
    { code: 'PH20-EDIT-01', name: 'PH20 Edit QA Location', type: 'STORE' },
  ];
  for (const spec of locationSpecs) {
    await prisma.location.upsert({
      where: { businessId_code: { businessId: business.id, code: spec.code } },
      create: { businessId: business.id, ...spec, managerId: owner.id },
      update: {},
    });
  }
  const branchLocation = await prisma.location.findUnique({
    where: { businessId_code: { businessId: business.id, code: 'PH21-BR-01' } },
  });
  const editLocation = await prisma.location.findUnique({
    where: { businessId_code: { businessId: business.id, code: 'PH20-EDIT-01' } },
  });
  if (!branchLocation || !editLocation) throw new Error('Could not create the phase test locations.');

  const customers = [
    { customerCode: 'PH21-CUST-A', name: 'PH21 Filter Customer Alpha', customerType: 'RETAIL', paymentTerms: 'NET-30', creditLimit: 5000000, isActive: true },
    { customerCode: 'PH21-CUST-B', name: 'PH21 Filter Customer Beta', customerType: 'WHOLESALE', paymentTerms: 'COD', creditLimit: 0, isActive: true },
    { customerCode: 'PH21-CUST-X', name: 'PH21 Inactive Customer', customerType: 'RETAIL', paymentTerms: 'COD', creditLimit: 0, isActive: false },
  ];
  for (let index = 0; index < customers.length; index += 1) {
    const value = customers[index];
    await prisma.customer.upsert({
      where: { businessId_customerCode: { businessId: business.id, customerCode: value.customerCode } },
      create: {
        businessId: business.id,
        ...value,
        email: `ph21-customer-${index + 1}@example.test`,
        phone: `+25570000021${index}`,
      },
      update: {},
    });
  }

  const productSpecs = [
    { sku: 'PH19-BEV-001', name: 'PH19 Premium Soda 330ml', buyingPrice: 900, sellingPrice: 1300, status: 'ACTIVE', quantity: 80 },
    { sku: 'PH19-BEV-002', name: 'PH19 Tonic Water 500ml', buyingPrice: 1200, sellingPrice: 1800, status: 'ACTIVE', quantity: 60 },
    { sku: 'PH19-BEV-003', name: 'PH19 Sparkling Water 750ml', buyingPrice: 1600, sellingPrice: 2400, status: 'ACTIVE', quantity: 45 },
    { sku: 'PH19-INACTIVE-001', name: 'PH19 Inactive Sample Product', buyingPrice: 1000, sellingPrice: 1500, status: 'INACTIVE', quantity: 0 },
    { sku: 'PH21-STOCK-001', name: 'PH21 Stock and Returns Test Product', buyingPrice: 2000, sellingPrice: 3000, status: 'ACTIVE', quantity: 50 },
  ];
  for (const spec of productSpecs) {
    const product = await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: spec.sku } },
      create: {
        businessId: business.id,
        sku: spec.sku,
        name: spec.name,
        categoryId: category.id,
        supplierId: supplier.id,
        buyingPrice: spec.buyingPrice,
        sellingPrice: spec.sellingPrice,
        minimumStock: 5,
        reorderLevel: 10,
        defaultUnitId: bottle.id,
        status: spec.status,
        description: `Synthetic ${spec.sku} phase fixture; development data only.`,
      },
      update: {},
    });
    await prisma.stockBalance.upsert({
      where: { productId_locationId: { productId: product.id, locationId: location.id } },
      create: { productId: product.id, locationId: location.id, quantity: spec.quantity },
      update: {},
    });
    if (spec.status === 'ACTIVE') {
      await prisma.stockBalance.upsert({
        where: { productId_locationId: { productId: product.id, locationId: branchLocation.id } },
        create: { productId: product.id, locationId: branchLocation.id, quantity: spec.quantity },
        update: {},
      });
    }
  }

  const loginResponse = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@genuineliquor.co.tz', password: 'admin123' }),
  });
  const loginJson = (await loginResponse.json()) as { data?: { accessToken?: string; user?: { businessId?: string } }; message?: string };
  const token = loginJson.data?.accessToken;
  if (!loginResponse.ok || !token || loginJson.data?.user?.businessId !== business.id) {
    throw new Error('Cannot authenticate the seeded owner against the target business.');
  }

  const [fixtureProduct, alpha] = await Promise.all([
    prisma.product.findFirst({ where: { businessId: business.id, sku: 'PH21-STOCK-001' } }),
    prisma.customer.findFirst({ where: { businessId: business.id, customerCode: 'PH21-CUST-A' } }),
  ]);
  const [beta, qaUser] = await Promise.all([
    prisma.customer.findFirst({ where: { businessId: business.id, customerCode: 'PH21-CUST-B' } }),
    prisma.user.findUnique({ where: { email: qaEmail }, select: { id: true } }),
  ]);
  if (!fixtureProduct || !alpha || !beta || !qaUser) throw new Error('Could not load the phase test lookups.');

  const invoiceRefs = Array.from({ length: 22 }, (_, index) => `PH21-FILTER:DRAFT-${String(index + 1).padStart(2, '0')}`);
  const invoiceRefsWithLifecycle = [
    ...invoiceRefs,
    'PH21-WORKFLOW:ISSUED',
    'PH21-WORKFLOW:OVERDUE',
    'PH21-WORKFLOW:PARTIAL',
    'PH21-WORKFLOW:PAID',
    'PH21-WORKFLOW:CANCELLED',
    'PH21-WORKFLOW:RETURN',
  ];
  const refsToCreate = invoiceRefsWithLifecycle;
  const day = 24 * 60 * 60 * 1000;
  const invoiceDates = invoiceRefs.map((_, index) => new Date(Date.UTC(2026, 9, 1 + index % 31, 12)).toISOString());
  const referenceInvoices: Array<{ reference: string; id: string; status: string }> = [];

  for (let index = 0; index < refsToCreate.length; index += 1) {
    const reference = refsToCreate[index];
    let invoice = await prisma.salesInvoice.findFirst({
      where: { businessId: business.id, referenceNumber: reference },
      select: { id: true, status: true },
    });
    if (!invoice) {
      const workflow = reference.startsWith('PH21-WORKFLOW:');
      const kind = reference.split(':')[1];
      const invoiceDate = kind === 'OVERDUE'
        ? new Date(Date.UTC(2026, 8, 20, 12)).toISOString()
        : invoiceDates[index % invoiceDates.length];
      const dueDate = kind === 'OVERDUE' ? new Date(Date.UTC(2026, 9, 20, 12)).toISOString() : new Date(Date.UTC(2026, 10, 30, 12)).toISOString();
      const quantity = kind === 'RETURN' ? 2 : 1;
      invoice = await request<{ id: string; status: string }>('/sales/invoices', token, 'POST', {
        customerId: alpha.id,
        locationId: branchLocation.id,
        invoiceDate,
        dueDate,
        items: [{ productId: fixtureProduct.id, quantity, unitPrice: fixtureProduct.sellingPrice }],
        paymentTerms: 'NET-30',
        referenceNumber: reference,
        notes: `${reference} synthetic development fixture for Phase 19–21.`,
      });
    }

    const kind = reference.split(':')[1];
    if (reference.startsWith('PH21-FILTER:') && invoice.status === 'DRAFT') {
      const locations = [location, editLocation, branchLocation];
      invoice = await request(`/sales/invoices/${invoice.id}`, token, 'PATCH', {
        customerId: index % 2 === 0 ? alpha.id : beta.id,
        locationId: locations[index % locations.length].id,
        salespersonId: index % 2 === 0 ? owner.id : qaUser.id,
        paymentTerms: index % 2 === 0 ? 'NET-30' : 'COD',
      });
    }
    if (kind === 'ISSUED' || kind === 'OVERDUE' || kind === 'PARTIAL' || kind === 'PAID' || kind === 'RETURN') {
      if (invoice.status === 'DRAFT') {
        invoice = await request(`/sales/invoices/${invoice.id}/issue`, token, 'POST');
      }
    }
    if (kind === 'CANCELLED' && invoice.status === 'DRAFT') {
      invoice = await request(`/sales/invoices/${invoice.id}/cancel`, token, 'POST', { reason: 'Synthetic Phase 21 fixture cancellation.' });
    }
    referenceInvoices.push({ reference, id: invoice.id, status: invoice.status });
  }

  const paymentMethods = await request<Array<{ id: string; name: string }>>('/payments/methods', token);
  const paymentMethod = paymentMethods.find((method) => method.name === 'Cash');
  if (!paymentMethod) throw new Error('Active Cash payment method is unavailable in the Sales API.');

  for (const kind of ['PARTIAL', 'PAID']) {
    const invoiceRef = `PH21-WORKFLOW:${kind}`;
    const invoice = await prisma.salesInvoice.findFirst({
      where: { businessId: business.id, referenceNumber: invoiceRef },
      select: { id: true, totalAmount: true, totalPaid: true, status: true },
    });
    if (!invoice) throw new Error(`Missing ${invoiceRef} invoice.`);
    const desired = kind === 'PARTIAL' ? Math.floor((invoice.totalAmount / 2) * 100) / 100 : invoice.totalAmount;
    const amount = Math.round((desired - invoice.totalPaid) * 100) / 100;
    if (amount > 0) {
      await request(`/sales/invoices/${invoice.id}/payments`, token, 'POST', {
        amount,
        paymentMethodId: paymentMethod.id,
        paymentNumber: `${invoiceRef}:PAY-01`,
        reference: invoiceRef,
        notes: 'Synthetic development fixture payment.',
      });
    }
  }

  const returnInvoice = await prisma.salesInvoice.findFirst({
    where: { businessId: business.id, referenceNumber: 'PH21-WORKFLOW:RETURN' },
    include: { items: { orderBy: { lineNo: 'asc' }, take: 1 } },
  });
  if (!returnInvoice?.items[0]) throw new Error('Return invoice line was not found.');
  let salesReturn = await prisma.salesReturn.findFirst({
    where: { businessId: business.id, returnNumber: 'PH21-RETURN-001' },
    select: { id: true, status: true },
  });
  if (!salesReturn) {
    salesReturn = await request('/sales/returns', token, 'POST', {
      salesInvoiceId: returnInvoice.id,
      returnNumber: 'PH21-RETURN-001',
      items: [{ salesInvoiceItemId: returnInvoice.items[0].id, quantity: 1, reason: 'CUSTOMER_REQUEST' }],
      authorizeNow: true,
      notes: 'Synthetic Phase 21 return fixture.',
    });
  }
  if (salesReturn.status === 'AUTHORIZED') {
    salesReturn = await request(`/sales/returns/${salesReturn.id}/receive`, token, 'POST');
  }

  async function prepareReturnFixture(reference: string, invoiceReference: string, authorize: boolean) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { businessId: business.id, referenceNumber: invoiceReference },
      include: { items: { orderBy: { lineNo: 'asc' }, take: 1 } },
    });
    if (!invoice?.items[0]) throw new Error(`Missing issued invoice line for ${reference}.`);
    let prepared = await prisma.salesReturn.findFirst({
      where: { businessId: business.id, returnNumber: reference },
      select: { id: true, status: true },
    });
    if (!prepared) {
      prepared = await request('/sales/returns', token, 'POST', {
        salesInvoiceId: invoice.id,
        returnNumber: reference,
        items: [{ salesInvoiceItemId: invoice.items[0].id, quantity: 1, reason: 'CUSTOMER_REQUEST' }],
        notes: `Synthetic ${reference} fixture for checklist step 5.5.`,
      });
    }
    if (authorize && prepared.status === 'DRAFT') {
      prepared = await request(`/sales/returns/${prepared.id}/authorize`, token, 'POST');
    }
    return prepared;
  }
  const rejectDraftFixture = await prepareReturnFixture(
    'PH21-5.5-DRAFT-001',
    'PH21-WORKFLOW:RETURN',
    false,
  );
  const rejectAuthorizedFixture = await prepareReturnFixture(
    'PH21-5.5-AUTH-001',
    'PH21-WORKFLOW:ISSUED',
    true,
  );

  const purchaseProduct = await prisma.product.findFirst({
    where: { businessId: business.id, sku: 'PH19-BEV-001' },
    select: { id: true, buyingPrice: true },
  });
  if (!purchaseProduct) throw new Error('PH19 purchasing product fixture is missing.');

  async function purchaseOrder(reference: string, quantity: number) {
    let order = await prisma.purchaseOrder.findFirst({
      where: { businessId: business.id, poNumber: reference },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!order) {
      await request('/purchases/orders', token, 'POST', {
        poNumber: reference,
        supplierId: supplier.id,
        locationId: location.id,
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 7 * day).toISOString(),
        items: [{ productId: purchaseProduct.id, quantity, unitPrice: purchaseProduct.buyingPrice }],
        notes: `${reference} synthetic development purchase fixture.`,
        referenceNumber: reference,
      });
      order = await prisma.purchaseOrder.findFirst({
        where: { businessId: business.id, poNumber: reference },
        include: { items: { orderBy: { id: 'asc' } } },
      });
    }
    if (!order) throw new Error(`Could not load purchase order ${reference}.`);
    return order;
  }

  const purchaseOrderFixtures: Array<{ reference: string; id: string; status: string }> = [];
  const draftOrder = await purchaseOrder('PH20-SEED-DRAFT-001', 2);
  purchaseOrderFixtures.push({ reference: 'PH20-SEED-DRAFT-001', id: draftOrder.id, status: draftOrder.status });

  const orderedOrder = await purchaseOrder('PH20-SEED-ORDERED-001', 2);
  if (orderedOrder.status === 'DRAFT') await request(`/purchases/orders/${orderedOrder.id}/approve`, token, 'POST');
  purchaseOrderFixtures.push({ reference: 'PH20-SEED-ORDERED-001', id: orderedOrder.id, status: orderedOrder.status });

  async function receiveOrder(reference: string, quantity: number, partial: boolean) {
    const order = await purchaseOrder(reference, quantity);
    if (order.status === 'DRAFT') await request(`/purchases/orders/${order.id}/approve`, token, 'POST');
    let grn = await prisma.goodsReceivedNote.findFirst({
      where: { businessId: business.id, purchaseOrderId: order.id },
      select: { id: true, status: true },
    });
    if (!grn) {
      grn = await request('/purchases/grn', token, 'POST', {
        purchaseOrderId: order.id,
        receivedDate: new Date().toISOString(),
        notes: `${reference} synthetic goods-received fixture.`,
        items: [{
          purchaseOrderItemId: order.items[0].id,
          receivedQuantity: partial ? 1 : quantity,
          acceptedQuantity: partial ? 1 : quantity,
          rejectedQuantity: 0,
          damageQuantity: 0,
        }],
      });
    }
    if (grn.status === 'RECEIVED') await request(`/purchases/grn/${grn.id}/accept`, token, 'POST');
    const finalOrder = await prisma.purchaseOrder.findUnique({ where: { id: order.id }, select: { id: true, status: true } });
    if (!finalOrder) throw new Error(`Could not reload ${reference}.`);
    purchaseOrderFixtures.push({ reference, id: finalOrder.id, status: finalOrder.status });
    return { order: finalOrder, orderItemId: order.items[0].id };
  }

  const partialOrder = await receiveOrder('PH20-SEED-PARTIAL-001', 3, true);
  const fullOrder = await receiveOrder('PH20-SEED-RECEIVED-001', 2, false);

  const cancelledOrder = await purchaseOrder('PH20-SEED-CANCELLED-001', 2);
  if (cancelledOrder.status === 'DRAFT') {
    await request(`/purchases/orders/${cancelledOrder.id}/cancel`, token, 'POST', { reason: 'Synthetic Phase 20 cancellation fixture.' });
  }
  purchaseOrderFixtures.push({ reference: 'PH20-SEED-CANCELLED-001', id: cancelledOrder.id, status: cancelledOrder.status });

  const existingPurchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { businessId: business.id, returnNumber: 'PH20-SEED-RETURN-001' },
    select: { id: true, status: true },
  });
  let purchaseReturn = existingPurchaseReturn;
  if (!purchaseReturn) {
    purchaseReturn = await request('/purchases/returns', token, 'POST', {
      purchaseOrderId: fullOrder.order.id,
      returnNumber: 'PH20-SEED-RETURN-001',
      items: [{ purchaseOrderItemId: fullOrder.orderItemId, quantity: 1, reason: 'DEFECTIVE' }],
      notes: 'Synthetic Phase 20 approved supplier return fixture.',
    });
  }
  if (purchaseReturn.status === 'DRAFT') {
    purchaseReturn = await request(`/purchases/returns/${purchaseReturn.id}/approve`, token, 'POST');
  }

  const paidBefore = await prisma.payment.findFirst({
    where: { businessId: business.id, poId: orderedOrder.id, paymentNumber: 'PH20-SEED-PAY-001' },
    select: { id: true },
  });
  if (!paidBefore) {
    const orderValue = await prisma.purchaseOrder.findUnique({ where: { id: orderedOrder.id }, select: { totalAmount: true } });
    if (!orderValue) throw new Error('PH20 ordered fixture disappeared before payment setup.');
    await request(`/purchases/orders/${orderedOrder.id}/payments`, token, 'POST', {
      paymentNumber: 'PH20-SEED-PAY-001',
      amount: Math.min(500, orderValue.totalAmount),
      paymentMethodId: cash.id,
      reference: 'PH20-SEED-PAY-001',
      notes: 'Synthetic development partial supplier payment fixture.',
    });
  }

  const [finalInvoices, finalPurchaseOrders, finalPurchaseReturns] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { businessId: business.id, referenceNumber: { startsWith: 'PH21-WORKFLOW:' } },
      select: { id: true, referenceNumber: true, invoiceNumber: true, status: true, totalPaid: true, balance: true },
      orderBy: { invoiceNumber: 'asc' },
    }),
    prisma.purchaseOrder.findMany({
      where: { businessId: business.id, poNumber: { startsWith: 'PH20-SEED-' } },
      select: { id: true, poNumber: true, status: true },
      orderBy: { poNumber: 'asc' },
    }),
    prisma.purchaseReturn.findMany({
      where: { businessId: business.id, returnNumber: { startsWith: 'PH20-SEED-' } },
      select: { id: true, returnNumber: true, status: true },
    }),
  ]);
  const counts = {
    phase19Products: await prisma.product.count({ where: { businessId: business.id, sku: { startsWith: 'PH19-' } } }),
    phase21Products: await prisma.product.count({ where: { businessId: business.id, sku: { startsWith: 'PH21-' } } }),
    phase21Customers: await prisma.customer.count({ where: { businessId: business.id, customerCode: { startsWith: 'PH21-' } } }),
    phase21Invoices: await prisma.salesInvoice.count({ where: { businessId: business.id, referenceNumber: { startsWith: 'PH21-' } } }),
    phase21Returns: await prisma.salesReturn.count({ where: { businessId: business.id, returnNumber: { startsWith: 'PH21-' } } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { businessId: business.id, poNumber: { startsWith: 'PH20-SEED-' } } }),
    purchaseReturns: await prisma.purchaseReturn.count({ where: { businessId: business.id, returnNumber: { startsWith: 'PH20-SEED-' } } }),
    salesStockMovements: await prisma.inventoryMovement.count({ where: { businessId: business.id, referenceType: 'SalesInvoice', notes: { contains: 'INV-202611-' } } }),
    purchaseStockMovements: await prisma.inventoryMovement.count({
      where: {
        businessId: business.id,
        product: { sku: 'PH19-BEV-001' },
        type: { in: ['PURCHASE', 'PURCHASE_RETURN'] },
      },
    }),
  };
  console.log(JSON.stringify({
    business: business.name,
    testUser: qaEmail,
    testUserPassword: 'PH21test!2026',
    counts,
    workflowInvoices: finalInvoices,
    purchaseOrders: finalPurchaseOrders,
    purchaseReturns: finalPurchaseReturns,
    salesReturn,
    rejectDraftFixture,
    rejectAuthorizedFixture,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Phase fixture setup failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
