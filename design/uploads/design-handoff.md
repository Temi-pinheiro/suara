# Suara — Design Handoff (UI/UX pass)

> **For:** `claude/design`. **From:** engineering. **Loop:** design improves the
> UI/UX → returns the spec in the format in **Part B** → engineering does one final
> implementation pass in React Native.
>
> This is the single source for the brief. Read **Part A** (context + constraints +
> what exists) to design; deliver exactly **Part B** (the return spec) so the build
> pass is unambiguous.

---

## Part A — The brief

### 0. What you're designing
Suara is an **all-voice, self-paced language tutor** (Michel Thomas method; Mandarin
launch, five languages on one engine). The whole app today is **one screen**: the
learner hears a setup, builds a sentence from known pieces, speaks it, then hears the
model + one warm cue. Make this **calm, warm, trustworthy, and obviously voice-first** —
and design the **first-run / session entry** that doesn't exist yet.

It must feel like a patient human teacher, not an app that grades you.

### 1. Non-negotiable invariants (pedagogy, not preference — do NOT design these away)
These come from `CLAUDE.md §2` and `docs/PLAN.md §2`. A design that violates one is a bug:

1. **No memorization framing.** No flashcards, "review"/"quiz" screens, scores-as-grades,
   streaks, percentages, XP, or "you forgot X" copy. Anything that reads as a test is out.
2. **No numbers as judgment.** Pronunciation feedback is **one warm sentence**, never a
   score, gauge, or red/green grade. (A *soft* warmth cue is fine — see current verdict
   accent — but never a number or a pass/fail.)
3. **Self-paced, no pressure.** No countdowns, timers, or auto-advance. The learner acts
   when ready; advancing is always an explicit tap.
4. **Construct-first.** The target answer is hidden until after the attempt. Never reveal
   the model before the learner speaks.
5. **Low-anxiety, English-scaffolded.** Setup/explanations are in English; the target
   language appears only for the word taught + the model. Warm, light, never effusive.
6. **Fully operable by voice; visuals are an optional aid.** Accessibility is core, not
   polish.

### 2. Technical constraints (what is actually implementable — please stay inside these)
- **React Native + React Native Web, one codebase.** Expo SDK 54, RN 0.81. Styling is
  **`StyleSheet`** (flexbox) — **no CSS files, no Tailwind, no web-only properties**
  (no `backdrop-filter`, no CSS grid, no `:hover`-only affordances — it's touch-first and
  must also work in a desktop browser). Gradients/blur need a library; prefer flat fills +
  subtle shadow/elevation.
- **No client storage.** No `localStorage`/`sessionStorage` (CLAUDE.md §6). Don't design
  anything that assumes persisted local state on the device.
- **Audio is learner-initiated.** Browsers block autoplay; the first sound must come from a
  tap. Keep a visible **"Listen"** affordance on every state that has audio; never assume
  audio plays on screen entry.
- **Five scripts + romanization.** The word card must hold Hanzi (我), Hiragana/Kanji
  (わたし), Hangul (저), and Devanagari (मैं) — large, plus a romanization line. Pick type
  that renders these (system fonts do; a custom display font must cover them or be Latin-only).
- **Three pronunciation modes.** Mandarin has an **audio-native tone scaffold** (a small
  cue card); Japanese/Korean/Hindi are "segmental"; Indonesian is "coached" — all surface
  as the same warm sentence. The tone card shows only for Mandarin.
- **Icons today are emoji** (🎙 / 🔊). If you want a real icon set, specify
  `@expo/vector-icons` glyph names or supply SVGs (`react-native-svg`).

### 3. Current UI inventory (what exists, so you redesign — not reinvent)
Files: `packages/client/src/ui/LessonScreen.tsx`, `SpeakButton.tsx`, `ToneCue.tsx`,
`packages/client/src/lesson/machine.ts` (the states).

**The screen is one flow driven by a state machine. Phases → what shows now:**
| Phase | Footer control | Body |
|---|---|---|
| `loading` | spinner | "Setting up your lesson…" |
| `awaiting` (after prompt) | **mic** (SpeakButton) | English setup; on *introduce* a word card (大 + pinyin); a **🔊 Listen** pill |
| `recording` | mic = stop (■) | same |
| `scoring` | spinner | "Listening to what you said…" |
| `feedback` | **Continue / Try once more** | warm correction in a card w/ a soft verdict accent; tone cue (cmn); **🔊 Hear it again** |
| `error` | — | "Something hiccupped…" + **Try again** |

**Components:** `SpeakButton` (120px circle, mic glyph; recording = red + ■), `ToneCue`
(card: tone name · spoken contour · mnemonic), the word/teach card, the feedback card,
the Listen pill, the primary button.

