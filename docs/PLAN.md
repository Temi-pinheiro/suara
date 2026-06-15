# Suara — Build Specification & Plan

> Source of truth for scope, architecture, and delivery. Pairs with `CLAUDE.md`.
> Status: v1 spec, ready for build handoff.

---

## 1. Vision & scope

Build an **all-voice, self-paced language tutor** that recreates a 1:1 lesson and
takes a learner from zero to **spoken fluency**, using the **Michel Thomas method**.

- **Supported languages:** Mandarin (launch), Japanese, Korean, Indonesian, Hindi —
  all on one shared teaching engine.
- **In scope:** spoken comprehension + production; pronunciation feedback; beginner →
  conversational fluency.
- **Out of scope (v1):** reading/writing of scripts; gamified streaks/leaderboards;
  social features.
- **Explicitly NOT required:** real-time latency, on-screen text reliance.

"Fluent" = **spoken fluency** (confident real-time comprehension + production in
everyday domains). Literacy is a deliberate future track (§11); the data model is
built so it can be added without re-architecture.

---

## 2. The Michel Thomas method → product rules

| MT principle | Concrete product rule | Where enforced |
|---|---|---|
| Don't memorize; teacher owns retention | No flashcards/quizzes/streaks; no "you forgot" copy | UI + brain persona |
| Building blocks, smallest first | Atomic unit = `Component` in a prereq DAG | `curriculum/` |
| Strict sequencing + constant recombination | Every prompt reuses prior blocks | brain + SRS |
| Construct, don't repeat | Learner produces a novel sentence first, then hears model | turn lifecycle |
| Learn through L1, zero anxiety | English setup/explanations; reassuring tone | brain persona |
| Reveal the structure | Teach generative rules, not word lists | brain prompts |
| Two students + you | Optional simulated "classmates" who attempt & sometimes err | TTS, optional |
| Self-paced | Learner answers when ready; pre-generated audio | client + turn |

**Mandarin tone scaffold:** the MT colour/gesture mnemonic is visual and doesn't
transfer to all-voice. Replace with an **audio-native** scaffold: spoken contour
description, an exaggerated sung model, and a consistent verbal mnemonic per tone.
This is where the app *exceeds* the CDs — they only model a tone and hope; we verify
production with the scorer.

---

## 3. System architecture

Six decoupled layers. Language-specific behavior lives entirely in `LanguageConfig`
+ provider bindings + the per-language curriculum graph. **The teaching engine is
identical across all five languages.**

1. **Curriculum graph** — ordered `Component` DAG; the pedagogical IP.
2. **Tutor Brain (LLM)** — plans the next block/prompt; interprets the response into
   warm feedback + the next move. Provider-agnostic; Claude default.
3. **TTS** — ElevenLabs; one native target voice + one L1 voice (+ optional classmate
   voices). Heavily cached/pre-generated.
4. **ASR** — transcribes the learner ("what did they say"). Scribe / Whisper.
5. **Pronunciation feedback** — three modes (§5). Reference-based when scored.
6. **Learner store + invisible SRS** — mastery, error history, recombination scheduling.

### Turn lifecycle (latency-relaxed, async)

```
1. PLAN     Brain reads LearnerState + CurriculumGraph
            → picks next block OR a recombination target
            → outputs: target sentence (+ romanization/expected tones), English setup, reference
2. PROMPT   TTS speaks English setup + (optional) a classmate attempt; poses the build task
3. PAUSE    Self-paced. Learner thinks, then speaks. (No timer.)
4. CAPTURE  Record learner audio
5. SCORE    ASR ∥ Pronunciation  (parallel)
            - tone/segmental modes: call PronunciationProvider with reference text
            - coached mode: skip scorer; brain will coach from the model audio
            → ResultPacket { transcript, perSyllable?[], tone?[] }
6. REACT    Brain interprets → reveal native model + gentle correction; advance vs re-build
7. SPEAK    TTS speaks the model answer + warm fix
8. PERSIST  Update mastery; log error grain; reschedule (invisible SRS)
9. LOOP     Next turn, slightly harder, recombining the weak block soon
```

See `mt-tutor-turn-flow.mermaid` for the diagram.

---

## 4. Data model (Postgres; Drizzle ORM)

```
users(id, l1='eng', created_at)
enrollments(user_id, lang, level_estimate, started_at)

components(
  id, lang, kind,            -- kind: word | connector | pattern | function
  surface,                   -- target-language form (+ romanization)
  gloss_en,                  -- English meaning / rule
  expected_tones,            -- nullable; cmn only
  prereq_ids[],
  intro_audio_ref,           -- pre-generated
  model_audio_refs[])

mastery(user_id, component_id, strength, last_seen, due_at)   -- drives invisible SRS

turns(
  id, user_id, lang, component_id, prompt_text, reference_text,
  transcript, overall_score, error_detail_jsonb, decision, ts)

error_log(user_id, lang, unit, expected, produced, count, last_ts)  -- syllable/phoneme grain
sessions(id, user_id, lang, started_at, ended_at, turn_count)
```

