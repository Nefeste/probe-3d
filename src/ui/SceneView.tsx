// Один вариант на экране по шагу плана.
import type { People } from '../load';
import type { Step } from '../sim/bench';
import type { Sink } from '../scenes/loop';
import { GLScene } from '../scenes/gl/GLScene';
import { GPUScene } from '../scenes/gpu/GPUScene';
import { SkiaScene } from '../scenes/skia/SkiaScene';

type Props = { people: People; step: Step; onFrame: Sink; onError: (e: string) => void };

export function SceneView({ people, step, onFrame, onError }: Props) {
  if (step.variant === 'skia') return <SkiaScene people={people} count={step.count} onFrame={onFrame} onError={onError} />;
  const detail = step.detail === 'full' ? 'full' : 'lod';
  if (step.variant === 'webgpu') return <GPUScene people={people} count={step.count} detail={detail} onFrame={onFrame} onError={onError} />;
  return <GLScene people={people} count={step.count} detail={detail} onFrame={onFrame} onError={onError} />;
}
