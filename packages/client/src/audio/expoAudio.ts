import { Audio } from 'expo-av';
import type { AudioBlobRef, AudioIO } from './types';

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
    await sound.unloadAsync();
  }

  async startRecording(): Promise<void> {
    await this.ensurePermission();
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    this.recording = recording;
  }

  async stopRecording(): Promise<AudioBlobRef> {
    if (!this.recording) throw new Error('No active recording');
    const status = await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;
    if (!uri) throw new Error('Recording produced no URI');
    return { uri, mimeType: 'audio/m4a', durationMs: status.durationMillis };
  }
}
