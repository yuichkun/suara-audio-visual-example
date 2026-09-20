import { test, expect } from '@playwright/test';

test.describe('Feature: web runtime で絵が出る', () => {
  test('given HUD play when a few frames then canvas center is not black', async ({ page }) => {
    await page.goto('/');
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
      return (px[0] ?? 0) + (px[1] ?? 0) + (px[2] ?? 0);
    });
    expect(lum).toBeGreaterThan(0);
  });

  test('given broken GLSL when compile then HUD shows error', async ({ page }) => {
    await page.goto('/harness.html');
    await page.waitForFunction(() => !!(window as unknown as { __suaraHarness?: unknown }).__suaraHarness);

    const result = await page.evaluate(() => {
      const h = (
        window as unknown as {
          __suaraHarness: {
            compileSource: (src: string) => { ok: true } | { ok: false; log: string };
          };
        }
      ).__suaraHarness;
      return h.compileSource('void mainImage(out vec4 c, in vec2 p) { not_a_valid_token }');
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.log).toMatch(/error|ERROR|syntax|undeclared|failed/i);
    }
  });
});
