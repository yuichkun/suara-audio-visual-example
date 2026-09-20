import { describe, it, expect, vi } from 'vitest';
import { defineParams, readParams } from '../../src/kit/signals/params';

// useParam は id ごとに 1 回だけ呼ぶ前提なので、テストごとに id を変える
const manifest = (base: number) => [
  { id: base, title: 'Scene', default: 0 },
  { id: base + 1, title: 'Intensity', default: 0.5 },
];

describe('Feature: suara.json を SSoT にした param 宣言', () => {
  it('given title で引く then id と default (normalized → 実値) が suara.json から決まる', () => {
    const p = defineParams(manifest(100), {
      scene: { title: 'Scene', min: 0, max: 15, step: 1 },
      intensity: { title: 'Intensity', min: 0, max: 2 },
    });
    expect(p.scene.id).toBe(100);
    expect(p.intensity.id).toBe(101);
    expect(p.intensity.defaultValue).toBe(1);
    expect(p.intensity.value).toBe(1);
  });

  it('given setFromUser then value が更新される (getter が生きている)', () => {
    const p = defineParams(manifest(110), {
      scene: { title: 'Scene' },
      intensity: { title: 'Intensity' },
    });
    p.intensity.begin();
    p.intensity.setFromUser(0.9);
    p.intensity.end();
    expect(p.intensity.value).toBe(0.9);
    expect(readParams(p)).toEqual({ scene: 0, intensity: 0.9 });
  });

  it('given suara.json に無い title then 起動時に throw する', () => {
    expect(() => defineParams(manifest(120), { nope: { title: 'Nope' } })).toThrow(/Nope/);
  });

  it('given コードから使われていない param then warn する', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    defineParams(manifest(130), { scene: { title: 'Scene' } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Intensity'));
    warn.mockRestore();
  });
});
