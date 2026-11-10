import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, PDFName, PDFNumber, StandardFonts, degrees, rgb } from 'pdf-lib';
import { readFile, mkdir } from 'node:fs/promises';

async function ready(page: Page) {
  await expect(page.locator('.paper canvas')).toBeVisible();
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
  await expect(page.locator('.rendering-indicator')).toHaveCount(0);
}
async function clickPoint(page: Page, x: number, y: number) {
  const svg = page.locator('.overlay-surface');
  const box = (await svg.boundingBox())!;
  const viewBox = await svg.getAttribute('viewBox');
  const [, , width, height] = viewBox!.split(' ').map(Number);
  await page.mouse.click(box.x + x / width * box.width, box.y + y / height * box.height);
}
async function saveProject(page: Page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Save editable project/ }).click();
  const downloaded = await downloadPromise;
  return { project: JSON.parse(await readFile((await downloaded.path())!, 'utf8')), path: (await downloaded.path())! };
}
test.beforeEach(async ({ page }) => { await page.goto('/'); await ready(page); });

test('renders desktop and mobile editor without horizontal document overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await mkdir('.impeccable/review', { recursive: true });
  await expect(page.locator('[data-overlay-id]')).toHaveCount(3);
  await expect(page.getByTestId('plan-legend')).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true, animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.getByRole('button', { name: 'Show colours and rooms' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.impeccable/review/mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Show colours and rooms' }).click();
  await expect(page.getByRole('heading', { name: 'Colour key' })).toBeVisible();
  await page.getByRole('button', { name: 'Close colour panel', exact: true }).last().click();
  await page.getByRole('button', { name: 'Drawing help' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Got it/ }).click();
  expect(errors).toEqual([]);
});

test('draws mixed straight and curved edges, closes paths, edits nodes and restores an editable project', async ({ page }) => {
  await page.getByRole('button', { name: 'Straight edge (P)', exact: true }).click();
  await clickPoint(page, 370, 200);
  await clickPoint(page, 630, 200);
  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Curved edge (C)', exact: true }).click();
  await clickPoint(page, 630, 350);
  await clickPoint(page, 570, 275);
  await page.getByRole('button', { name: 'Straight edge (P)', exact: true }).click();
  await clickPoint(page, 370, 350);
  await clickPoint(page, 370, 200);
  await expect(page.locator('[data-overlay-id]')).toHaveCount(4);
  const drawn = page.locator('[data-overlay-id]').last();
  expect(await drawn.getAttribute('d')).toContain('Q');
  expect(await drawn.getAttribute('d')).toMatch(/ Z$/);
  await expect(page.getByLabel('Room name', { exact: true })).toBeVisible();
  await page.getByLabel('Room name', { exact: true }).fill('Curved studio');
  await page.getByLabel('Room name', { exact: true }).press('Enter');
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(page.getByLabel('Room name', { exact: true })).toHaveValue('Room 4');
  await page.getByRole('button', { name: /^Redo/ }).click();
  await expect(page.getByLabel('Room name', { exact: true })).toHaveValue('Curved studio');
  await page.getByLabel('Category', { exact: true }).selectOption('meeting');
  // Drag a corner; its closing path must remain intact.
  const node = page.locator('.edit-handle').first();
  const b = (await node.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + 17, b.y + 12, { steps: 4 }); await page.mouse.up();
  expect(await drawn.getAttribute('d')).toMatch(/ Z$/);
  const { project, path } = await saveProject(page);
  expect(project.state.overlays.at(-1).name).toBe('Curved studio');
  expect(project.state.overlays.at(-1).categoryId).toBe('meeting');
  expect(project.state.overlays.at(-1).vertices.some((v: { control?: unknown }) => v.control)).toBe(true);
  await page.getByRole('button', { name: 'Delete room', exact: true }).click();
  await expect(page.locator('[data-overlay-id]')).toHaveCount(3);
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(page.locator('[data-overlay-id]')).toHaveCount(4);
  await page.getByRole('button', { name: /^Redo/ }).click();
  await expect(page.locator('[data-overlay-id]')).toHaveCount(3);
  page.once('dialog', d => d.accept());
  await page.getByLabel('Open PDF or project').setInputFiles({ name: 'saved.overlayer.json', mimeType: 'application/json', buffer: await readFile(path) });
  await ready(page);
  await expect(page.locator('[data-overlay-id]')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Curved studio', exact: true })).toBeVisible();
});

test('edits colour categories and opacity, moves the legend and excludes hidden rooms from the legend', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Teaching label', exact: true }).click();
  await page.getByLabel('Category label', { exact: true }).fill('Teaching & learning');
  await page.getByLabel('Category label', { exact: true }).press('Enter');
  await page.getByLabel('Teaching & learning colour', { exact: true }).fill('#2277bb');
  await page.getByLabel('Teaching & learning opacity', { exact: true }).fill('45');
  await expect(page.locator('[data-overlay-id="sample-1"]')).toHaveAttribute('fill', '#2277bb');
  await expect(page.locator('[data-overlay-id="sample-1"]')).toHaveAttribute('fill-opacity', '0.45');
  await expect(page.getByTestId('plan-legend')).toContainText('Teaching & learning');
  const legend = page.getByTestId('plan-legend');
  const original = await legend.getAttribute('transform');
  const box = (await legend.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 10); await page.mouse.down();
  await page.mouse.move(box.x - 45, box.y - 45, { steps: 5 }); await page.mouse.up();
  expect(await legend.getAttribute('transform')).not.toBe(original);
  await page.getByRole('button', { name: 'Hide Seminar room', exact: true }).click();
  await expect(page.locator('[data-overlay-id]')).toHaveCount(2);
  await expect(legend).not.toContainText('Teaching & learning');
  await page.getByRole('switch', { name: 'Show legend on this page' }).click();
  await expect(legend).toHaveCount(0);
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(legend).toBeVisible();
});

test('curve closure is quadratic and incomplete shapes cannot be saved or exported', async ({ page }) => {
  await page.getByRole('button', { name: 'Straight edge (P)', exact: true }).click();
  await clickPoint(page, 380, 440); await clickPoint(page, 620, 440); await clickPoint(page, 620, 580);
  await page.getByRole('button', { name: 'Curved edge (C)', exact: true }).click();
  await clickPoint(page, 380, 440);
  await expect(page.getByRole('button', { name: /Close shape/ })).toBeDisabled();
  await clickPoint(page, 370, 580);
  await expect(page.locator('[data-overlay-id]')).toHaveCount(4);
  expect(await page.locator('[data-overlay-id]').last().getAttribute('d')).toMatch(/Q .* Z$/);
  await page.getByRole('button', { name: 'Straight edge (P)', exact: true }).click();
  await clickPoint(page, 400, 450);
  await expect(page.getByRole('button', { name: /^Save editable/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Save editable/ })).toBeEnabled();
});

test('exports every page at source dimensions and aligns overlays on cropped pages at all four rotations', async ({ page }) => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  for (const rotation of [0, 90, 180, 270]) {
    const p = source.addPage([800, 600]);
    p.setCropBox(30, 40, 600, 500); p.setRotation(degrees(rotation));
    if (rotation === 0) p.node.set(PDFName.of('UserUnit'), PDFNumber.of(2));
    p.drawText(`REFERENCE PAGE ${rotation}`, { x: 300, y: 300, font, size: 14, color: rgb(0, 0, 0) });
  }
  const original = await source.save();
  await page.getByLabel('Open PDF or project').setInputFiles({ name: 'rotated-cropped.pdf', mimeType: 'application/pdf', buffer: Buffer.from(original) });
  await ready(page);
  for (let i = 0; i < 4; i++) {
    await page.getByLabel('PDF page', { exact: true }).selectOption({ value: String(i) });
    await ready(page);
    await page.getByRole('button', { name: 'Straight edge (P)', exact: true }).click();
    await clickPoint(page, 70, 80); await clickPoint(page, 240, 80); await clickPoint(page, 240, 220); await clickPoint(page, 70, 220);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-overlay-id]')).toHaveCount(1);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const downloaded = await downloadPromise;
  const output = new Uint8Array(await readFile((await downloaded.path())!));
  const result = await PDFDocument.load(output);
  expect(result.getPageCount()).toBe(4);
  for (const [i, p] of result.getPages().entries()) {
    expect(p.getMediaBox()).toEqual(source.getPage(i).getMediaBox());
    expect(p.getCropBox()).toEqual(source.getPage(i).getCropBox());
    expect(p.getRotation()).toEqual(source.getPage(i).getRotation());
  }
  expect(result.getPage(0).node.get(PDFName.of('UserUnit'))?.toString()).toBe('2');
  const samples = await page.evaluate(async bytes => {
    const modulePath = '/src/pdf.ts';
    const { openDocument } = await import(/* @vite-ignore */ modulePath);
    const opened = await openDocument(new Uint8Array(bytes));
    const results = [];
    for (let i = 0; i < opened.document.numPages; i++) {
      const p = await opened.document.getPage(i + 1);
      const canvas = document.createElement('canvas'); const viewport = p.getViewport({ scale: 1 });
      canvas.width = viewport.width; canvas.height = viewport.height;
      await p.render({ canvas, viewport }).promise;
      const pixel = [...canvas.getContext('2d')!.getImageData(150, 150, 1, 1).data];
      const text = await p.getTextContent();
      results.push({ pixel, text: text.items.map((item: { str: string }) => item.str).join(' ') });
    }
    await opened.document.loadingTask.destroy();
    return results;
  }, Array.from(output));
  for (const [i, sample] of samples.entries()) {
    // Teaching green at 30% over white: (57,155,136)*0.3 + 255*0.7.
    expect(sample.pixel[0]).toBeGreaterThan(190); expect(sample.pixel[0]).toBeLessThan(202);
    expect(sample.pixel[1]).toBeGreaterThan(220); expect(sample.pixel[1]).toBeLessThan(231);
    expect(sample.pixel[2]).toBeGreaterThan(214); expect(sample.pixel[2]).toBeLessThan(225);
    expect(sample.text).toContain(`REFERENCE PAGE ${i * 90}`);
    expect(sample.text).toContain('ROOM COLOUR KEY');
    expect(sample.text).toContain('Teaching');
  }
});

test('rejects invalid projects without replacing the current plan', async ({ page }) => {
  await page.getByLabel('Open PDF or project').setInputFiles({ name: 'bad.overlayer.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"pdf-overlayer","version":1}') });
  await expect(page.getByRole('alert')).toContainText('not a valid');
  await expect(page.locator('[data-overlay-id]')).toHaveCount(3);
});
