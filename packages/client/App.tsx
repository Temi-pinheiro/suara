import { StatusBar } from 'expo-status-bar';
import { HttpSessionApi } from './src/api/httpApi';
import { MockSessionApi } from './src/api/mockApi';
import type { SessionApi } from './src/api/types';
import { useExpoAudioIO } from './src/audio/expoAudio';
import { LessonScreen } from './src/ui/LessonScreen';

// Point at a real backend with EXPO_PUBLIC_SUARA_API (e.g. http://localhost:8787 via
// `pnpm serve`); otherwise the standalone mock lesson runs. (Must be the literal
// `process.env.EXPO_PUBLIC_*` form so Expo inlines it at build time.)
const apiUrl = process.env.EXPO_PUBLIC_SUARA_API;
const api: SessionApi = apiUrl
  ? new HttpSessionApi({ baseUrl: apiUrl, userId: process.env.EXPO_PUBLIC_SUARA_USER ?? 'demo' })
  : new MockSessionApi();

export default function App() {
  const audio = useExpoAudioIO();
  return (
    <>
      <StatusBar style="auto" />
      <LessonScreen api={api} audio={audio} />
    </>
  );
}
