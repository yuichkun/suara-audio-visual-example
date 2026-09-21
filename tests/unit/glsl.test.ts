import { describe, it, expect } from 'vitest';
import { buildConstantDecls, buildFragmentSource, type UniformSpec } from '../../cli/templates/glsl/src/kit/glsl/renderer';
import { sceneForValue, scenesFromGlob } from '../../cli/templates/glsl/src/kit/glsl/scenes';
import { paramUniformName } from '../../cli/templates/glsl/src/kit/glsl/standard-uniforms';

describe('Feature: uniform 表 → GLSL 宣言', () => {
  it('given 表 then 型ごとの宣言が生成され、user source の行番号が 1 から始まる', () => {
    const table: UniformSpec<null>[] = [
      { name: 'iA', type: 'float', get: () => 0 },
      { name: 'iB', type: 'vec3', get: () => [0, 0, 0] },
      { name: 'iC', type: 'texture', get: () => new Float32Array(1) },
    ];
    const src = buildFragmentSource('void mainImage(out vec4 c, in vec2 p) {}', table);
    expect(src.startsWith('#version 300 es')).toBe(true);
    expect(src).toContain('uniform vec3 iResolution;');
    expect(src).toContain('uniform float iA;');
    expect(src).toContain('uniform vec3 iB;');
    expect(src).toContain('uniform sampler2D iC;');
    expect(src).toMatch(/#line 1\nvoid mainImage/);
  });

  it('param の key は p + PascalCase の uniform 名になる', () => {
    expect(paramUniformName('audioAmount')).toBe('pAudioAmount');
  });
});

describe('Feature: Scene param → scene', () => {
  const scenes = scenesFromGlob({ './shaders/01-b.frag': 'B', './shaders/00-a.frag': 'A' });

  it('ファイル名順に並ぶ', () => {
    expect(scenes.map((s) => s.name)).toEqual(['00-a', '01-b']);
  });

  it('値を丸めて選び、scene が無い slot は最後の scene に寄せる', () => {
    expect(sceneForValue(scenes, 0.4)?.name).toBe('00-a');
    expect(sceneForValue(scenes, 0.6)?.name).toBe('01-b');
    expect(sceneForValue(scenes, 7)?.name).toBe('01-b');
  });

  it('scene が 1 つも無ければ null', () => {
    expect(sceneForValue([], 0)).toBeNull();
  });
});

describe('Feature: TS の定数 → GLSL const', () => {
  it('number は float、配列は vecN、boolean は bool になる', () => {
    expect(buildConstantDecls({ SPIN: 0.15, COUNT: 60, ACCENT: [0.25, 0.85, 1], ON: true })).toBe(
      [
        'const float SPIN = 0.15;',
        'const float COUNT = 60.0;',
        'const vec3 ACCENT = vec3(0.25, 0.85, 1.0);',
        'const bool ON = true;',
      ].join('\n'),
    );
  });

  it('shader source では uniform の後・user source の前に入る', () => {
    const src = buildFragmentSource('void mainImage(out vec4 c, in vec2 p) {}', [], { K: 2 });
    expect(src).toMatch(/const float K = 2\.0;\nout vec4 suaraFragColor;\n#line 1\n/);
  });

  it('NaN や長さ 1 の配列は弾く', () => {
    expect(() => buildConstantDecls({ BAD: Number.NaN })).toThrow();
    expect(() => buildConstantDecls({ BAD: [1] })).toThrow();
  });
});