`error_detail_jsonb` (Mandarin): `[{ "syllable":"mai","expected":"3","produced":"2","score":58 }]`.
For segmental/coached languages it stores phoneme-level or qualitative notes. This
grain lets the brain target the exact failure and is reusable by a future reading layer.

---

## 5. Per-language capability matrix & feedback modes

Voice (ElevenLabs) and ASR (Scribe/Whisper) cover all five. Only the pronunciation
feedback layer varies — and only **Mandarin** needs true tone scoring.

| Lang | Phonology | Feedback mode | Provider | Notes |
|---|---|---|---|---|
| Mandarin (cmn) | Tonal (4+neutral) | **tone** | SpeechSuper (initial/final/**tone**); Azure zh-CN; iFlytek | Richest support; the one language that needs tone scoring |
| Japanese (jpn) | Pitch-accent | **segmental** | Azure ja-JP; SpeechSuper | Pitch-accent treated as advisory only |
| Korean (kor) | Non-tonal | **segmental** | Azure ko-KR; SpeechSuper | Emphasize tense/aspirated stop trios, final consonants |
| Hindi (hin) | Non-tonal | **segmental** | Azure hi-IN | Emphasize retroflex/dental + 4-way stop distinctions |
| Indonesian (ind) | Non-tonal | **coached** | none (brain-coached); optional Azure ms-MY approx | Nearly phonemic + forgiving; no scoring vendor needed |

Notes:
- Azure pronunciation assessment confirmed for zh-CN, ja-JP, ko-KR, hi-IN
  (accuracy/fluency/miscue). Finest phoneme/syllable detail is richest for zh-CN/en-US;
  for ja/ko/hi the accuracy + fluency scores are sufficient, with the brain turning
  them into coaching.
- **Indonesian has no native pronunciation-assessment vendor (no id-ID).** This is a
  non-issue: Indonesian is non-tonal with near-phonemic spelling and a simple sound
  system, so `coached` mode (model-and-imitate + qualitative cues from the brain)
  delivers the full MT teaching feel. Optional: approximate automated scoring via
  Azure **Malay (ms-MY)**, which is closely related — validate before relying on it.
- **No hard scoring gap remains** in this language set. The pronunciation layer
  degrades gracefully from tone → segmental → coached, all behind one interface.

---

## 6. The curriculum graph (the real IP)

The method lives or dies on the **sequence**, so this is the highest-leverage and
highest-risk asset.

1. **Decompose** the language into MT-style atoms (functional words, connectors,
   high-frequency verbs, patterns), ordered by enabling power, not frequency alone.
2. **Author the DAG** with explicit prerequisites and "first recombination" hints.
3. **Bootstrap with the LLM, gate with a native-teacher expert.** The brain drafts
   candidate sequences + construction prompts; an expert signs off on ordering and
   naturalness. The LLM must not freestyle the backbone at runtime.
4. **Per-language graphs are separate files, shared schema.** Mandarin first; reuse
   the authoring playbook for the rest.

Mandarin MVP target: ~150–250 components covering survival + everyday domains to a
low-intermediate spoken plateau, expandable.

---

## 7. Pronunciation handling

- **Reference-based when scored.** We always know the target, so we pass
  `referenceText` and get per-unit scores. Free conversation at higher levels relaxes
  this; feedback becomes advisory there.
- **By mode:**
  - *tone (cmn):* surface tone scores; brain coaches contour ("dip then rise").
  - *segmental (jpn, kor, hin):* phoneme/word accuracy; brain highlights the known
    hard contrasts; for jpn, pitch-accent misses are advisory, not blocking.
  - *coached (ind):* no scorer; brain compares against the native model audio and
    gives a single warm, specific cue. Feels identical to the learner.
- **UX rule:** scores never shown as a grade. Brain converts signal → one warm cue,
  then a re-build opportunity. Two misses → move on, requeue softly.

---

## 8. Cost model & optimizations

- **TTS:** cache by content hash; pre-generate all component intros + model answers
  via batch. Only dynamic feedback is synthesized on demand (and not in real time).
- **Audio storage on Cloudflare R2 (zero egress):** the cache re-serves the *same*
  teacher-audio files to every learner — pure repeated egress, the dominant infra
  cost for an all-voice app. R2 charges no egress, so this is the single biggest
  infra-cost lever; storage/DB/compute are a rounding error next to the API bills.
- **LLM:** prompt-cache the static persona + curriculum context; tier models; batch
  offline generation. Verify current caching/batch details at docs.claude.com.
- **Scoring:** pronunciation APIs bill per request; debounce retries, skip empty/aborted
  audio. Indonesian incurs no scoring cost at all (`coached`).

---

## 9. Tech stack (recommended)

- **Language:** TypeScript, pnpm monorepo.
- **Server:** thin serverless compute (Supabase Edge Functions by default; Vercel
  functions if a Node runtime is preferred) — key-holding proxy + turn orchestration.
- **Data/storage:** Supabase Postgres (Drizzle ORM); Cloudflare R2 for the audio
  cache (zero egress — see §8). `gen:audio` is a Node batch job writing to R2.
- **Client:** Expo / React Native, mobile-first + RN Web (web-capable); minimal UI.
- **Providers:** Anthropic (brain), ElevenLabs (TTS/ASR), SpeechSuper + Azure
  (pronunciation). All behind the interfaces in `CLAUDE.md §5`.

Founder may swap any of these; the interfaces are the contract.

---

## 10. Phased roadmap

### Phase 0 — Skeleton & contracts (1–2 wks)
- Monorepo, `core/types` interfaces, `LanguageConfig`, provider stubs + mocks
  (including a `CoachedProvider` no-op scorer).
- Golden-path turn lifecycle running fully on mocks.
- **Done when:** `pnpm test:turn` passes end-to-end on mocks for both a scored
  (tone) and a coached config.

### Phase 1 — Mandarin vertical slice (3–5 wks)
- Real ElevenLabs TTS (2 voices) + Scribe ASR + **SpeechSuper** tone scoring.
- Brain persona (MT invariants) + decideTurn/interpretResponse with prompt caching.
- ~30-component starter graph; learner store + invisible SRS; Expo voice client.
- Audio-native tone scaffold for Mandarin.
- **Done when:** a real beginner completes a 15-min session, builds novel sentences,
  gets gentle tone feedback — with no "review/quiz" surface anywhere.

### Phase 2 — Pedagogy hardening (2–4 wks)
- Full ~150–250-component Mandarin graph (expert-reviewed).
- Optional simulated classmates (3rd voice + instructive errors).
- Pre-generation/caching pipeline (`gen:audio`); cost instrumentation.
- **Done when:** a learner progresses across sessions with retention driven purely by
  recombination, and per-turn cost is within target.

### Phase 3 — Multi-language proof (3–5 wks)
- Add **Japanese, Korean, Hindi** via config + graphs + Azure `segmental` routing
  (**zero `core` diffs** — this is the acceptance test).
- Add **Indonesian** in `coached` mode (no scorer) — proves graceful degradation and
  that the teaching feel is preserved without a pronunciation vendor.
- **Done when:** all five run; Indonesian feels identical to the scored languages
  apart from the absence of a numeric tone/phoneme signal.

### Phase 4 — Fluency runway & scale (ongoing)
- Free-conversation mode (advisory scoring) for intermediate+ learners.
- Graph extension toward conversational domains; analytics on error decay.
- Optional literacy track (§11).

---

## 11. Future tracks (designed-for, not built)

- **Reading layer:** `components` already stores surface forms + tones; a
  script-recognition + reading-construction mode reuses it without migration.
- **More languages:** any ElevenLabs-supported language; pick a feedback mode
  (tone/segmental/coached) by its phonology.
- **Better Indonesian scoring:** swap `coached` → a custom or ms-MY-based scorer
  behind the existing interface if data shows it's worth it.

---

## 12. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Curriculum sequencing wrong/unnatural | High | Native-teacher review gates every graph; iterate from real session data |
| LLM breaks MT persona (drifts into quizzing) | Med | Persona tests + output-copy lint; signal→copy always via brain |
| TTS pronunciation fidelity for modeling | Med | Audition voices per language; v3 for expressive models; SSML phoneme tags to force pronunciation |
| Cost blowout from per-turn API fan-out | Med | Caching + pre-gen + prompt caching + model tiering (§8) |
| `coached` Indonesian feels lower-quality | Low | Strong native model audio + brain cues; Indonesian is forgiving; optional ms-MY scoring later |
| Over-reliance / no human practice | Low | Position as practice partner; encourage real-world use |

No hard pronunciation-scoring gap remains in the chosen language set.

---

## 13. Decisions (resolved at kickoff)

> Resolved in the kickoff design pass — see `docs/design-pass.md` for full rationale.

1. **Platform — mobile-first, web-capable.** Expo (iOS/Android) now; keep RN Web
   compiling so a browser build is near-free later. QA on mobile.
2. **Backend — thin serverless + managed DB + object storage.** Replaces the
   Fastify-monolith assumption. Infra: Cloudflare R2 (audio) + Supabase
   (Postgres + auth) + serverless compute. `core` stays host-agnostic.
3. **Curriculum — build in-house.** LLM-drafted, native-teacher-gated before Phase 2.
   ("License" is largely theoretical — MT sequences are proprietary and don't map to
   the recombination-DAG schema.) The 30-block starter unblocks Phase 1.
4. **Simulated classmates — supported, off by default.** `classmateAttempt` stays in
   the schema; ship Phase 1 with classmates disabled, enable once the core loop is
   proven. No turn-lifecycle rework later.
5. **Indonesian — `coached`-only.** Non-tonal, near-phonemic, no `id-ID` vendor;
   defer ms-MY scoring, revisit only if session data shows a gap.
6. **Provider keys — all available.** Build/test on mocks (CI never calls live);
   exercise real providers from Phase 1.
