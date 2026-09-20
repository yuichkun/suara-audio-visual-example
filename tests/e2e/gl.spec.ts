import { test, expect, type Page } from '@playwright/test';

type SceneResult = { index: number; ok: boolean; log?: string };

async function getHarness(page: Page) {
  await page.goto('/harness.html');
  await page.waitForFunction(() => !!(window as unknown as { __suaraHarness?: unknown }).__suaraHarness);
  return {
    compileScenes: () =>
      page.evaluate(() => (window as unknown as { __suaraHarness: { compileScenes: () => SceneResult[] } }).__suaraHarness.compileScenes()),
    drawProbe: (partial: Record<string, number>) =>
      page.evaluate(
        (p) => (window as unknown as { __suaraHarness: { drawProbe: (x: Record<string, number>) => number[] } }).__suaraHarness.drawProbe(p),
        partial,
      ),
    setScene: (index: number) =>
      page.evaluate(
        (i) => (window as unknown as { __suaraHarness: { setScene: (n: number) => void } }).__suaraHarness.setScene(i),
        index,
      ),
  };
}

test.describe('Feature: uniforms reach the GPU', () => {
  test('given probe.frag when draw then readPixels match iTime/iRms/iScene', async ({ page }) => {
    const harness = await getHarness(page);
    const px = await harness.drawProbe({ iTime: 0.5, iRms: 0.25, iScene: 1 });
    expect(Math.abs((px[0] ?? 0) - 128)).toBeLessThan(3);
    expect(Math.abs((px[1] ?? 0) - Math.round(0.25 * 255))).toBeLessThan(3);
    expect(Math.abs((px[2] ?? 0) - 1)).toBeLessThan(3);
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
