import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import type { AudioBlobRef, AudioIO } from './types';

/**
 * 16 kHz mono capture. iOS records LinearPCM WAV, which Azure Pronunciation
 * Assessment accepts directly. Android can't emit WAV via MediaRecorder, so it
 * records AAC/m4a — fine for Scribe ASR, but Azure tone scoring on Android needs a
 * server-side transcode (TODO). iOS is the Phase 1 target.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

const RECORDING_MIME = Platform.select({ ios: 'audio/wav', android: 'audio/mp4', default: 'audio/webm' });

/**
 * Device AudioIO via expo-av. Mic capture is self-paced — startRecording/
 * stopRecording are driven by the learner tapping, never a timer.
 *
 * Not exercised in CI (no device); the lesson logic is tested against MockAudioIO.
 */
export class ExpoAudioIO implements AudioIO {
  private recording: Audio.Recording | null = null;
  private permitted = false;

  private async ensurePermission(): Promise<void> {
    if (this.permitted) return;
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    this.permitted = true;
  }

  async play(url: string): Promise<void> {
    const { sound } = await Audio.Sound.createAsync({ uri: url });
    try {
      await new Promise<void>((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            if (status.error) reject(new Error(status.error));
            return;
          }
          if (status.didJustFinish) resolve();
        });
        sound.playAsync().catch(reject);
      });
    } finally {
      await sound.unloadAsync(); // always release the native Sound, even on error
    }
  }

  async startRecording(): Promise<void> {
    await this.ensurePermission();
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(RECORDING_OPTIONS);
    await recording.startAsync();
    this.recording = recording;
  }

  async stopRecording(): Promise<AudioBlobRef> {
    if (!this.recording) throw new Error('No active recording');
    const status = await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;
    if (!uri) throw new Error('Recording produced no URI');
    return { uri, mimeType: RECORDING_MIME, durationMs: status.durationMillis };
  }
}
