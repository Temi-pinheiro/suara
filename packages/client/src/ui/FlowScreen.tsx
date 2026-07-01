/**
 * FlowScreen — the eyes-closed, all-voice lesson. Once it mounts (after "Begin"), the
 * conductor drives everything by ear: you can flow through the whole session without
 * looking or tapping. The visuals here are an OPTIONAL aid (CLAUDE.md §6) — a breathing
 * orb that carries state by color + motion, a listening bar, and faint text you can
 * ignore. Tap anywhere to pause/resume; press and hold to hear the last bit again.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SessionApi } from '../api/types';
import type { AudioIO } from '../audio/types';
import { useConductor, type ConductorPhase } from '../lesson/conductor';
import { useReduceMotion } from './primitives';
import { useTheme, type Colors } from './theme';

interface Props {
  api: SessionApi;
  audio: AudioIO;
  title: string;
  onExit: () => void;
}

/** Orb color by phase: teal while the teacher speaks, brighter while you speak, warm on feedback. */
function orbColor(phase: ConductorPhase, verdict: string | undefined, c: Colors): string {
  switch (phase) {
    case 'listening':
      return c.live; // you're being heard
    case 'feedback':
      return verdict === 'correct' ? c.correct : verdict === 'close' ? c.close : c.off;
    case 'scoring':
      return c.dim;
    case 'paused':
    case 'error':
      return c.faint;
    default:
      return c.primary; // teaching / loading — the teacher's voice
  }
}

/** One short status line — spoken content is the source of truth; this just mirrors it. */
function caption(phase: ConductorPhase): string {
  switch (phase) {
    case 'loading':
      return 'Setting up…';
    case 'teaching':
      return 'Listen';
    case 'listening':
      return 'Your turn — say it';
    case 'scoring':
      return 'One moment…';
    case 'feedback':
      return '';
    case 'paused':
      return 'Paused — tap to resume';
    case 'error':
      return 'Something hiccuped';
    default:
      return '';
  }
}

export function FlowScreen({ api, audio, title, onExit }: Props) {
  const { c, shadow } = useTheme();
  const reduce = useReduceMotion();
  const { state, start, stop, pause, resume, repeat } = useConductor(api, audio);
  const { phase, prompt, attempt, level, spend, error } = state;

  // Start the hands-free loop on mount; tear it down on exit.
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  // Breathing orb — a slow, calm pulse (skipped under reduce-motion).
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  // While listening, the orb pulses with the learner's own voice (input level) instead of
  // showing a countdown — you can *see* you're being heard, with no time pressure (§2.7).
  const listening = phase === 'listening';
  const voice = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !listening) return;
    Animated.timing(voice, { toValue: level, duration: 90, easing: Easing.linear, useNativeDriver: true }).start();
  }, [level, listening, reduce, voice]);
  const voiceScale = voice.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  const color = orbColor(phase, attempt?.verdict, c);
  const paused = phase === 'paused';

  // Optional visual aid: the taught word while teaching, the model after the attempt.
  const bigWord = phase === 'feedback' ? attempt?.modelSurface : prompt?.teach?.surface;
  const bigRoman = phase === 'feedback' ? attempt?.modelPinyin : prompt?.teach?.pinyin;
  // The spoken line, mirrored faintly: the setup task, then the warm correction.
  const subtext = phase === 'feedback' ? attempt?.correction : phase === 'teaching' ? prompt?.englishSetup : caption(phase);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="End lesson" onPress={onExit} hitSlop={10} style={styles.x}>
          <Ionicons name="close" size={22} color={c.dim} />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{title}</Text>
        <Text style={{ minWidth: 40, textAlign: 'right', fontSize: 13, fontWeight: '600', color: c.faint, fontVariant: ['tabular-nums'] }}>
          ${spend.toFixed(2)}
        </Text>
      </View>

      <Pressable
        style={styles.stage}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Paused. Tap to resume.' : 'Lesson playing. Tap to pause, hold to repeat.'}
        onPress={paused ? resume : pause}
        onLongPress={repeat}
        delayLongPress={350}
      >
        <View style={styles.orbWrap}>
          <Animated.View
            style={[
              styles.orb,
              { backgroundColor: color, shadowColor: color, transform: [{ scale: paused ? 1 : listening ? voiceScale : scale }] },
              !paused && shadow.glowLive,
              { shadowOpacity: listening ? 0.5 : 0.28 },
            ]}
          >
            <Ionicons
              name={paused ? 'pause' : listening ? 'mic' : phase === 'feedback' ? 'sparkles' : 'volume-high'}
              size={40}
              color={c.onPrimary}
            />
          </Animated.View>
        </View>

        {bigWord ? (
          <View style={styles.word}>
            <Text style={{ fontSize: 44, fontWeight: '700', color: c.text }}>{bigWord}</Text>
            {bigRoman ? <Text style={{ fontSize: 20, color: c.dim, marginTop: 4 }}>{bigRoman}</Text> : null}
          </View>
        ) : null}

        <Text style={[styles.caption, { color: phase === 'feedback' ? c.text : c.dim }]} numberOfLines={3}>
          {error ?? subtext ?? ''}
        </Text>
      </Pressable>

      <Text style={[styles.hint, { color: c.faint }]}>tap to pause · hold to hear it again</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4 },
  x: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 30 },
  orbWrap: { alignItems: 'center', gap: 22 },
  orb: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center' },
  word: { alignItems: 'center' },
  caption: { fontSize: 19, lineHeight: 27, fontWeight: '500', textAlign: 'center' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '600', paddingBottom: 10 },
});
