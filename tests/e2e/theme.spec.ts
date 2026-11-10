import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function ready(page: Page) {
  await expect(page.locator('.paper canvas')).toBeVisible();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.locator('.rendering-indicator')).toHaveCount(0);
}

test('defaults to system, follows live changes and preserves white PDF content', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/'); await ready(page);
  await expect(page.getByRole('combobox', { name: 'Colour theme' })).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.paper')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByTestId('plan-legend').locator('rect').first()).toHaveAttribute('fill', 'white');
  const original = await page.locator('.paper canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const overlays = await page.locator('[data-overlay-id]').evaluateAll(paths => paths.map(path => [path.getAttribute('fill'), path.getAttribute('fill-opacity')]));
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.locator('.paper canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(original);
  expect(await page.locator('[data-overlay-id]').evaluateAll(paths => paths.map(path => [path.getAttribute('fill'), path.getAttribute('fill-opacity')]))).toEqual(overlays);
  await expect(page.locator('.paper')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await page.evaluate(() => localStorage.getItem('pdf-overlayer.theme'))).toBeNull();
});

test('persists manual overrides and can return to following the system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/'); await ready(page);
  const control = page.getByRole('combobox', { name: 'Colour theme' });
  await control.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('pdf-overlayer.theme'))).toBe('dark');
  await page.reload(); await ready(page);
  await expect(control).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await control.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload(); await ready(page);
  await expect(control).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await control.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload(); await ready(page);
  await expect(control).toHaveValue('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('remains usable when local storage is blocked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage is blocked', 'SecurityError'); } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/'); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('synchronises theme choices across tabs', async ({ page, context }) => {
  await page.goto('/'); await ready(page);
  const other = await context.newPage();
  await other.goto('/'); await ready(other);
  await other.getByRole('combobox', { name: 'Colour theme' }).selectOption('dark');
  await expect(page.getByRole('combobox', { name: 'Colour theme' })).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('system');
  await expect(other.getByRole('combobox', { name: 'Colour theme' })).toHaveValue('system');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('renders both themes at desktop and mobile sizes with readable controls', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/'); await ready(page);
  await mkdir('.impeccable/review', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Colour theme' }).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await ready(page);
    const contrasts = await page.evaluate(() => {
      const selectors = ['.brand', '.secondary-button', '.primary-button', '.theme-control', '.category-select', '.category-count', '.tool-button.is-active', '.page-controls', '.fit-button', '.demo-banner', '.example-badge', '.demo-banner > button', '.workspace-status', '.legend-section p', '.sidebar-footer'];
      const channels = (value: string) => value.match(/[\d.]+/g)!.map(Number);
      const luminance = (rgb: number[]) => rgb.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      return selectors.map(selector => {
        const element = document.querySelector(selector)!;
        const foreground = luminance(channels(getComputedStyle(element).color));
        let ancestor: Element | null = element;
        let background = [255, 255, 255];
        while (ancestor) {
          const candidate = channels(getComputedStyle(ancestor).backgroundColor);
          if (candidate.length === 3 || candidate[3] === 1) { background = candidate; break; }
          ancestor = ancestor.parentElement;
        }
        const bg = luminance(background);
        return { selector, ratio: (Math.max(foreground, bg) + 0.05) / (Math.min(foreground, bg) + 0.05) };
      });
    });
    for (const result of contrasts) expect(result.ratio, `${theme} ${result.selector} text contrast`).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `.impeccable/review/${theme}-desktop.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 }); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('combobox', { name: 'Colour theme' })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/${theme}-mobile.png`, fullPage: true, animations: 'disabled' });
    if (theme === 'dark') {
      await page.getByRole('button', { name: 'Show colours and rooms' }).click();
      await expect(page.getByRole('heading', { name: 'Colour key' })).toBeVisible();
      await page.screenshot({ path: '.impeccable/review/dark-mobile-panel.png', fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Close colour panel', exact: true }).last().click();
    }
    await page.setViewportSize({ width: 360, height: 800 }); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await ready(page);
  await page.getByRole('button', { name: 'Seminar room', exact: true }).click();
  await expect(page.getByLabel('Room name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Drawing help' }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(32, 41, 35)');
  await page.screenshot({ path: '.impeccable/review/dark-help.png', fullPage: true, animations: 'disabled' });
});
