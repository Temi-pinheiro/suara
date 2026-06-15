/**
 * Standalone SessionApi so the app runs with no server (dev, demos, web preview).
 * Serves a tiny scripted Mandarin lesson and nudges one rebuild before advancing,
 * exercising the tone scaffold. The real api hits the serverless turn endpoint.
 */

import type { AudioBlobRef } from '../audio/types';
import type { AttemptResult, PromptPacket, SessionApi } from './types';

const DEFAULT_SCRIPT: PromptPacket[] = [
  {
    turnId: 't1',
    englishSetup: "Let's start. How would you say: I want coffee? No rush.",
    setupAudioUrl: 'mock://setup/t1',
    targetUtterance: { surface: '我要咖啡', pinyin: 'wǒ yào kāfēi', expectedTones: '3-4-1-1' },
  },
  {
    turnId: 't2',
    englishSetup: 'Now swap the drink. How would you say: I want tea?',
    setupAudioUrl: 'mock://setup/t2',
    targetUtterance: { surface: '我要茶', pinyin: 'wǒ yào chá', expectedTones: '3-4-2' },
  },
];

export class MockSessionApi implements SessionApi {
  private index = 0;
  private attemptsForCurrent = 0;
  private readonly script: PromptPacket[];

  constructor(script: PromptPacket[] = DEFAULT_SCRIPT) {
    this.script = script;
  }

  async nextPrompt(): Promise<PromptPacket> {
    const prompt = this.script[this.index % this.script.length]!;
    this.index += 1;
    this.attemptsForCurrent = 0;
    return prompt;
  }

  async submitAttempt(turnId: string, _audio: AudioBlobRef): Promise<AttemptResult> {
    this.attemptsForCurrent += 1;
    if (this.attemptsForCurrent === 1) {
      return {
        verdict: 'close',
        correction: 'So close — let that last word rise, like a gentle question.',
        modelAudioUrl: `mock://model/${turnId}`,
        decision: 'rebuild',
        toneFocus: '2',
      };
    }
    return {
      verdict: 'correct',
      correction: 'That is it — lovely and clear.',
      modelAudioUrl: `mock://model/${turnId}`,
      decision: 'advance',
    };
  }
}
