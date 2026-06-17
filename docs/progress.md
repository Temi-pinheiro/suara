# Suara — Build Progress

> Snapshot as of 2026-06-17. Branch: `phase-0-skeleton`.
> **Status: Phases 0–1 complete & validated live; Phase 2 substantially done; Phase 3
> architecturally complete — all FIVE languages run end-to-end on one engine with ZERO
> `core` diffs. 104 tests green, typechecks clean.** A real Mandarin turn runs end-to-end
> against every provider + Supabase + R2 (`pnpm turn`); Japanese/Korean/Hindi route through
> the same loop in `segmental` mode and Indonesian in `coached` mode (proven on mocks).
> Pairs with `PLAN.md` (spec) and `design-pass.md` (decisions).
>
> **Honest caveats:** the curricula are LLM-authored *drafts* (cmn 50 of the 150–250
> target; the four new languages ~30 each) and still need the PLAN.md §6 native-teacher
> gate before they're production curricula. Classmates are implemented + opt-in but not
> yet exercised on the live brain. Live validation so far is Mandarin only.

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
| `@suara/curriculum` | 5 language seeds — cmn (50) + jpn/kor/hin/ind (~30 each) — on a shared prereq-DAG graph, with a cross-language integrity test | ✅ | 26 |
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

**Verified in CI** (104 tests, `pnpm typecheck` + `pnpm --filter @suara/client typecheck`):
- Full turn lifecycle on mocks (tone + coached).
- SRS scheduling/mastery; TTS cache behavior; brain tiering + tool-use + persona gate;
  vendor request shaping (ElevenLabs/Scribe/SpeechSuper) + SpeechSuper result mapping;
  server handlers (advance, rebuild+toneFocus, coached routing, unknown-turn guard);
  client lesson machine + tone scaffold + mock API; client RN UI typechecks.

**NOT yet exercised live** (by design — no live calls in CI):
- Real vendor APIs against real keys (Anthropic/ElevenLabs/SpeechSuper).
- The Expo app on a device/simulator (verified via tests + full RN typecheck).
- **SpeechSuper `coreType` + response field names** — structurally faithful, but
  unverified (keys require waiting for their team). **Azure is the self-serve
  alternative and is what the live turn uses** — `pronunciation: { mode: 'tone',
  provider: 'azure' }`, zero core diffs. (Minor: Azure's per-syllable `unit` labels
  come back blank in the live output — scores + coaching are correct; label mapping
  is a small follow-up.)

**Validated live** (`pnpm smoke`, `pnpm turn`):
- All six services authenticate (`pnpm smoke`): Anthropic, ElevenLabs TTS + Scribe
  ASR, Azure, Supabase, R2.
- DB migrated (`pnpm db:migrate`) + curriculum seeded (`pnpm db:seed`, 30 rows).
- A full turn runs end-to-end (`pnpm turn`): real brain picks/recombines blocks
  (`我` → `我要茶`), Azure scores tones, the brain coaches contour, and mastery
  advances in Supabase (`known: ['c01','c02']`).

---

## 5. Run it

```bash
pnpm install
pnpm test            # 104 unit/integration tests (mocks; no live calls — also CI)
pnpm test:turn       # golden-path turn lifecycle gate
pnpm typecheck       # engine + providers + curriculum + server
pnpm --filter @suara/client typecheck   # RN/Expo client
pnpm --filter @suara/client start        # Expo dev (defaults to the local backend)
```

CI (`.github/workflows/ci.yml`) runs the typechecks + tests on every push/PR — all
on mocks, no keys.

With real keys in `.env` (see `.env.example`):

```bash
pnpm smoke                    # ping every provider (auth/connectivity), no secrets printed
pnpm db:migrate               # apply the schema to Supabase Postgres
pnpm db:seed [cmn|jpn|kor|hin|ind]   # load a language's curriculum into `components`
pnpm turn [user]              # one real end-to-end turn (SUARA_LANG=jpn pnpm turn → another language)
pnpm serve                    # local HTTP backend on :8787 (SUARA_LANG picks the language)
```

Run the app against the live backend: `pnpm serve`, then start the client. The client
defaults to `http://localhost:8787`; override with `EXPO_PUBLIC_SUARA_API` for a device
(LAN IP) or a deployed backend. There is no offline mock lesson — every turn is real.

`prod.ts` builds the real brain + TTS/ASR/pronunciation + Drizzle stores from env.

---

## 6. Phase status & what's next

- **Phase 0 — Skeleton & contracts:** ✅ done.
- **Phase 1 — Mandarin vertical slice:** ✅ all providers + brain + server + client +
  tone scaffold, tested on mocks **and validated live end-to-end** (`pnpm turn`).
- **App wiring:** ✅ framework-agnostic HTTP entry (`createHttpHandler`) + local dev
  server (`pnpm serve`, now `SUARA_LANG`-switchable across all five); client
  `HttpSessionApi` → those endpoints (uploads recorded audio); Expo records 16 kHz WAV
  on iOS for Azure. Client audio/UX reworked (learner-initiated playback, no autoplay
  wedge). The standalone mock client was removed — the app always hits the real backend.
- **Phase 2 — Pedagogy hardening:** 🟡 mostly done. ✅ `gen:audio` pre-gen pipeline +
  cost instrumentation (done earlier); ✅ Mandarin graph expanded 30 → 50 (DAG-validated);
  ✅ simulated classmates implemented as an opt-in `LanguageConfig.classmates` flag (core
  plumbing + persona + mock + tests). ⬜ Remaining: grow cmn to the full 150–250 and get
  the native-teacher review; exercise classmates on the live brain.
- **Phase 3 — Multi-language proof:** ✅ architecturally complete. Japanese/Korean/Hindi
  (`segmental`, Azure) + Indonesian (`coached`, no scorer) each have a `LanguageConfig`
  + a DAG-validated starter graph (~30 blocks) + registration — added as **data + config
  only, zero `core` diffs** (the acceptance test). A segmental turn and a coached turn
  each run the full loop on mocks. ⬜ Remaining: per-language curricula to full size +
  expert review; live validation beyond Mandarin; Android WAV transcode for Azure.
- **Cross-cutting to ship:** deploy `createHttpHandler` to a Supabase Edge Function;
  real Supabase auth (the `authenticate` hook is injected, dev uses `x-user-id`); client
  packaging (EAS / hosted web); onboarding/session UX.
- **Phase 4 — Fluency runway:** not started (free-conversation, analytics, literacy).

---

## 7. History

See `git log --oneline main..phase-0-skeleton` for the full commit history (design
pass → Phase 0 skeleton → Phase 1 brain/client/server/providers → live validation +
hardening fixes found by the first real turn).
