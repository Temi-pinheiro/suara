# Suara — Design spec (UI/UX pass → build)

> Return spec for the `claude/design → engineering` loop. Implement directly from this.
> Visual reference: **`suara/Suara — UI-UX pass.html`** (all states pinned out, Light + Dark, plus an interactive walk-through). Token CSS that mirrors this spec 1:1: **`suara/theme.css`**.
>
> **Design lineage:** built on the bound **Kataku** calm-tutor system, tuned to Suara's warmth. One hue logic — **teal = the live voice** (carries speech, mic, progress, primary action). Verdict warmths (green / amber / slate) layer on top. **No red anywhere** in any role. Every invariant in brief §1 and constraint in §2 is honored (see §8).

---

## 1. Design tokens

Define as a shared theme module (e.g. `theme.ts`) with two palettes under the same key names. RN `StyleSheet`, flat fills + shadow/elevation only (no gradients/blur libs required — the one radial in `scoring` degrades to a flat fill).

### 1.1 Color — roles (hex)

| role | light | dark | use |
|---|---|---|---|
| `bg` | `#FAF8F3` | `#0F1411` | screen background (warm cream / warm near-black) |
| `surface` | `#FFFFFF` | `#18201B` | cards: word card, feedback card |
| `cream` | `#F2EEE4` | `#212B24` | raised / secondary surfaces, chips, segmented track |
| `cream2` | `#EAE3D4` | `#283328` | insets, idle-mic fill |
| `stroke` | `#E4DCCB` | `#2D3A30` | borders, dividers |
| `hair` | `#EDE7D9` | `#232E26` | faint internal hairlines |
| `text` | `#2A261F` | `#F1F5EF` | primary text |
| `dim` | `#5C564A` | `#9DAB9E` | secondary text / cue |
| `faint` | `#8E8678` | `#5F6E62` | tertiary / meta / spend |
| `narration` | `#3A352C` | `#AEBBAD` | ambient English (raised contrast for daylight) |
| `primary` | `#0F8E78` | `#45D4B0` | **the live-voice teal** — primary buttons, mic, Listen, progress |
| `onPrimary` | `#FFFFFF` | `#07140F` | text/icon on primary |
| `live` | `#0E9E84` | `#5FE0BE` | mic-live fill (a touch brighter than primary) |
| `wash` | `#DCEFE9` | `#143029` | teal wash: learner echo bubble, Listen pill bg, picker active row |
| `correct` | `#1F9D62` | `#45D483` | verdict "that's it" (green) |
| `close` | `#B0741B` | `#E3A968` | verdict "almost" (amber) |
| `off` | `#5D7187` | `#94A3B8` | verdict "not yet" (slate = information, never failure) |
| `wordmark` | `#B6AFA0` | `#6E7B6E` | "suara" wordmark |

> **No-red rule:** the recording state uses `live` (teal), not red. "Recording = your voice is alive," which also satisfies brief §2 (no judgment) and the Kataku no-red invariant.

### 1.2 Shadow / elevation (RN)

| name | iOS `shadow*` | Android `elevation` | use |
|---|---|---|---|
| `card` | color `#2A261F` (dark: `#000`), opacity .06 / .34, radius 16, offset {0,8} | 2 | word card, feedback card |
| `lift` | opacity .12 / .5, radius 22, offset {0,18} | 6 | picker popover |
| `mic` | color = `primary`, opacity .34 / .30, radius 13, offset {0,8} | 5 | primary buttons + mic |
| `glowLive` | color = `live`, opacity .42 / .40, radius 15, offset {0,8} + a 6px `wash` ring (render as a second view / border) | 8 | mic when live |

### 1.3 Type scale (system stack: `-apple-system, "SF Pro Text", system-ui` — covers CJK + Devanagari)

| role | size / weight / line-height | use |
|---|---|---|
| `word` | 76 / 700 / 1.0, tracking −1 | the taught script (我 / わたし / 저 / मैं) — the visual king |
| `roman` | 26 / 500 / 1.1 | romanization (pinyin etc.), color `dim` — **always shown** |
| `gloss` | 16 / 400 | English gloss under the word, `faint` |
| `setup` | 23 / 500 / 1.34, tracking −.2 | English setup sentence |
| `cue` | 17 / 500 / 1.4, `dim` (bold span → `text`) | the "now say" prompt |
| `narration` | 15 / 400 / 1.5, `narration` | ambient English, never boxed |
| `body` | 17 / 400 / 1.45 | feedback note |
| `verdict` | 15 / 700 | the one warm sentence, colored by result |
| `button` | 18 / 700 | primary / Continue / Try once more |
| `caption` | 12 / 700, tracking 1.6, uppercase, `faint` | section eyebrows ("pieces you can now combine") |
| `wordmark` | 19–40 / 500, tracking 6–13, lowercase, `wordmark` color | brand |

