// Посмотреть один вариант: та же сцена, сверху — кадры в секунду за последние полсекунды.
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '../i18n';
import type { People } from '../load';
import type { Step } from '../sim/bench';
import { SceneView } from './SceneView';

export function Live({ people, step, onBack }: { people: People; step: Step; onBack: () => void }) {
  const [hud, setHud] = useState('');
  const acc = useRef({ n: 0, sum: 0, tris: 0 });
  const onFrame = useCallback((iv: number, _cpu: number, tris: number) => {
    const a = acc.current;
    a.n++;
    a.sum += iv;
    if (tris) a.tris = tris;
    if (a.sum > 500) {
      const ms = a.sum / a.n;
      setHud(T.hud(1000 / ms, ms, a.tris));
      a.n = 0;
      a.sum = 0;
    }
  }, []);
  const [err, setErr] = useState('');
  return (
    <View style={styles.wrap}>
      <SceneView people={people} step={step} onFrame={onFrame} onError={setErr} />
      <View style={styles.bar}>
        <Pressable onPress={onBack} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>{T.back}</Text></Pressable>
        <Text style={styles.hud}>{err ? T.failed(err) : `${T.variant[step.variant]} · ${T.people(step.count)} · ${hud}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f1efe8' },
  bar: { position: 'absolute', left: 12, top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 15 },
  hud: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, fontSize: 14, flexShrink: 1 },
});
