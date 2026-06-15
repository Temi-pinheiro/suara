import type { ASRProvider, AudioBlob, LangCode } from '@suara/core';

/**
 * Mock ASR. Tests encode the learner's intended utterance as UTF-8 in the audio
 * bytes; this decodes it back, giving deterministic "what they said" transcripts.
 */
export class MockASRProvider implements ASRProvider {
  public callCount = 0;

  async transcribe(audio: AudioBlob, _lang: LangCode): Promise<{ text: string }> {
    this.callCount += 1;
    return { text: new TextDecoder().decode(audio.bytes) };
  }
}

/** Helper for tests/clients: build an AudioBlob that the MockASR will "hear" as text. */
export function spokenAudio(text: string): AudioBlob {
  return { bytes: new TextEncoder().encode(text), mimeType: 'audio/mock', durationMs: 1200 };
}