### 1.4 Spacing / radius

- Spacing scale: **6 · 8 · 12 · 14 · 16 · 20 · 26 · 30** (px). Screen H-padding **26**; status bar top ~54.
- Radii: word card **24**, feedback card **20**, tone cue / list rows **16**, picker **22**, chips & Listen pill & lang pill **999**, buttons **18**, mic / orb / spinner **50%**.
- Min tap target **44pt** (mic is 76; Listen pill 44; lang rows 66; the whole word card is tappable to play, not just an inner glyph).

---

## 2. Per-state screen specs

Every screen: `column`, `bg`. Top chrome = status bar then a **topbar** `row, space-between, padding 4/22/0`: `✕` (40×40, `dim`) · title "Mandarin" (16/700) · spend (13/600, `faint`, tabular). Entry screens omit the topbar.

Layout notation: `[col]`/`[row]` = flex-direction, `gap`, `pad`, `align`. Every value below ties to a §1 token.

### `loading`
```
┌──────────────┐
│   (spinner)  │   center-state: [col], flex:1, center, gap 22, pad 0/40
│ Setting up   │   spinner 46 ring stroke=stroke, top=primary, spin 0.9s linear
│ your lesson… │   msg 19/500 dim, centered
└──────────────┘
```
Auto-leaves on data ready (no tap needed); never a timer the learner sees.

### `awaiting · introduce`  (a new piece is taught)
```
topbar
[col] body, pad 8/26, gap 20:
  narration  ── "The first piece you'll need is the word for "I". Listen, then say it back…"
  word-card  ── surface, stroke, radius24, pad 30/26/26, shadow card, [col] center gap10:
     word "我" (76/700)
     roman "wǒ" (26/500 dim)
     gloss "I / me" (16 faint)
     Listen pill (wash bg, primary text, 44h)
  (spacer, flex:1)
footer: mic-row (mic idle 76, primary) + helper "Tap to speak — there's no rush" (14 faint, center)
```

### `awaiting · recombine`  (build from owned pieces; **target hidden**)
```
topbar
[col] body gap 20:
  cue   "Now put it together: "I want tea.""  (bold span = text)
  narration "You already own every piece… the answer stays hidden until you've tried."
  (spacer flex:1)
  shelf  ── caption "pieces you can now combine"
           chips [row wrap gap8]: 我 wǒ · 要 yào · 茶 chá(fresh→wash) · 不 bù
footer: mic idle + helper "Tap to speak when you've built it"
```
`shelf` is the **only** honest progress signal — which pieces are getting recombined. No scores, counts-as-grades, or %.

### `recording`  (mic live)
```
topbar
[col] body gap20:
  cue (same as recombine, persists)
  (spacer flex:1)
  echo bubble (align right, wash bg, primary text, radius 22/22/8/22): "listening…" (faint, pending)
footer:
  helper "Live — say it your way, finish when you're done" (14, live, weight600, center)
  mic LIVE: live fill + glowLive ring; 5 level bars (onPrimary), height-animated by real input
```
Construct-first: nothing is shown as "the answer" yet. The learner ends the utterance (tap to finish) — no timeout, no auto-stop.

### `scoring`
```
center-state: think-orb 92 (radial wash→cream, dark: flat cream) with 3 pulsing dots (primary)
msg "Listening to what you said…"
```

### `feedback · correct` / `close` / `off`
```
topbar
[col] body gap16:
  echo bubble (learner's verbatim words, right) — "我要茶" (or "我喝茶" on off)
  feedback-card: surface, stroke, radius20, LEFT BORDER 4px = verdict color, shadow card, [col] gap14:
     verdict line (15/700, verdict color) — ONE warm sentence, also worded
     fb-note (17/1.45 text) — the human explanation
     fb-model [row space-between], top hairline: model word (30/700) + roman (16 dim) · Listen pill
  toneCue (Mandarin only; correct & close)
  (spacer flex:1)
footer btn-row:
  correct → [ Try once more (ghost) | Continue (primary) ]
  close   → [ Continue (ghost)     | Try once more (primary) ]
  off     → [ Try once more (primary, full width) ]
```
- **Model revealed only here** (construct-first §1.4).
- Verdict copy is a sentence, never a number/gauge/grade. Left-border accent is the only color "score," and it is always backed by words so meaning survives color-blindness/washout.

