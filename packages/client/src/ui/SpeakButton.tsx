import { Pressable, StyleSheet, Text } from 'react-native';
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

  const label = recording ? 'Tap when you’re done' : phase === 'awaiting' ? 'Tap to speak' : '…';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop speaking' : 'Speak'}
      disabled={!enabled}
      onPress={recording ? onStop : onSpeak}
      style={[styles.button, recording && styles.recording, !enabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A6EA5',
  },
  recording: { backgroundColor: '#B5524B' },
  disabled: { opacity: 0.4 },
  label: { color: 'white', fontSize: 20, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },
});
