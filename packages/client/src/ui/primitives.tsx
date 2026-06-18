/**
 * Token-driven presentational primitives shared by the lesson + entry screens.
 * Every component reads the theme via useTheme(); nothing hard-codes a color.
 * Animations are gentle and gated by reduced-motion (CLAUDE.md accessibility).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type, useTheme } from './theme';

/** True when the OS asks for reduced motion — loops render static instead. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { c, shadow } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary ? { backgroundColor: c.primary, ...shadow.mic } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.stroke },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={primary ? c.onPrimary : c.dim} /> : null}
      <Text style={[type.button, { color: primary ? c.onPrimary : c.dim }]}>{label}</Text>
    </Pressable>
  );
}

/** Listen / replay pill — wash bg, primary text. The audio is always tap-initiated. */
export function ListenPill({
  label = 'Listen',
  onPress,
  playing = false,
}: {
  label?: string;
  onPress: () => void;
  playing?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Listen' ? 'Hear the word' : 'Hear it again'}
      disabled={playing}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: c.wash }, (pressed || playing) && { opacity: 0.7 }]}
    >
      <Ionicons name="volume-high" size={17} color={c.primary} />
      <Text style={[styles.pillLabel, { color: c.primary }]}>{playing ? 'Playing…' : label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** The taught block — five scripts in one shape; the whole card replays the audio. */
export function WordCard({
  word,
  roman,
  gloss,
  onListen,
  playing,
}: {
  word: string;
  roman?: string;
  gloss?: string;
  onListen: () => void;
  playing: boolean;
}) {
  const { c, shadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Hear the word, ${word}${roman ? ' ' + roman : ''}`}
      onPress={onListen}
      style={[styles.wordCard, { backgroundColor: c.surface, borderColor: c.stroke }, shadow.card]}
    >
      <Text style={[type.word, { color: c.text }]}>{word}</Text>
      {roman ? <Text style={[type.roman, { color: c.dim }]}>{roman}</Text> : null}
      {gloss ? <Text style={[type.gloss, { color: c.faint }]}>{gloss}</Text> : null}
      <View style={{ marginTop: space.xs }}>
        <ListenPill onPress={onListen} playing={playing} />
      </View>
    </Pressable>
  );
}

const VERDICT_KEY = { correct: 'correct', close: 'close', off: 'off' } as const;

export function FeedbackCard({
  verdict,
  verdictLine,
  note,
  modelWord,
  modelRoman,
  onListen,
  playing,
}: {
  verdict: 'correct' | 'close' | 'off';
  verdictLine: string;
  note: string;
  /** the revealed model — present only on introduce turns client-side (see notes) */
  modelWord?: string;
  modelRoman?: string;
  onListen: () => void;
  playing: boolean;
}) {
  const { c, shadow } = useTheme();
  const accent = c[VERDICT_KEY[verdict]];
  return (
    <View style={[styles.feedbackCard, { backgroundColor: c.surface, borderColor: c.stroke, borderLeftColor: accent }, shadow.card]}>
      <Text style={[type.verdict, { color: accent }]}>{verdictLine}</Text>
      <Text style={[type.body, { color: c.text }]}>{note}</Text>
      <View style={[styles.fbModel, { borderTopColor: c.hair }]}>
        {modelWord ? (
          <View style={styles.fbModelWord}>
            <Text style={{ fontSize: 30, fontWeight: '700', color: c.text }}>{modelWord}</Text>
            {modelRoman ? <Text style={{ fontSize: 16, color: c.dim }}>{modelRoman}</Text> : null}
          </View>
        ) : (
          <Text style={[type.body, { color: c.dim }]}>Hear how it should sound</Text>
        )}
        <ListenPill label="Hear it" onPress={onListen} playing={playing} />
      </View>
    </View>
  );
}

/** The learner's verbatim words after capture — teal, right-aligned, never paraphrased. */
export function EchoBubble({ text, pending = false }: { text: string; pending?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.echo, { backgroundColor: c.wash }]}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: pending ? c.faint : c.primary }}>{text}</Text>
    </View>
  );
}

export function Chip({ label, roman, fresh = false }: { label: string; roman?: string; fresh?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        fresh
          ? { backgroundColor: c.wash, borderColor: 'transparent' }
          : { backgroundColor: c.cream, borderColor: c.stroke },
      ]}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: fresh ? c.primary : c.text }}>{label}</Text>
      {roman ? <Text style={{ fontSize: 12, fontWeight: '600', color: c.faint }}>{roman}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

export function Topbar({ title, onClose }: { title: string; onClose?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.topbar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close lesson"
        onPress={onClose}
        style={styles.topbarX}
        hitSlop={8}
      >
        {onClose ? <Ionicons name="close" size={20} color={c.dim} /> : null}
      </Pressable>
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{title}</Text>
      <View style={styles.topbarX} />
    </View>
  );
}

export function CenterState({ children, msg }: { children: ReactNode; msg: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.center}>
      {children}
      <Text style={[type.msg, { color: c.dim, textAlign: 'center' }]}>{msg}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated atoms
// ---------------------------------------------------------------------------

export function Spinner() {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={[styles.spinner, { borderColor: c.stroke, borderTopColor: c.primary, transform: [{ rotate }] }]}
    />
  );
}

/** Three teal dots pulsing — the "thinking" signal while scoring. */
export function ThinkOrb() {
  const { c } = useTheme();
  return (
    <View style={[styles.orb, { backgroundColor: c.wash, borderColor: c.stroke }]}>
      <PulseDots />
    </View>
  );
}

export function PulseDots() {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (reduce) return;
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, vals]);
  return (
    <View style={styles.dots}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: c.primary, opacity: v, transform: [{ scale: v }] }]} />
      ))}
    </View>
  );
}

/** Per-tone contour glyph drawn with Views (avoids a react-native-svg dependency). */
export function ToneContour({ tone, color }: { tone: string; color: string }) {
  const line = (extra: ViewStyle) => <View style={[styles.contourLine, { backgroundColor: color }, extra]} />;
  let body: ReactNode;
  switch (tone) {
    case '1': // high-flat
      body = line({ width: 40, top: 8 });
      break;
    case '2': // rising
      body = line({ width: 44, transform: [{ rotate: '-32deg' }] });
      break;
    case '4': // falling
      body = line({ width: 44, transform: [{ rotate: '32deg' }] });
      break;
    case '3': // dip (shallow V)
      body = (
        <>
          {line({ width: 24, left: 2, top: 20, transform: [{ rotate: '28deg' }] })}
          {line({ width: 24, right: 2, top: 20, transform: [{ rotate: '-28deg' }] })}
        </>
      );
      break;
    default: // neutral — a small dot
      body = <View style={[styles.contourDot, { backgroundColor: color }]} />;
  }
  return <View style={styles.contour}>{body}</View>;
}

// ---------------------------------------------------------------------------

function leftAccent(): ViewStyle {
  return { borderLeftWidth: 4 };
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  pill: {
    height: 44,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 20,
    alignSelf: 'center',
  },
  pillLabel: { fontSize: 15, fontWeight: '700' },
  wordCard: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: radius.word,
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 10,
  },
  feedbackCard: {
    alignSelf: 'stretch',
    borderWidth: 1,
    ...leftAccent(),
    borderRadius: radius.feedback,
    paddingVertical: 20,
    paddingHorizontal: 22,
    gap: 14,
  },
  fbModel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  fbModelWord: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  echo: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    borderRadius: 22,
    borderBottomRightRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  chip: {
    height: 38,
    paddingHorizontal: 15,
    borderRadius: radius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  topbarX: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 40 },
  spinner: { width: 46, height: 46, borderRadius: 23, borderWidth: 3 },
  orb: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  contour: { width: 52, height: 36, justifyContent: 'center', alignItems: 'center' },
  contourLine: { position: 'absolute', height: 3, borderRadius: 2 },
  contourDot: { width: 8, height: 8, borderRadius: 4 },
});
