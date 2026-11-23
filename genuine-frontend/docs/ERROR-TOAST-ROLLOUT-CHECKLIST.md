# Global error-toast rollout

## Rule

- API-client failures now emit one global error toast. A page gets 60 ms to show its own toast first; when it does, the global bridge suppresses a duplicate.
- Authentication entry failures keep using the existing auth-form toast. HTTP 401 session-expiry responses continue through the session-expiry flow and are not surfaced as generic API errors.
- Local file/CSV preparation failures on customer/product photos and customer import, offline purchase-draft sync failures, and workspace restore failures on login now show both an inline explanation and a toast.
- Field validation stays beside the field; destructive/action forms may keep their inline explanation and Retry alongside the toast.
- A route is GREEN only after reviewing its local/native error paths, checking that the new global toast does not duplicate existing notifications, and doing the route's safe UI error/retry check. Global wiring alone does not mark every page green.

## Public and authentication routes

- [x] `/` — splash-only route; no API or user action can fail here. Redirects to `/login`.
- [x] `/login` — user confirmed GREEN on 2026-11-23; empty credential validation shows toast and inline message. Workspace restore and expired-session paths also have toast coverage in code.
- [ ] `/register`
- [ ] `/forgot-password`
- [ ] `/reset-password`
- [ ] `/offline`
- [ ] `/error`
- [ ] `/global-error`

## Workspace and account routes

- [x] `/dashboard` — user confirmed GREEN on 2026-11-23 after Refresh/error-toast retry check.
- [ ] `/dashboard/activity`
- [ ] `/dashboard/audit`
- [ ] `/dashboard/security`
- [ ] `/dashboard/help-feedback`
- [ ] `/dashboard/notifications`
- [ ] `/dashboard/settings`
- [ ] `/dashboard/settings/business`
- [ ] `/dashboard/settings/general`
- [ ] `/dashboard/settings/locations`
- [ ] `/dashboard/settings/payment-methods`
- [ ] `/dashboard/settings/expense-categories`
- [ ] `/dashboard/settings/product-categories`
- [ ] `/dashboard/settings/roles`
- [ ] `/dashboard/settings/tax-settings`
- [ ] `/dashboard/settings/units`
- [ ] `/dashboard/settings/users`

## Operations — inventory

- [x] `/dashboard/inventory` — global API toast added; user confirmed the dashboard failure toast and Retry flow GREEN on 2026-11-23. Local filter/movement edge cases remain in Phase 24.1.
- [ ] `/dashboard/inventory/adjustments`
- [ ] `/dashboard/inventory/adjustments/new`
- [ ] `/dashboard/inventory/adjustments/[id]`
- [ ] `/dashboard/inventory/counts`
- [ ] `/dashboard/inventory/counts/new`
- [ ] `/dashboard/inventory/counts/[id]`
- [ ] `/dashboard/inventory/transfers`
- [ ] `/dashboard/inventory/transfers/new`
- [ ] `/dashboard/inventory/transfers/[id]`
- [ ] `/dashboard/inventory/reports`
- [ ] `/dashboard/inventory/settings/reorder-points`

## Operations — products, sales, purchases, customers, suppliers

- [ ] `/dashboard/products`
- [ ] `/dashboard/products/new`
- [ ] `/dashboard/products/[id]`
- [ ] `/dashboard/products/[id]/edit`
- [ ] `/dashboard/products/catalogs`
- [ ] `/dashboard/sales/invoices`
- [ ] `/dashboard/sales/invoices/new`
- [ ] `/dashboard/sales/invoices/[id]`
- [ ] `/dashboard/sales/invoices/[id]/edit`
- [ ] `/dashboard/sales/returns`
- [ ] `/dashboard/sales/returns/new`
- [ ] `/dashboard/purchases`
- [ ] `/dashboard/purchases/orders/new`
- [ ] `/dashboard/purchases/orders/[id]`
- [ ] `/dashboard/purchases/orders/[id]/edit`
- [ ] `/dashboard/purchases/grn/[id]`
- [ ] `/dashboard/customers` — CSV parse/import and customer-photo preparation errors toast; API failures use the global bridge. Needs browser smoke check.
- [ ] `/dashboard/customers/new`
- [ ] `/dashboard/customers/[id]`
- [ ] `/dashboard/customers/[id]/edit`
- [ ] `/dashboard/suppliers`
- [ ] `/dashboard/suppliers/new`
- [ ] `/dashboard/suppliers/[id]`
- [ ] `/dashboard/suppliers/[id]/edit`

## Finance and insights

- [ ] `/dashboard/expenses`
- [ ] `/dashboard/expenses/new`
- [ ] `/dashboard/expenses/[id]`
- [ ] `/dashboard/expenses/[id]/edit`
- [ ] `/dashboard/finance`
- [ ] `/dashboard/finance/payments/[id]`
- [ ] `/dashboard/reports`

## Cross-route checks

- [ ] Confirm one failing request does not create duplicate global + local toasts across routes with existing `notify.error` handlers.
- [ ] Confirm an HTTP 401 that is successfully refreshed does not show an error toast; an expired session follows the sign-in flow.
- [x] Searched non-Axios `fetch`, image, file and browser-storage paths. Added toasts for actionable local CSV/photo/offline-sync failures; benign image-preview/storage fallback paths stay quiet.
- [x] Targeted frontend TypeScript and ESLint checks pass for the global bridge and the local error paths changed in this pass.
- [ ] Browser-smoke each route family in order; do not call a route GREEN from global wiring alone.
