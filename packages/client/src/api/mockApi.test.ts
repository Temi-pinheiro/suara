import { describe, expect, it } from 'vitest';
import { MockSessionApi } from './mockApi';

const audio = { uri: 'mock://rec', mimeType: 'audio/mock' };

describe('MockSessionApi', () => {
  it('serves the scripted prompts in order', async () => {
    const api = new MockSessionApi();
    expect((await api.nextPrompt()).turnId).toBe('t1');
    expect((await api.nextPrompt()).turnId).toBe('t2');
  });

  it('nudges a rebuild (with a tone cue) first, then advances', async () => {
    const api = new MockSessionApi();
    await api.nextPrompt();

    const first = await api.submitAttempt('t1', audio);
    expect(first.decision).toBe('rebuild');
    expect(first.toneFocus).toBe('2');

    const second = await api.submitAttempt('t1', audio);
    expect(second.decision).toBe('advance');
  });

  it('resets the attempt counter on the next prompt', async () => {
    const api = new MockSessionApi();
    await api.nextPrompt();
    await api.submitAttempt('t1', audio); // rebuild
    await api.nextPrompt(); // moves to t2, resets
    const r = await api.submitAttempt('t2', audio);
    expect(r.decision).toBe('rebuild'); // first attempt on the new prompt again
  });
});
