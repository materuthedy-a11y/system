# Phases 27, 29 and 30 — Implementation and acceptance checklist

**Code state:** Implementation is present for the items marked `[x]` under implementation. **Browser/device acceptance has not started.** No acceptance check in this file is green until it is observed with the application and recorded below.

**Order:** Finish the user's currently paused Phase 25 acceptance, then Phase 24, then Phase 23 as previously agreed. After those, test Phases 27, 28, 29, 30, 31 and 32 in sequence. Phase 28's detailed combined checklist is [PHASE28-EXPENSES-PAYMENTS-FINANCE-CHECKLIST.md](PHASE28-EXPENSES-PAYMENTS-FINANCE-CHECKLIST.md). Phase 30's detailed PWA matrix is [PHASE30-PWA-CHECKLIST.md](genuine-frontend/docs/PHASE30-PWA-CHECKLIST.md). Phase 31's role and authorization matrix is [PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md](PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md). Phase 32's audit trail and business history matrix is [PHASE32-AUDIT-TRAIL-CHECKLIST.md](PHASE32-AUDIT-TRAIL-CHECKLIST.md).

## Rules for acceptance

1. Run one numbered test at a time in the order below. Use isolated business records and note the account permission, browser/device, and expected server-side result.
2. A source review, migration file, build, or API response seen outside the UI is implementation evidence, not browser acceptance evidence.
3. On a failure, stop at that item, capture the result, fix it, and repeat the same item before moving on.
4. Never mark an item green from memory or from a pasted code section. Record the observed result and date.
5. Do not send real email/SMS or enter production provider credentials during local acceptance. Use a controlled test provider/account if that test is authorized.

## Phase 27 — Suppliers

### Implementation inventory

- [x] Connect the UI to the real business-scoped `/suppliers-customers/suppliers` endpoints and actual DTO field names.
- [x] Add the supplier directory with search, active/inactive/overdue filters, sort, pagination, loading/error/retry and empty states.
- [x] Add supplier creation and edit screens for required business details, phone/email validation, payment terms, opening balance on create, credit limit, optional primary contact, address and bank fields.
- [x] Add supplier profile with totals, credit utilization, monthly supplier statement, account movements, contact/address/bank details and purchase-order history linked to existing purchase order pages.
- [x] Use backend status change to deactivate/reactivate suppliers so historical purchasing records are retained.
- [x] Correct backend list sorting/pagination for overdue balances and actual last purchase dates; cap page size.
- [x] Make supplier edit and child contact/address updates atomic. Allow intentional removal of contacts and address.
- [x] Keep deletion out of the normal workflow when purchase history should be preserved; deactivate instead.

### Acceptance tests — do not mark green in advance

- [ ] 27.1 Open `/dashboard/suppliers` as a user with `suppliers.view`; verify rows, page-labeled summary values, status, payment terms, outstanding balances, loading and refresh. Confirm the summary does not imply business-wide totals when only the current page is aggregated.
- [ ] 27.2 Open the same page without `suppliers.view`; confirm API denial is explained and supplier data does not appear.
- [ ] 27.3 Search by supplier name, generated code, email and phone; combine search with status and verify result counts, empty state, reset-to-page-1 and next/previous pagination.
- [ ] 27.4 Verify newest, name, outstanding and last-purchase sorting both directions across more than one page; overdue must include only positive balances and report the filtered total.
- [ ] 27.5 Create a supplier with required fields and no optional fields; confirm generated code, defaults, saved values, toast and detail URL.
- [ ] 27.6 Create a supplier with a contact, complete address, tax ID, bank details, credit limit and opening balance; verify all fields and opening balance in the account statement.
- [ ] 27.7 Reject invalid/missing email, phone without country code, negative/invalid amounts, partially completed contact and partially completed address; confirm focus/error is useful and no record is created.
- [ ] 27.8 Attempt duplicate supplier name/code; confirm server conflict is visible and existing supplier data is unchanged.
- [ ] 27.9 Edit supplier contact, address and banking fields; clear contact and address deliberately; verify removed child records do not reappear after refresh and main supplier changes are not partially saved if any update fails.
- [ ] 27.10 Edit without `suppliers.edit`; confirm no save/status action is offered and the backend denies a direct mutation.
- [ ] 27.11 Deactivate/reactivate supplier; confirm status is persisted, purchase history remains intact, and the supplier availability in new purchase-order selection follows the server's active-supplier rules.
- [ ] 27.12 Load detail for missing/cross-business supplier IDs; confirm no data leaks and retry/error state is actionable.
- [ ] 27.13 Verify statement month changes, opening/purchases/payments/returns/closing totals and individual references against known purchase, payment and approved return records.
- [ ] 27.14 Open an order from supplier history; verify it resolves to the correct purchase order, location and status. Verify no-order state and multiple-page history behavior.
- [ ] 27.15 Reconcile supplier aggregate totals and credit utilization against backend purchases, active payments, approved purchase returns and opening balance, including overpayment/credit balance.
- [ ] 27.16 Check mobile and dark mode on list, form and detail; no page-level horizontal overflow, clipped bank/contact data, or inaccessible action controls.

