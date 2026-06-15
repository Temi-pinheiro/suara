# CLAUDE.md

> Operational context for any AI/human engineer working in this repo.
> Read this fully before writing code. Project: **Suara** ("voice / sound / tone", from Sanskrit svara).

## 1. What this is

An **all-voice** language tutor that simulates a 1:1 lesson and carries a learner
from absolute beginner to **spoken fluency**, built on the **Michel Thomas (MT)
method**. Launch language: **Mandarin**. Supported set: **Mandarin, Japanese,
Korean, Indonesian, Hindi** — all run on the *same* teaching engine.

There is **no reading requirement** and **no live/real-time latency requirement**.
The experience is audio-first and self-paced.

## 2. Non-negotiable product principles (MT invariants)

These are pedagogy, not preference. Do not "optimize" them away.

1. **No memorization, ever — the teacher carries retention.** No flashcards,
   "review" screens, scores-as-grades, streak pressure, or "you forgot X" copy.
   Retention is engineered by *recombination*, not drilling.
2. **Invisible SRS.** Spaced repetition runs server-side; its ONLY surface
   expression is *which prior building blocks get folded into the next sentence
   the learner constructs*. The learner never experiences a "review."
3. **Construction over repetition.** The learner *builds* a novel sentence from
   known blocks and speaks it FIRST, then hears the model. Not "repeat after me."
4. **Smallest blocks, strict sequencing, constant recombination.** Introduce the
   next smallest unlocked component, then immediately reuse it with everything
   prior. The *ordering* is the core IP (see `curriculum/`).
5. **Low-anxiety, English-scaffolded persona.** Prompt/explain in the learner's L1,
   stay warm, and explicitly tell the learner not to try to remember. Teach the
   generative *rule*, not vocab lists.
6. **Gentle pronunciation feedback.** Correction is delivered as a teacher would
   ("almost — let it dip then rise"), never as a red score. Scoring is a backend
   signal; its UX surface is warm and optional.
7. **Self-paced.** Learner answers when ready (tap/voice-activated). No countdowns.
   Pre-generate audio; never block on real-time turn latency.

## 3. Architecture — the golden rule

Six layers. **Everything language-specific lives behind a provider interface +
`LanguageConfig`.** Adding/swapping a language = config + curriculum + provider
bindings, never editing core logic.

```
Curriculum graph ──► Tutor Brain (LLM) ──► TTS ──► [learner speaks]
        ▲                   ▲                          │
        │                   │                          ▼
  Learner store ◄──── scoring fan-in ◄──── ASR  +  Pronunciation feedback
   (+ invisible SRS)                         (what they said) (how well — per-lang mode)
```

The **same teaching engine drives all five languages.** Only the thin pronunciation
feedback layer varies, via three modes (see §5 and `/docs/PLAN.md`).

## 4. Repo layout

```
/packages
  /core            # language-agnostic engine. NO provider SDKs imported here.
    /turn          # turn lifecycle orchestration
    /srs           # invisible spaced-repetition scheduler
    /brain         # prompt assembly, turn-decision schema, persona
    /types         # shared domain types + provider interfaces
  /providers
    /llm           # AnthropicProvider, ... (implements LLMProvider)
    /tts           # ElevenLabsProvider (implements TTSProvider)
    /asr           # ScribeProvider / WhisperProvider
    /pronunciation # SpeechSuperProvider, AzureProvider, CoachedProvider (no-op scorer)
  /curriculum      # component dependency graphs, one per language (the IP)
  /server          # thin serverless handlers + turn orchestration; auth +
                   #   persistence via Supabase Postgres (Drizzle); audio on Cloudflare R2
  /client          # Expo / React Native (+ RN Web) voice app (mic, playback, minimal UI)
/docs
  PLAN.md          # full build spec — source of truth for scope & phases
  language-matrix.md
```

**Hard rule:** `packages/core` must compile with zero provider SDK dependencies.
Providers depend on core interfaces, never the reverse.

## 5. Core interfaces (authoritative — keep in `core/types`)

