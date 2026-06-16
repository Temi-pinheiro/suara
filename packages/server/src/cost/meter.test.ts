import { describe, expect, it } from 'vitest';
import {
  MockASRProvider,
  MockPronunciationProvider,
  MockTTSProvider,
  spokenAudio,
} from '@suara/providers';
import {
  MeteredASRProvider,
  MeteredPronunciationProvider,
  MeteredTTSProvider,
  UsageMeter,
} from './meter';
import { estimateCost } from './pricing';

describe('UsageMeter + decorators', () => {
  it('tallies tts chars, asr/pron calls, and llm tokens per model', async () => {
    const meter = new UsageMeter();
    const tts = new MeteredTTSProvider(new MockTTSProvider(), meter);
    const asr = new MeteredASRProvider(new MockASRProvider(), meter);
    const pron = new MeteredPronunciationProvider(new MockPronunciationProvider(), meter);

    await tts.synth('我想喝茶', 'v', 'cmn'); // 4 chars
    await asr.transcribe(spokenAudio('我'), 'cmn');
    await pron.score(spokenAudio('我'), '我', 'cmn');
    meter.llm('claude-haiku-4-5', { input: 1000, output: 200, cacheRead: 5000 });
    meter.llm('claude-haiku-4-5', { input: 500, output: 100 });

    expect(meter.usage).toMatchObject({ ttsCalls: 1, ttsChars: 4, asrCalls: 1, pronCalls: 1 });
    expect(meter.usage.llm['claude-haiku-4-5']).toEqual({
      calls: 2,
      inputTokens: 1500,
      outputTokens: 300,
      cacheReadTokens: 5000,
    });
  });
});

describe('estimateCost', () => {
  it('prices llm per model plus tts/asr/pron', () => {
    const meter = new UsageMeter();
    meter.tts(1000); // 1000 chars -> $0.10
    meter.asr(); // $0.01
    meter.pron(); // $0.006
    meter.llm('claude-haiku-4-5', { input: 1_000_000, output: 1_000_000 }); // $1 in + $5 out

    const c = estimateCost(meter.usage);
    expect(c.llmUsd).toBeCloseTo(6, 5);
    expect(c.ttsUsd).toBeCloseTo(0.1, 5);
    expect(c.asrUsd).toBeCloseTo(0.01, 5);
    expect(c.pronUsd).toBeCloseTo(0.006, 5);
    expect(c.totalUsd).toBeCloseTo(6.116, 5);
  });

  it('discounts cache-read tokens', () => {
    const meter = new UsageMeter();
    meter.llm('claude-opus-4-8', { input: 0, output: 0, cacheRead: 1_000_000 }); // 1M cached @ $5 * 0.1
    expect(estimateCost(meter.usage).llmUsd).toBeCloseTo(0.5, 5);
  });
});
