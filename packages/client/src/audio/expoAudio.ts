import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import {
  AudioModule,
  createAudioPlayer,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioStatus,
  type RecordingOptions,
} from 'expo-audio';
import type { AudioBlobRef, AudioIO, AudioSource, LoopHandle } from './types';

/**
 * 16 kHz mono capture. iOS records LinearPCM WAV, which Azure Pronunciation
 * Assessment accepts directly. Android records AAC/m4a — fine for Scribe ASR, but
 * Azure tone scoring on Android needs a server-side transcode (TODO). iOS is the
 * Phase 1 target.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  // Metering surfaces the live input level (dBFS) on recorder.getStatus(), which drives
  // natural turn-taking — we end the recording when the learner stops talking.
  isMeteringEnabled: true,
  extension: Platform.OS === 'ios' ? '.wav' : '.m4a',
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    outputFormat: IOSOutputFormat.LINEARPCM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

const RECORDING_MIME = Platform.select({ ios: 'audio/wav', android: 'audio/mp4', default: 'audio/webm' });

/**
 * Device AudioIO via expo-audio (expo-av's successor). Playback is imperative
 * (createAudioPlayer); recording is hook-based (useAudioRecorder), so this is a hook
 * that returns the AudioIO. Mic capture is self-paced — start/stop are driven by the
 * learner tapping, never a timer. Not exercised in CI; the pure lesson machine
 * (machine.ts) is unit-tested directly without audio.
 */
export function useExpoAudioIO(): AudioIO {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const permitted = useRef(false);

  // iOS: let playback through even when the ringer is on silent. Set once at
  // startup so the very first clip plays — previously this only ran inside
  // startRecording, so playback before the first recording was muted on a silenced
  // device. No-op (and harmless) on web/Android.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return useMemo<AudioIO>(
    () => ({
      async play(source: AudioSource): Promise<void> {
        // A string URL (teacher/model audio) or a number (require'd earcon asset);
        // createAudioPlayer accepts both.
        const player = createAudioPlayer(source);
        try {
          await new Promise<void>((resolve) => {
            let settled = false;
            // Hard cap so a clip that never loads (bad URL, autoplay blocked on web)
            // can't leak a pending promise. Replaced by a precise timer below.
            let timer: ReturnType<typeof setTimeout> = setTimeout(finish, 20_000);

            function finish() {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              sub.remove();
              resolve();
            }

            const sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
              if (status.didJustFinish) {
                finish(); // native end signal
                return;
              }
              // Web fallback: the <audio> element's `ended` event is NOT surfaced as
              // didJustFinish, so once the duration is known, (re)arm a timer for the
              // remaining playback time. Re-arming on each tick keeps it accurate and
              // safely past the real end (status updates stop once playback finishes).
              const dur = player.duration;
              if (Number.isFinite(dur) && dur > 0) {
                clearTimeout(timer);
                const remainingMs = Math.max(0, (dur - player.currentTime) * 1000) + 600;
                timer = setTimeout(finish, remainingMs);
              }
            });

            player.play();
          });
        } finally {
          player.remove(); // always release the native player
        }
      },

      playLoop(source: AudioSource): LoopHandle {
        // An ambient bed that loops until stopped — covers the scoring wait so it never
        // reads as a freeze. Fire-and-forget playback; no completion promise.
        const player = createAudioPlayer(source);
        player.loop = true;
        player.play();
        let stopped = false;
        return {
          async stop(): Promise<void> {
            if (stopped) return; // idempotent — safe to call on every exit path
            stopped = true;
            try {
              player.pause();
            } catch {
              /* already gone */
            }
            player.remove();
          },
        };
      },

      async startRecording(): Promise<void> {
        if (!permitted.current) {
          const { granted } = await AudioModule.requestRecordingPermissionsAsync();
          if (!granted) throw new Error('Microphone permission denied');
          permitted.current = true;
        }
        // Enter the recording session EVERY turn — stopRecording resets it back to a
        // playback session (for loud speaker output), so the mode must be re-asserted
        // before each record(), not just the first. Missing this makes record() throw
        // from turn 2 on (the session is still playback-only).
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      },

      async stopRecording(): Promise<AudioBlobRef> {
        await recorder.stop();
        // Critical for the hands-free loop: leaving allowsRecording on keeps iOS in the
        // playAndRecord category, which routes the NEXT playback to the quiet earpiece.
        // Reset to a playback session so the feedback + model audio come back loud on
        // the speaker every turn (not just the first). Harmless on web/Android.
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
        const uri = recorder.uri;
        if (!uri) throw new Error('Recording produced no URI');
        return { uri, mimeType: RECORDING_MIME };
      },

      getInputLevel(): number | null {
        // Only meaningful mid-recording; metering is undefined on web / when idle.
        const status = recorder.getStatus();
        return status.isRecording ? status.metering ?? null : null;
      },
    }),
    [recorder],
  );
}
