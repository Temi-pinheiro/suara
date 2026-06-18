import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpSessionApi } from './src/api/httpApi';
import { useExpoAudioIO } from './src/audio/expoAudio';
import { languageByCode, type LangCode } from './src/languages';
import { EntryScreen } from './src/ui/EntryScreen';
import { LanguagePicker } from './src/ui/LanguagePicker';
import { LessonScreen } from './src/ui/LessonScreen';

// The turn server. Defaults to the local `pnpm serve` endpoint; override with
// EXPO_PUBLIC_SUARA_API for a physical device (your machine's LAN IP) or a deployed
// backend. (Must be the literal `process.env.EXPO_PUBLIC_*` form so Expo inlines it.)
const apiUrl = process.env.EXPO_PUBLIC_SUARA_API ?? 'http://localhost:8787';
const userId = process.env.EXPO_PUBLIC_SUARA_USER ?? 'demo';

type Screen = 'entry' | 'picker' | 'lesson';

export default function App() {
  const audio = useExpoAudioIO();
  const [screen, setScreen] = useState<Screen>('entry');
  const [lang, setLang] = useState<LangCode>('cmn');

  // Rebuild the api when the language changes so x-suara-lang follows the picker.
  const api = useMemo(() => new HttpSessionApi({ baseUrl: apiUrl, userId, lang }), [lang]);
  const language = languageByCode(lang);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {screen === 'lesson' ? (
        // "Begin" (and entering the lesson) is the first user gesture — it unlocks
        // audio on web, where browsers block autoplay until the learner interacts.
        <LessonScreen api={api} audio={audio} title={language.name} onExit={() => setScreen('entry')} />
      ) : screen === 'picker' ? (
        <LanguagePicker
          current={lang}
          onSelect={(code) => {
            setLang(code);
            setScreen('entry');
          }}
          onClose={() => setScreen('entry')}
        />
      ) : (
        <EntryScreen
          onBegin={() => setScreen('lesson')}
          onPickLanguage={() => setScreen('picker')}
          language={language.name}
          code={language.badge}
        />
      )}
    </SafeAreaProvider>
  );
}
