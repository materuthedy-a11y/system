// Seeds the isolated `test` schema (DATABASE_URL from .env.test) with synthetic data.
// Idempotent-ish: wipes the test schema tables first. NEVER point this at public.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
const envTest = readFileSync(new URL('../.env.test', import.meta.url), 'utf8');
const testUrl = envTest.match(/DATABASE_URL="([^"]+)"/)[1];
if (!testUrl.includes('schema=test')) throw new Error('Refusing: .env.test must target schema=test');
process.env.DATABASE_URL = testUrl;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const uid = () => randomUUID();
const daysAgo = (n, h = 12) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };
const PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // "password" bcrypt

async function wipe() {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='test' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) {
    const list = tables.map((t) => `test."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
  console.log(`wiped ${tables.length} tables in schema=test`);
}

async function main() {
  await wipe();

  // ---------- Business A ----------
  const bizA = await prisma.business.create({
    data: {
      id: uid(), name: 'TestBiz Alpha', businessType: 'RETAIL', country: 'TZ',
      currency: 'TZS', allowNegativeStock: true, isSetupComplete: true,
    },
  });
  const bizB = await prisma.business.create({
    data: {
      id: uid(), name: 'TestBiz Beta', businessType: 'RETAIL', country: 'TZ',
      currency: 'TZS', allowNegativeStock: false, isSetupComplete: true,
    },
  });

  const mkLoc = (businessId, name, code, managerId) =>
    prisma.location.create({ data: { id: uid(), businessId, name, code, type: 'BRANCH', isActive: true, managerId } });

  const mkUser = (businessId, email, firstName, roleName) =>
    prisma.user.create({
      data: {
        id: uid(), businessId, email, passwordHash: PASSWORD_HASH,
        firstName, lastName: 'Test', isActive: true, isVerified: true,
        userRoles: roleName ? { create: { role: { create: { id: uid(), businessId, name: roleName, isSystem: ['Owner', 'Admin'].includes(roleName), isDefault: true } } } } : undefined,
      },
    });

  const ownerA = await mkUser(bizA.id, 'owner@alpha.test', 'Alice', 'Owner');
  const managerA = await mkUser(bizA.id, 'manager@alpha.test', 'Moses', 'Manager');
  const restrictedA = await mkUser(bizA.id, 'staff@alpha.test', 'Staff', 'Sales');
  const ownerB = await mkUser(bizB.id, 'owner@beta.test', 'Beta', 'Owner');

  const locA1 = await mkLoc(bizA.id, 'Alpha Main', 'A1', restrictedA.id);
  const locA2 = await mkLoc(bizA.id, 'Alpha Branch', 'A2', null);
  const locB1 = await mkLoc(bizB.id, 'Beta Main', 'B1', null);

  // Grant Owner role all permissions needed by live workflow tests
  const KEYS = [
    'sales.create', 'sales.view', 'sales.price_override', 'sales.approve', 'sales.returns.create',
    'payments.create', 'payments.view', 'payments.void', 'payments.reconcile',
    'purchases.create', 'purchases.view', 'purchases.approve',
    'inventory.view', 'inventory.adjust',
    'insights.view', 'insights.manage', 'reports.view', 'customers.view', 'suppliers.view',
  ];
  for (const biz of [bizA, bizB]) {
    const ownerRole = await prisma.role.findFirst({ where: { businessId: biz.id, name: 'Owner' } });
    for (const key of KEYS) {
      const perm = await prisma.permission.upsert({
        where: { businessId_key: { businessId: biz.id, key } },
        update: {},
        create: { id: uid(), businessId: biz.id, key, name: key, category: 'TEST', action: 'ALLOW' },
      });
      await prisma.role.update({ where: { id: ownerRole.id }, data: { permissions: { connect: { id: perm.id } } } });
    }
  }

  const catA = await prisma.category.create({ data: { id: uid(), businessId: bizA.id, name: 'Beverages' } });
  const catA2 = await prisma.category.create({ data: { id: uid(), businessId: bizA.id, name: 'Snacks' } });
  const catB = await prisma.category.create({ data: { id: uid(), businessId: bizB.id, name: 'General' } });

  const pmCash = await prisma.paymentMethod.create({ data: { id: uid(), businessId: bizA.id, name: 'Cash', code: 'CASH', methodType: 'CASH' } });
  const pmBank = await prisma.paymentMethod.create({ data: { id: uid(), businessId: bizA.id, name: 'Bank', code: 'BANK', methodType: 'BANK' } });
  const pmCashB = await prisma.paymentMethod.create({ data: { id: uid(), businessId: bizB.id, name: 'Cash', code: 'CASH', methodType: 'CASH' } });
  const expCat = await prisma.expenseCategory.create({ data: { id: uid(), businessId: bizA.id, name: 'Utilities', code: 'UTIL' } });

  const sup1 = await prisma.supplier.create({ data: { id: uid(), businessId: bizA.id, name: 'Supplier Fast', supplierCode: 'SUP-1', email: 's1@test', phone: '1', isActive: true, paymentTerms: 'NET30' } });
  const sup2 = await prisma.supplier.create({ data: { id: uid(), businessId: bizA.id, name: 'Supplier Slow', supplierCode: 'SUP-2', email: 's2@test', phone: '2', isActive: true, paymentTerms: 'NET30' } });
  const supInactive = await prisma.supplier.create({ data: { id: uid(), businessId: bizA.id, name: 'Supplier Gone', supplierCode: 'SUP-3', email: 's3@test', phone: '3', isActive: false, paymentTerms: 'NET30' } });
  const supB = await prisma.supplier.create({ data: { id: uid(), businessId: bizB.id, name: 'Beta Supplier', supplierCode: 'BSUP-1', email: 'b1@test', phone: '9', isActive: true, paymentTerms: 'NET30' } });

  const custCash = await prisma.customer.create({ data: { id: uid(), businessId: bizA.id, name: 'Walk-in Customer', customerCode: 'C-1', customerType: 'INDIVIDUAL', paymentTerms: 'PREPAID', email: 'c1@test', phone: '1', isActive: true } });
  const custCredit = await prisma.customer.create({ data: { id: uid(), businessId: bizA.id, name: 'Credit Customer', customerCode: 'C-2', customerType: 'BUSINESS', paymentTerms: 'NET-30', email: 'c2@test', phone: '2', isActive: true, creditLimit: 500000 } });
  const custChurn = await prisma.customer.create({ data: { id: uid(), businessId: bizA.id, name: 'Churned Customer', customerCode: 'C-3', customerType: 'INDIVIDUAL', paymentTerms: 'PREPAID', email: 'c3@test', phone: '3', isActive: true } });
  const custB = await prisma.customer.create({ data: { id: uid(), businessId: bizB.id, name: 'Beta Customer', customerCode: 'BC-1', customerType: 'INDIVIDUAL', paymentTerms: 'PREPAID', email: 'bc@test', phone: '4', isActive: true } });

  // ---------- Products (Business A) ----------
  const mkProduct = (over) =>
    prisma.product.create({
      data: {
        id: uid(), businessId: bizA.id, sku: over.sku, name: over.name, categoryId: over.categoryId || catA.id,
        buyingPrice: over.buying ?? 1000, sellingPrice: over.selling ?? 1500,
        minimumStock: over.min ?? 0, reorderLevel: over.reorder ?? 0,
        supplierId: over.supplierId ?? null, status: over.status || 'ACTIVE',
      },
    });

  const pFast = await mkProduct({ sku: 'P-FAST', name: 'Fast Cola 500ml', buying: 800, selling: 1200, reorder: 50, supplierId: sup1.id });
  const pLow = await mkProduct({ sku: 'P-LOW', name: 'Low Stock Juice', buying: 2000, selling: 3000, reorder: 30, supplierId: sup2.id });
  const pZero = await mkProduct({ sku: 'P-ZERO', name: 'Out Bread', buying: 500, selling: 900, reorder: 10 });
  const pNeg = await mkProduct({ sku: 'P-NEG', name: 'Negative Widget', buying: 700, selling: 1100, reorder: 20, supplierId: sup1.id });
  const pDead = await mkProduct({ sku: 'P-DEAD', name: 'Dead Stock Item', buying: 5000, selling: 8000, reorder: 5 });
  const pExp = await mkProduct({ sku: 'P-EXP', name: 'Expiring Milk', buying: 1500, selling: 2200, reorder: 10, requiresExpiry: true });
  const pNoSup = await mkProduct({ sku: 'P-NOSUP', name: 'No Supplier Thing', buying: 900, selling: 1400, reorder: 15 });
  const pDisc = await mkProduct({ sku: 'P-DISC', name: 'Discounted Soap', buying: 1000, selling: 1600, reorder: 20, supplierId: sup1.id });
  const pMargin = await mkProduct({ sku: 'P-MARGIN', name: 'Thin Margin Oil', buying: 10000, selling: 10500, reorder: 10 }); // ~4.8% margin
  const pInactive = await mkProduct({ sku: 'P-INACT', name: 'Inactive Prod', status: 'INACTIVE' });

  // Default sellable unit per product (required by purchase order creation)
  const unitA = await prisma.unit.create({ data: { id: uid(), businessId: bizA.id, name: 'Piece', symbol: 'pc', isDefault: true, isSystem: true } });
  const unitB = await prisma.unit.create({ data: { id: uid(), businessId: bizB.id, name: 'Piece', symbol: 'pc', isDefault: true, isSystem: true } });
  for (const p of [pFast, pLow, pZero, pNeg, pDead, pExp, pNoSup, pDisc, pMargin, pInactive]) {
    await prisma.productUnit.create({ data: { id: uid(), productId: p.id, unitId: unitA.id, conversionFactor: 1, isDefault: true } });
    await prisma.product.update({ where: { id: p.id }, data: { defaultUnitId: unitA.id } });
  }

  const mkBal = (productId, locationId, quantity) =>
    prisma.stockBalance.create({ data: { id: uid(), businessId: bizA.id, productId, locationId, quantity, lastMovementAt: new Date() } });
  await mkBal(pFast.id, locA1.id, 500);
  await mkBal(pFast.id, locA2.id, 80);
  await mkBal(pLow.id, locA1.id, 12);
  await mkBal(pZero.id, locA1.id, 0);
  await mkBal(pNeg.id, locA1.id, -15);
  await mkBal(pDead.id, locA1.id, 100);
  await mkBal(pExp.id, locA1.id, 60);
  await mkBal(pNoSup.id, locA1.id, 40);
  await mkBal(pDisc.id, locA1.id, 300);
  await mkBal(pMargin.id, locA1.id, 200);
  await mkBal(pInactive.id, locA1.id, 50);

  const mv = (productId, locationId, type, quantity, extra = {}) =>
    prisma.inventoryMovement.create({
      data: { id: uid(), businessId: bizA.id, productId, locationId, type, quantity, createdBy: ownerA.id, createdAt: daysAgo(1), ...extra },
    });
  // Velocity: pFast sells ~20/day → 600 units over 30d at locA1, ~5/day at locA2
  for (let i = 0; i < 30; i++) {
    await mv(pFast.id, locA1.id, 'SALE', -20);
    await mv(pFast.id, locA2.id, 'SALE', -5);
    await mv(pLow.id, locA1.id, 'SALE', -2);
    await mv(pDisc.id, locA1.id, 'SALE', -10);
    await mv(pMargin.id, locA1.id, 'SALE', -4);
    await mv(pNoSup.id, locA1.id, 'SALE', -3);
  }
  // Dead stock: no SALE for pDead/pExp; purchase receipts
  await mv(pDead.id, locA1.id, 'PURCHASE', 100, { unitCost: 5000 });
  await mv(pExp.id, locA1.id, 'PURCHASE', 60, { unitCost: 1500, batchNumber: 'B-EXP-1', expiryDate: daysAgo(-20) }); // expires in 20d
  await mv(pExp.id, locA1.id, 'SALE', -10, { batchNumber: 'B-EXP-1', expiryDate: daysAgo(-20) });
  await mv(pNeg.id, locA1.id, 'PURCHASE', 10, { unitCost: 700 });
  await mv(pNeg.id, locA1.id, 'SALE', -25); // drives balance negative conceptually
  // Non-sale movements that must NOT count as demand
  await mv(pFast.id, locA1.id, 'CUSTOMER_RETURN', 5);
  await mv(pFast.id, locA1.id, 'TRANSFER_OUT', -3);
  await mv(pFast.id, locA1.id, 'ADJUSTMENT', -2);

  // ---------- Sales invoices (Business A) ----------
  const mkInvoice = async (over) => {
    const inv = await prisma.salesInvoice.create({
      data: {
        id: uid(), businessId: bizA.id, customerId: over.customerId, locationId: over.locationId || locA1.id,
        invoiceNumber: over.number, invoiceDate: over.date || daysAgo(5), dueDate: over.dueDate || null,
        status: over.status || 'ISSUED', subtotal: over.subtotal, discountAmount: over.discount || 0,
        discountPercent: over.discountPct || 0, taxAmount: over.tax || 0, totalAmount: over.total,
        totalPaid: over.paid || 0, balance: over.total - (over.paid || 0),
        issuedDate: over.issued || over.date || daysAgo(5), createdBy: ownerA.id,
        items: { create: over.items },
      },
    });
    return inv;
  };

  // Recent healthy sales (last 30d) — prevents false sales-decline
  for (let i = 1; i <= 8; i++) {
    await mkInvoice({
      number: `INV-R${i}`, customerId: custCash.id, date: daysAgo(i),
      subtotal: 24000, total: 24000, paid: 24000, status: 'PAID',
      items: [{ id: uid(), productId: pFast.id, quantity: 20, unitPrice: 1200, discount: 0, discountPercentage: 0, total: 24000, lineNo: 1 }],
    });
  }
  // Prior period sales (31-60d ago) — slightly higher to create detectable decline? keep equal to avoid noise
  for (let i = 31; i <= 38; i++) {
    await mkInvoice({
      number: `INV-P${i}`, customerId: custCash.id, date: daysAgo(i),
      subtotal: 30000, total: 30000, paid: 30000, status: 'PAID',
      items: [{ id: uid(), productId: pFast.id, quantity: 25, unitPrice: 1200, discount: 0, discountPercentage: 0, total: 30000, lineNo: 1 }],
    });
  }
  // Churned customer: 4 old invoices (>60d), nothing recent
  for (let i = 1; i <= 4; i++) {
    await mkInvoice({
      number: `INV-CH${i}`, customerId: custChurn.id, date: daysAgo(90 + i * 5),
      subtotal: 50000, total: 50000, paid: 50000, status: 'PAID',
      items: [{ id: uid(), productId: pFast.id, quantity: 40, unitPrice: 1250, discount: 0, discountPercentage: 0, total: 50000, lineNo: 1 }],
    });
  }
  // Credit invoice partially paid + overdue
  const invOverdue = await mkInvoice({
    number: 'INV-OVERDUE', customerId: custCredit.id, date: daysAgo(45), dueDate: daysAgo(15),
    subtotal: 100000, total: 100000, paid: 40000, status: 'PARTIALLY_PAID',
    items: [{ id: uid(), productId: pLow.id, quantity: 33, unitPrice: 3000, discount: 0, discountPercentage: 0, total: 100000, lineNo: 1 }],
  });
  await prisma.payment.create({
    data: { id: uid(), businessId: bizA.id, paymentNumber: 'PAY-1', paymentDate: daysAgo(44), customerId: custCredit.id, invoiceId: invOverdue.id, amount: 40000, paymentMethodId: pmCash.id, direction: 'INFLOW', status: 'COMPLETED', createdBy: ownerA.id },
  });
  // Excessive discount invoice (>25%)
  await mkInvoice({
    number: 'INV-DISC', customerId: custCash.id, date: daysAgo(3),
    subtotal: 20000, discount: 8000, discountPct: 40, total: 12000, paid: 12000, status: 'PAID',
    items: [{ id: uid(), productId: pDisc.id, quantity: 10, unitPrice: 2000, discount: 8000, discountPercentage: 40, total: 12000, lineNo: 1 }],
  });
  // Low-margin product sales (margin ~4.8% < 8%)
  await mkInvoice({
    number: 'INV-MARGIN', customerId: custCash.id, date: daysAgo(2),
    subtotal: 42000, total: 42000, paid: 42000, status: 'PAID',
    items: [{ id: uid(), productId: pMargin.id, quantity: 4, unitPrice: 10500, discount: 0, discountPercentage: 0, total: 42000, lineNo: 1 }],
  });
  // Void/cancelled anomalies for activity detector
  await prisma.payment.create({
    data: { id: uid(), businessId: bizA.id, paymentNumber: 'PAY-V1', paymentDate: daysAgo(4), customerId: custCash.id, amount: 5000, paymentMethodId: pmCash.id, direction: 'INFLOW', status: 'VOIDED', voidedAt: daysAgo(4), voidedBy: ownerA.id, createdBy: ownerA.id },
  });
  await prisma.payment.create({
    data: { id: uid(), businessId: bizA.id, paymentNumber: 'PAY-V2', paymentDate: daysAgo(5), customerId: custCash.id, amount: 7000, paymentMethodId: pmCash.id, direction: 'INFLOW', status: 'VOIDED', voidedAt: daysAgo(5), voidedBy: ownerA.id, createdBy: ownerA.id },
  });
  await prisma.payment.create({
    data: { id: uid(), businessId: bizA.id, paymentNumber: 'PAY-V3', paymentDate: daysAgo(6), customerId: custCash.id, amount: 9000, paymentMethodId: pmCash.id, direction: 'INFLOW', status: 'VOIDED', voidedAt: daysAgo(6), voidedBy: ownerA.id, createdBy: ownerA.id },
  });

  // ---------- Purchase orders ----------
  // PO-1: ORDERED with partial GRN (incoming for pLow)
  const po1 = await prisma.purchaseOrder.create({
    data: {
      id: uid(), businessId: bizA.id, poNumber: 'PO-001', supplierId: sup1.id, locationId: locA1.id,
      status: 'PARTIALLY_RECEIVED', orderDate: daysAgo(10), expectedDeliveryDate: daysAgo(-5),
      subtotal: 50000, totalAmount: 50000, createdBy: ownerA.id,
      items: { create: [{ id: uid(), productId: pLow.id, quantity: 30, unitPrice: 2000, discount: 0, lineTotal: 60000 }] },
    },
  });
  const po1Item = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: po1.id } });
  await prisma.goodsReceivedNote.create({
    data: {
      id: uid(), businessId: bizA.id, grnNumber: 'GRN-001', purchaseOrderId: po1.id,
      status: 'ACCEPTED', receivedBy: ownerA.id, receivedDate: daysAgo(6),
      items: { create: [{ id: uid(), purchaseOrderItemId: po1Item.id, receivedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0, damageQuantity: 0 }] },
    },
  });
  // PO-2: ORDERED, untouched (incoming for pFast)
  await prisma.purchaseOrder.create({
    data: {
      id: uid(), businessId: bizA.id, poNumber: 'PO-002', supplierId: sup2.id, locationId: locA1.id,
      status: 'ORDERED', orderDate: daysAgo(4), expectedDeliveryDate: daysAgo(-10),
      subtotal: 96000, totalAmount: 96000, createdBy: ownerA.id,
      items: { create: [{ id: uid(), productId: pFast.id, quantity: 80, unitPrice: 1200, discount: 0, lineTotal: 96000 }] },
    },
  });
  // PO-3: CANCELLED — must NOT count as incoming
  await prisma.purchaseOrder.create({
    data: {
      id: uid(), businessId: bizA.id, poNumber: 'PO-003', supplierId: sup2.id, locationId: locA1.id,
      status: 'CANCELLED', orderDate: daysAgo(8), cancelledAt: daysAgo(7),
      subtotal: 20000, totalAmount: 20000, createdBy: ownerA.id,
      items: { create: [{ id: uid(), productId: pZero.id, quantity: 40, unitPrice: 500, discount: 0, lineTotal: 20000 }] },
    },
  });
  // PO-4: late deliveries for supplier risk (sup2 late twice of 3)
  for (let i = 1; i <= 3; i++) {
    const po = await prisma.purchaseOrder.create({
      data: {
        id: uid(), businessId: bizA.id, poNumber: `PO-L${i}`, supplierId: sup2.id, locationId: locA1.id,
        status: 'FULLY_RECEIVED', orderDate: daysAgo(60 + i * 10), expectedDeliveryDate: daysAgo(50 + i * 10),
        subtotal: 10000, totalAmount: 10000, createdBy: ownerA.id,
        items: { create: [{ id: uid(), productId: pLow.id, quantity: 5, unitPrice: 2000, discount: 0, lineTotal: 10000 }] },
      },
    });
    const late = i <= 2;
    await prisma.goodsReceivedNote.create({
      data: {
        id: uid(), businessId: bizA.id, grnNumber: `GRN-L${i}`, purchaseOrderId: po.id,
        status: 'ACCEPTED', receivedBy: ownerA.id,
        receivedDate: daysAgo(late ? 40 + i * 10 : 49 + i * 10), // 2 late, 1 on-time-ish
        items: { create: [{ id: uid(), purchaseOrderItemId: (await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: po.id } })).id, receivedQuantity: 5, acceptedQuantity: 5, rejectedQuantity: 0, damageQuantity: 0 }] },
      },
    });
  }
  // Supplier lead-time history for sup1 (3 POs, ~5d lead)
  for (let i = 1; i <= 3; i++) {
    await prisma.purchaseOrder.create({
      data: {
        id: uid(), businessId: bizA.id, poNumber: `PO-S1-${i}`, supplierId: sup1.id, locationId: locA1.id,
        status: 'FULLY_RECEIVED', orderDate: daysAgo(100 + i * 20), expectedDeliveryDate: daysAgo(95 + i * 20),
        subtotal: 5000, totalAmount: 5000, createdBy: ownerA.id,
        items: { create: [{ id: uid(), productId: pFast.id, quantity: 5, unitPrice: 1000, discount: 0, lineTotal: 5000 }] },
      },
    });
  }

  // ---------- Return + refund ----------
  const retInv = await mkInvoice({
    number: 'INV-RET', customerId: custCash.id, date: daysAgo(10),
    subtotal: 12000, total: 12000, paid: 12000, status: 'PAID',
    items: [{ id: uid(), productId: pFast.id, quantity: 10, unitPrice: 1200, discount: 0, discountPercentage: 0, total: 12000, lineNo: 1 }],
  });
  await prisma.salesReturn.create({
    data: {
      id: uid(), businessId: bizA.id, invoiceId: retInv.id, customerId: custCash.id,
      returnNumber: 'RET-001', returnDate: daysAgo(5), reason: 'Defective',
      totalAmount: 2400, status: 'RECEIVED', createdBy: ownerA.id, receivedBy: ownerA.id, receivedAt: daysAgo(5),
      items: { create: [{ id: uid(), salesInvoiceItemId: (await prisma.salesInvoiceItem.findFirst({ where: { invoiceId: retInv.id } })).id, productId: pFast.id, quantity: 2, unitPrice: 1200, total: 2400 }] },
    },
  });

  // ---------- Expense ----------
  await prisma.expense.create({
    data: { id: uid(), businessId: bizA.id, expenseNumber: 'EXP-001', expenseDate: daysAgo(3), categoryId: expCat.id, amount: 50000, description: 'Electricity', status: 'PAID', isPaid: true, locationId: locA1.id, createdBy: ownerA.id, paidAt: daysAgo(3) },
  });

  // ---------- Stock adjustment (activity anomaly: 8 adjustments by owner) ----------
  for (let i = 1; i <= 8; i++) {
    await prisma.stockAdjustment.create({
      data: {
        id: uid(), businessId: bizA.id, adjustmentNumber: `ADJ-${i}`, adjustmentDate: daysAgo(i), locationId: undefined,
        reason: 'Count correction', status: 'APPROVED', createdBy: ownerA.id, approvedBy: managerA.id, approvedAt: daysAgo(i),
        items: { create: [{ id: uid(), productId: pFast.id, currentQty: 500, adjustedQty: 501, difference: 1, locationId: locA1.id }] },
      },
    });
  }

  // ---------- Business B minimal ----------
  const pB = await prisma.product.create({ data: { id: uid(), businessId: bizB.id, sku: 'BP-1', name: 'Beta Prod', categoryId: catB.id, buyingPrice: 500, sellingPrice: 800, status: 'ACTIVE' } });
  await prisma.stockBalance.create({ data: { id: uid(), businessId: bizB.id, productId: pB.id, locationId: locB1.id, quantity: 50, lastMovementAt: new Date() } });
  await prisma.salesInvoice.create({
    data: {
      id: uid(), businessId: bizB.id, customerId: custB.id, locationId: locB1.id,
      invoiceNumber: 'BINV-1', invoiceDate: daysAgo(2), status: 'ISSUED', subtotal: 8000, totalAmount: 8000,
      totalPaid: 0, balance: 8000, issuedDate: daysAgo(2), createdBy: ownerB.id,
      items: { create: [{ id: uid(), productId: pB.id, quantity: 10, unitPrice: 800, discount: 0, discountPercentage: 0, total: 8000, lineNo: 1 }] },
    },
  });

  console.log('seed complete');
  console.log('bizA:', bizA.id, 'bizB:', bizB.id);
  console.log('users: owner@alpha.test / manager@alpha.test / staff@alpha.test / owner@beta.test (password: password)');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
