import { describe, expect, it } from 'vitest';
import {
  InMemoryLearnerStore,
  MockASRProvider,
  MockLLMProvider,
  MockPronunciationProvider,
  MockTTSProvider,
} from '@suara/providers';
import type { LanguageConfig } from '@suara/core';
import { assembleTurnDeps } from '../compose';
import type { TurnHandlerDeps } from '../turn/handlers';
import { InMemoryPendingTurnStore } from '../turn/pending';
import { createHttpHandler, devHeaderAuth } from './handler';

const clock = () => 1_700_000_000_000;

const cmnConfig: LanguageConfig = {
  code: 'cmn',
  l1: 'eng',
  phonology: 'tonal',
  toneInventory: ['1', '2', '3', '4', '0'],
  tts: { provider: 'mock', targetVoiceId: 'cmn-native', l1VoiceId: 'eng-warm' },
  pronunciation: { mode: 'tone', provider: 'mock' },
};

function handler(idgen = () => 'turn-1') {
  const h: TurnHandlerDeps = {
    deps: assembleTurnDeps({
      config: cmnConfig,
      store: new InMemoryLearnerStore(clock),
      llm: new MockLLMProvider(),
      tts: new MockTTSProvider(),
      asr: new MockASRProvider(),
      pronunciation: new MockPronunciationProvider(),
    }),
    pending: new InMemoryPendingTurnStore(),
    now: clock,
    idgen,
  };
  return createHttpHandler(h, { authenticate: devHeaderAuth });
}

const post = (path: string, init: RequestInit = {}) =>
  new Request(`http://x${path}`, { method: 'POST', headers: { 'x-user-id': 'u1' }, ...init });

describe('createHttpHandler', () => {
  it('runs a plan -> attempt turn over HTTP', async () => {
    const handle = handler();

    const planRes = await handle(post('/turn/plan'));
    expect(planRes.status).toBe(200);
    const packet = (await planRes.json()) as { turnId: string; englishSetup: string };
    expect(packet.turnId).toBe('turn-1');
    expect(packet.englishSetup.length).toBeGreaterThan(0);

    const attemptRes = await handle(
      post('/turn/turn-1/attempt', { headers: { 'x-user-id': 'u1', 'content-type': 'audio/wav' }, body: new Uint8Array([1, 2, 3]) }),
    );
    expect(attemptRes.status).toBe(200);
    const result = (await attemptRes.json()) as { decision: string };
    expect(result.decision).toBe('advance');
  });

  it('401s without an auth header', async () => {
    const handle = handler();
    const res = await handle(new Request('http://x/turn/plan', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('409s on an unknown turn id', async () => {
    const handle = handler();
    const res = await handle(post('/turn/nope/attempt', { headers: { 'x-user-id': 'u1' }, body: new Uint8Array([1]) }));
    expect(res.status).toBe(409);
  });

  it('handles CORS preflight', async () => {
    const handle = handler();
    const res = await handle(new Request('http://x/turn/plan', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('404s an unknown route', async () => {
    const handle = handler();
    const res = await handle(post('/nope'));
    expect(res.status).toBe(404);
  });

  it('routes by the x-suara-lang header, falling back to the default (the picker)', async () => {
    const mk = (id: string): TurnHandlerDeps => ({
      deps: assembleTurnDeps({
        config: cmnConfig,
        store: new InMemoryLearnerStore(clock),
        llm: new MockLLMProvider(),
        tts: new MockTTSProvider(),
        asr: new MockASRProvider(),
        pronunciation: new MockPronunciationProvider(),
      }),
      pending: new InMemoryPendingTurnStore(),
      now: clock,
      idgen: () => id,
    });
    const cmnH = mk('cmn-turn');
    const jpnH = mk('jpn-turn');
    const handle = createHttpHandler((lang) => (lang === 'jpn' ? jpnH : cmnH), { authenticate: devHeaderAuth });

    const def = (await (await handle(post('/turn/plan'))).json()) as { turnId: string; costUsd?: number };
    expect(def.turnId).toBe('cmn-turn'); // no header → default deps
    expect(typeof def.costUsd).toBe('number'); // resolver path is metered (the spend field)

    const jp = await handle(post('/turn/plan', { headers: { 'x-user-id': 'u1', 'x-suara-lang': 'jpn' } }));
    expect(((await jp.json()) as { turnId: string }).turnId).toBe('jpn-turn');
  });
});
