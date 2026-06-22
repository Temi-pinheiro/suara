import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANGUAGES, type LangCode } from '../languages';
import { Topbar } from './primitives';
import { radius, useTheme } from './theme';

interface Props {
  current: LangCode;
  onSelect: (code: LangCode) => void;
  onClose?: () => void;
}

/**
 * Language picker (design pass). Never a gate — all five are open; the current one
 * is highlighted, the rest are one tap away ("nothing is locked"). Picking one sets
 * the session language (sent as x-suara-lang) and returns to the entry screen.
 */
export function LanguagePicker({ current, onSelect, onClose }: Props) {
  const { c, shadow } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <Topbar title="Choose a language" onClose={onClose} />
      <View style={styles.center}>
        <View style={[styles.picker, { backgroundColor: c.surface, borderColor: c.stroke }, shadow.lift]}>
          {LANGUAGES.map((l) => {
            const active = l.code === current;
            return (
              <Pressable
                key={l.code}
                accessibilityRole="button"
                accessibilityLabel={`${l.name}${active ? ', current' : ''}`}
                onPress={() => onSelect(l.code)}
                style={({ pressed }) => [styles.row, active && { backgroundColor: c.wash }, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.code, { backgroundColor: active ? c.primary : c.cream }]}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: active ? c.onPrimary : c.dim }}>{l.badge}</Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{l.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.footnote, { color: c.faint }]}>five languages, one teacher · nothing is locked</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 26 },
  picker: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radius.picker, padding: 8, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 15 },
  code: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footnote: { fontSize: 13, textAlign: 'center' },
});
