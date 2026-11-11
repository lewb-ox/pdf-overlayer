import { test, expect } from '@playwright/test';

test('renders the PDF when the runtime lacks collection upsert APIs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const collection of [Map, WeakMap]) {
      Object.defineProperty(collection.prototype, 'getOrInsertComputed', {
        value: undefined, writable: true, configurable: true,
      });
    }
  });
  await page.goto('/');
  await expect(page.locator('.paper canvas')).toBeVisible();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.locator('.rendering-indicator')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  // Overlays are SVG: check the canvas itself contains the PDF's floor plan.
  const darkPixels = await page.locator('.paper canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] && pixels[i] < 180 && pixels[i + 1] < 180 && pixels[i + 2] < 180) count++;
    }
    return count;
  });
  expect(darkPixels).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});
