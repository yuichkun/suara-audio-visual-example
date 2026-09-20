import scene0 from '../shaders/scene0.frag?raw';
import scene1 from '../shaders/scene1.frag?raw';
import scene2 from '../shaders/scene2.frag?raw';
import scene3 from '../shaders/scene3.frag?raw';

export const SCENES: string[] = [scene0, scene1, scene2, scene3];

/** Map Scene param (0..1 denorm or float index) to scene index. */
export function sceneIndexFromParam(sceneValue: number, count = SCENES.length): number {
  if (count <= 0) return 0;
  // suara.json Scene default 0, range 0..N via denormalized useParam with max = count-1
  const idx = Math.round(sceneValue);
  return Math.max(0, Math.min(count - 1, idx));
}
