# Suara

> An all-voice language tutor that takes a learner from beginner to **spoken
> fluency** using the **Michel Thomas method**. Launch language: Mandarin.
> Supported set: Mandarin, Japanese, Korean, Indonesian, Hindi — one teaching engine.
>
> *Suara* — "voice / sound / tone" (from Sanskrit स्वर *svara*). The name is the product.

## How to use this package

These docs are the full design for handoff. The intended workflow:

1. Put `CLAUDE.md` at the **repo root** (Claude Code auto-loads it every session);
   put the rest in `/docs`.
2. Hand off **all docs as context**, but commission the build **one phase at a
   time** (`PLAN.md §10`), reviewing each working slice before the next. Do not
   commission all phases at once — that's how the pedagogy invariants quietly drift.
3. Run the **native-teacher curriculum review** (`PLAN.md §6`) as a parallel human
   track. It doesn't block Phase 1 (the 30-block starter is enough) but must finish
   before Phase 2 expands the graph.
4. Close the **open decisions** in `PLAN.md §13` before the phases that depend on them.

## Files (suggested reading order)

| File | What it is |
|---|---|
| `PLAN.md` | Master spec — vision, MT→product rules, architecture, per-language matrix, data model, phased roadmap, risks, open decisions. **Start here.** |
| `CLAUDE.md` | Standing rulebook for the build agent — the MT invariants it must never violate, architecture, core interfaces, conventions, definition of done. |
| `mt-tutor-turn-flow.mermaid` | The single-turn data flow, MT-shaped (construct → score → coach → recombine), colour-coded by layer. |
| `curriculum-mandarin-starter.md` | Phase-1 pedagogical seed — the first 30 Mandarin building blocks in dependency order with recombination hints + a loadable JSON seed. The core IP. |
| `brain-spec.md` | The tutor "brain" — MT teacher system prompt + the `decideTurn` / `interpretResponse` contract and worked examples. |

*Archived:* `mandarin-tutor-turn-flow.mermaid` — the earlier repeat-after-me turn
flow, **superseded** by `mt-tutor-turn-flow.mermaid`. Kept only for history.

## The one-paragraph architecture

Six decoupled layers: a curriculum graph (the IP), an LLM "brain" (the teacher),
ElevenLabs TTS, ASR, a pluggable pronunciation layer, and a learner store with an
*invisible* spaced-repetition scheduler. Everything language-specific lives behind a
provider interface + `LanguageConfig`, so the same engine drives all five languages.
Only the pronunciation feedback layer varies — three modes: **tone** (Mandarin),
**segmental** (Japanese/Korean/Hindi), **coached** (Indonesian).
