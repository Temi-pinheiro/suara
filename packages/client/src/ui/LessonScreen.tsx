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
 * warm cue. Audio is learner-initiated (Listen) so it works under browser autoplay
 * rules, and advancing is an explicit tap — never a timer. Fully operable by voice.
 */
export function LessonScreen({ api, audio }: Props) {
  const { state, playing, speak, stopAndSubmit, replay, advance, reload } = useLesson(api, audio);
  const { phase, prompt, attempt } = state;

  const isFeedback = phase === 'feedback';
  const showContent = !!prompt && phase !== 'loading' && phase !== 'error';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Text style={styles.wordmark}>suara</Text>

      <View style={styles.body}>
        {phase === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#3A6EA5" />
            <Text style={styles.muted}>Setting up your lesson…</Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.error}>Something hiccupped: {state.error}</Text>
            <Pressable accessibilityRole="button" onPress={reload} style={styles.primary}>
              <Text style={styles.primaryLabel}>Try again</Text>
            </Pressable>
          </View>
        )}

        {showContent && (
          <>
            {/* L1 setup — the spoken instruction, shown as a visual aid */}
            <Text style={styles.setup}>{prompt.englishSetup}</Text>

            {/* introduce: the new block to hear + see before producing it */}
            {prompt.teach && (
              <View style={styles.card}>
                <Text style={styles.hanzi}>{prompt.teach.surface}</Text>
                {prompt.teach.pinyin ? <Text style={styles.pinyin}>{prompt.teach.pinyin}</Text> : null}
              </View>
            )}

            {/* warm correction — revealed only after the attempt, never a score */}
            {isFeedback && attempt && (
              <View style={[styles.feedbackCard, accentFor(attempt.verdict)]}>
                <Text style={styles.correction}>{attempt.correction}</Text>
              </View>
            )}

            {isFeedback && attempt?.toneFocus && <ToneCue tone={attempt.toneFocus} />}

            {/* learner-initiated audio — reliable under autoplay rules */}
            <Pressable
              accessibilityRole="button"
              disabled={playing}
              onPress={replay}
              style={({ pressed }) => [styles.listen, pressed && styles.listenPressed, playing && styles.listenPlaying]}
            >
              <Text style={styles.listenLabel}>
                {playing ? '🔊  Playing…' : isFeedback ? '🔊  Hear it again' : '🔊  Listen'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {(phase === 'awaiting' || phase === 'recording') && (
          <SpeakButton phase={phase} onSpeak={speak} onStop={stopAndSubmit} />
        )}

        {phase === 'scoring' && (
          <View style={styles.center}>
            <ActivityIndicator color="#3A6EA5" />
            <Text style={styles.muted}>Listening to what you said…</Text>
          </View>
        )}

        {isFeedback && attempt && (
          <Pressable accessibilityRole="button" onPress={advance} style={styles.primary}>
            <Text style={styles.primaryLabel}>
              {attempt.decision === 'rebuild' ? 'Try once more' : 'Continue'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Soft, warm accent bar by verdict — a feeling, not a grade (CLAUDE.md §2/§6). */
function accentFor(verdict: 'correct' | 'close' | 'off') {
  switch (verdict) {
    case 'correct':
      return { borderLeftColor: '#3E9E7E' };
    case 'close':
      return { borderLeftColor: '#C8862B' };
    default:
      return { borderLeftColor: '#3A6EA5' };
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF8F3' },
  wordmark: {
    fontSize: 15,
    letterSpacing: 4,
    color: '#B6AFA0',
    textAlign: 'center',
    marginTop: 8,
    textTransform: 'lowercase',
  },
  body: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center', gap: 18 },
  center: { alignItems: 'center', gap: 12 },
  muted: { fontSize: 15, color: '#6A6A6A' },

  setup: { fontSize: 23, lineHeight: 32, textAlign: 'center', color: '#2B2B2B', fontWeight: '500' },

  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  hanzi: { fontSize: 72, color: '#2B2B2B', fontWeight: '500' },
  pinyin: { fontSize: 26, color: '#3A6EA5' },

  feedbackCard: {
    alignSelf: 'stretch',
    backgroundColor: 'white',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  correction: { fontSize: 18, lineHeight: 26, color: '#2B2B2B' },

  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#EFEBE1',
    borderWidth: 1,
    borderColor: '#E0DACB',
  },
  listenPressed: { opacity: 0.7 },
  listenPlaying: { opacity: 0.6 },
  listenLabel: { fontSize: 16, color: '#5A5345', fontWeight: '600' },

  errorBox: { alignItems: 'center', gap: 16, paddingHorizontal: 28 },
  error: { fontSize: 15, color: '#B5524B', textAlign: 'center' },

  footer: { alignItems: 'center', paddingBottom: 40, minHeight: 180, justifyContent: 'center' },
  primary: { paddingVertical: 16, paddingHorizontal: 44, borderRadius: 28, backgroundColor: '#3A6EA5' },
  primaryLabel: { color: 'white', fontSize: 17, fontWeight: '600' },
});