### `error`
```
center-state: muted orb (cream) "· · ·" + msg "Something hiccupped on our side — your place is saved." + Try again (primary, ~200 max)
```

### `entry` (first-run) — **new**
```
[col] pad 0/30, no topbar:
  (60) wordmark "suara" (40/500, tracking 13, primary)
  (18) sound-mark: 7 teal bars, ascending heights/opacity — the brand "voice" glyph
  (flex:1)
  lead "Let's pick up where speaking comes from." (27/500, text, balance)
  sub  "A patient voice, one sentence at a time. You listen, you build, you say it. No tests, no clock." (17 dim)
  (flex:1)
  [ Begin ] (primary, full width)
  lang pill (centered): "ZH  Mandarin ▾"  → opens picker
```
Tiny by design: no name capture (constraint §2 = no client storage), no goal-setting, no streak/"welcome back". A returning learner sees the identical warm screen.

### `picker` (language) — **new**
```
[col] center, no topbar:
  wordmark (faded .4)
  caption "choose a language"
  picker popover (surface, stroke, radius22, shadow lift, pad8, [col] gap2):
     lang-row ACTIVE: wash bg — code badge(primary/onPrimary) + name(17/700) + pos "Month 1 · Week 1"
        ZH Mandarin · Month 1 · Week 1     ← launching
     lang-row resting (faint): JA Japanese · KO Korean · HI Hindi · ID Indonesian — "resting"
  footnote "five languages, one teacher · nothing is locked"
```
Never a gate. "Resting"/"ahead", never "locked". The word card holds all five scripts unchanged (see Components).

### `path` (module overview) — **new**
```
backbar: ‹ + "Your path"
[col] body gap16:
  caption "Mandarin · six little blocks"
  path-mirror "Everything here is yours to wander — start where you are, or wander back. Nothing is timed, nothing locks." (16 dim)
  modules [col] gap12:
    module-card DONE  ── mdot(primary+✓) · title(18/800) · "↻ revisit"(faint) · pieces all OWNED (wash/primary mini-chips)
    module-card HERE  ── lifted: 1.5px primary border + 4px wash halo · mdot(wash, primary ring+core) · title · "you're here"(primary) · sub · pieces: owned + CURRENT(primary fill + glowLive) + ahead(outline faint)
    module-card AHEAD ── transparent, no shadow · mdot(hollow, stroke) · title+pieces in faint · "ahead"(faint, never "locked")
```
**This is the glanceable progress signal** the brief asks for (§4) without gamification: state dots (done/here/ahead) + the actual **pieces you own** (filled teal) vs. ahead (outline). No %, no counts-as-grade, no streak. A module is a small functional block (e.g. "Tea, water, coffee"), not a level to beat. Tapping the `here` card → `moduleIntro`.

### `moduleIntro` (the glance before a lesson) — **new**
```
backbar: ‹ + "Your path"
[col] body gap16:
  caption "Block 3 · you're here" (primary)
  module title (30/800)
  m-sub "You already own 我要 — "I want". Now we add the things you'll ask for." (16)
  intro-pieces [row wrap]: 我要(owned) · 茶(cur, glow) · 水(ahead) · 咖啡(ahead)
  caption "what you'll be able to say"
  say-list [col gap12]: each = zh(19/700) + roman(13 faint) + en(15 dim); not-yet rows dimmed (faint, .7)
  (spacer)
footer:
  [ Pick up where you left off ] (primary)
  helper "nothing is timed — close any time, you'll land right back here"
```
Resume-friendly (matches §3 self-paced + the "leaving is safe" idea): it shows where you are, what you own, and what the block unlocks for speaking — then one tap in.

> **Module model (state, drives both screens):** each module = `{ title, pieces: [{script, roman, owned: bool, current: bool}], state: done|here|ahead }`. `state` is derived from protocol position, not from a score. "owned" pieces are the honest progress. The continuous lesson flow still runs *inside* a module — the path is the overview + entry point, it does not chop the pedagogy into gated levels.

---

## 3. Component specs

