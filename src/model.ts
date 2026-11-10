export interface Point { x: number; y: number }
export interface Vertex extends Point { control?: Point }
export interface Category { id: string; label: string; color: string; opacity: number }
export interface Overlay {
  id: string;
  page: number;
  name: string;
  categoryId: string;
  vertices: Vertex[];
  hidden?: boolean;
}
export interface Legend { visible: boolean; x: number; y: number }
export interface EditorState {
  categories: Category[];
  overlays: Overlay[];
  legends: Record<number, Legend>;
}
export type Matrix = [number, number, number, number, number, number];
export interface PageInfo {
  width: number;
  height: number;
  transform: Matrix;
}
export type Tool = 'select' | 'line' | 'curve' | 'hand';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'teaching', label: 'AV1', color: '#399B88', opacity: 0.3 },
  { id: 'meeting', label: 'AV2', color: '#DBA24C', opacity: 0.3 },
  { id: 'support', label: 'AV3', color: '#708EC9', opacity: 0.3 },
  { id: 'circulation', label: 'AV4', color: '#BC7A99', opacity: 0.3 },
];
export const emptyState = (): EditorState => ({
  categories: structuredClone(INITIAL_CATEGORIES), overlays: [], legends: {},
});
export const uid = () => crypto.randomUUID();

export function inverseMatrix([a, b, c, d, e, f]: Matrix): Matrix {
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new Error('Invalid PDF page transform.');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}
export function transformPoint(p: Point, [a, b, c, d, e, f]: Matrix): Point {
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function curveControl(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2 - (b.y - a.y) * 0.28, y: (a.y + b.y) / 2 + (b.x - a.x) * 0.28 };
}
export function pathData(vertices: Vertex[], closed = true, map: (p: Point) => Point = p => p): string {
  if (!vertices.length) return '';
  const first = map(vertices[0]);
  let result = `M ${first.x} ${first.y}`;
  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i];
    const p = map(v);
    if (v.control) {
      const control = map(v.control);
      result += ` Q ${control.x} ${control.y} ${p.x} ${p.y}`;
    } else result += ` L ${p.x} ${p.y}`;
  }
  if (closed) {
    if (vertices[0].control) {
      const control = map(vertices[0].control);
      result += ` Q ${control.x} ${control.y} ${first.x} ${first.y}`;
    }
    result += ' Z';
  }
  return result;
}

// A closed polygon may be concave or have curved edges, but needs three distinct vertices.
export function validShape(vertices: Vertex[]): boolean {
  if (vertices.length < 3) return false;
  const unique = new Set(vertices.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`));
  if (unique.size < 3) return false;
  // Curved edges can enclose area even when their endpoints lie on a line.
  if (vertices.some(v => v.control)) return true;
  const a = vertices[0];
  return vertices.slice(1, -1).some((b, i) => {
    const c = vertices[i + 2];
    return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 0.01;
  });
}

export function pageCategories(state: EditorState, page: number) {
  const ids = new Set(state.overlays.filter(o => o.page === page && !o.hidden).map(o => o.categoryId));
  return state.categories.filter(c => ids.has(c.id));
}
export function legendLayout(info: PageInfo, categories: Category[]) {
  const scale = Math.min(1, info.width / 540, info.height / 400);
  const width = 202 * scale;
  const rows = categories.map(c => {
    // Approximate wrapping is shared by the SVG preview and PDF export.
    const lines = wrapLabel(c.label, 24);
    return { category: c, lines, height: Math.max(23, lines.length * 13 + 8) * scale };
  });
  return { width, height: 45 * scale + rows.reduce((sum, r) => sum + r.height, 0) + 8 * scale, scale, rows };
}
export function wrapLabel(text: string, length: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (let word of words) {
    if (current && (current.length + word.length + 1) > length) { lines.push(current); current = ''; }
    while (word.length > length) { if (current) { lines.push(current); current = ''; } lines.push(word.slice(0, length)); word = word.slice(length); }
    if (word) current += (current ? ' ' : '') + word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['Untitled'];
}
export function getLegend(state: EditorState, page: number, info: PageInfo): Legend {
  const layout = legendLayout(info, pageCategories(state, page));
  const existing = state.legends[page] ?? { visible: true, x: info.width - layout.width - 24, y: info.height - layout.height - 24 };
  return {
    visible: existing.visible,
    x: Math.max(0, Math.min(existing.x, info.width - layout.width)),
    y: Math.max(0, Math.min(existing.y, info.height - layout.height)),
  };
}

export function moveVertex(vertices: Vertex[], index: number, p: Point): Vertex[] {
  const old = vertices[index];
  const dx = p.x - old.x, dy = p.y - old.y;
  return vertices.map((v, i) => ({ ...v, ...(i === index ? p : {}),
    ...(v.control && (i === index || i === (index + 1) % vertices.length) ?
      { control: { x: v.control.x + dx / 2, y: v.control.y + dy / 2 } } : {}),
  }));
}

export interface ProjectFile {
  format: 'pdf-overlayer';
  version: 1;
  filename: string;
  pdf: string;
  state: EditorState;
}
export function validateProject(value: unknown): ProjectFile {
  const bad = () => { throw new Error('This is not a valid PDF Overlayer project. Open a .overlayer.json file saved by this app.'); };
  if (!value || typeof value !== 'object') return bad();
  const v = value as ProjectFile;
  if (v.format !== 'pdf-overlayer' || v.version !== 1 || typeof v.filename !== 'string' || typeof v.pdf !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(v.pdf)) return bad();
  if (!v.state || !Array.isArray(v.state.categories) || !v.state.categories.length || v.state.categories.length > 100 || !Array.isArray(v.state.overlays) || v.state.overlays.length > 10000) return bad();
  const ids = new Set<string>();
  for (const c of v.state.categories) {
    if (!c || typeof c.id !== 'string' || ids.has(c.id) || typeof c.label !== 'string' || !c.label.trim() || c.label.length > 80 || !/^#[0-9a-fA-F]{6}$/.test(c.color) || !Number.isFinite(c.opacity) || c.opacity < 0.05 || c.opacity > 0.85) return bad();
    ids.add(c.id);
  }
  const overlayIds = new Set<string>();
  const pointOK = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 1e7 && Math.abs(p.y) <= 1e7;
  for (const o of v.state.overlays) {
    if (!o || typeof o.id !== 'string' || overlayIds.has(o.id) || !Number.isInteger(o.page) || o.page < 0 || typeof o.name !== 'string' || o.name.length > 100 || !ids.has(o.categoryId) || !Array.isArray(o.vertices) || o.vertices.length > 5000 || !o.vertices.every(p => pointOK(p) && (!p.control || pointOK(p.control))) || !validShape(o.vertices) || (o.hidden !== undefined && typeof o.hidden !== 'boolean')) return bad();
    overlayIds.add(o.id);
  }
  if (!v.state.legends || typeof v.state.legends !== 'object' || Array.isArray(v.state.legends)) return bad();
  for (const [page, l] of Object.entries(v.state.legends)) {
    if (!/^\d+$/.test(page) || !l || typeof l.visible !== 'boolean' || !pointOK(l)) return bad();
  }
  return v;
}