## Phase 29 — Notifications

### Implementation inventory

- [x] Add typed frontend API calls for the actual inbox, mark-read, preferences, delivery log, and provider configuration routes.
- [x] Add per-user/per-event in-app preferences in Prisma and migration `20261106100000_phase29_notification_preferences`.
- [x] Apply saved in-app preferences when the backend creates event notifications; default remains enabled for every supported event.
- [x] Add a user-scoped inbox, read/unread filtering, pagination, mark-read action, known related-record links and actionable error/empty states.
- [x] Add server-side inbox search, mark-all-read, per-user archive/restore and per-user inbox-entry removal without deleting the shared delivery event or other recipients' entries.
- [x] Replace the disabled header bell with an unread count and foreground polling; show a toast for newly observed unread events after the initial load.
- [x] Add personal in-app preference switches and a workspace delivery log gated by settings permissions.
- [x] Add SMTP/SendGrid and Twilio/Africa's Talking configuration forms using existing encrypted backend config routes. Secret fields are never populated from server responses and are cleared after save.
- [x] Keep external channel secrets in the backend; the UI makes clear that saving replaces the stored credentials and requires re-entry.

### Acceptance tests — do not mark green in advance

- [ ] 29.1 Apply all pending Prisma migrations to the local database and confirm the notification preference table exists; do not run seed or destructive reset commands.
- [ ] 29.2 Open `/dashboard/notifications` as two users in one business; confirm inbox contents and unread counts remain user-specific.
- [ ] 29.3 Confirm a user in a different business cannot read, mark, or infer another business's inbox/preferences by changing IDs or request parameters.
- [ ] 29.4 Load an empty inbox, populated inbox, retry after temporary API error, unread-only filter, and multiple pages.
- [ ] 29.4a Search the inbox by subject, body and event type; verify server-side matching, pagination totals and no cross-user results.
- [ ] 29.5 Mark a notification as read; verify unread count and list state update immediately and remain correct after refresh/re-login.
- [ ] 29.5a Mark all active inbox entries as read; verify archived entries are unaffected and unread count becomes zero.
- [ ] 29.5b Archive, restore, and remove one inbox entry; verify only the signed-in user's entry changes and the workspace delivery log/other recipient inboxes remain intact.
- [ ] 29.6 Verify notification references open the matching invoice, purchase order, expense or product only when the reference type supports that internal route; unknown types remain readable without a broken link.
- [ ] 29.7 Change each in-app event preference; verify reload persistence and that future event generation obeys the saved preference while default-on behavior still works for unset preferences.
- [ ] 29.8 Verify the header badge updates after initial load, on focus and by polling; initial historical notifications must not fire a burst of arrival toasts.
- [ ] 29.9 Verify badge count cap, zero state, mobile header fit, reduced motion/accessibility and dark-mode colors.
- [ ] 29.10 As a user without `settings.view`, confirm the workspace delivery log is hidden and direct requests are denied; inbox and personal preferences remain available.
- [ ] 29.11 As a user without `settings.edit`, confirm external provider forms are unavailable and direct provider writes are denied.
- [ ] 29.12 Verify delivery log status filter, counts, pagination and empty state against known notification records.
- [ ] 29.13 Verify configuration status for absent email/SMS providers; save valid local test-provider settings and confirm toast/status after reload.
- [ ] 29.14 Confirm SMTP, SendGrid, Twilio and Africa's Talking credential validation matches backend DTO requirements; invalid inputs do not replace saved credentials.
- [ ] 29.15 Inspect browser storage, DOM and GET responses: provider secrets, auth headers/tokens and credential values must not be retained or rendered after save.
- [ ] 29.16 Confirm event preferences affect only in-app events; provider delivery and its retry status remain controlled by server provider configuration/outbox, not by a fabricated browser preference.
- [ ] 29.17 Confirm email/SMS delivery with controlled test destinations only; verify pending, sent, failed and retryable states from the delivery log, without sending customer messages.
- [ ] 29.18 Confirm stale/inactive users, expired sessions, permission changes and logout stop polling and cannot use a previous account's unread count.

