import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ModulePath } from '../api/types';
import { Backbar, Button, PathChip } from './primitives';
import { space, type, useTheme } from './theme';

interface Props {
  module: ModulePath;
  onBegin: () => void;
  onViewPath: () => void;
  onClose?: () => void;
}

/**
 * The glance before a lesson (design pass): where you are, what you already own, and
 * what this little block adds — then one tap in. Resume-friendly: leaving is safe, you
 * land right back here. No timer, no score.
 */
export function ModuleIntroScreen({ module: m, onBegin, onViewPath, onClose }: Props) {
  const { c } = useTheme();
  const owned = m.pieces.filter((p) => p.owned).length;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <Backbar title="Your path" onBack={onViewPath} />
      <View style={styles.body}>
        <Text style={[type.caption, { color: c.primary }]}>you’re here</Text>
        <Text style={[styles.title, { color: c.text }]}>{m.title}</Text>
        <Text style={[styles.sub, { color: c.dim }]}>
          {owned > 0
            ? `You already own ${owned} of these. We’ll keep weaving them together as you add the rest.`
            : 'A fresh little block — you’ll build these out loud, one sentence at a time.'}
        </Text>
        <View style={styles.chips}>
          {m.pieces.map((p, i) => (
            <PathChip key={i} surface={p.surface} roman={p.roman} owned={p.owned} current={p.current} />
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Button label="Pick up where you left off" onPress={onBegin} />
        <Text style={[type.helper, styles.helper, { color: c.faint }]}>
          nothing is timed — close any time, you’ll land right back here
        </Text>
        {onClose ? (
          <Text accessibilityRole="button" onPress={onClose} style={[styles.exit, { color: c.faint }]}>
            not now
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: space.h, paddingTop: space.sm, gap: 14 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 16, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  footer: { paddingHorizontal: space.h, paddingBottom: space.hero, paddingTop: space.xl, gap: space.md },
  helper: { textAlign: 'center' },
  exit: { textAlign: 'center', fontSize: 14, paddingVertical: 6 },
});
