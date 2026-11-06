# Phase 31 — Permissions and authorization checklist

Scope: permissions across the dashboard, Settings, API, and all business modules. Phase 31 follows Phase 30 (PWA) in the numbered phase plan. Its authorization rules also apply while testing Phase 25 (Settings and team access), Phase 27 (Suppliers), Phase 28 (Expenses and Payments & Finance), and Phase 29 (Notifications).

Status: permission implementation has been updated; browser/API verification is still pending. Do not mark manual checks green until the named outcome is observed with the named role.

## Implementation completed in code

- [x] Sidebar only shows destinations the signed-in user can open; unauthorized “Soon” module placeholders are not shown as if the user has access.
- [x] A user with `products.view` can open Products without needing create/edit/delete permissions. Each write action remains independently guarded.
- [x] Create-only module permissions have visible entry points. Successful creation stays on the create form and clears it when the user lacks that module’s `*.view`, instead of navigating into a denied detail page.
- [x] Settings access no longer grants the payment ledger, expense records, or financial reports. Accounting periods are a separate Settings-governed destination.
- [x] Settings edit access can load the current business profile/date preferences it needs to edit; it does not imply access to payment or expense history.
- [x] User creation no longer silently selects the first role (which could be Admin); an administrator must choose an assignable role explicitly.
- [x] System Owner, Admin, Manager, and Salesperson role grants are synchronized to their defined grants, including removal of obsolete grants. Permission changes revoke assigned users’ existing sessions; description-only role synchronization does not.
- [x] Role assignment is limited to grants the actor is allowed to delegate. Only an Owner can assign/manage the Owner role; non-Owners cannot grant permissions they do not hold.
- [x] Custom role permission dependencies reject actions whose required read/context permissions are missing (for example edit without view, approve without module view, sales creation without product/customer lookup).
- [x] Deleting obsolete permission catalog entries also revokes sessions whose role or direct user grant was removed.
- [x] Settings-only access to expense and payment ledgers has been removed from their backend routes. API authorization remains enforced independently of the sidebar.

## Manual role matrix — browser checks

### Owner

- [ ] Open each business module, Settings, Team access, Reports, Payments & Finance, and accounting periods.
- [ ] Confirm Owner can assign the Owner role and configure all supported permissions.
- [ ] Confirm Owner cannot deactivate the last active Owner of the business.

### Admin

- [ ] Confirm Admin can manage business operations and custom roles, but cannot assign the Owner role.
- [ ] Confirm Admin cannot deactivate/delete a user when `users.delete` is absent.
- [ ] Confirm Admin cannot grant a custom role any permission Admin does not hold.

### Manager

- [ ] Confirm sales, products, inventory, purchases, customers, suppliers, expenses, payments, and reports appear according to the Manager grants.
- [ ] Confirm Settings and Team access remain hidden when the role lacks those permissions.
- [ ] Confirm manager cannot change role grants or create an Owner.

### Salesperson

- [ ] Confirm Sales, Products, Customers, Inventory, and payment capture through an authorized invoice workflow are available according to grants.
- [ ] Confirm Payments & Finance ledger, Purchases, Expenses, Suppliers, Settings, Team access, and Reports stay hidden where the role lacks their view/manage grants.
- [ ] Confirm invoice discount, edit, issue, and cancel controls follow their individual permissions.

### Custom view-only and create-only roles

- [ ] Give a user only `products.view`; confirm the product list and details open while all create/edit/delete actions are absent and API writes are denied.
- [ ] Give a user `products.create` without `products.view`; confirm they can open the product creation form and required lookup metadata loads, but they cannot browse or open saved product records.
- [ ] Repeat view-only/create-only checks for customers and suppliers; confirm create-only users have a visible entry route and are not redirected to a forbidden list/detail after save.
- [ ] Give a user `sales.create` with the required `products.view` and `customers.view`; confirm they can create a draft without gaining sales list/detail access or approval rights.
- [ ] Give a user `purchases.create` with required product/supplier lookup; confirm draft creation works without granting order browsing/approval.
- [ ] Give a user `expenses.create`; confirm category/options and draft entry work, while saved expense history remains unavailable without `expenses.view`.
- [ ] Give a user `inventory.adjust` or `inventory.transfer`; confirm the role editor requires `inventory.view` and the correct form is reachable only with the corresponding action permission.
- [ ] Attempt invalid custom grants such as `sales.approve` without `sales.view`, `expenses.pay` without `expenses.view`, `reports.export` without `reports.view`, and `products.edit` without `products.view`; confirm the server rejects them with a useful message.

## Manual authorization/API checks

- [ ] With only `settings.view`, open Settings and accounting periods; confirm Payments & Finance ledger, expense pages, reports, customer balances, and payment endpoints remain denied.
- [ ] With only `settings.edit`, confirm current settings load for editing, but finance ledger and expense history remain denied.
- [ ] Open restricted routes directly by URL; confirm the page shows an access boundary or redirects to an accessible page without leaking record data.
- [ ] Call each corresponding restricted API directly; confirm it returns 403 even if the user bypasses the UI.
- [ ] Confirm `/business/users` is only accessible to user managers/readers, `/business/roles` only returns roles the caller may assign, and permission catalog/custom-role editing requires `roles.manage`.
- [ ] Confirm a non-Owner cannot assign the Owner role, edit/deactivate an Owner account, or remove the last active Owner.
- [ ] Change a custom role’s permissions; confirm affected users must sign in again and receive only the new permission set.
- [ ] Change a user’s role or deactivate the user; confirm their existing sessions are revoked.
- [ ] Confirm roles, user IDs, product/customer/supplier IDs, and finance records from another business are rejected (no cross-business access).
- [ ] Confirm a permission removed during system-role sync is no longer usable in the active session and obsolete permission labels do not remain in the role editor.
- [ ] Confirm the Owner/Admin/Manager/Salesperson default grants after a fresh business signup and after an existing user’s next login.

## Status and completion gate

- [ ] Complete every browser and API check above with the intended roles.
- [ ] Record any observed mismatch here and fix it before moving to the next phase.
- [ ] Mark this checklist green only after all applicable checks pass in the active local environment.
