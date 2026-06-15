# Suara — Design Pass (decisions + architecture refinement)

> Outcome of the kickoff design pass. Resolves the open decisions in `PLAN.md §13`
> and refines the backend shape. Pairs with `CLAUDE.md` and `PLAN.md`.

## Context

Founder is kicking off the **Suara** build (all-voice, Michel-Thomas-method language
tutor; Mandarin launch; one engine for five languages). Rather than start coding, we
ran a **design pass** to (a) resolve the open decisions in `PLAN.md §13`, and (b)
correct one architectural assumption: the spec assumed a *full* backend (Node +
Fastify + self-hosted Postgres), which is heavier than the product needs.

The driving realization: only **three** things genuinely force server-side —
**secrets** (paid API keys can't ship in a client), the **shared TTS cache** (cost
model depends on synthesizing each teacher line *once* and reusing it across all
users via content-hash → central storage), and **central learner data** (the
`error_log` grain is the dataset that tells us the curriculum DAG is mis-ordered —
the #1 product risk's only mitigation). None of these require a heavy always-on
server, and `PLAN.md` already drops the real-time latency requirement, which removes
the main argument against serverless.

**Outcome of this pass:** lock the backend as *thin serverless + managed DB + object
storage*, settle all four §13 decisions, and update the docs to match.

---

## Decisions (resolved)

1. **Platform — mobile-first, web-capable.** Expo / React Native targeting iOS +
   Android now; keep React Native Web compiling so a browser build is near-free
   later. QA focuses on mobile. (Honors `CLAUDE.md §6`: web build uses in-memory +
   server round-trips only — no `localStorage`/`sessionStorage`.)
2. **Backend shape — thin serverless + managed DB + object storage.** Replaces the
   Fastify-monolith / self-hosted-Postgres assumption.
3. **Infra bundle — Hybrid:**
   - **Cloudflare R2** for the audio cache. *Decisive cost lever:* R2 has **zero
     egress fees**, and re-serving cached teacher audio to many learners is pure
     repeated egress — the dominant infra cost for an all-voice app.
   - **Supabase** for managed **Postgres + auth** (turnkey, fast to stand up).
   - **Serverless compute** for the key-holding proxy + turn orchestration.
     Recommend **Supabase Edge Functions** (keeps it to two vendors); **Vercel
     functions** acceptable if a Node runtime is preferred. Low-stakes and swappable
     because `core` is host-agnostic.
   - Batch pre-generation (`gen:audio`) runs as a **Node CI/CLI job** writing to R2
     (better suited than an edge function).
4. **Simulated classmates — supported, off by default.** The `classmateAttempt`
   field already exists in `TurnDecision`; build the plumbing but ship Phase 1 with
   classmates disabled. Enable after the core construct→score→coach loop is proven.
   No turn-lifecycle rework needed later.
5. **Provider keys — all available.** Anthropic, ElevenLabs, SpeechSuper, Azure
   ready. We still build/test on mocks (CI never calls live), but can exercise real
   providers as soon as the skeleton lands → faster Phase 1 demo.
6. **Curriculum — build in-house.** LLM drafts candidate sequences; a paid
   native-teacher **gates the ordering before Phase 2** expands the graph. ("License"
   is largely theoretical — MT's sequences are proprietary and none map to the
   recombination-DAG schema.) The 30-block starter unblocks Phase 1.
7. **Indonesian — `coached`-only.** Non-tonal, near-phonemic, forgiving; no `id-ID`
   vendor. Defer ms-MY-approximation scoring; revisit only if session data shows a
   gap. (Phase 3 concern — not urgent.)

---

## What does NOT change

The design pass is conservative — almost everything in the existing spec holds:

- The **six-layer architecture** and the **golden rule** (everything
  language-specific behind `LanguageConfig` + provider interfaces; `core` imports no
  provider/infra SDKs).
- All **MT invariants** (`CLAUDE.md §2`) and the **brain spec** / turn lifecycle.
- The **core interfaces** (`CLAUDE.md §5`) and **data model** (`PLAN.md §4`).
- **Drizzle ORM** stays — Supabase is Postgres, so the ORM choice is unaffected.
- The **monorepo + `packages/*` layout** stays. `packages/server` is reinterpreted as
  *thin serverless handlers that import `core`*, not a Fastify app. `core` remains a
  pure, host-agnostic engine — the serverless shift is purely the deployment shell.

---

## Doc edits to apply

1. **`CLAUDE.md §4` (Repo layout)** — change `/server` line from "API (Fastify),
   auth, persistence (Postgres + Drizzle)" to "thin serverless handlers + turn
   orchestration; auth + persistence via **Supabase Postgres (Drizzle)**; audio
   cache on **Cloudflare R2**." Note `/client` targets Expo **+ RN Web**.
2. **`CLAUDE.md §7` (Build/run/test)** — keep `pnpm dev` / `pnpm test` /
   `pnpm test:turn` / `pnpm gen:audio`; add a one-line note that the deploy shell is
   serverless (Supabase Edge Functions, swappable) and `gen:audio` writes to R2.
   Add R2/Supabase env vars to the required-env list (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL`, `R2_*`).
3. **`PLAN.md §9` (Tech stack)** — replace "Node + Fastify; Postgres + Drizzle;
   object storage" with the hybrid: *serverless compute (Supabase Edge Functions /
   Vercel) + Supabase Postgres (Drizzle) + Cloudflare R2 for audio*; client Expo +
   RN Web.
4. **`PLAN.md §13` (Open decisions)** — convert to a **Decisions** section recording
   the seven resolutions above (with the one-line rationale each).
5. **Optional:** add a 3–4 line "why R2" note to `PLAN.md §8` (Cost model) — zero
   egress on repeatedly-served cached audio is the single biggest infra-cost lever.

---

## Path forward

The build proceeds **one phase at a time** per the README. The immediate next slice is
**Phase 0 — Skeleton & contracts** (`PLAN.md §10`), now parameterized by the
decisions above:

- pnpm monorepo; `core/types` interfaces + `LanguageConfig`; provider stubs + mocks
  (including the `CoachedProvider` no-op scorer).
- Golden-path turn lifecycle running fully on mocks for **both** a scored (`tone`)
  and a `coached` config.
- Serverless handler shells (thin) that import `core`; no live API calls in CI.
- **Done when:** `pnpm test:turn` passes end-to-end on mocks for both configs.

---

## Verification (for this design pass)

1. **Boundary intact:** the serverless shift introduces **zero** new dependencies in
   `packages/core` — R2/Supabase/Anthropic SDKs live only in `packages/providers` and
   `packages/server`.
2. **Decisions traceable:** every former `§13` item appears in the new Decisions
   section with a one-line rationale; no open decision is silently dropped.
3. **Invariants untouched:** the edits change *tech stack + infra* only — no MT
   invariant, core interface, data-model field, or brain-spec contract is altered.
4. **Cost lever recorded:** the R2 zero-egress rationale is captured in `PLAN.md §8`.
