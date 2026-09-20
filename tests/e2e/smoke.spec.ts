import { test, expect } from '@playwright/test';

test.describe('Feature: web runtime で動く', () => {
  test('given ページを開く then エラーなしで描画ループが回る', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto('/');
    await expect(page.locator('#stage')).toBeVisible();
    // main() の初期化 (SDK / AudioWorklet / WebGL) が終わって数フレーム回るのを待つ
    await page.evaluate(
      () => new Promise<void>((r) => setTimeout(() => requestAnimationFrame(() => r()), 500)),
    );
    expect(errors).toEqual([]);
  });
});
