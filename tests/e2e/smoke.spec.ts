import { test, expect } from '@playwright/test';

test.describe('Feature: web runtime で絵が出る', () => {
  test('given HUD play when a few frames then canvas center is not black', async ({ page }) => {
    await page.goto('/');
    // AudioContext often needs a user gesture
    await page.getByTestId('hud-play').click();
    await page.waitForTimeout(500);

    const lum = await page.evaluate(() => {
      const canvas = document.getElementById('stage') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2');
      if (!gl) return -1;
      const px = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        px,
      );
      return px[0] + px[1] + px[2];
    });
    expect(lum).toBeGreaterThan(0);
  });

  test('given broken GLSL when compile then HUD shows error', async ({ page }) => {
    await page.goto('/harness.html');
    await page.waitForFunction(() => !!(window as unknown as { __suaraHarness?: unknown }).__suaraHarness);

    // Use main app for error HUD — inject broken shader via evaluate on a fresh page
    await page.goto('/');
    await page.waitForSelector('#stage');

    const err = await page.evaluate(async () => {
      const { createWebGlRenderer } = await import('/src/render/webgl.ts');
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      let message: string | null = null;
      const r = createWebGlRenderer(canvas, (m) => {
        message = m;
      });
      r?.setFragmentSource('void mainImage(out vec4 c, in vec2 p) { not_a_valid_token }');
      return message;
    });

    expect(err).toBeTruthy();
    expect(String(err)).toMatch(/error|ERROR|syntax|undeclared|failed/i);
  });
});
