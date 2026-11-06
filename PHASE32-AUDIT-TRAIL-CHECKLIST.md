# Phase 32 — Audit trail and business activity history

Status: implementation is in progress. Browser/API acceptance is pending. Keep Phase 25 acceptance paused at its current checkpoint; resume it after this phase's code and migration are ready, then return to the previously agreed Phase 25 → 24 → 23 test order. Audit access and privacy checks in this file are a separate Phase 32 acceptance gate.

## Implementation scope

- [x] Reuse the existing tenant-scoped `AuditLog` records created by sales, inventory, purchases, finance, customers, suppliers, settings, roles, users and report services.
- [x] Add an Audit log page and business-scoped list/detail/export API. The browser and every API route enforce `audit.view`; CSV export separately requires `audit.export`.
- [x] Add search, date range, action, record-type filters, pagination, before/after details, actor details, time, IP address and user-agent display.
- [x] Redact credential-like keys (passwords, tokens, secrets, API keys, auth/cookie data and hashes) from event details and CSV exports.
- [x] Add sign-in, rejected known-user sign-in, sign-out, password-change, password-reset and denied write-permission events. Never record password values, reset tokens, or submitted request bodies.
- [x] Keep actor name/email snapshots in the database so user deletion does not erase the history or lose attribution; existing rows are backfilled by migration.
- [x] Keep audit storage append-only from the product API: only list, detail and export endpoints exist; no edit/delete route is provided.
- [x] Add tenant/date/action/entity indexes for the audit query workload.
- [x] Keep Audit access independent of `settings.view`; sidebar and settings shortcut appear only when `audit.view` is granted.

## Required database/deploy work

- [ ] Apply `genuine-backend/prisma/migrations/20261106120000_phase32_audit_trail` to local database with `pnpm db:migrate:deploy`.
- [ ] Apply the same migration to the online database during deployment.
- [ ] Confirm migration backfills actor snapshots and changes user deletion behavior to preserve audit rows.

## Role and access acceptance

- [ ] Owner can view/export all audit entries belonging to their own business.
- [ ] Admin can view/export when their role grants the audit permissions; no permission is inferred from Settings.
- [ ] Manager has no Audit menu/page/API access unless an Owner/Admin explicitly grants `audit.view`.
- [ ] Salesperson has no Audit menu/page/API access unless explicitly granted `audit.view`.
- [ ] A custom role with `audit.view` can search and inspect history but cannot export unless separately granted `audit.export`.
- [ ] A custom role with `audit.export` but no `audit.view` is rejected by permission dependency validation.
- [ ] Direct cross-business IDs and queries cannot expose another business's logs.
- [ ] Browser sidebar, direct route, list/detail API and export API all agree on the signed-in user's permissions.

## Event coverage and data safety

- [ ] Create/update/delete, approval/rejection/cancellation, payment, receipt, return, stock movement, role/user/settings changes and report exports appear with the right actor/action/time/record reference.
- [ ] Successful login/logout and password change/reset are recorded; known inactive/incorrect-password sign-in attempts and denied write-permission attempts are recorded without capturing credentials.
- [ ] Before/after details are readable and sensitive-key fields remain `[REDACTED]` in both page and CSV.
- [ ] Actor attribution remains readable after a user is deactivated or deleted.
- [ ] Audit entries remain after a referenced operational record is later removed; business deletion behavior is explicitly confirmed as retention policy.
- [ ] Browser console and network show no unauthorized data leakage; filters and pagination preserve business scope.
- [ ] CSV opens correctly, quotes delimiters/newlines, includes active filters and never includes secrets.
- [ ] Mobile and dark-mode audit page remain legible and usable.

## Final gate

- [ ] Run backend and frontend production builds; resolve all errors before commit/deploy.
- [ ] Complete the role/API/data-safety checks above and mark observed results green only after evidence is confirmed.
- [ ] Do not treat stored domain events, application log files, notifications or dashboard activity as substitutes for this auditable business history.
