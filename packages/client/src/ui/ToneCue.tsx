import { StyleSheet, Text, View } from 'react-native';
import { toneCue } from '../tone/scaffold';

interface Props {
  /** the tone the brain chose to coach this turn, e.g. '2' */
  tone: string;
}

/**
 * Audio-native tone scaffold, surfaced gently. Shows the spoken contour + the
 * consistent mnemonic for the tone being coached. It's an optional visual aid —
 * the real teaching is in the spoken correction and the model audio.
 */
export function ToneCue({ tone }: Props) {
  const cue = toneCue(tone);
  if (!cue) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tone {cue.tone} · {cue.name}</Text>
      <Text style={styles.contour}>{cue.contour}</Text>
      <Text style={styles.mnemonic}>Think: {cue.mnemonic}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F4F1EA',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 6, color: '#2B2B2B' },
  contour: { fontSize: 16, color: '#2B2B2B', lineHeight: 22 },
  mnemonic: { fontSize: 15, color: '#6A6A6A', marginTop: 8, fontStyle: 'italic' },
});
