import { test, expect, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

const frames = (page: Page, ms: number) =>
  page.evaluate((wait) => new Promise<void>((r) => setTimeout(() => requestAnimationFrame(() => r()), wait)), ms);

test.describe('Feature: example が web runtime で動く', () => {
  test('given ページを開く then エラーなしで描画ループが回る (= shader がコンパイルできている)', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('#stage')).toBeVisible();
    await frames(page, 800);
    expect(errors).toEqual([]);
  });

  test('given 再生して Shape と Energy を最大にする then エラーなしで描画が続く', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await frames(page, 500);
    await page.evaluate(async () => {
      const { useTransport } = await import('/src/sdk/transport.ts' as string);
      useTransport().setPlaying(true);
      const { params } = await import('/src/params.ts' as string);
      for (const [key, value] of [['shape', 2], ['energy', 1]] as const) {
        params[key].begin();
        params[key].setFromUser(value);
        params[key].end();
      }
    });
    await frames(page, 1500);
    expect(errors).toEqual([]);
  });
});
