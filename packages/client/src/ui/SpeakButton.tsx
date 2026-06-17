import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LessonPhase } from '../lesson/machine';

interface Props {
  phase: LessonPhase;
  onSpeak: () => void;
  onStop: () => void;
}

/**
 * The single voice control. Tap to speak when ready (self-paced — enabled only in
 * `awaiting`), tap again to finish. No countdown, ever.
 */
export function SpeakButton({ phase, onSpeak, onStop }: Props) {
  const recording = phase === 'recording';
  const enabled = phase === 'awaiting' || recording;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop speaking' : 'Speak'}
        disabled={!enabled}
        onPress={recording ? onStop : onSpeak}
        style={({ pressed }) => [
          styles.button,
          recording && styles.recording,
          !enabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.glyph}>{recording ? '■' : '🎙'}</Text>
      </Pressable>
      <Text style={styles.caption}>{recording ? 'Tap when you’re done' : 'Tap and say it'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A6EA5',
    shadowColor: '#3A6EA5',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  recording: { backgroundColor: '#B5524B', shadowColor: '#B5524B' },
  disabled: { opacity: 0.35 },
  pressed: { transform: [{ scale: 0.96 }] },
  glyph: { fontSize: 44, color: 'white' },
  caption: { fontSize: 15, color: '#6A6A6A' },
});
