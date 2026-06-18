import { useCallback, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpSessionApi } from './src/api/httpApi';
import type { PathView } from './src/api/types';
import { useExpoAudioIO } from './src/audio/expoAudio';
import { languageByCode, type LangCode } from './src/languages';
import { EntryScreen } from './src/ui/EntryScreen';
import { LanguagePicker } from './src/ui/LanguagePicker';
import { LessonScreen } from './src/ui/LessonScreen';
import { ModuleIntroScreen } from './src/ui/ModuleIntroScreen';
import { PathScreen } from './src/ui/PathScreen';

// The turn server. Defaults to the local `pnpm serve` endpoint; override with
// EXPO_PUBLIC_SUARA_API for a physical device (your machine's LAN IP) or a deployed
// backend. (Must be the literal `process.env.EXPO_PUBLIC_*` form so Expo inlines it.)
const apiUrl = process.env.EXPO_PUBLIC_SUARA_API ?? 'http://localhost:8787';
const userId = process.env.EXPO_PUBLIC_SUARA_USER ?? 'demo';

type Screen = 'entry' | 'picker' | 'path' | 'moduleIntro' | 'lesson';

export default function App() {
  const audio = useExpoAudioIO();
  const [screen, setScreen] = useState<Screen>('entry');
  const [lang, setLang] = useState<LangCode>('cmn');
  const [path, setPath] = useState<PathView | null>(null);

  // Rebuild the api when the language changes so x-suara-lang follows the picker.
  const api = useMemo(() => new HttpSessionApi({ baseUrl: apiUrl, userId, lang }), [lang]);
  const language = languageByCode(lang);
  const here = path?.modules.find((m) => m.state === 'here');

  // "Begin" peeks at the path: if this language has modules, show the glance first;
  // otherwise (or if the server's unreachable) go straight to the lesson, which then
  // surfaces its own error. Fetching here is also the first user gesture (unlocks web audio).
  const begin = useCallback(async () => {
    try {
      const p = await api.getPath();
      if (p.modules.some((m) => m.state === 'here')) {
        setPath(p);
        setScreen('moduleIntro');
        return;
      }
    } catch {
      /* fall through to the lesson */
    }
    setScreen('lesson');
  }, [api]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {screen === 'lesson' ? (
        <LessonScreen api={api} audio={audio} title={language.name} onExit={() => setScreen('entry')} />
      ) : screen === 'picker' ? (
        <LanguagePicker
          current={lang}
          onSelect={(code) => {
            setLang(code);
            setPath(null);
            setScreen('entry');
          }}
          onClose={() => setScreen('entry')}
        />
      ) : screen === 'path' && path ? (
        <PathScreen path={path} onOpenHere={() => setScreen('moduleIntro')} onBack={() => setScreen('moduleIntro')} />
      ) : screen === 'moduleIntro' && here ? (
        <ModuleIntroScreen
          module={here}
          onBegin={() => setScreen('lesson')}
          onViewPath={() => setScreen('path')}
          onClose={() => setScreen('entry')}
        />
      ) : (
        <EntryScreen
          onBegin={begin}
          onPickLanguage={() => setScreen('picker')}
          language={language.name}
          code={language.badge}
        />
      )}
    </SafeAreaProvider>
  );
}