## Phase 30 — PWA

### Existing implementation retained and reviewed

- [x] Keep Mizania manifest, app icons, standalone metadata, responsive install prompt, iOS add-to-home-screen guidance and charcoal dark-mode theme color.
- [x] Keep the versioned service worker app shell and branded offline page; only same-origin static build/public assets are cached. API, auth, tenant data, private pages and mutations are not cached/replayed.
- [x] Keep explicit local purchase-order draft persistence in IndexedDB, scoped to signed-in user and business; manual foreground sync reuses an idempotency key and requires `purchases.create`.
- [x] Keep approvals, receipts, payments, returns, inventory changes and all other business mutations online-only. No generic mutation queue, background replay, browser push, or sensitive API-response cache is enabled.
- [x] Bump app-shell cache version so this worker refresh does not reuse the prior cache namespace.
- [x] Keep update activation user-confirmed and make the offline page explain saved-draft limits.

### Acceptance tests

- [ ] Run every numbered item in [PHASE30-PWA-CHECKLIST.md](genuine-frontend/docs/PHASE30-PWA-CHECKLIST.md) in order. It covers manifest/assets, install, worker/update lifecycle, online/offline navigation, explicit draft storage/sync, security/session isolation, accessibility, supported browser/device differences and release operations.
- [ ] Confirm the final dark-mode PWA chrome/safe-area bars are charcoal on the actual installed app, and light mode remains readable; browser-chrome color is not inferred from the page background alone.
- [ ] Confirm the browser-PWA does not claim push notifications, automatic/background sync or offline business-data access unless those features are separately specified, implemented and accepted.

## Phase 31 — Permissions and authorization

- [x] Keep Phase 31 after Phase 30 PWA in the phase plan; its rules apply as security criteria to earlier modules as well.
- [x] Add the complete role, direct-route, API, delegation, session-revocation, and create-only/view-only acceptance matrix in [PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md](PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md).
- [ ] Run the Phase 31 matrix after the user completes Phases 25, 24, 23, 27, 28, 29 and 30; record results in that checklist.

## Phase 32 — Audit trail and business activity history

- [x] Add a tenant-scoped audit history page/API using existing domain audit records, explicit `audit.view` / `audit.export` authorization, secret redaction, actor snapshots, auth events and denied write-attempt events.
- [x] Add the detailed Phase 32 migration, privacy, permissions, event coverage and browser acceptance matrix in [PHASE32-AUDIT-TRAIL-CHECKLIST.md](PHASE32-AUDIT-TRAIL-CHECKLIST.md).
- [ ] Apply the Phase 32 database migration and complete its full browser/API acceptance matrix after Phase 31.

## Cross-phase checks and sign-off

- [ ] Run the acceptance sequence for Phase 25 first, then Phase 24, then Phase 23, respecting each existing numbered checklist.
- [ ] Run Phase 27, Phase 28, Phase 29, Phase 30, Phase 31, and Phase 32 acceptance in that order, stopping and fixing on the first failure.
- [ ] Review cross-links: supplier → purchase order/payment/return statement; notification → linked source; provider/outbox → notification delivery status; PWA draft → purchase order DRAFT only.
- [ ] Verify all protected routes enforce backend permissions and business tenancy; hidden frontend controls alone are insufficient evidence.
- [ ] Check browser console/network, database effects, audit trail, calculations, refresh persistence and mobile/dark-mode layout for every flow that mutates data.
- [ ] Record test evidence below for each phase; leave the phase in progress if any required check is unchecked or blocked.
- [ ] Mark a phase complete only when every applicable numbered check passes and its evidence has been recorded.

## Evidence log

| Test ID | Result and observed evidence | Date | Browser/device and safe fixture identifiers |
| --- | --- | --- | --- |
| — | No acceptance testing has started. This document records implementation scope only. | — | — |
