import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './primitives';
import { useTheme } from './theme';

interface Props {
  onBegin: () => void;
  onPickLanguage?: () => void;
  /** current language label + badge */
  language?: string;
  code?: string;
}

// Ascending "voice" sound-mark — 7 bars, the brand glyph (no asset).
const BAR_HEIGHTS = [16, 26, 38, 52, 40, 28, 20];

/**
 * First-run / entry. Deliberately tiny (no name capture — client storage is
 * disallowed, CLAUDE.md §6 — no goals, no streak). "Begin" starts the lesson AND
 * is the first user gesture, which unlocks audio on web (browser autoplay policy).
 */
export function EntryScreen({ onBegin, onPickLanguage, language = 'Mandarin', code = 'ZH' }: Props) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[styles.wordmark, { color: c.primary }]}>suara</Text>
          <View style={styles.soundmark}>
            {BAR_HEIGHTS.map((h, i) => (
              <View
                key={i}
                style={{ width: 7, height: h, borderRadius: 4, backgroundColor: c.primary, opacity: 0.9 }}
              />
            ))}
          </View>
        </View>

        <View style={styles.grow} />

        <Text style={[styles.lead, { color: c.text }]}>Let’s pick up where speaking comes from.</Text>
        <Text style={[styles.sub, { color: c.dim }]}>
          A patient voice, one sentence at a time. You listen, you build, you say it. No tests, no clock.
        </Text>

        <View style={styles.grow} />

        <Button label="Begin" onPress={onBegin} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Language: ${language}. Tap to change.`}
          onPress={onPickLanguage}
          style={({ pressed }) => [styles.langPill, { backgroundColor: c.surface, borderColor: c.stroke }, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.code, { backgroundColor: c.cream }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: c.dim }}>{code}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: c.text }}>{language}</Text>
          <Ionicons name="chevron-down" size={13} color={c.faint} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 30, paddingTop: 30, paddingBottom: 36, alignItems: 'stretch' },
  top: { alignItems: 'center', gap: 18, marginTop: 24 },
  wordmark: { fontSize: 40, fontWeight: '500', letterSpacing: 13, textTransform: 'lowercase' },
  soundmark: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 56 },
  grow: { flex: 1 },
  lead: { fontSize: 27, lineHeight: 35, fontWeight: '500', letterSpacing: -0.4 },
  sub: { fontSize: 17, lineHeight: 26, marginTop: 14 },
  langPill: {
    alignSelf: 'center',
    marginTop: 16,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  code: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
