import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ModulePath } from '../api/types';
import { Backbar, Button, PathChip } from './primitives';
import { space, type, useTheme } from './theme';

interface Props {
  module: ModulePath;
  /** start the lesson — only offered for the in-progress ("here") module */
  onBegin: () => void;
  /** the ‹ backbar → the path overview */
  onViewPath: () => void;
}

const EYEBROW = { here: 'you’re here', done: 'already yours', ahead: 'coming up' } as const;

/**
 * The glance for a module (design pass): where you are, what you own, what it adds.
 * The "here" module offers a one-tap start; done/ahead modules are read-only details
 * (you can browse the whole path, nothing is locked, but the lesson always continues
 * from where the invisible SRS has you). No timer, no score.
 */
export function ModuleIntroScreen({ module: m, onBegin, onViewPath }: Props) {
  const { c } = useTheme();
  const owned = m.pieces.filter((p) => p.owned).length;

  const sub =
    m.state === 'here'
      ? owned > 0
        ? `You already own ${owned} of these. We’ll keep weaving them together as you add the rest.`
        : 'A fresh little block — you’ll build these out loud, one sentence at a time.'
      : m.state === 'done'
        ? 'You’ve got this one — we keep weaving it back in so it stays with you.'
        : 'You’ll reach this soon. It builds on what you’re working on now — nothing here is locked.';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <Backbar title="Your path" onBack={onViewPath} />
      <View style={styles.body}>
        <Text style={[type.caption, { color: m.state === 'here' ? c.primary : c.faint }]}>{EYEBROW[m.state]}</Text>
        <Text style={[styles.title, { color: c.text }]}>{m.title}</Text>
        <Text style={[styles.sub, { color: c.dim }]}>{sub}</Text>
        <View style={styles.chips}>
          {m.pieces.map((p, i) => (
            <PathChip key={i} surface={p.surface} roman={p.roman} owned={p.owned} current={p.current} />
          ))}
        </View>
      </View>
      {m.state === 'here' ? (
        <View style={styles.footer}>
          <Button label="Pick up where you left off" onPress={onBegin} />
          <Text style={[type.helper, styles.helper, { color: c.faint }]}>
            nothing is timed — close any time, you’ll land right back here
          </Text>
        </View>
      ) : null}
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
});
