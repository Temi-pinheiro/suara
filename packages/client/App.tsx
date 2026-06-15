import { StatusBar } from 'expo-status-bar';
import { MockSessionApi } from './src/api/mockApi';
import { ExpoAudioIO } from './src/audio/expoAudio';
import { LessonScreen } from './src/ui/LessonScreen';

// Phase 1: the standalone mock lesson + device audio. When the serverless turn
// endpoint lands, swap MockSessionApi for the HTTP SessionApi — nothing else changes.
const api = new MockSessionApi();
const audio = new ExpoAudioIO();

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <LessonScreen api={api} audio={audio} />
    </>
  );
}
