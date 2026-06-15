import type {
  Feedback,
  LLMProvider,
  MasteryDelta,
  PerUnitScore,
  ScoredResponse,
  TurnContext,
  TurnDecision,
  TurnOutcome,
  Verdict,
} from '@suara/core';

/** "我 (wǒ)" -> "我"; leaves romanization-free surfaces untouched. */
export function stripRomanization(surface: string): string {
  const idx = surface.indexOf(' (');
  return idx === -1 ? surface : surface.slice(0, idx);
}

function worstSyllable(syllables: PerUnitScore[]): PerUnitScore | undefined {
  if (syllables.length === 0) return undefined;
  return [...syllables].sort((a, b) => a.score - b.score)[0];
}

/**
 * Deterministic stand-in for the teacher brain. It picks the smallest unlocked
 * block (or recombines a due one), and turns the pron score into a warm verdict.
 * It honors the determinism guardrail (brain-spec §5): it only ever chooses among
 * the `availableBlocks` / `recombinationTargets` the orchestrator hands it.
 *
 * Replaced by AnthropicProvider in Phase 1; the contract is identical.
 */
export class MockLLMProvider implements LLMProvider {
  public decideTurnCount = 0;
  public interpretCount = 0;

  async decideTurn(ctx: TurnContext): Promise<TurnDecision> {
    this.decideTurnCount += 1;

    const block = ctx.availableBlocks[0];
    if (block) {
      const surface = stripRomanization(block.surface);
      return {
        action: 'introduce',
        focusComponentId: block.id,
        recombinedComponentIds: ctx.recombinationTargets.map((r) => r.id),
        englishSetup: 'Here is the next small piece. How would you say it? Take your time.',
        targetUtterance: { surface, expectedTones: block.expectedTones ?? undefined },
        referenceText: surface,
        teachingNote: block.rule ?? '',
        classmateAttempt: null,
        reassurance: null,
      };
    }

    const target = ctx.recombinationTargets[0];
    if (!target) {
      throw new Error('MockLLM: no available blocks and no recombination targets');
    }
    const surface = stripRomanization(target.surface);
    return {
      action: 'recombine',
      focusComponentId: target.id,
      recombinedComponentIds: ctx.recombinationTargets.slice(1).map((r) => r.id),
      englishSetup: 'Let us put a few pieces together again. Build it when you are ready.',
      targetUtterance: { surface },
      referenceText: surface,
      teachingNote: '',
      classmateAttempt: null,
      reassurance: null,
    };
  }

  async interpretResponse(r: ScoredResponse, _ctx: TurnContext): Promise<Feedback> {
    this.interpretCount += 1;
    const focus = r.decision.focusComponentId;
    const masteryDelta: MasteryDelta[] = [];

    let verdict: Verdict;
    let outcome: TurnOutcome;
    let correction: string;
    let nextPrompt: string | null = null;

    if (r.pronScore === null) {
      // coached mode: no score — judge from the native model (here: trust the match)
      verdict = 'correct';
      outcome = 'advance';
      correction = 'Lovely — clean and natural.';
      masteryDelta.push({ componentId: focus, change: 'strengthen' });
    } else {
      const worst = worstSyllable(r.pronScore.perSyllable);
      const overall = r.pronScore.overall ?? 100;
      if (worst && worst.score < 70) {
        verdict = 'close';
        outcome = 'rebuild';
        correction = 'So close — let that last sound dip then rise. Hear it once more.';
        nextPrompt = 'Give the whole thing one more go.';
        masteryDelta.push({ componentId: focus, change: 'partial' });
        masteryDelta.push({
          logError: {
            unit: worst.unit,
            expected: worst.expectedTone ?? '?',
            produced: worst.producedTone ?? '?',
            score: worst.score,
          },
        });
      } else if (overall < 60) {
        verdict = 'off';
        outcome = 'ease';
        correction = 'No trouble — we will let this one settle and weave it back in soon.';
        masteryDelta.push({ componentId: focus, change: 'weaken' });
      } else {
        verdict = 'correct';
        outcome = 'advance';
        correction = 'That is it — nicely balanced.';
        masteryDelta.push({ componentId: focus, change: 'strengthen' });
      }
    }

    if (outcome === 'advance') {
      for (const id of r.decision.recombinedComponentIds) {
        masteryDelta.push({ componentId: id, change: 'strengthen' });
      }
    }

    return {
      verdict,
      spokenModel: r.decision.referenceText,
      correction,
      decision: outcome,
      masteryDelta,
      nextPrompt,
      revealNote: null,
    };
  }
}
