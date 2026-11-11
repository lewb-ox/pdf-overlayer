import { PDFDocument, StandardFonts, rgb, degrees, BlendMode } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fontUrl from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff?url';
import boldFontUrl from '@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff?url';
// Electron's bundled Chromium can lag the APIs required by the modern build.
// Use PDF.js's supported compatibility build in both renderer and worker.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { INITIAL_CATEGORIES, defaultLegendTitle, getLegend, inverseMatrix, legendLayout, pathData, roomMarkerPosition, roomNumbers, transformPoint, type EditorState, type Matrix, type PageInfo, type Point } from './model';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function openDocument(bytes: Uint8Array): Promise<{ document: PDFDocumentProxy; pages: PageInfo[] }> {
  // PDF.js transfers its buffer to the worker. Keep the source bytes intact for export.
  const document = await getDocument({ data: bytes.slice() }).promise;
  try {
    const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      return { width: viewport.width, height: viewport.height, transform: viewport.transform as Matrix };
    }));
    return { document, pages };
  } catch (error) { await document.loadingTask.destroy(); throw error; }
}

let embeddedFontBytes: Promise<ArrayBuffer[]> | undefined;
export async function exportPdf(source: Uint8Array, state: EditorState, pages: PageInfo[], filename = 'Plan overlay'): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(source);
  pdf.registerFontkit(fontkit);
  embeddedFontBytes ??= Promise.all([fontUrl, boldFontUrl].map(url => fetch(url).then(r => {
    if (!r.ok) throw new Error('Could not load the legend fonts. Reload the app and try again.');
    return r.arrayBuffer();
  }))).catch(error => { embeddedFontBytes = undefined; throw error; });
  const fonts = await Promise.all((await embeddedFontBytes).map(bytes => pdf.embedFont(bytes, { subset: true })));
  // Use the same loaded text metrics for wrapping in the preview and export.
  await Promise.all([document.fonts.load('400 12px "DM Sans"'), document.fonts.load('600 14px "DM Sans"')]);
  const supported = new Set(fonts[0].getCharacterSet());
  const title = defaultLegendTitle(filename);
  const numbers = roomNumbers(state.overlays);
  for (const [index, info] of pages.entries()) {
    const page = pdf.getPage(index);
    const inverse = inverseMatrix(info.transform);
    const unit = Math.hypot(inverse[0], inverse[1]);
    const toPdf = (p: Point) => transformPoint(p, inverse);
    // drawSvgPath flips SVG's y-axis. Negate mapped PDF y to cancel that flip.
    const forSvg = (p: Point) => { const mapped = toPdf(p); return { x: mapped.x, y: -mapped.y }; };
    const text = (value: string, x: number, baseline: number, size: number, color: string, bold = false, centered = false) => {
      const font = fonts[bold ? 1 : 0];
      const offset = centered ? font.widthOfTextAtSize(value, size) / 2 : 0;
      const point = toPdf({ x: x - offset, y: baseline });
      page.drawText(value, { x: point.x, y: point.y, font, size: size * unit,
        rotate: degrees(Math.atan2(inverse[1], inverse[0]) * 180 / Math.PI), color: hexRgb(color) });
    };
    const numberBadge = (number: number, x: number, y: number, radius: number, color: string) => {
      const point = toPdf({ x, y });
      page.drawCircle({ x: point.x, y: point.y, size: radius * unit, color: rgb(1, 1, 1), borderColor: hexRgb(color), borderWidth: radius * 0.22 * unit });
      const size = radius * (String(number).length === 1 ? 1.2 : String(number).length === 2 ? 1.05 : String(number).length === 3 ? 0.82 : 0.65);
      text(String(number), x, y + size * 0.34, size, '#222222', true, true);
    };
    const visibleRooms = state.overlays.filter(o => o.page === index && !o.hidden);
    for (const overlay of visibleRooms) {
      const category = state.categories.find(c => c.id === overlay.categoryId);
      if (!category) continue;
      page.drawSvgPath(pathData(overlay.vertices, true, forSvg), {
        x: 0, y: 0, color: hexRgb(category.color), opacity: category.opacity,
        borderColor: hexRgb(category.color), borderWidth: 0.6 * unit,
        borderOpacity: Math.min(1, category.opacity + 0.25), blendMode: BlendMode.Multiply,
      });
    }
    // Draw numbers after all fills so an overlapping room cannot obscure a marker.
    for (const overlay of visibleRooms) {
      const point = overlay.labelPosition ?? roomMarkerPosition(overlay.vertices);
      const category = state.categories.find(c => c.id === overlay.categoryId)!;
      numberBadge(numbers.get(overlay.id)!, point.x, point.y, 8.5, category.color);
    }
    const legend = getLegend(state, index, info, title);
    const layout = legendLayout(info, state, index, title);
    if (legend.visible && layout.groups.length) {
      if (layout.height > info.height) throw new Error(`The legend is too tall for page ${index + 1}. Shorten its text, reduce its room entries, or hide the legend on this page.`);
      for (const item of layout.items) if (item.type === 'text' && [...item.text].some(c => !supported.has(c.codePointAt(0)!))) {
        throw new Error(`The legend text “${item.text}” contains characters unavailable in the export font. Please use Latin letters, numbers and punctuation.`);
      }
      const { x, y } = legend;
      const s = layout.scale;
      const rect = (rx: number, ry: number, w: number, h: number, fill: string, opacity = 1, border?: string) => {
        page.drawSvgPath(pathData([{ x: rx, y: ry }, { x: rx + w, y: ry }, { x: rx + w, y: ry + h }, { x: rx, y: ry + h }], true, forSvg), {
          x: 0, y: 0, color: hexRgb(fill), opacity,
          ...(border ? { borderColor: hexRgb(border), borderWidth: 1.4 * s * unit } : {}),
        });
      };
      rect(x, y, layout.width, layout.height, '#FFFFFF');
      for (const item of layout.items) {
        if (item.type === 'text') text(item.text, x + item.x * s, y + item.y * s, item.size * s, item.color, item.weight === 600);
        else if (item.type === 'number') numberBadge(item.number, x + item.x * s, y + item.y * s, item.radius * s, item.color);
        else rect(x + item.x * s, y + item.y * s, item.width * s, item.height * s, item.category.color, item.category.opacity, item.category.color);
      }
    }
  }
  pdf.setProducer('PDF Overlayer');
  return pdf.save();
}

