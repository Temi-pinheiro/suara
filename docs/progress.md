# Suara — Build Progress

> Snapshot as of 2026-06-15. Branch: `phase-0-skeleton`.
> **Status: Phase 0 + Phase 1 complete — 49 tests green, all typechecks clean.**
> Pairs with `PLAN.md` (spec) and `design-pass.md` (decisions).

---

## 1. Decisions locked (kickoff design pass)

| Decision | Resolution |
|---|---|
| Platform | Mobile-first (Expo), web-capable (RN Web) |
| Backend | Thin serverless + managed DB + object storage |
| Infra | **Cloudflare R2** (audio, zero egress) + **Supabase** (Postgres + auth) + serverless compute |
| Curriculum | Build in-house; native-teacher-gated before Phase 2 |
| Classmates | Supported in schema, **off by default** in Phase 1 |
| Indonesian | `coached`-only; defer ms-MY |
| Provider keys | All available |

Full rationale in `design-pass.md`; recorded in `PLAN.md §13`.

---

## 2. What's built (monorepo)

pnpm workspace, TypeScript (strict), Vitest. The golden rule holds: **`packages/core`
imports zero provider/infra SDKs** (verified).

| Package | Role | Status | Tests |
|---|---|---|---|
| `@suara/core` | Language-/host-agnostic engine: types + provider interfaces, invisible SRS, MT brain (persona + context + structured-output validators), turn lifecycle (`planTurn`/`completeTurn`/`runTurn`) | ✅ | 8 |
| `@suara/curriculum` | c01–c30 Mandarin seed + prereq-respecting DAG graph | ✅ | (via golden path) |
| `@suara/providers` | Real + mock providers behind core interfaces | ✅ | 18 |
| `@suara/server` | Composition root, two-phase turn handlers, Drizzle/Supabase store, R2 store | ✅ | 5 |
| `@suara/client` | Expo voice app: lesson state machine, tone scaffold, audio/api interfaces, UI | ✅ | 13 |
| golden-path gate | End-to-end turn on mocks (tone + coached) | ✅ | 5 |

**Providers implemented:**

| Interface | Real | Mock (CI) |
|---|---|---|
| `LLMProvider` (brain) | **AnthropicProvider** — Haiku/Opus tiering, prompt caching, forced tool-use | MockLLM |
| `TTSProvider` | **ElevenLabsTTSProvider** + content-hash cache over R2 | MockTTS |
| `ASRProvider` | **ScribeASRProvider** (ElevenLabs Scribe) | MockASR |
| `PronunciationProvider` | **AzureProvider** (self-serve, zh-CN tone + segmental) · **SpeechSuperProvider** (richest tone) · **CoachedProvider** (no-op, Indonesian) — vendor chosen by `pronunciation.provider` | MockPronunciation |
| `LearnerStore` | **DrizzleLearnerStore** (Supabase Postgres) | InMemoryLearnerStore |
| object cache | **R2ObjectStore** (`@aws-sdk/client-s3`) | InMemoryObjectStore |

---

## 3. Architecture as built (one turn, end to end)

The turn is split across two stateless HTTP calls (the learner records in between):

```
POST plan   → planTurn:    store.getState → brain.decideTurn → TTS(setup)   → PromptPacket (no answer leak)
  (learner builds & speaks — self-paced, no timer)
POST attempt → completeTurn: ASR ∥ Pronunciation → brain.interpretResponse → TTS(model) → persist(SRS)
                                                                              → AttemptResult (+ tone to coach)
```

- **Routing by `LanguageConfig`**, never `if (lang === …)`. Pronunciation routed by
  *mode* (tone/segmental/coached). Adding a language = config + curriculum seed +
  bindings, **zero `core` diffs** (proved by the coached Indonesian test).
- **Invisible SRS**: surfaces only as recombination targets; `known` (introduced)
  is distinct from `strength` (schedule). `rebuild` keeps a block out of `known` to retry.