**Current baseline tokens (the starting palette — improve freely):**
`bg #FAF8F3` · text `#2B2B2B` · muted `#6A6A6A` · accent/primary `#3A6EA5` ·
recording `#B5524B` · cards `white` + soft shadow · cream surfaces `#F4F1EA`/`#EFEBE1` ·
verdict accents correct `#3E9E7E` / close `#C8862B` / off `#3A6EA5` · wordmark
"suara" letter-spaced `#B6AFA0`. Word/Hanzi 72pt, pinyin 26pt, setup 23pt, body 18pt.

### 4. Goals for this pass (the actual asks)
- Raise the **visual craft** of the lesson screen and all six states (it's currently
  functional-but-plain). Cohesive system: type scale, spacing, color, depth, motion.
- Design the **missing entry experience**: first-run + how a session starts + a **language
  picker** (5 languages). Keep it MT-calm (no "Day 3 streak!" anything).
- Make **progress feel real without gamification** — convey "you're moving / building"
  honestly (the only legitimate signal is *which pieces are getting recombined*), no scores.
- Strengthen the **recording moment** (it's the emotional core) and the **feedback moment**
  (warm, human, never a grade).
- A coherent **brand expression** for "suara" (voice/tone) beyond plain text.

### 5. Open decisions for you to resolve or propose
- First-run flow: name? goal-setting? or straight to "tap to begin"? (Keep it tiny.)
- Romanization: always shown, or revealable on tap?
- Recording feedback: static pulse vs live waveform/level meter (must be RN-expressible).
- Light only, or light + dark?
- How (if at all) to show session length / "where am I" without implying a quiz or grade.

### 6. In / out of scope
**In:** the lesson screen + its 6 states; entry/first-run; language picker; the shared
visual system (tokens, components, motion); brand expression; copy for UI chrome.
**Out:** backend/turn logic, the curriculum, anything requiring new client storage,
real-time/streaming audio UX, account/billing screens.

---

## Part B — What to return to engineering (the return spec)

Deliver a **markdown spec in the repo** (suggest `docs/design/spec.md`) plus any assets as
**files** (SVG/PNG/fonts) committed alongside. It must be **agent-actionable in one pass** —
I implement directly from it, so no ambiguity and nothing that only lives in a Figma link.
Include all eight:

1. **Design tokens** — named, with values:
   - Colors: every role (bg, surface, text, muted, primary, danger/recording, the three
     verdict warmths, borders) as hex; light + dark if you do dark.
   - Type scale: each role (display/word, pinyin, setup, body, caption, button) → size /
     weight / line-height. **If a custom font:** name the family + supply the font files
     (I load via `expo-font`); confirm it covers CJK + Devanagari or is Latin-only.
   - Spacing scale, radii, shadow/elevation values (RN `shadow*`/`elevation` numbers).
2. **Per-state screen specs** — for **each** phase (`loading`, `awaiting`-introduce,
   `awaiting`-recombine, `recording`, `scoring`, `feedback`-correct/close/off, `error`):
   an **ASCII/wireframe layout** + a component tree, every element annotated with the token
   it uses and its placement in **flexbox terms** (row/column, gap, align, padding) — not
   pixel-absolute CSS.
3. **Component specs** — `SpeakButton`, Listen/replay control, word/teach card, feedback
   card, `ToneCue`, primary/Continue button, plus any new ones (language picker item, etc.):
   all states (default/press/disabled/active), sizes, and token refs. **Tap targets ≥ 44pt.**
4. **Interaction & motion** — what animates, with durations + easing, expressible via RN
   `Animated`/Reanimated (e.g. "mic press: scale 0.96, 120ms ease-out"). Preserve the
   tap-to-listen / tap-to-advance model (no autoplay, no auto-advance).
5. **Copy** — every UI string you introduce/change (button labels, empty/loading/error
   text), MT-compliant (run them past §1 — no "quiz/review/remember/score/streak").
6. **Accessibility** — `accessibilityRole`/`Label` intent per control, contrast ratios
   (target WCAG AA), behavior at large system text sizes, and confirm voice-only operability.
7. **Icons & assets** — icon strategy (`@expo/vector-icons` names **or** SVG files); any
   imagery as `react-native-svg` or PNG `@1x/2x/3x`; brand wordmark/logo as SVG.
8. **RN/Web compatibility statement** — one short section confirming nothing relies on
   web-only CSS, hover, or unsupported props, and that it reads well at a phone width AND a
   desktop-browser width.

### Acceptance checklist (the return is "ready to build" when…)
- [ ] Every one of the 6 phases (with the introduce/recombine + correct/close/off variants)
      has a layout I can build without guessing.
- [ ] Every visual value is a **named token**, and every component references tokens.
- [ ] Custom fonts/icons/images are **provided as files** (or named from an available set).
- [ ] No invariant in §1 is violated; no constraint in §2 is broken.
- [ ] Motion is specified in RN-expressible terms.

### What I'll do when it comes back
Implement the spec in `packages/client` (tokens → a shared theme module; per-state layouts
→ `LessonScreen` + components; entry/picker → new screens), keep RN + Web compiling and the
lesson state machine intact, typecheck + web-export to verify, then hand back for your final pass.
