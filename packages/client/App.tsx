import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpSessionApi } from './src/api/httpApi';
import type { SessionApi } from './src/api/types';
import { useExpoAudioIO } from './src/audio/expoAudio';
import { LessonScreen } from './src/ui/LessonScreen';

// The turn server. Defaults to the local `pnpm serve` endpoint; override with
// EXPO_PUBLIC_SUARA_API for a physical device (your machine's LAN IP) or a deployed
// backend. (Must be the literal `process.env.EXPO_PUBLIC_*` form so Expo inlines it
// at build time.) If the server is down the lesson screen surfaces a real error —
// there's no fake offline lesson.
const apiUrl = process.env.EXPO_PUBLIC_SUARA_API ?? 'http://localhost:8787';
const api: SessionApi = new HttpSessionApi({
  baseUrl: apiUrl,
  userId: process.env.EXPO_PUBLIC_SUARA_USER ?? 'demo',
});

export default function App() {
  const audio = useExpoAudioIO();
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <LessonScreen api={api} audio={audio} />
    </SafeAreaProvider>
  );
}
