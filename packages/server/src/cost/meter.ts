/**
 * Per-turn usage metering. Decorators wrap the providers and tally what each turn
 * actually requests (TTS chars, ASR/pron calls, LLM tokens per model). Paired with
 * pricing.ts, this gives the "per-turn cost within target" number Phase 2 needs.
 */

import type {
  ASRProvider,
  AudioBlob,
  AudioRef,
  LangCode,
  PronScore,
  PronunciationProvider,
  TTSProvider,
} from '@suara/core';

export interface LlmModelUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface Usage {
  ttsCalls: number;
  ttsChars: number;
  asrCalls: number;
  pronCalls: number;
  /** token usage keyed by model id */
  llm: Record<string, LlmModelUsage>;
}

export function emptyUsage(): Usage {
  return { ttsCalls: 0, ttsChars: 0, asrCalls: 0, pronCalls: 0, llm: {} };
}

export class UsageMeter {
  readonly usage: Usage = emptyUsage();

  tts(chars: number): void {
    this.usage.ttsCalls += 1;
    this.usage.ttsChars += chars;
  }
  asr(): void {
    this.usage.asrCalls += 1;
  }
  pron(): void {
    this.usage.pronCalls += 1;
  }
  llm(model: string, u: { input?: number; output?: number; cacheRead?: number }): void {
    const m = (this.usage.llm[model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });
    m.calls += 1;
    m.inputTokens += u.input ?? 0;
    m.outputTokens += u.output ?? 0;
    m.cacheReadTokens += u.cacheRead ?? 0;
  }
}

export class MeteredTTSProvider implements TTSProvider {
  constructor(
    private readonly inner: TTSProvider,
    private readonly meter: UsageMeter,
  ) {}
  synth(text: string, voiceId: string, lang: LangCode): Promise<AudioRef> {
    this.meter.tts(text.length);
    return this.inner.synth(text, voiceId, lang);
  }
}

export class MeteredASRProvider implements ASRProvider {
  constructor(
    private readonly inner: ASRProvider,
    private readonly meter: UsageMeter,
  ) {}
  transcribe(audio: AudioBlob, lang: LangCode): Promise<{ text: string }> {
    this.meter.asr();
    return this.inner.transcribe(audio, lang);
  }
}

export class MeteredPronunciationProvider implements PronunciationProvider {
  constructor(
    private readonly inner: PronunciationProvider,
    private readonly meter: UsageMeter,
  ) {}
  score(audio: AudioBlob, referenceText: string, lang: LangCode): Promise<PronScore> {
    this.meter.pron();
    return this.inner.score(audio, referenceText, lang);
  }
}
