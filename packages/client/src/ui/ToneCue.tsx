import { StyleSheet, Text, View } from 'react-native';
import { toneCue } from '../tone/scaffold';
import { radius, useTheme } from './theme';
import { ToneContour } from './primitives';

interface Props {
  /** the tone the brain chose to coach this turn, e.g. '2' */
  tone: string;
}

/**
 * Audio-native tone scaffold, surfaced gently (Mandarin only). A small contour glyph
 * (line direction = the tone) + the plain-language contour. The real teaching is the
 * spoken correction + model audio; this is an optional visual aid.
 */
export function ToneCue({ tone }: Props) {
  const { c } = useTheme();
  const cue = toneCue(tone);
  if (!cue) return null;

  return (
    <View style={[styles.card, { backgroundColor: c.cream, borderColor: c.stroke }]}>
      <ToneContour tone={tone} color={c.primary} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: c.text }]}>
          Tone {cue.tone} · {cue.name}
        </Text>
        <Text style={[styles.desc, { color: c.dim }]}>{cue.contour}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderRadius: radius.cue,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '800' },
  desc: { fontSize: 13.5, lineHeight: 19 },
});
