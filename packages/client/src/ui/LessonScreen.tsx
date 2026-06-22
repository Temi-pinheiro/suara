import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SessionApi } from '../api/types';
import type { AudioIO } from '../audio/types';
import { useLesson } from '../lesson/useLesson';
import { SpeakButton } from './SpeakButton';
import { ToneCue } from './ToneCue';
import {
  Button,
  CenterState,
  Chip,
  EchoBubble,
  FeedbackCard,
  Spinner,
  ThinkOrb,
  Topbar,
  WordCard,
} from './primitives';
import { space, type, useTheme } from './theme';

interface Props {
  api: SessionApi;
  audio: AudioIO;
  /** language label for the topbar (the client isn't told the code; defaults to launch lang) */
  title?: string;
  onExit?: () => void;
}

const VERDICT_LINE = { correct: 'That’s it.', close: 'Almost.', off: 'Not quite.' } as const;

/**
 * The lesson, one self-paced turn at a time (design pass). Audio is learner-initiated
 * (Listen / mic), the model is revealed only after the attempt, and advancing is an
 * explicit tap — the same MT invariants, now in the warm teal "live-voice" system.
 */
export function LessonScreen({ api, audio, title = 'Mandarin', onExit }: Props) {
  const { c } = useTheme();
  const { state, playing, spend, speak, stopAndSubmit, replay, reload } = useLesson(api, audio);
  const { phase, prompt, attempt } = state;

  const introduce = !!prompt?.teach;
  const loading = phase === 'idle' || phase === 'loading' || (phase === 'prompting' && !prompt);
  const awaitingLike = phase === 'awaiting' || phase === 'prompting';

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <CenterState msg="Setting up your lesson…">
          <Spinner />
        </CenterState>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.errCenter}>
          <View style={[styles.mutedOrb, { backgroundColor: c.cream, borderColor: c.stroke }]}>
            <Text style={{ color: c.faint, fontSize: 24, letterSpacing: 5 }}>···</Text>
          </View>
          <Text style={[type.msg, { color: c.dim, textAlign: 'center' }]}>
            Something hiccupped on our side — your place is saved.
          </Text>
          <Button label="Try again" onPress={reload} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <Topbar title={title} onClose={onExit} spend={spend} />

      <View style={styles.body}>
        {phase === 'scoring' ? (
          <CenterState msg="Listening to what you said…">
            <ThinkOrb />
          </CenterState>
        ) : phase === 'feedback' && attempt ? (
          <>
            {attempt.transcript ? <EchoBubble text={attempt.transcript} roman={attempt.transcriptRoman} /> : null}
            <FeedbackCard
              verdict={attempt.verdict}
              verdictLine={VERDICT_LINE[attempt.verdict]}
              note={attempt.correction}
              modelWord={attempt.modelSurface}
              modelRoman={attempt.modelPinyin}
              onListen={replay}
              playing={playing}
            />
            {attempt.toneFocus ? <ToneCue tone={attempt.toneFocus} /> : null}
            <View style={styles.grow} />
          </>
        ) : (
          <>
            {/* introduce → ambient narration; recombine → the build cue */}
            <Text style={[introduce ? type.narration : type.cue, { color: introduce ? c.narration : c.dim }]}>
              {prompt?.englishSetup}
            </Text>

            {introduce && prompt?.teach ? (
              <WordCard word={prompt.teach.surface} roman={prompt.teach.pinyin} onListen={replay} playing={playing} />
            ) : null}

            {!introduce ? (
              <Text style={[type.narration, { color: c.narration }]}>
                The answer stays hidden until you’ve tried — take your time.
              </Text>
            ) : null}

            <View style={styles.grow} />

            {phase === 'recording' ? (
              <EchoBubble text="listening…" pending />
            ) : !introduce && prompt?.pieces?.length ? (
              <View style={styles.shelf}>
                <Text style={[type.caption, { color: c.faint }]}>pieces you can now combine</Text>
                <View style={styles.chips}>
                  {prompt.pieces.map((p, i) => (
                    <Chip key={i} label={p.surface} roman={p.roman} fresh={p.fresh} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.footer}>
        {awaitingLike && (
          <>
            <View style={styles.micRow}>
              <SpeakButton state="idle" onPress={speak} />
            </View>
            <Text style={[type.helper, styles.helper, { color: c.faint }]}>
              {introduce ? 'Tap to speak — there’s no rush' : 'Tap to speak when you’ve built it'}
            </Text>
          </>
        )}

        {phase === 'recording' && (
          <>
            <Text style={[type.helper, styles.helper, { color: c.live, fontWeight: '600' }]}>
              Live — say it your way, finish when you’re done
            </Text>
            <View style={styles.micRow}>
              <SpeakButton state="live" onPress={stopAndSubmit} />
            </View>
          </>
        )}

        {phase === 'feedback' && attempt && (
          <Button label={attempt.verdict === 'correct' ? 'Continue' : 'Try once more'} onPress={reload} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: space.h, paddingTop: space.sm, gap: space.xxl },
  grow: { flex: 1 },
  shelf: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingHorizontal: space.h, paddingTop: space.xl, paddingBottom: space.hero, gap: space.lg },
  micRow: { alignItems: 'center' },
  helper: { textAlign: 'center' },
  errCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  mutedOrb: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
