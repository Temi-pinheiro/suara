import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ModulePath, PathView } from '../api/types';
import { Backbar, ModuleDot, PathChip } from './primitives';
import { space, type, useTheme } from './theme';

interface Props {
  path: PathView;
  /** tap the in-progress ("here") module → its intro/lesson */
  onOpenHere: () => void;
  onBack?: () => void;
}

/**
 * The path overview (design pass): modules as small functional blocks, each showing
 * the pieces you OWN (filled teal) vs ahead (outline) + a done/here/ahead dot. The
 * honest progress signal — no %, no score, no streak. Nothing is locked.
 */
export function PathScreen({ path, onOpenHere, onBack }: Props) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <Backbar title="Your path" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[type.caption, { color: c.faint }]}>your blocks, in order</Text>
        <Text style={[styles.mirror, { color: c.dim }]}>
          Wander where you like — start where you are or wander back. Nothing is timed, nothing locks.
        </Text>
        {path.modules.map((m) =>
          m.state === 'here' ? (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}, you're here`}
              onPress={onOpenHere}
            >
              <ModuleCard module={m} />
            </Pressable>
          ) : (
            <ModuleCard key={m.id} module={m} />
          ),
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModuleCard({ module: m }: { module: ModulePath }) {
  const { c, shadow } = useTheme();
  const here = m.state === 'here';
  const raised = here || m.state === 'done';
  const label = here ? 'you’re here' : m.state === 'done' ? 'done' : 'ahead';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: raised ? c.surface : 'transparent',
          borderColor: here ? c.primary : c.stroke,
          borderWidth: here ? 1.5 : 1,
        },
        raised && shadow.card,
        here && { shadowColor: c.primary },
      ]}
    >
      <ModuleDot state={m.state} />
      <View style={styles.cardMain}>
        <View style={styles.cardTop}>
          <Text style={[styles.title, { color: m.state === 'ahead' ? c.faint : c.text }]}>{m.title}</Text>
          <Text style={[styles.mlabel, { color: here ? c.primary : c.faint }]}>{label}</Text>
        </View>
        <View style={styles.chips}>
          {m.pieces.map((p, i) => (
            <PathChip key={i} surface={p.surface} roman={p.roman} owned={p.owned} current={p.current} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: space.h, paddingTop: space.sm, paddingBottom: 40, gap: 14 },
  mirror: { fontSize: 16, lineHeight: 24 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', borderRadius: 20, padding: 16 },
  cardMain: { flex: 1, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  mlabel: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
