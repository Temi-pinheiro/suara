import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { SessionApi } from '../api/types';
import type { AudioIO } from '../audio/types';
import { useLesson } from '../lesson/useLesson';
import { SpeakButton } from './SpeakButton';
import { ToneCue } from './ToneCue';

interface Props {
  api: SessionApi;
  audio: AudioIO;
}

/**
 * The whole app is one screen: hear the setup, build & speak, hear the model + a
 * warm cue. Minimal, voice-first, fully operable by the single speak control.
 */
export function LessonScreen({ api, audio }: Props) {
  const { state, speak, stopAndSubmit } = useLesson(api, audio);
  const { phase, prompt, attempt } = state;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        {/* L1 setup — optional visual aid; the spoken version leads */}
        {prompt && <Text style={styles.setup}>{prompt.englishSetup}</Text>}

        {phase === 'loading' && <ActivityIndicator size="large" color="#3A6EA5" />}

        {attempt && phase === 'feedback' && (
          <Text style={styles.correction}>{attempt.correction}</Text>
        )}

        {attempt?.toneFocus && phase === 'feedback' && <ToneCue tone={attempt.toneFocus} />}

        {state.error && <Text style={styles.error}>Something hiccupped: {state.error}</Text>}
      </View>

      <View style={styles.footer}>
        <SpeakButton phase={phase} onSpeak={speak} onStop={stopAndSubmit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'white' },
  body: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 12 },
  setup: { fontSize: 22, lineHeight: 30, textAlign: 'center', color: '#2B2B2B' },
  correction: { fontSize: 18, textAlign: 'center', color: '#3A6EA5', marginTop: 12 },
  error: { fontSize: 14, color: '#B5524B', marginTop: 12 },
  footer: { alignItems: 'center', paddingBottom: 48 },
});
