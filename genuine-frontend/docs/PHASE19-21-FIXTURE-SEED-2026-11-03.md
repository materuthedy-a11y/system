# Development fixture data — 2026-11-03

This note records a development database reset and fixture population only. It is not evidence that any previously GREEN acceptance item was re-tested, and it does not change checklist statuses.

## Development target

- `NODE_ENV=development`
- PostgreSQL `localhost/genuine`
- Business: `Genuine Liquor Store`
- Seed owner: `admin@genuineliquor.co.tz` / `admin123`
- Salesperson fixture: `ph21.salesperson@example.test` / `PH21test!2026`
- Cross-tenant fixture: `PH19 Tenant Test Business B`, login `ph19.tenantb@example.test` / `PH19test!2026`; it has its own product, customer, location and one PH21 draft invoice.

## Fixtures added

- Phase 19 catalog: 3 active products and 1 inactive product (`PH19-*`), plus a test warehouse.
- Phase 20 purchasing: 5 purchase orders covering DRAFT, ORDERED, PARTIALLY_RECEIVED, FULLY_RECEIVED and CANCELLED; 2 accepted GRNs; 1 approved supplier return; 1 partial supplier payment. These state changes were created through the backend API.
- Phase 21 sales: 3 synthetic customers, a test branch, 22 filter draft invoices, and workflow invoices for ISSUED, overdue-by-date, partially paid, paid, cancelled and customer return. Created/issued/paid/returned through the backend API. Return status is RECEIVED.
- The PH21 draft fixtures are spread across the Alpha/Beta customers, Main Warehouse, `PH20 Edit QA Location`, and `PH21 Test Branch`, with Admin and PH21 salesperson as creators.
- Cross-tenant fixture: Business B has product `PH19-TENANT-B-001` and draft invoice `PH21-B-TENANT-001`; Business A records were not added to or modified in Business B.

## Counts after fixture setup

- PH19 products: 4
- PH21 customers: 3
- PH21 invoices: 28 (22 DRAFT plus 6 workflow records)
- PH21 customer returns: 1
- PH20 purchase orders: 5
- PH20 supplier returns: 1
- Workflow stock movements: 5 sales movements, 3 purchase/return movements
- Business B cross-tenant draft invoices: 1

The regular `db:seed` command truncates all public tables before creating its base records. For additive phase fixtures, use `pnpm db:seed:phases`; it refuses a non-development or non-local database and reuses existing phase records.

Only reusable UI/workflow fixtures were restored. Temporary one-off negative-input, concurrency and cross-tenant request fixtures from historical checklist runs were not recreated as persistent business records. Prior GREEN checklist entries remain historical and were not re-run as part of this seed.
