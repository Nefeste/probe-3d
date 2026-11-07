// Проба 3D (docs/spec.md): меню, замер всего, просмотр варианта, итоги.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from './src/i18n';
import { loadPeople, type People } from './src/load';
import { plan, type Result, type Step } from './src/sim/bench';
import { Bench } from './src/ui/Bench';
import { Live } from './src/ui/Live';
import { Results } from './src/ui/Results';

type Screen = { k: 'menu' } | { k: 'bench'; n: number } | { k: 'live'; step: Step } | { k: 'results'; results: Result[] };

export default function App() {
  const [people, setPeople] = useState<People | null>(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ k: 'menu' });
  useEffect(() => {
    loadPeople().then(setPeople, e => setError(String(e?.message ?? e)));
  }, []);
  let body;
  if (!people) body = <Text style={styles.p}>{error ? T.failed(error) : T.loading}</Text>;
  else if (screen.k === 'bench') body = <Bench key={screen.n} people={people} onDone={results => setScreen({ k: 'results', results })} />;
  else if (screen.k === 'live') body = <Live people={people} step={screen.step} onBack={() => setScreen({ k: 'menu' })} />;
  else if (screen.k === 'results') body = <Results results={screen.results} onAgain={() => setScreen({ k: 'bench', n: Date.now() })} onBack={() => setScreen({ k: 'menu' })} />;
  else body = (
    <ScrollView contentContainerStyle={styles.menu}>
      <Text style={styles.h}>{T.title}</Text>
      <Text style={styles.p}>{T.subtitle}</Text>
      <Pressable testID="run" onPress={() => setScreen({ k: 'bench', n: Date.now() })} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>{T.run}</Text></Pressable>
      <Text style={styles.note}>{T.runNote}</Text>
      <Text style={styles.sub}>{T.live}</Text>
      <View style={styles.grid}>
        {plan().map((s, i) => (
          <Pressable key={i} testID={`live-${i}`} onPress={() => setScreen({ k: 'live', step: s })} style={styles.small} accessibilityRole="button">
            <Text style={styles.smallText}>{`${T.variant[s.variant]} · ${T.people(s.count)} · ${T.detail[s.detail]}`}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1efe8' },
  menu: { padding: 20, gap: 10 },
  h: { fontSize: 24, fontWeight: '700', color: '#2a2a2a' },
  p: { fontSize: 15, color: '#2a2a2a', padding: 4 },
  note: { fontSize: 13, color: '#555' },
  sub: { fontSize: 16, fontWeight: '700', color: '#2a2a2a', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { alignSelf: 'flex-start', backgroundColor: '#2f5d6e', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 16 },
  small: { backgroundColor: '#dfe6e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  smallText: { color: '#2a2a2a', fontSize: 14 },
});
