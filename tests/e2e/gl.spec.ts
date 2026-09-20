import { test, expect } from '@playwright/test';

type Harness = {
  compileScenes: () => Array<{ index: number; ok: boolean; log?: string }>;
  drawProbe: (partial: Record<string, number>) => number[];
  setScene: (index: number) => void;
};

async function getHarness(page: import('@playwright/test').Page): Promise<Harness> {
  await page.goto('/harness.html');
  await page.waitForFunction(() => !!(window as unknown as { __suaraHarness?: unknown }).__suaraHarness);
  return page.evaluateHandle(() => (window as unknown as { __suaraHarness: Harness }).__suaraHarness).then(async (h) => {
    // Return via evaluate wrappers instead
    return {
      compileScenes: () => page.evaluate(() => (window as unknown as { __suaraHarness: Harness }).__suaraHarness.compileScenes()),
      drawProbe: (partial) =>
        page.evaluate((p) => (window as unknown as { __suaraHarness: Harness }).__suaraHarness.drawProbe(p), partial),
      setScene: (index) =>
        page.evaluate((i) => (window as unknown as { __suaraHarness: Harness }).__suaraHarness.setScene(i), index),
    };
  });
}

test.describe('Feature: uniforms reach the GPU', () => {
  test('given probe.frag when draw then readPixels match iTime/iRms/iScene', async ({ page }) => {
    const harness = await getHarness(page);
    const px = await harness.drawProbe({ iTime: 0.5, iRms: 0.25, iScene: 1 });
    // UNSIGNED_BYTE quantizes 0..1 float → 0..255
    expect(px[0]).toBeCloseTo(Math.round(0.5 * 255), -1); // within ~10
    expect(Math.abs(px[0] - 128)).toBeLessThan(3);
    expect(Math.abs(px[1] - Math.round(0.25 * 255))).toBeLessThan(3);
    expect(Math.abs(px[2] - Math.round((1 / 255) * 255))).toBeLessThan(3); // iScene/255 → ~1/255 → byte 1
    expect(px[3]).toBe(255);
  });

  test('given each sceneN.frag when compile then link succeeds', async ({ page }) => {
    const harness = await getHarness(page);
    const results = await harness.compileScenes();
    for (const r of results) {
      expect(r, `scene ${r.index}: ${r.log ?? ''}`).toMatchObject({ ok: true });
    }
  });

  test('given Scene 1 when select then probe B channel encodes 1', async ({ page }) => {
    const harness = await getHarness(page);
    const px = await harness.drawProbe({ iTime: 0, iRms: 0, iScene: 1 });
    expect(px[2]).toBe(1);
  });
});
