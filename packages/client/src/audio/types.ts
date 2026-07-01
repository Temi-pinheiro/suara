/**
 * Audio I/O behind an interface so the lesson logic never touches a platform API
 * directly. expoAudio.ts is the device implementation (iOS, Android, and web).
 * CLAUDE.md §6: client storage is in-memory only — an AudioBlobRef is a transient
 * handle, never persisted.
 */

export interface AudioBlobRef {
  uri: string;
  mimeType: string;
  durationMs?: number;
}

/** A remote clip (URL string) or a bundled asset (require(...) module id, for earcons). */
export type AudioSource = string | number;

/** A handle to a looping clip (the scoring bed); call stop() when the wait is over. */
export interface LoopHandle {
  stop(): Promise<void>;
}

export interface AudioIO {
  /** Play teacher/model audio or a bundled earcon (resolves when playback finishes). */
  play(source: AudioSource): Promise<void>;
  /** Play a clip on loop (an ambient bed) until the returned handle is stopped. */
  playLoop(source: AudioSource): LoopHandle;
  /** Begin capturing the learner's voice (self-paced; no timer). */
  startRecording(): Promise<void>;
  /** Stop capture and hand back a reference to the recording. */
  stopRecording(): Promise<AudioBlobRef>;
  /**
   * Current mic input level in dBFS (~-160 silent … 0 loud), or null if unavailable
   * (metering off, web, or not recording). Drives natural turn-taking: detect when the
   * learner has started and finished speaking instead of a fixed window.
   */
  getInputLevel(): number | null;
}