```ts
type LangCode = 'cmn' | 'jpn' | 'kor' | 'ind' | 'hin';

// Pronunciation feedback ranges over three modes:
//   'tone'      -> Mandarin only (initial/final/tone scoring)
//   'segmental' -> Japanese, Korean, Hindi (phoneme/word accuracy)
//   'coached'   -> Indonesian (no scoring vendor; brain coaches from model audio)
type PronMode = 'tone' | 'segmental' | 'coached';

interface LanguageConfig {
  code: LangCode;
  l1: 'eng';
  phonology: 'tonal' | 'pitch-accent' | 'non-tonal';
  toneInventory?: string[];                   // cmn only, e.g. ['1','2','3','4','neutral']
  tts: { provider: string; targetVoiceId: string; l1VoiceId: string;
         classmateVoiceIds?: string[] };
  pronunciation: { mode: PronMode; provider?: string };  // provider omitted when 'coached'
}

interface LLMProvider {                        // the "teacher brain"
  decideTurn(ctx: TurnContext): Promise<TurnDecision>;
  interpretResponse(r: ScoredResponse, ctx: TurnContext): Promise<Feedback>;
}

interface TTSProvider {
  synth(text: string, voiceId: string, lang: LangCode): Promise<AudioRef>;
  // implementations must cache by (text, voiceId) hash — see cost rules
}

interface ASRProvider {
  transcribe(audio: AudioBlob, lang: LangCode): Promise<{ text: string }>;
}

interface PronunciationProvider {              // reference-based; we always know the target
  score(audio: AudioBlob, referenceText: string, lang: LangCode): Promise<PronScore>;
  // PronScore: { overall, perSyllable[], tone?[] }
  // CoachedProvider returns nulls; the brain supplies qualitative feedback instead
}

interface LearnerStore {
  getState(userId: string, lang: LangCode): Promise<LearnerState>;
  recordTurn(userId: string, lang: LangCode, t: TurnRecord): Promise<void>;
}

interface CurriculumGraph {
  nextUnlocked(state: LearnerState): Component[];          // respects prereqs
  recombinationTargets(state: LearnerState): Component[];  // SRS-driven, invisible
}
```

If a signature here changes, update `PLAN.md` in the same PR.

## 6. Conventions & guardrails

- **Never** import a provider SDK into `core`. Route by `LanguageConfig`, not `if (lang === ...)`.
- In **`coached`** mode the turn lifecycle skips the scorer entirely; the brain
  generates pronunciation feedback from the native model audio + known difficulties.
  This path must feel identical to the learner — same warmth, same flow.
- **Never** persist API keys/secrets in code or the learner store.
- **Client storage:** in-memory + server round-trips only. (Web build: no
  `localStorage`/`sessionStorage`.)
- **Cost discipline (required):**
  - Cache all TTS by content hash; teacher lines are highly reusable.
  - Pre-generate component-introduction + model-answer audio offline (batch).
  - LLM **prompt caching** for the static persona + curriculum context; only the
    per-turn delta is uncached.
  - Tier models: cheap/fast for routine turns, stronger only for diagnosis / free chat.
- **Scoring runs async/parallel** (ASR ∥ pronunciation). Never serialize them.
- **Feedback wording is generated by the brain**, not templated from raw scores.
- **Accessibility:** fully operable by voice; visual UI is optional aid.
- For Anthropic API / Claude Code specifics, verify against
  https://docs.claude.com/en/docs_site_map.md rather than assuming.

## 7. Build / run / test

```
pnpm install
pnpm dev            # server + client (Expo)
pnpm test           # unit; core targets 100% on provider mocks
pnpm test:turn      # golden-path turn lifecycle integration test
pnpm gen:audio      # offline batch pre-generation of cacheable TTS
```

Required env (see `.env.example`): `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`,
`SPEECHSUPER_APP_KEY`/`SPEECHSUPER_SECRET`, `AZURE_SPEECH_KEY`/`AZURE_REGION`,
`DATABASE_URL` (Supabase Postgres), `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`,
`R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`.
(No pronunciation keys needed for Indonesian.)

> **Deploy shell:** thin serverless (Supabase Edge Functions by default; Vercel
> functions if a Node runtime is preferred) — swappable, since `core` is
> host-agnostic. `pnpm gen:audio` runs as a Node batch job that writes cached
> audio to Cloudflare R2.

## 8. Definition of done (per feature)

- Honors all MT invariants in §2 (surfacing an SRS "review" is a bug).
- New language = new `LanguageConfig` + curriculum graph + provider bindings, with
  **zero diffs in `core`**.
- Provider-mocked unit tests; no live API calls in CI.
- Pronunciation UX copy reads as a patient human teacher, not a grader — in all
  three modes, including `coached`.
