import type { AudioBlobRef, AudioIO } from './types';

/**
 * Platform-free AudioIO for dev, web fallback, and tests. Playback is instant;
 * recording returns a deterministic fake handle. No real mic/speaker access.
 */
export class MockAudioIO implements AudioIO {
  public played: string[] = [];
  public recording = false;

  async play(url: string): Promise<void> {
    this.played.push(url);
  }

  async startRecording(): Promise<void> {
    this.recording = true;
  }

  async stopRecording(): Promise<AudioBlobRef> {
    this.recording = false;
    return { uri: 'mock://recording', mimeType: 'audio/mock', durationMs: 1200 };
  }
}
