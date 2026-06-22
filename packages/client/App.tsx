import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpSessionApi } from './src/api/httpApi';
import type { ModulePath, PathView } from './src/api/types';
import { useExpoAudioIO } from './src/audio/expoAudio';
import { getDeviceUserId } from './src/identity';
import { languageByCode, type LangCode } from './src/languages';
import { EntryScreen } from './src/ui/EntryScreen';
import { FlowScreen } from './src/ui/FlowScreen';
import { LanguagePicker } from './src/ui/LanguagePicker';
import { ModuleIntroScreen } from './src/ui/ModuleIntroScreen';
import { PathScreen } from './src/ui/PathScreen';
import { CenterState, Spinner } from './src/ui/primitives';
import { useTheme } from './src/ui/theme';

// The turn server. Defaults to the local `pnpm serve` endpoint; override with
// EXPO_PUBLIC_SUARA_API for a physical device (your machine's LAN IP) or a deployed
// backend. (Must be the literal `process.env.EXPO_PUBLIC_*` form so Expo inlines it.)
const apiUrl = process.env.EXPO_PUBLIC_SUARA_API ?? 'http://localhost:8787';

type Screen = 'entry' | 'picker' | 'path' | 'moduleIntro' | 'lesson';

export default function App() {
  const audio = useExpoAudioIO();
  const [screen, setScreen] = useState<Screen>('entry');
  const [lang, setLang] = useState<LangCode>('cmn');
  const [path, setPath] = useState<PathView | null>(null);
  const [viewModule, setViewModule] = useState<ModulePath | null>(null);
  // Anonymous per-install id (Keychain-backed) so each tester's progress is isolated.
  // Resolved once on mount; the api isn't built until we have it.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDeviceUserId().then((id) => alive && setUserId(id));
    return () => {
      alive = false;
    };
  }, []);

  // Rebuild the api when the language or learner id changes so the headers follow them.
  const api = useMemo(
    () => (userId ? new HttpSessionApi({ baseUrl: apiUrl, userId, lang }) : null),
    [lang, userId],
  );
  const language = languageByCode(lang);

  // "Begin" peeks at the path: if this language has modules, open the in-progress
  // module's glance first; otherwise (or if the server's unreachable) go straight to
  // the lesson, which surfaces its own error. This tap also unlocks web audio.
  const begin = useCallback(async () => {
    if (!api) return; // identity still resolving — Begin is disabled below until it's ready
    try {
      const p = await api.getPath();
      const here = p.modules.find((m) => m.state === 'here');
      if (here) {
        setPath(p);
        setViewModule(here);
        setScreen('moduleIntro');
        return;
      }
    } catch {
      /* fall through to the lesson */
    }
    setScreen('lesson');
  }, [api]);

  // Hold the app at a quiet boot state until the device id resolves (Keychain read,
  // near-instant). Everything past here can assume `api` is non-null.
  if (!api) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <BootScreen />
      </SafeAreaProvider>
    );
  }

  // Navigation hierarchy: entry → moduleIntro(here) → lesson, with the path overview
  // (every module tappable) one ‹ away. moduleIntro ‹ → path; path ‹ → entry; lesson ✕ → entry.
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {screen === 'lesson' ? (
        <FlowScreen api={api} audio={audio} title={language.name} onExit={() => setScreen('entry')} />
      ) : screen === 'picker' ? (
        <LanguagePicker
          current={lang}
          onSelect={(code) => {
            setLang(code);
            setPath(null);
            setViewModule(null);
            setScreen('entry');
          }}
          onClose={() => setScreen('entry')}
        />
      ) : screen === 'path' && path ? (
        <PathScreen
          path={path}
          onSelectModule={(m) => {
            setViewModule(m);
            setScreen('moduleIntro');
          }}
          onBack={() => setScreen('entry')}
        />
      ) : screen === 'moduleIntro' && viewModule ? (
        <ModuleIntroScreen
          module={viewModule}
          onBegin={() => setScreen('lesson')}
          onViewPath={() => setScreen('path')}
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

/** Quiet full-bleed loader shown while the anonymous device id resolves on launch. */
function BootScreen() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <CenterState msg="Warming up your lesson…">
        <Spinner />
      </CenterState>
    </View>
  );
}
