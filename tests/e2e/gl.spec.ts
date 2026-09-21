import { test, expect } from '@playwright/test';

// example の dev server から renderer の module をそのまま読み込んでテストする
// (example の中にテスト用のファイルを置かないため)
const RENDERER = '/src/kit/glsl/renderer.ts';

test.describe('Feature: uniform 表の値が GPU に届く', () => {
  test('given float / vec2 / texture when draw then readPixels に出る', async ({ page }) => {
    await page.goto('/');
    const px = await page.evaluate(async (url) => {
      const { createGlslRenderer } = await import(url);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:64px';
      document.body.appendChild(canvas);
      const renderer = createGlslRenderer(
        canvas,
        [
          { name: 'uA', type: 'float', get: () => 0.5 },
          { name: 'uB', type: 'vec2', get: () => [0.25, 0] },
          { name: 'uTex', type: 'texture', get: () => new Float32Array([0, 0, 1, 1]) },
        ],
        { preserveDrawingBuffer: true },
      );
      // R = float、G = vec2.x、B = texture の中央 texel
      renderer.setFragment(
        'void mainImage(out vec4 c, in vec2 p) { c = vec4(uA, uB.x, texture(uTex, vec2(0.5)).r, 1.0); }',
      );
      renderer.draw(null);
      const gl = canvas.getContext('webgl2');
      if (!gl) throw new Error('no webgl2');
      const out = new Uint8Array(4);
      gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return [...out];
    }, RENDERER);
    expect(Math.abs((px[0] ?? 0) - 128)).toBeLessThan(3);
    expect(Math.abs((px[1] ?? 0) - 64)).toBeLessThan(3);
    // 4 texel [0,0,1,1] の中央 = 0 と 1 の線形補間 = 0.5 (R16F が LINEAR filter できている証拠)
    expect(Math.abs((px[2] ?? 0) - 128)).toBeLessThan(3);
    expect(px[3]).toBe(255);
  });

  test('given 壊れた GLSL when compile then .frag 基準の行番号つきでエラーが返る', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async (url) => {
      const { createGlslRenderer } = await import(url);
      const renderer = createGlslRenderer(document.createElement('canvas'), []);
      return renderer.compileOnly('void mainImage(out vec4 c, in vec2 p) {\n  not_a_valid_token\n}');
    }, RENDERER);
    expect(result.ok).toBe(false);
    expect(result.log).toMatch(/0:[23]/);
  });
});
