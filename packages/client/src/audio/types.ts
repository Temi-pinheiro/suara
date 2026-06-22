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

export interface AudioIO {
  /** Play teacher/model audio or a bundled earcon (resolves when playback finishes). */
  play(source: AudioSource): Promise<void>;
  /** Begin capturing the learner's voice (self-paced; no timer). */
  startRecording(): Promise<void>;
  /** Stop capture and hand back a reference to the recording. */
  stopRecording(): Promise<AudioBlobRef>;
}
