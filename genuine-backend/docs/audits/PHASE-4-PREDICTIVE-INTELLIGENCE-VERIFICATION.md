# PHASE 4 — PREDICTIVE INTELLIGENCE VERIFICATION

## Architecture

- `src/intelligence/forecast.ts` — pure forecasting library (no DB): daily-series
  builder, candidate methods (SEASONAL_WEEKLY, TREND, MOVING_AVERAGE, NAIVE),
  chronological backtesting (14-fold, 1-day-ahead MAE), model selection by lowest
  backtest MAE, confidence classification, `predictStockout`, `predictOverstock`.
- `src/intelligence/predictions.service.ts` — business/location-scoped aggregation
  (bounded `findMany`/`groupBy`, `take` caps), reuses `accessibleLocationIds`,
  `assertLocationAccess`, `computeReorderMath`.
- `src/intelligence/predictions.controller.ts` — `GET /api/v1/insights/predictions/*`,
  JwtAuthGuard + PermissionGuard + `insights.view`.
- Frontend: new **Forecasts** tab on `/dashboard/intelligence` — stockout, overstock,
  churn tables + cash-flow cards, 7/14/30-day horizon switch, loading/empty states,
  semantic risk badges, dark-mode aware.

## Prediction methods (IMPLEMENTED + UNIT TESTED + LIVE TESTED)

| Capability | Method | Status |
|---|---|---|
| Demand forecast (7/14/30d) | Backtest-selected among seasonal-weekly (≥56d), damped trend, 14d MA, naive; INSUFFICIENT_DATA <14d | UNIT+LIVE |
| Stockout prediction | available+incoming vs daily demand; stockout date, risk tier, horizon flag | UNIT+LIVE |
| Overstock prediction | coverage-days vs 60d target; excess units/value, risk | UNIT+LIVE |
| Customer churn | Heuristic recency/frequency (≥3 invoices required; else INSUFFICIENT) | LIVE |
| Cash flow | Actual 30d net + overdue receivables + due-in-horizon, explicitly separated | LIVE |
| Expiry prediction | Covered by Phase 2 EXPIRY_RISK detector (batch+expiry evidence); no separate forecast endpoint | NOT IMPLEMENTED as forecast |

## Forecasting quality

- Chronological backtesting only — no future leakage (each fold predicts held-out
  day from prior data only).
- Baseline comparison: backtest MAE vs moving-average baseline; confidence HIGH only
  when winner beats baseline by >10%.
- Zero-demand, intermittent (<30% coverage), and volatile series handled; negative
  forecasts clamped to 0.
- `dataSufficiency` + `factors[]` explainability returned on every demand forecast.

## Persistence decision

**Not persisted** — forecasts are computed on demand from live data (reproducible,
always fresh, no stale-prediction lifecycle needed). Documented trade-off: repeated
calls recompute; queries are bounded (`take` caps, groupBy aggregation). If volume
grows, add a cached `Prediction` table — flagged as future work, not a defect.

## API endpoints

- `GET /insights/predictions/demand/:productId?locationId&horizon` (7/14/30)
- `GET /insights/predictions/stockout`
- `GET /insights/predictions/overstock`
- `GET /insights/predictions/churn`
- `GET /insights/predictions/cashflow?days` (7/14/30)

All require `insights.view`; business+location scoping enforced server-side.

## Test results

- `forecast.spec.ts`: **11/11 unit tests** (steady/zero/intermittent demand,
  insufficient data, seasonal, stockout critical/incoming/zero-demand, overstock).
- `intelligence.live-db.spec.ts`: **10/10 live tests** incl. 3 new prediction tests
  (demand forecast structure, stockout rows + restricted-location scoping,
  overstock/churn/cashflow + invalid-horizon rejection).
- Full suite: **211/211 PASS**; `tsc --noEmit` backend+frontend clean;
  `eslint src/intelligence` clean.

## Security

- Restricted user verified live: cannot forecast locA2 demand; stockout results
  filtered to managed locations only.
- Cross-business isolation via `businessId` scoping on every query.

## Known limitations

- No dedicated expiry-*forecast* endpoint (detector covers current expiry risk).
- Churn is heuristic scoring, explicitly labeled — not a statistical probability.
- Cash-flow forecast shows actuals + expected receivables/payables; no ML projection
  of future collections.
- Lead time in stockout list uses default 7d (supplier-specific lead times live in
  reorder engine — noted for consolidation).
- No load testing; UI not browser-tested this phase.
- No prediction persistence/evaluation-history table.

## Verdict

**B — Implemented with known limitations.** Core forecasting, explainability,
backtesting, scoping, UI and tests are real and verified; expiry-forecast endpoint,
persistence, and load validation remain for a future hardening pass.
