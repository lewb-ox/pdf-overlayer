import type { Category, EditorState, Legend, Overlay, PageInfo, Point, Vertex } from './model';

export type LegendItem =
  | { type: 'text'; text: string; x: number; y: number; size: number; weight: 400 | 600; color: string }
  | { type: 'swatch'; x: number; y: number; width: number; height: number; category: Category }
  | { type: 'number'; x: number; y: number; radius: number; number: number; color: string };

export function roomNumbers(overlays: Overlay[]): Map<string, number> {
  const result = new Map<string, number>();
  const used = new Set<number>();
  for (const o of overlays) if (o.number && !used.has(o.number)) { result.set(o.id, o.number); used.add(o.number); }
  let next = 1;
  for (const o of overlays) if (!result.has(o.id)) {
    while (used.has(next)) next++;
    result.set(o.id, next); used.add(next++);
  }
  return result;
}
export function nextRoomNumber(overlays: Overlay[]) { return Math.max(0, ...roomNumbers(overlays).values()) + 1; }
export function defaultLegendTitle(filename: string) { return filename.replace(/\.pdf$/i, '').replace(/^Example · /, '') || 'Plan overlay'; }
export function pageCategories(state: EditorState, page: number) {
  const ids = new Set(state.overlays.filter(o => o.page === page && !o.hidden).map(o => o.categoryId));
  return state.categories.filter(c => ids.has(c.id));
}

export function wrapLabel(text: string, length: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (let word of text.trim().split(/\s+/)) {
    if (current && current.length + word.length + 1 > length) { lines.push(current); current = ''; }
    while (word.length > length) { if (current) { lines.push(current); current = ''; } lines.push(word.slice(0, length)); word = word.slice(length); }
    if (word) current += (current ? ' ' : '') + word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['Untitled'];
}

let measureCanvas: HTMLCanvasElement | undefined;
export function measureLegendText(text: string, size: number, weight: number) {
  if (typeof document === 'undefined') return text.length * size * 0.58;
  measureCanvas ??= document.createElement('canvas');
  const context = measureCanvas.getContext('2d')!;
  context.font = `${weight} ${size}px "DM Sans"`;
  return context.measureText(text).width;
}
function wrapText(text: string, width: number, size: number, weight: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && measureLegendText(`${line} ${word}`, size, weight) > width) { lines.push(line); line = ''; }
      for (const char of (line ? ' ' : '') + word) {
        if (line && measureLegendText(line + char, size, weight) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line.trim());
  }
  return lines;
}

// One measured layout supplies both SVG preview and PDF drawing commands.
// Item coordinates use unscaled legend points; renderers apply scale once.
export function legendLayout(info: PageInfo, state: EditorState, page: number, title = 'Plan overlay') {
  const scale = Math.min(1, info.width / 720, info.height / 540);
  const width = 306;
  const items: LegendItem[] = [];
  const metadata = state.legends[page];
  const numbers = roomNumbers(state.overlays);
  let y = 27;
  const addText = (value: string, x: number, size: number, weight: 400 | 600, color: string, maxWidth: number, lineHeight: number) => {
    const lines = wrapText(value, maxWidth, size, weight);
    for (const line of lines) { items.push({ type: 'text', text: line, x, y, size, weight, color }); y += lineHeight; }
  };
  addText(metadata?.title ?? title, 16, 14.5, 600, '#222222', width - 32, 18);
  if (metadata?.subtitle !== '') { y += 1; addText(metadata?.subtitle ?? 'AV category overlay', 16, 9, 400, '#666666', width - 32, 12); }
  y += 15;
  const groups = pageCategories(state, page).map(category => {
    items.push({ type: 'swatch', x: 16, y: y - 11, width: 23, height: 14, category });
    addText(category.label, 47, 11.5, 600, '#222222', width - 63, 15);
    y += 3;
    const rooms = state.overlays.filter(o => o.page === page && !o.hidden && o.categoryId === category.id);
    for (const room of rooms) {
      items.push({ type: 'number', x: 26, y: y - 3.5, radius: 4.7, number: numbers.get(room.id)!, color: category.color });
      addText(room.name, 38, 9.5, 400, '#333333', width - 54, 13);
      y += 2;
    }
    y += 14;
    return { category, rooms: rooms.map(room => ({ ...room, number: numbers.get(room.id)! })) };
  });
  if (metadata?.note?.trim()) { y += 3; addText(metadata.note, 16, 8.3, 400, '#666666', width - 32, 12); y += 12; }
  if (metadata?.footer?.trim()) { y += 17; addText(metadata.footer, 16, 7, 400, '#737373', width - 32, 10); }
  const height = y + 6;
  return { width: width * scale, height: height * scale, scale, items, groups };
}
export function getLegend(state: EditorState, page: number, info: PageInfo, title = 'Plan overlay'): Legend {
  const layout = legendLayout(info, state, page, title);
  const existing = state.legends[page] ?? { visible: true, x: info.width - layout.width - 24, y: info.height - layout.height - 16 };
  return { ...existing, x: Math.max(0, Math.min(existing.x, info.width - layout.width)), y: Math.max(0, Math.min(existing.y, info.height - layout.height)) };
}

export function roomMarkerPosition(vertices: Vertex[]): Point {
  const polygon: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    polygon.push(a);
    if (b.control) for (let n = 1; n < 16; n++) {
      const t = n / 16, u = 1 - t;
      polygon.push({ x: u * u * a.x + 2 * u * t * b.control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * b.control.y + t * t * b.y });
    }
  }
  if (!polygon.length) return { x: 0, y: 0 };
  const minY = Math.min(...polygon.map(p => p.y)), maxY = Math.max(...polygon.map(p => p.y));
  let best = polygon[0], score = -Infinity;
  // Find a wide interior span. This also works when a concave room's centroid is outside it.
  for (let row = 1; row < 20; row++) {
    const y = minY + (maxY - minY) * row / 20;
    const intersections: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      if ((a.y > y) !== (b.y > y)) intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const width = intersections[i + 1] - intersections[i];
      const candidate = Math.min(width / 2, y - minY, maxY - y, 24) - Math.abs(y - (minY + (maxY - minY) * 0.25)) * 0.2;
      if (candidate > score) { score = candidate; best = { x: (intersections[i] + intersections[i + 1]) / 2, y }; }
    }
  }
  return best;
}
