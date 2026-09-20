// Scene param → どの shader を描くか。
//
// Scene param の範囲は scene の数ではなく SCENE_SLOTS で固定する。こうしておくと、後から
// scene を足しても DAW に書いた automation の意味 (= どの値がどの scene か) が変わらない。

export const SCENE_SLOTS = 16;

export interface Scene {
  name: string;
  source: string;
}

/** import.meta.glob('./shaders/*.frag', { query: '?raw', import: 'default', eager: true }) の結果を
 *  ファイル名順の Scene 配列にする。 */
export function scenesFromGlob(files: Record<string, string>): Scene[] {
  return Object.keys(files)
    .sort()
    .map((path) => ({
      name: path.replace(/^.*\//, '').replace(/\.frag$/, ''),
      source: files[path] ?? '',
    }));
}

/** Scene param の値 → 描く Scene。scene が無い slot は最後の scene に寄せる。1 つも無ければ null。 */
export function sceneForValue(scenes: readonly Scene[], value: number): Scene | null {
  const slot = Math.max(0, Math.min(SCENE_SLOTS - 1, Math.round(value)));
  return scenes[Math.min(slot, scenes.length - 1)] ?? null;
}
