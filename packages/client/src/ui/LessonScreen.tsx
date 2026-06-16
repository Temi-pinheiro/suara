import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const { state, speak, stopAndSubmit, reload } = useLesson(api, audio);
  const { phase, prompt, attempt } = state;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        {/* L1 setup — optional visual aid; the spoken version leads */}
        {prompt && <Text style={styles.setup}>{prompt.englishSetup}</Text>}

        {/* introduce: show the new block you just heard, so you can say it */}
        {prompt?.teach && (phase === 'prompting' || phase === 'awaiting' || phase === 'recording') && (
          <View style={styles.teach}>
            <Text style={styles.hanzi}>{prompt.teach.surface}</Text>
            {prompt.teach.pinyin ? <Text style={styles.pinyin}>{prompt.teach.pinyin}</Text> : null}
            <Text style={styles.teachHint}>Listen, then say it.</Text>
          </View>
        )}

        {phase === 'loading' && <ActivityIndicator size="large" color="#3A6EA5" />}

        {attempt && phase === 'feedback' && (
          <Text style={styles.correction}>{attempt.correction}</Text>
        )}

        {attempt?.toneFocus && phase === 'feedback' && <ToneCue tone={attempt.toneFocus} />}

        {phase === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.error}>Something hiccupped: {state.error}</Text>
            <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {phase !== 'error' && <SpeakButton phase={phase} onSpeak={speak} onStop={stopAndSubmit} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'white' },
  body: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 12 },
  setup: { fontSize: 22, lineHeight: 30, textAlign: 'center', color: '#2B2B2B' },
  teach: { alignItems: 'center', marginTop: 8, gap: 4 },
  hanzi: { fontSize: 64, color: '#2B2B2B', fontWeight: '500' },
  pinyin: { fontSize: 24, color: '#3A6EA5' },
  teachHint: { fontSize: 14, color: '#6A6A6A', marginTop: 4 },
  correction: { fontSize: 18, textAlign: 'center', color: '#3A6EA5', marginTop: 12 },
  errorBox: { alignItems: 'center', gap: 16 },
  error: { fontSize: 14, color: '#B5524B', marginTop: 12, textAlign: 'center' },
  retry: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 24, backgroundColor: '#3A6EA5' },
  retryLabel: { color: 'white', fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', paddingBottom: 48 },
});
