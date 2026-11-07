// Итоги замера: таблица по шагам и телефон. Снимок экрана этой таблицы — результат пробы (docs/spec.md).
import { Dimensions, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from '../i18n';
import type { Result } from '../sim/bench';

export function deviceLine(): string {
  const c = Platform.constants as unknown as Record<string, unknown>;
  const { width, height } = Dimensions.get('screen');
  const px = `${Math.round(width * PixelRatio.get())}×${Math.round(height * PixelRatio.get())}`;
  if (Platform.OS === 'android') return `${c.Brand ?? ''} ${c.Model ?? ''}, Android ${c.Release ?? ''}, экран ${px}`;
  return `${Platform.OS} ${Platform.Version}, экран ${px}`;
}

const f1 = (x: number) => x.toFixed(1);

export function Results({ results, onAgain, onBack }: { results: Result[]; onAgain: () => void; onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{T.results}</Text>
      <Text style={styles.p}>{T.device(deviceLine())}</Text>
      <View style={styles.row}>{T.cols.map(c => <Text key={c} style={[styles.cell, styles.head]}>{c}</Text>)}</View>
      {results.map((r, i) => (
        <View key={i} style={styles.row} testID={`result-${i}`}>
          <Text style={styles.cell}>{T.variant[r.variant]}</Text>
          <Text style={styles.cell}>{`${r.count}, ${T.detail[r.detail]}`}</Text>
          {r.stats ? (
            <>
              <Text style={styles.cell}>{(1000 / r.stats.medianMs).toFixed(0)}</Text>
              <Text style={styles.cell}>{f1(r.stats.medianMs)}</Text>
              <Text style={styles.cell}>{f1(r.stats.p99Ms)}</Text>
              <Text style={styles.cell}>{f1(r.stats.worstMs)}</Text>
              <Text style={styles.cell}>{`${(r.stats.longShare * 100).toFixed(1)} %`}</Text>
              <Text style={styles.cell}>{f1(r.stats.cpuMedianMs)}</Text>
              <Text style={styles.cell}>{r.firstFrameMs !== undefined ? r.firstFrameMs.toFixed(0) : '—'}</Text>
            </>
          ) : (
            <Text style={[styles.cell, styles.bad]}>{T.failed(r.error ?? '')}</Text>
          )}
        </View>
      ))}
      <Text style={styles.p}>{T.shot}</Text>
      <View style={styles.buttons}>
        <Pressable onPress={onAgain} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>{T.again}</Text></Pressable>
        <Pressable onPress={onBack} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>{T.back}</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8, backgroundColor: '#f1efe8', minHeight: '100%' },
  h: { fontSize: 22, fontWeight: '700', color: '#2a2a2a' },
  p: { fontSize: 14, color: '#2a2a2a' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#d8d4c8', paddingVertical: 4 },
  cell: { flex: 1, fontSize: 13, color: '#2a2a2a' },
  head: { fontWeight: '700' },
  bad: { flex: 7, color: '#a33' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { backgroundColor: '#2f5d6e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 15 },
});
