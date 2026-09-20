import scene0 from '../shaders/scene0.frag?raw';
import scene1 from '../shaders/scene1.frag?raw';
import scene2 from '../shaders/scene2.frag?raw';
import scene3 from '../shaders/scene3.frag?raw';

export const SCENES: readonly string[] = [scene0, scene1, scene2, scene3];

/** Map Scene param to scene index. */
export function sceneIndexFromParam(sceneValue: number, count = SCENES.length): number {
  if (count <= 0) return 0;
  const idx = Math.round(sceneValue);
  return Math.max(0, Math.min(count - 1, idx));
}

export function sceneSource(index: number): string {
  const src = SCENES[sceneIndexFromParam(index)];
  if (src === undefined) {
    const fallback = SCENES[0];
    if (fallback === undefined) throw new Error('no scenes registered');
    return fallback;
  }
  return src;
}
