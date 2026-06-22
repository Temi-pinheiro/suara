import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './theme';
import { useReduceMotion } from './primitives';

export type MicState = 'idle' | 'warming' | 'live' | 'disabled';

interface Props {
  state: MicState;
  onPress: () => void;
}

/**
 * The single voice control, with honest states (design pass): idle (teal, ready),
 * warming (neutral breathing ring — nothing captured yet), live (teal glow + level
 * bars), disabled. Self-paced — tap to speak, tap to finish, never a timer.
 */
export function SpeakButton({ state, onPress }: Props) {
  const { c, shadow } = useTheme();
  const enabled = state === 'idle' || state === 'live';

  const fill =
    state === 'live' ? c.live : state === 'warming' ? c.cream2 : state === 'disabled' ? c.cream : c.primary;

  const label =
    state === 'live'
      ? 'Listening — tap when you’re done'
      : state === 'warming'
        ? 'Opening the microphone'
        : 'Speak your answer';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mic,
        { backgroundColor: fill },
        state === 'idle' && shadow.mic,
        state === 'live' && shadow.glowLive,
        pressed && enabled && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {state === 'warming' && <WarmingRing color={c.primary} />}
      {state === 'live' ? (
        <LevelBars color={c.onPrimary} />
      ) : (
        <Ionicons name="mic" size={30} color={state === 'disabled' ? c.faint : c.onPrimary} />
      )}
    </Pressable>
  );
}

function WarmingRing({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <Animated.View
      style={[
        styles.ring,
        {
          borderColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.55] }) }],
        },
      ]}
    />
  );
}

function LevelBars({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.33))).current;
  useEffect(() => {
    if (reduce) return;
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(b, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.27, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, bars]);
  return (
    <View style={styles.bars}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: b }] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 2 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 },
  bar: { width: 4, height: 26, borderRadius: 2 },
});
