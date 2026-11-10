import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

async function ready(page: Page) {
  await expect(page.locator('.paper canvas')).toBeVisible();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.locator('.rendering-indicator')).toHaveCount(0);
}
async function point(page: Page, x: number, y: number) {
  const svg = page.locator('.overlay-surface');
  const box = (await svg.boundingBox())!;
  const [, , w, h] = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  await page.mouse.click(box.x + x / w * box.width, box.y + y / h * box.height);
}

test('matches the grouped legend reference in preview, saved projects and exported PDFs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'AV4 0', exact: true }).click();
  await page.getByRole('button', { name: 'Straight edge (P)', exact: true }).click();
  for (const [x, y] of [[900, 430], [980, 430], [980, 500], [900, 500]]) await point(page, x, y);
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Reception');
  await page.getByRole('textbox', { name: 'Room name', exact: true }).press('Enter');
  await expect(page.getByTestId('plan-legend')).toContainText('Reception');
  await expect(page.locator('[data-room-number="4"]')).toBeVisible();
  await page.getByText('Edit legend text', { exact: true }).click();
  for (const [label, text] of [
    ['Legend title', 'Example building - First Floor'],
    ['Legend subtitle', 'AV category overlay (rooms from Room List)'],
    ['Legend notes', 'Not shown: ground floor entrance stairwell.'],
    ['Legend footer', 'Base: example plan. Overlay follows room boundaries.'],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(text);
    await page.getByLabel(label, { exact: true }).press('Tab');
  }
  const legend = page.getByTestId('plan-legend');
  await expect(legend).toContainText('Example building - First Floor');
  await expect(legend).toContainText('ground floor entrance');
  const number = page.locator('[data-room-number="1"]');
  const start = await number.locator('circle').getAttribute('cx');
  const box = (await number.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 25, box.y + 27, { steps: 5 }); await page.mouse.up();
  expect(await number.locator('circle').getAttribute('cx')).not.toBe(start);
  await page.getByRole('button', { name: 'Hide AV & support', exact: true }).click();
  await expect(legend).not.toContainText('AV & support');
  await expect(page.locator('[data-room-number="3"]')).toHaveCount(0);
  await expect(page.locator('[data-room-number="4"]')).toBeVisible();
  await page.getByRole('button', { name: 'Show AV & support', exact: true }).click();
  await page.getByText('Edit legend text', { exact: true }).click();
  await page.getByRole('button', { name: 'Select (V)', exact: true }).click();
  await mkdir('.impeccable/review', { recursive: true });
  await legend.screenshot({ path: '.impeccable/review/legend-preview.png', animations: 'disabled' });

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Save editable/ }).click();
  const saved = await savePromise;
  const project = JSON.parse(await readFile((await saved.path())!, 'utf8'));
  expect(project.state.legends[0].title).toBe('Example building - First Floor');
  expect(project.state.overlays[0].number).toBe(1);
  expect(project.state.overlays[0].labelPosition).toBeTruthy();

  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const exported = await exportPromise;
  const bytes = new Uint8Array(await readFile((await exported.path())!));
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(1190.55);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89);
  const rendered = await page.evaluate(async input => {
    const modulePath = '/src/pdf.ts';
    const { openDocument } = await import(/* @vite-ignore */ modulePath);
    const document = await openDocument(new Uint8Array(input));
    const pdfPage = await document.document.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1.5 });
    const canvas = window.document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await pdfPage.render({ canvas, viewport }).promise;
    const content = await pdfPage.getTextContent();
    const text = content.items.map((item: { str: string }) => item.str).join(' ').replace(/\s+/g, ' ');
    const png = canvas.toDataURL('image/png').split(',')[1];
    await document.document.loadingTask.destroy();
    return { text, png };
  }, Array.from(bytes));
  for (const text of ['Example building - First Floor', 'AV category overlay', 'Not shown:', 'Base: example plan.', 'Reception', 'AV1', 'AV2', 'AV3', 'AV4']) expect(rendered.text).toContain(text);
  await writeFile('.impeccable/review/legend-export.png', Buffer.from(rendered.png, 'base64'));
  await page.getByLabel('Open PDF or project').setInputFiles({ name: 'saved.overlayer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await ready(page);
  await expect(legend).toContainText('Example building - First Floor');
  await expect(page.locator('[data-room-number="4"]')).toBeVisible();
});

test('opens older projects with automatic room numbers and the new legend', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Save editable/ }).click();
  const saved = await savePromise;
  const legacy = JSON.parse(await readFile((await saved.path())!, 'utf8'));
  for (const room of legacy.state.overlays) delete room.number;
  legacy.state.legends = { 0: { visible: true, x: 850, y: 30 } };
  await page.getByLabel('Open PDF or project').setInputFiles({ name: 'older.overlayer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await ready(page);
  for (const number of [1, 2, 3]) await expect(page.locator(`[data-room-number="${number}"]`)).toBeVisible();
  await expect(page.getByTestId('plan-legend')).toContainText('Seminar room');
  await expect(page.getByTestId('plan-legend')).toContainText('Meeting room');
});
