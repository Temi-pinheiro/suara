import { useMemo, useRef } from 'react';
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
import type { AudioBlobRef, AudioIO } from './types';

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
 * learner tapping, never a timer. Not exercised in CI; the lesson logic is tested
 * against MockAudioIO.
 */
export function useExpoAudioIO(): AudioIO {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const permitted = useRef(false);

  return useMemo<AudioIO>(
    () => ({
      async play(url: string): Promise<void> {
        const player = createAudioPlayer(url);
        try {
          await new Promise<void>((resolve) => {
            player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
              if (status.didJustFinish) resolve();
            });
            player.play();
          });
        } finally {
          player.remove(); // always release the native player, even on error
        }
      },

      async startRecording(): Promise<void> {
        if (!permitted.current) {
          const { granted } = await AudioModule.requestRecordingPermissionsAsync();
          if (!granted) throw new Error('Microphone permission denied');
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
          permitted.current = true;
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
      },

      async stopRecording(): Promise<AudioBlobRef> {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('Recording produced no URI');
        return { uri, mimeType: RECORDING_MIME };
      },
    }),
    [recorder],
  );
}
