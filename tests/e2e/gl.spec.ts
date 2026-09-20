import { test, expect, type Page } from '@playwright/test';
import type { HarnessApi } from '../../src/harness';

declare global {
  interface Window {
    __suaraHarness: HarnessApi;
  }
}

async function openHarness(page: Page): Promise<void> {
  await page.goto('/harness.html');
  await page.waitForFunction(() => '__suaraHarness' in window);
}

test.describe('Feature: uniform 表の値が GPU に届く', () => {
  test('given float / vec2 / texture when draw then readPixels に出る', async ({ page }) => {
    await openHarness(page);
    const px = await page.evaluate(() =>
      window.__suaraHarness.drawProbe({ a: 0.5, b: 0.25, tex: [0, 0, 1, 1] }),
    );
    expect(Math.abs((px[0] ?? 0) - 128)).toBeLessThan(3);
    expect(Math.abs((px[1] ?? 0) - 64)).toBeLessThan(3);
    // 4 texel [0,0,1,1] の中央 = 0 と 1 の線形補間 = 0.5 (R16F が LINEAR filter できている証拠)
    expect(Math.abs((px[2] ?? 0) - 128)).toBeLessThan(3);
    expect(px[3]).toBe(255);
  });
});

test.describe('Feature: shader がコンパイルできる', () => {
  test('given src/shaders の全 scene when compile then link まで通る', async ({ page }) => {
    await openHarness(page);
    const results = await page.evaluate(() => window.__suaraHarness.compileScenes());
    for (const r of results) {
      expect(r, `${r.name}: ${r.ok ? '' : r.log}`).toMatchObject({ ok: true });
    }
  });

  test('given 壊れた GLSL when compile then .frag 基準の行番号つきでエラーが返る', async ({ page }) => {
    await openHarness(page);
    const result = await page.evaluate(() =>
      window.__suaraHarness.compileSource(
        'void mainImage(out vec4 c, in vec2 p) {\n  not_a_valid_token\n}',
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.log).toMatch(/0:[23]/);
  });
});