- **MT invariants enforced structurally**: construct-first (model revealed only after
  the attempt), no countdown, no score shown; a CI gate asserts the brain never emits
  "remember/memorize/quiz/review…".
- **Cost levers**: TTS cached by `(voiceId, text)` hash → one object per teacher line,
  served from R2 (zero egress); brain persona + curriculum cached via `cache_control`;
  model tiering.

---

## 4. Verification status

**Verified in CI** (49 tests, `pnpm typecheck` + `pnpm --filter @suara/client typecheck`):
- Full turn lifecycle on mocks (tone + coached).
- SRS scheduling/mastery; TTS cache behavior; brain tiering + tool-use + persona gate;
  vendor request shaping (ElevenLabs/Scribe/SpeechSuper) + SpeechSuper result mapping;
  server handlers (advance, rebuild+toneFocus, coached routing, unknown-turn guard);
  client lesson machine + tone scaffold + mock API; client RN UI typechecks.

**NOT yet exercised live** (by design — no live calls in CI):
- Real vendor APIs against real keys (Anthropic/ElevenLabs/SpeechSuper).
- `DrizzleLearnerStore` / `R2ObjectStore` against a real Supabase DB / R2 bucket
  (typechecked only; no migrations run yet).
- The Expo app on a device/simulator (verified via tests + full RN typecheck).
- **SpeechSuper `coreType` + response field names** — structurally faithful, but
  confirm against your account; mapping is isolated + tested for easy tuning.
  (Not a blocker: SpeechSuper keys require waiting for their team to make contact.
  **Azure pronunciation assessment** is the self-serve alternative — set
  `pronunciation: { mode: 'tone', provider: 'azure' }` to use it instead, zero core
  diffs; Mandarin can also run in `coached` mode meanwhile.)

---

## 5. Run it

```bash
pnpm install
pnpm test            # 49 unit/integration tests (mocks; no live calls)
pnpm test:turn       # golden-path turn lifecycle gate
pnpm typecheck       # engine + providers + curriculum + server
pnpm --filter @suara/client typecheck   # RN/Expo client
pnpm --filter @suara/client start        # Expo dev (runs the standalone mock lesson)
```

Real providers activate when env keys are present (see `.env.example`): the client's
`MockSessionApi` swaps for an HTTP adapter to the server handlers; `prod.ts` builds
the real brain + TTS/ASR/pronunciation + Drizzle stores from env.

---

## 6. Phase status & what's next

- **Phase 0 — Skeleton & contracts:** ✅ done.
- **Phase 1 — Mandarin vertical slice:** ✅ all providers + brain + server + client +
  tone scaffold built and tested on mocks.
- **Remaining glue to a live demo** (small): client HTTP `SessionApi` adapter →
  server handlers; Drizzle migrations + Supabase project; pick the serverless shell
  (Supabase Edge Functions); seed the `components` table; smoke-test with real keys.
- **Phase 2 — Pedagogy hardening (next):** full ~150–250-component expert-reviewed
  Mandarin graph; optional classmates (turn on the existing schema field);
  `gen:audio` batch pre-generation pipeline → R2; cost instrumentation.
- **Phase 3:** Japanese/Korean/Hindi (segmental, add Azure for hi-IN) + Indonesian
  (coached) — the zero-`core`-diff acceptance test.

---

## 7. Commits (this branch)

```
3b39505 Phase 1: real vendor providers — ElevenLabs TTS+R2, Scribe ASR, SpeechSuper
a7d9f21 Phase 1: server composition root + two-phase turn handlers + Drizzle store
bc283c3 Phase 1: Expo voice client + audio-native Mandarin tone scaffold
8b85b22 Phase 1: AnthropicProvider (brain) with tiering, caching, tool-use
9b693cb Phase 0: monorepo skeleton, core engine, provider mocks, golden-path test
8263561 Apply design-pass decisions to CLAUDE.md and PLAN.md
```
