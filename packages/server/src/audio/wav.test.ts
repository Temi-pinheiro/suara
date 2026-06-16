import { describe, expect, it } from 'vitest';
import { pcmToWav } from './wav';

describe('pcmToWav', () => {
  it('prepends a 44-byte RIFF/WAVE PCM header and preserves the samples', () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const wav = pcmToWav(pcm, 16000, 1, 16);

    expect(wav.length).toBe(48);
    const ascii = (a: number, b: number) => String.fromCharCode(...wav.slice(a, b));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 12)).toBe('WAVE');
    expect(ascii(12, 16)).toBe('fmt ');
    expect(ascii(36, 40)).toBe('data');

    const dv = new DataView(wav.buffer);
    expect(dv.getUint16(20, true)).toBe(1); // PCM
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(16000); // sample rate
    expect(dv.getUint16(34, true)).toBe(16); // bits/sample
    expect(dv.getUint32(40, true)).toBe(4); // data size
    expect([...wav.slice(44)]).toEqual([1, 2, 3, 4]);
  });
});