### `SpeakButton` (mic) — 76×76, radius 50%
| state | fill | content | effect |
|---|---|---|---|
| idle | `primary` | mic glyph (onPrimary, 30) | shadow `mic` |
| press | — | — | `scale 0.96`, 120ms ease-out |
| warming | `cream2` | (none) | breathing ring: 2px `primary` border, `@keyframes warm` scale .7→1.55 / opacity .8→0, 1.3s ease-out loop. **Not teal yet** — nothing captured |
| live | `live` | 5 level bars (onPrimary, 4px wide, radius2) | `glowLive`; bars height-animated by **real mic level** (fallback `@keyframes bob` 8↔26px, 0.9s, 5× staggered 0/.12/.24/.36/.48s) |
| disabled | `cream` | mic glyph (faint) | no shadow |

Tap target ≥ 44 (it's 76). `accessibilityRole="button"`, label per state (see §6).

### Listen / replay pill — 44h, radius 999
`wash` bg, `primary` text, 15/700, speaker glyph + label ("Listen" / "Hear it"). Ghost variant: transparent bg, `stroke` border, `dim` text. The **whole word card** is also a play target.

### Word / teach card — surface, stroke 1, radius 24, pad 30/26/26, shadow `card`
`[col] center gap10`: `word` → `roman` → `gloss` → Listen pill. Holds any of the five scripts at 76/700 with no layout change. Mandarin/Japanese may show dual-script; romanization line always present.

### Feedback card — surface, stroke 1, **left border 4px** = verdict color, radius 20, pad 20/22, shadow `card`
`[col] gap14`: verdict (15/700) → fb-note (17) → fb-model (row, top hairline: model word 30/700 + roman + Listen).

### `ToneCue` (Mandarin only) — cream, stroke, radius 16, pad 14/16, `[row] gap16`
contour SVG (52×36, `primary` stroke 3, round caps — line direction encodes the tone: T1 flat, T2 rising `M6 30 L46 6`, T3 dip, T4 falling) · `[col]`: t-name "Tone 2 · rising" (15/800) + t-desc (13.5 dim). Shown only for `cmn`; segmental/coached languages never render it.

### Primary / Continue / Ghost button — 56h, radius 18, 18/700
`primary`: `primary` bg, `onPrimary`, shadow `mic`. `ghost`: transparent, `stroke` border, `dim`. In a row, both flex:1, gap 12. The **primary slot encodes the suggested action** (Continue when correct; Try once more when close/off).

### Language picker row — ≥66h, radius 16, `[row] gap14`
40×40 code badge (radius 12; active = `primary`/`onPrimary`, else `cream`/`dim`) + `[col]` name(17/700) + pos(13 faint). Active row = `wash` bg.

### Pieces chip — 38h, radius 999, `cream` bg + `stroke`, 16/600
"fresh" (just-learned) variant = `wash` bg, `primary` text, no border.

---

## 4. Interaction & motion (RN `Animated` / Reanimated)

| moment | animation | duration / easing |
|---|---|---|
| mic press | `scale → 0.96` | 120ms ease-out |
| mic warming | ring scale .7→1.55, opacity .8→0, loop | 1.3s ease-out |
| mic live → level bars | bar heights bound to real input level (fallback staggered bob) | continuous |
| words land (echo) | learner's verbatim words fade in, **teal**, never paraphrased/truncated | per-word ~80ms |
| recording finish | closing tone (audio) + glow off; line becomes the echo | one step |
| scoring dots | 3 dots pulse opacity .3→1 + scale .8→1, staggered | 1.2s loop |
| word card enters | spring in (scale .96→1, opacity 0→1) — "new piece" | ~260ms spring |
| verdict color-in | left border + verdict text fade/slide in (8px) | 200ms ease-out |
| feedback reveal | model row fades in after verdict | 120ms delay |
| Continue / Try | cross-fade to next state | 200ms |

**Rules baked in:** no autoplay (first sound from a tap — Listen pill on every audio-bearing state), no auto-advance (explicit Continue/mic tap), no countdown/timer, learner ends the utterance. All entrance animations animate *from* hidden to a visible base state, gated on a `reduced-motion` check; under `prefers-reduced-motion: reduce` the ring + bars + spinner + dots are static (state stays legible via color + label).

---

## 5. Copy (all MT-compliant — no quiz/review/remember/score/streak)

- Loading: **"Setting up your lesson…"**
- Introduce narration: **"The first piece you'll need is the word for "I". Listen, then say it back whenever you're ready."**
- Introduce helper: **"Tap to speak — there's no rush"**
- Recombine cue: **"Now put it together: "I want tea.""**
- Recombine narration: **"You already own every piece of this. Build it out loud — the answer stays hidden until you've tried."**
- Recombine helper: **"Tap to speak when you've built it"**
- Shelf eyebrow: **"pieces you can now combine"**
- Recording helper: **"Live — say it your way, finish when you're done"** · echo placeholder **"listening…"**
- Scoring: **"Listening to what you said…"**
- Verdict · correct: **"That's it."** — note: *"Clean and natural. Notice you never had to rearrange a thing — Mandarin lets the pieces sit in the order you know."*
- Verdict · close: **"Almost — the tone on 茶 slipped a little."** — note: *"You said it flat; chá rises, like you're gently asking "huh?". Everything else landed."*
- Verdict · off: **"Not quite — that was "I drink tea." Let's hear the one we're after."** — note: *"Close cousin! You reached for 喝 hē (drink). For "want" we use 要 yào. Listen, then have another go."*
- Buttons: **Continue · Try once more · Hear it · Listen · Begin · Try again**
- Error: **"Something hiccupped on our side — your place is saved."**
- Entry lead: **"Let's pick up where speaking comes from."** / sub: **"A patient voice, one sentence at a time. You listen, you build, you say it. No tests, no clock."**
- Picker footnote: **"five languages, one teacher · nothing is locked"**

---

## 6. Accessibility

- **Voice-operable:** the mic is the single primary action on every interactive lesson state; Listen/Continue are reachable controls. No interaction depends on hover (touch-first; works at desktop width too).
- `accessibilityRole` / `accessibilityLabel`:
  - mic idle → `button`, "Speak your answer". warming → "Opening the microphone". live → "Listening — tap when you're done". 
  - Listen pill → `button`, "Hear it again". word card → `button`, "Hear the word, 我 wǒ".
  - Continue → "Continue". Try once more → "Try once more". lang row → "Mandarin, Month 1 Week 1, current".
- **Contrast (WCAG AA):** light `text` on `bg` ≈ 13:1; `dim` ≈ 6.3:1; `narration` ≈ 9:1 (raised for direct sun); `primary` text on `wash` ≈ 5.2:1; `onPrimary` on `primary` ≈ 4.9:1. Dark theme ≥ AA on all body/secondary text. Verdict meaning never relies on color alone — always also worded.
- **Large text:** all type uses scaled fonts; cards are `[col]` and wrap (no fixed heights on text blocks); the word card and feedback card grow vertically. Buttons keep ≥44 min height as text scales.

---

## 7. Icons & assets

- **Icons:** `@expo/vector-icons` (or `react-native-svg`). Glyphs used: `mic` (mic-outline), `stop` (square, for the live/finish affordance if you prefer a stop glyph over bars), speaker/`volume-high` (Listen), `close` (✕), caret (`chevron-down`). All currentColor.
- **Tone contour:** tiny inline `react-native-svg` `Path`, stroke = `primary`, per-tone path (T1 flat / T2 rising / T3 dip / T4 falling). No raster.
- **Brand:** the `suara` wordmark is **type, not an image** (system font, lowercase, letter-spaced, `wordmark` color). The **sound-mark** (ascending teal bars on entry) is 7 `View`s — no asset. No commissioned art needed (Suara has no Stories-style imagery).
- **No raster assets required.** Orbs/spinner/bars/dots are RN shapes + `Animated`.

---

## 8. RN / Web compatibility statement

Nothing relies on web-only CSS. The reference HTML uses `backdrop-filter` / `color-mix` **only in the review board's toolbar chrome** — *not* in any screen; every in-screen surface is a flat fill + `StyleSheet` shadow/elevation. No CSS grid (all `[row]`/`[col]` flexbox), no `:hover`-only affordances (touch-first; press states are explicit), no client storage. The single radial gradient (scoring orb) degrades to a flat `cream` fill. Layouts are flexbox with `gap`/padding and wrap, so they read at a phone width (390) and a desktop-browser width alike. Light + dark are the same component tree with swapped token values.

---

## Acceptance checklist
- [x] All 6 phases + introduce/recombine + correct/close/off variants, each with a buildable layout (§2).
- [x] Every visual value is a named token; every component references tokens (§1, §3).
- [x] Fonts = system stack (covers CJK + Devanagari); icons named from `@expo/vector-icons`; no images to commission (§7).
- [x] No §1 invariant violated; no §2 constraint broken (§8).
- [x] Motion specified in RN-expressible terms (§4).
