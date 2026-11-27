# PHASE 5 — ULIZA (AI BUSINESS ASSISTANT) VERIFICATION

## Architecture

- `src/copilot/` module registered in `AppModule`.
- **`LlmProvider`** (`llm.provider.ts`) — OpenAI-compatible chat-completions client.
  Credentials server-side only via env: `ULIZA_LLM_BASE_URL`, `ULIZA_LLM_API_KEY`,
  `ULIZA_LLM_MODEL` (default `gpt-4o-mini`). 30s timeout, ≤4 tool-call rounds,
  graceful `null` on any failure.
- **`CopilotTools` + `TOOLS`** (`tools.ts`) — 6 direct-query tools (sales summary,
  top/worst products, inventory status, outstanding invoices, expenses, POs) +
  6 intelligence tools routed through verified `InsightsService`/`PredictionsService`.
  Every tool enforces `businessId` + `accessibleLocationIds`; no raw SQL, no writes.
- **`CopilotService`** — orchestrates: LLM tool-loop when configured, else
  deterministic **rules engine** (regex intent → tool → formatted result).
  History capped at 10 messages, roles whitelisted, content sliced — treated as
  untrusted context. System prompt forbids fabrication, distinguishes
  revenue/cash/balances, labels estimates, read-only.
- **`CopilotController`** — `GET /copilot/status`, `GET /copilot/suggestions`,
  `POST /copilot/chat` (JWT guard, business+user decorators, DTO validation).
- Frontend: `/dashboard/uliza` chat page (suggestions, history, loading, provider
  badge, dark-mode aware) + `lib/api/copilot.ts` + nav item "Uliza".

## Status legend

| Area | Status |
|---|---|
| Tool framework + authorization | IMPLEMENTED, UNIT TESTED |
| Rules engine (offline mode) | IMPLEMENTED, UNIT TESTED |
| LLM provider + tool loop | IMPLEMENTED (code path live-tested only via mocks) |
| Business/location isolation | IMPLEMENTED (reuses verified scoping utils) |
| UI chat page | IMPLEMENTED (tsc clean; NOT browser-verified) |
| Conversation persistence | NOT IMPLEMENTED (client-held history, capped) |
| Write actions + approvals | NOT IMPLEMENTED (read-only by design) |
| Audit logging of interactions | NOT IMPLEMENTED |
| Rate limiting / cost caps | PARTIAL (token cap per call; no per-user quota) |

## Tests

- `copilot.service.spec.ts`: **8/8 PASS** — tool routing (sales/risks/low-stock
  args), unsupported-question fallback (no fabrication), empty-message rejection,
  history capping, LLM-failure→rules fallback, honest tool-error surfacing.
- Bugs found & fixed during testing: "running low" intent missed; provider label
  incorrectly reported LLM name after fallback.
- `tsc --noEmit` backend+frontend clean; `eslint src/copilot` clean.

## To enable real LLM

Set in backend `.env`:
```
ULIZA_LLM_BASE_URL=https://api.openai.com/v1   # or any OpenAI-compatible endpoint
ULIZA_LLM_API_KEY=sk-...
ULIZA_LLM_MODEL=gpt-4o-mini
```
Restart backend — Uliza switches to AI mode automatically; rules engine remains
fallback. Core app works fully without keys.

## Known limitations

- No persistent conversation storage (privacy-friendly default; revisit with
  retention policy if wanted).
- No write/action tools — approval framework deferred to a later phase.
- LLM path not exercised against a real provider (no key in test env).
- No per-user rate limit or token-cost metering yet.
- Prompt-injection defenses are prompt-level + tool-scoping; retrieved data is
  data-only by construction (tools return JSON, system prompt forbids obeying it).

## Verdict

**B — Functional with known limitations.** Secure, data-grounded foundation with
working offline assistant + pluggable LLM; persistence, actions, and cost controls
are documented next steps, not defects.
