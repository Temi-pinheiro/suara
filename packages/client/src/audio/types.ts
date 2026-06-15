/**
 * Audio I/O behind an interface so the lesson logic never touches a platform API
 * directly. expoAudio.ts is the device implementation; mockAudio.ts runs anywhere
 * (dev, web fallback, tests). CLAUDE.md §6: client storage is in-memory only — an
 * AudioBlobRef is a transient handle, never persisted.
 */

export interface AudioBlobRef {
  uri: string;
  mimeType: string;
  durationMs?: number;
}

export interface AudioIO {
  /** Play teacher/model audio by URL (resolves when playback finishes). */
  play(url: string): Promise<void>;
  /** Begin capturing the learner's voice (self-paced; no timer). */
  startRecording(): Promise<void>;
  /** Stop capture and hand back a reference to the recording. */
  stopRecording(): Promise<AudioBlobRef>;
}