export function hexRgb(hex: string) {
  return rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
}
export function download(data: Uint8Array | string, filename: string, type: string) {
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return btoa(chunks.join(''));
}
export function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }

export async function createDemo(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const width = 1190.55, height = 841.89;
  const page = pdf.addPage([width, height]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = '#56615B';
  const text = (t: string, x: number, y: number, size = 10, strong = false, color = ink) => page.drawText(t, { x, y: height - y, size, font: strong ? bold : regular, color: hexRgb(color) });
  const line = (path: string, thickness = 1, color = ink) => page.drawSvgPath(path, { x: 0, y: height, borderColor: hexRgb(color), borderWidth: thickness });
  const roomLabel = (name: string, id: string, x: number, y: number) => { text(name, x, y, 12, true); text(id, x, y + 18, 8, false, '#7B847E'); };
  text('THE WORKPLACE', 77, 76, 11, true, '#34483C');
  text('Ground floor plan', 77, 111, 25, false, '#34483C');
  text('ILLUSTRATIVE EXAMPLE / NOT FOR CONSTRUCTION', 803, 75, 8, false, '#7B847E');
  text('Try tracing a room, or open your own PDF.', 839, 99, 9);
  line('M 77 136 L 1114 136', 0.7, '#BBC3BD');
  // Architectural wall geometry; coordinates are also used by the sample overlays.
  line('M 90 190 L 900 190 Q 1090 190 1090 365 L 1090 600 L 90 600 Z', 4);
  line('M 90 365 L 210 365 M 255 365 L 500 365 M 545 365 L 790 365 M 835 365 L 1090 365', 3);
  line('M 90 425 L 210 425 M 255 425 L 500 425 M 545 425 L 790 425 M 835 425 L 1090 425', 3);
  line('M 360 190 L 360 365 M 650 190 L 650 365 M 890 190 L 890 365 M 360 425 L 360 600 M 650 425 L 650 600 M 890 425 L 890 600', 2.5);
  line('M 890 510 L 1090 510 M 990 510 L 990 600', 2.5);
  // Door swings.
  for (const x of [210, 500, 790]) {
    line(`M ${x} 365 L ${x} 320 M ${x} 320 Q ${x + 45} 320 ${x + 45} 365`, 0.75, '#88948B');
    line(`M ${x} 425 L ${x} 470 M ${x} 470 Q ${x + 45} 470 ${x + 45} 425`, 0.75, '#88948B');
  }
  // Window lines.
  for (const x of [115, 225, 395, 520, 685, 790]) {
    line(`M ${x} 187 L ${x + 75} 187 M ${x} 193 L ${x + 75} 193`, 1, '#95AAA0');
    line(`M ${x} 597 L ${x + 75} 597 M ${x} 603 L ${x + 75} 603`, 1, '#95AAA0');
  }
  roomLabel('Seminar room', 'G.01 / 36 seats', 164, 278);
  roomLabel('Learning studio', 'G.02 / 24 seats', 443, 278);
  roomLabel('Meeting room', 'G.03 / 12 seats', 719, 278);
  roomLabel('Collaboration', 'G.04 / 8 seats', 939, 301);
  roomLabel('Project room', 'G.05 / 16 seats', 165, 511);
  roomLabel('Staff workspace', 'G.06 / 10 desks', 444, 511);
  roomLabel('AV & support', 'G.07', 720, 511);
  text('STORE', 923, 472, 9, true); text('WC', 927, 561, 9, true); text('WC', 1027, 561, 9, true);
  text('MAIN CIRCULATION', 478, 399, 9, false, '#7B847E');
  // Furniture is deliberately lighter than the room boundary.
  for (const [cx, cy] of [[220, 240], [490, 240], [750, 240], [220, 550], [490, 550]]) {
    line(`M ${cx - 38} ${cy - 14} L ${cx + 38} ${cy - 14} L ${cx + 38} ${cy + 14} L ${cx - 38} ${cy + 14} Z`, 0.6, '#BBC3BD');
  }
  // Dimension annotations.
  line('M 90 160 L 890 160 M 90 155 L 90 165 M 360 155 L 360 165 M 650 155 L 650 165 M 890 155 L 890 165', 0.5, '#A2ADA5');
  text('7 200', 204, 156, 8); text('7 800', 487, 156, 8); text('6 400', 753, 156, 8);
  line('M 63 190 L 63 600 M 58 190 L 68 190 M 58 365 L 68 365 M 58 425 L 68 425 M 58 600 L 68 600', 0.5, '#A2ADA5');
  // Drawing footer and scale reference are source PDF content, not editor chrome.
  line('M 77 664 L 1114 664', 0.7, '#BBC3BD');
  text('DRAWING NOTES', 77, 691, 8, true);
  text('Example geometry for exploring PDF Overlayer.', 77, 711, 9);
  text('No real building or surveyed dimensions are represented.', 77, 727, 9);
  text('N', 560, 697, 9, true); line('M 563 731 L 563 705 L 557 715 M 563 705 L 569 715', 1);
  text('DRAWING', 648, 691, 8, true); text('EX-001', 648, 712, 13, true);
  text('REVISION', 780, 691, 8, true); text('A / EXAMPLE', 780, 712, 10);
  text('PDF OVERLAYER', 77, 801, 8, true); text('Original page size: A3 landscape', 77, 816, 8);
  return pdf.save();
}

export function demoState(): EditorState {
  return {
    categories: structuredClone(INITIAL_CATEGORIES),
    overlays: [
      { id: 'sample-1', page: 0, name: 'Seminar room', categoryId: 'teaching', vertices: [{ x: 92, y: 192 }, { x: 358, y: 192 }, { x: 358, y: 363 }, { x: 92, y: 363 }] },
      { id: 'sample-2', page: 0, name: 'Meeting room', categoryId: 'meeting', vertices: [{ x: 652, y: 192 }, { x: 888, y: 192 }, { x: 888, y: 363 }, { x: 652, y: 363 }] },
      { id: 'sample-3', page: 0, name: 'AV & support', categoryId: 'support', vertices: [{ x: 652, y: 427 }, { x: 888, y: 427 }, { x: 888, y: 598 }, { x: 652, y: 598 }] },
    ], legends: {},
  };
}
