// Замер всего (docs/spec.md, «Что меряем»): шаги плана по очереди — вариант с числом людей монтируется, разогрев,
// счёт кадров, итог; затем следующий. Не запустилось — ошибка в итоге, замер идёт дальше.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { T } from '../i18n';
import { Meter, plan, type Result } from '../sim/bench';
import type { People } from '../load';
import { SceneView } from './SceneView';

const STEPS = plan();
// сценарий в браузере (tools/e2e/web.ts): ?quick — 5 кадров разогрева и 30 счёта, только чтобы пройти все шаги
const QUICK = Platform.OS === 'web' && typeof location !== 'undefined' && location.search.includes('quick');
const newMeter = () => (QUICK ? new Meter(5, 30) : new Meter());

export function Bench({ people, onDone }: { people: People; onDone: (r: Result[]) => void }) {
  const [i, setI] = useState(0);
  const st = STEPS[i];
  const results = useRef<Result[]>([]);
  const meter = useRef(newMeter());
  const mounted = useRef(0);
  const first = useRef<number | undefined>(undefined);
  const tris = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    meter.current = newMeter();
    first.current = undefined;
    tris.current = 0;
    finished.current = false;
    mounted.current = performance.now();
  }, [i]);

  const next = useCallback((r: Result) => {
    if (finished.current) return;
    finished.current = true;
    results.current.push(r);
    if (i + 1 >= STEPS.length) onDone(results.current);
    else setI(i + 1);
  }, [i, onDone]);

  const onFrame = useCallback((iv: number, cpu: number, t: number) => {
    if (finished.current) return;
    if (first.current === undefined) first.current = performance.now() - mounted.current;
    if (t) tris.current = t;
    meter.current.frame(iv, cpu);
    if (meter.current.done) next({ ...st, stats: meter.current.result(), firstFrameMs: first.current, tris: tris.current });
  }, [st, next]);

  const onError = useCallback((e: string) => next({ ...st, error: e }), [st, next]);

  return (
    <View style={styles.wrap}>
      <SceneView key={i} people={people} step={st} onFrame={onFrame} onError={onError} />
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.text}>{`${T.step(i + 1, STEPS.length)} · ${T.variant[st.variant]} · ${T.people(st.count)} · ${T.detail[st.detail]}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f1efe8' },
  badge: { position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  text: { color: '#fff', fontSize: 14 },
});
