import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Layers, LoaderCircle, Move, Upload } from 'lucide-react';
import { getLegend, legendLayout, moveVertex, pageCategories, pathData, roomNumbers, roomMarkerPosition, type EditorState, type PageInfo, type Point, type Tool, type Vertex } from './model';
import { LegendGraphic, NumberBadge } from './LegendGraphic';

interface Props {
  pdf: PDFDocumentProxy | null;
  info?: PageInfo;
  page: number;
  state: EditorState;
  tool: Tool;
  zoom: number | null;
  onScale: (scale: number) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (value: EditorState) => void;
  draft: Vertex[];
  pending: Point | null;
  closingCurve: boolean;
  color: string;
  opacity: number;
  legendTitle: string;
  onPoint: (point: Point, close: boolean) => void;
  onOpen: () => void;
  onError: (message: string) => void;
}

type Drag = { type: 'vertex' | 'control'; id: string; index: number; vertices: Vertex[] }
  | { type: 'label'; id: string; start: Point; point: Point }
  | { type: 'legend'; start: Point; x: number; y: number }
  | { type: 'pan'; x: number; y: number; left: number; top: number };

export function PlanCanvas(props: Props) {
  const { pdf, info, page, state, tool, zoom, selected, draft, pending, closingCurve, color, opacity } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [bounds, setBounds] = useState({ width: 900, height: 700 });
  const [rendering, setRendering] = useState(false);
  const [pointer, setPointer] = useState<Point | null>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ id: string; vertices: Vertex[] } | null>(null);
  const [legendPreview, setLegendPreview] = useState<Point | null>(null);
  const [labelPreview, setLabelPreview] = useState<{ id: string; point: Point } | null>(null);
  const [, setFontsReady] = useState(false);
  const didDrag = useRef(false);
  const drawing = tool === 'line' || tool === 'curve';
  const fit = info ? Math.max(0.05, Math.min((bounds.width - 84) / info.width, (bounds.height - 84) / info.height)) : 1;
  const scale = zoom ?? fit;
  const onScaleRef = useRef(props.onScale); onScaleRef.current = props.onScale;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { onScaleRef.current(scale); }, [scale]);
  useEffect(() => { setPreview(null); setLegendPreview(null); setLabelPreview(null); drag.current = null; }, [page, pdf, tool, state]);
  useEffect(() => { let active = true; void document.fonts.ready.then(() => { if (active) setFontsReady(true); }); return () => { active = false; }; }, []);

  useEffect(() => {
    if (!pdf || !info || !canvasRef.current) return;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setRendering(true);
    // Render offscreen so a cancelled task never clears the current page.
    const buffer = document.createElement('canvas');
    (async () => {
      const pdfPage = await pdf.getPage(page + 1);
      if (cancelled) return;
      const resolution = Math.min(2, window.devicePixelRatio || 1);
      const requested = Math.min(scale * resolution, Math.sqrt(16_000_000 / (info.width * info.height)));
      const viewport = pdfPage.getViewport({ scale: requested });
      buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height);
      task = pdfPage.render({ canvas: buffer, viewport });
      await task.promise;
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = buffer.width; canvas.height = buffer.height;
      canvas.getContext('2d')!.drawImage(buffer, 0, 0);
      setRendering(false);
    })().catch(error => {
      if (!cancelled) { setRendering(false); props.onError(`Could not render this page: ${error instanceof Error ? error.message : 'Try another PDF.'}`); }
    });
    return () => { cancelled = true; task?.cancel(); };
  // Rendering callbacks do not determine the PDF raster.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, page, info, scale]);

  const position = (e: { clientX: number; clientY: number }): Point => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(info!.width, (e.clientX - box.left) / scale)), y: Math.max(0, Math.min(info!.height, (e.clientY - box.top) / scale)) };
  };
  const beginDrag = (e: ReactPointerEvent, value: Drag) => {
    e.preventDefault(); e.stopPropagation();
    drag.current = value; didDrag.current = false;
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = position(e); setPointer(p);
    const d = drag.current;
    if (!d) return;
    didDrag.current = true;
    if (d.type === 'pan') {
      scrollRef.current!.scrollLeft = d.left - (e.clientX - d.x);
      scrollRef.current!.scrollTop = d.top - (e.clientY - d.y);
    } else if (d.type === 'legend') {
      const layout = legendLayout(info!, state, page, props.legendTitle);
      setLegendPreview({ x: Math.max(0, Math.min(info!.width - layout.width, d.x + p.x - d.start.x)), y: Math.max(0, Math.min(info!.height - layout.height, d.y + p.y - d.start.y)) });
    } else if (d.type === 'label') {
      setLabelPreview({ id: d.id, point: { x: Math.max(9, Math.min(info!.width - 9, d.point.x + p.x - d.start.x)), y: Math.max(9, Math.min(info!.height - 9, d.point.y + p.y - d.start.y)) } });
    } else {
      const vertices = d.type === 'vertex' ? moveVertex(d.vertices, d.index, p) : d.vertices.map((v, i) => i === d.index ? { ...v, control: p } : v);
      setPreview({ id: d.id, vertices });
    }
  };
  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    if (preview) props.onCommit({ ...state, overlays: state.overlays.map(o => o.id === preview.id ? { ...o, vertices: preview.vertices } : o) });
    if (legendPreview && info) props.onCommit({ ...state, legends: { ...state.legends, [page]: { ...getLegend(state, page, info, props.legendTitle), ...legendPreview } } });
    if (labelPreview) props.onCommit({ ...state, overlays: state.overlays.map(o => o.id === labelPreview.id ? { ...o, labelPosition: labelPreview.point } : o) });
    drag.current = null; setPreview(null); setLegendPreview(null); setLabelPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const cancelDrag = () => { drag.current = null; setPreview(null); setLegendPreview(null); setLabelPreview(null); didDrag.current = true; };
  const categories = pageCategories(state, page);
  const legend = info ? { ...getLegend(state, page, info, props.legendTitle), ...legendPreview } : null;
  const layout = info ? legendLayout(info, state, page, props.legendTitle) : null;
  const numbers = roomNumbers(state.overlays);
  const chosen = state.overlays.find(o => o.id === selected && o.page === page && !o.hidden);
  const chosenVertices = chosen ? (preview?.id === chosen.id ? preview.vertices : chosen.vertices) : [];
  const ghost = [...draft];
  if (pending && pointer) {
    if (closingCurve) { if (ghost.length) ghost[0] = { ...ghost[0], control: pointer }; }
    else ghost.push({ ...pending, control: pointer });
  } else if (pointer && draft.length) ghost.push(pointer);

  return <div className={`canvas-scroll tool-${tool}`} ref={scrollRef} aria-label="PDF plan workspace">
    {!info ? <div className="empty-workspace"><Layers size={34}/><h2>Your plan, clearly marked.</h2><p>Open a PDF to start colouring rooms, or a saved project to continue editing.</p><button className="primary-button" onClick={props.onOpen}><Upload size={16}/> Open PDF / project</button></div> :
      <div className="paper-stage" style={{ width: Math.max(bounds.width, info.width * scale + 84), height: Math.max(bounds.height, info.height * scale + 84) }}>
        <div className="paper" style={{ width: info.width * scale, height: info.height * scale }}>
          <canvas ref={canvasRef} aria-label={`Original PDF, page ${page + 1}`} />
          <svg ref={svgRef} viewBox={`0 0 ${info.width} ${info.height}`} className="overlay-surface" aria-label="Draw and edit room overlays"
            onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={cancelDrag} onPointerLeave={() => { if (!drag.current) setPointer(null); }}
            onPointerDown={e => {
              if (tool === 'hand' || e.button === 1) beginDrag(e, { type: 'pan', x: e.clientX, y: e.clientY, left: scrollRef.current!.scrollLeft, top: scrollRef.current!.scrollTop });
            }}
            onClick={e => {
              if (didDrag.current) { didDrag.current = false; return; }
              if (e.button !== 0) return;
              if (drawing) {
                const p = position(e);
                const close = draft.length >= 3 && Math.hypot(p.x - draft[0].x, p.y - draft[0].y) * scale <= 13;
                props.onPoint(p, close);
              } else if (tool === 'select') props.onSelect(null);
            }}>
            {state.overlays.filter(o => o.page === page && !o.hidden).map(overlay => {
              const category = state.categories.find(c => c.id === overlay.categoryId)!;
              return <path key={overlay.id} data-overlay-id={overlay.id} d={pathData(preview?.id === overlay.id ? preview.vertices : overlay.vertices)}
                fill={category.color} fillOpacity={category.opacity} stroke={selected === overlay.id ? '#245D4F' : category.color}
                strokeOpacity={selected === overlay.id ? 1 : Math.min(1, category.opacity + 0.25)} strokeWidth={(selected === overlay.id ? 1.7 : 0.7) / scale}
                fillRule="nonzero" style={{ mixBlendMode: 'multiply', cursor: tool === 'select' ? 'pointer' : undefined }}
                onClick={e => { if (tool === 'select' && !didDrag.current) { e.stopPropagation(); props.onSelect(overlay.id); } }}>
                <title>{overlay.name} — {category.label}</title>
              </path>;
            })}
            {state.overlays.filter(o => o.page === page && !o.hidden).map(overlay => {
              const point = labelPreview?.id === overlay.id ? labelPreview.point : overlay.labelPosition ?? roomMarkerPosition(preview?.id === overlay.id ? preview.vertices : overlay.vertices);
              const category = state.categories.find(c => c.id === overlay.categoryId)!;
              return <g key={`number-${overlay.id}`} data-room-number={numbers.get(overlay.id)} className="room-number-marker" style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                onClick={e => { e.stopPropagation(); if (!didDrag.current) props.onSelect(overlay.id); didDrag.current = false; }}
                onPointerDown={e => { props.onSelect(overlay.id); beginDrag(e, { type: 'label', id: overlay.id, point, start: position(e) }); }}>
                <NumberBadge x={point.x} y={point.y} radius={8.5} number={numbers.get(overlay.id)!} color={category.color}/>
                <title>{numbers.get(overlay.id)}: {overlay.name}. Drag to move the number.</title>
              </g>;
            })}
            {legend?.visible && layout && categories.length > 0 && <g className="plan-legend" data-testid="plan-legend" transform={`translate(${legend.x} ${legend.y})`}
              onClick={e => { e.stopPropagation(); didDrag.current = false; }}
              onPointerDown={e => beginDrag(e, { type: 'legend', start: position(e), x: legend.x, y: legend.y })}>
              <LegendGraphic layout={layout}/>
              <title>Drag to move the legend</title>
            </g>}
            {chosen && tool === 'select' && chosenVertices.map((v, i) => <g key={i}>
              {v.control && <>
                <path d={`M ${chosenVertices[(i - 1 + chosenVertices.length) % chosenVertices.length].x} ${chosenVertices[(i - 1 + chosenVertices.length) % chosenVertices.length].y} L ${v.control.x} ${v.control.y} L ${v.x} ${v.y}`} stroke="#326C5E" strokeWidth={1 / scale} strokeDasharray={`${4 / scale} ${3 / scale}`} fill="none" pointerEvents="none"/>
                <circle cx={v.control.x} cy={v.control.y} r={5 / scale} fill="#D8B46A" stroke="white" strokeWidth={1.5 / scale} className="edit-handle" aria-label={`Curve handle ${i + 1}`} onClick={e => e.stopPropagation()} onPointerDown={e => beginDrag(e, { type: 'control', id: chosen.id, index: i, vertices: structuredClone(chosenVertices) })}><title>Drag to adjust curve</title></circle>
              </>}
              <circle cx={v.x} cy={v.y} r={5 / scale} fill="white" stroke="#245D4F" strokeWidth={1.7 / scale} className="edit-handle" onClick={e => e.stopPropagation()} onPointerDown={e => beginDrag(e, { type: 'vertex', id: chosen.id, index: i, vertices: structuredClone(chosenVertices) })}><title>Drag vertex {i + 1}</title></circle>
            </g>)}
            {draft.length > 0 && <g pointerEvents="none">
              <path d={pathData(ghost, closingCurve)} fill={color} fillOpacity={opacity * 0.65} stroke={color} strokeWidth={1.7 / scale} strokeDasharray={`${5 / scale} ${3 / scale}`}/>
              {pending && pointer && <path d={`M ${draft[draft.length - 1].x} ${draft[draft.length - 1].y} L ${pointer.x} ${pointer.y} L ${pending.x} ${pending.y}`} fill="none" stroke="#8B794B" strokeWidth={1 / scale} strokeDasharray={`${3 / scale} ${3 / scale}`}/>}
              {draft.map((v, i) => <circle key={i} cx={v.x} cy={v.y} r={(i === 0 ? 6 : 3.5) / scale} fill={i === 0 ? color : 'white'} stroke={i === 0 ? 'white' : color} strokeWidth={1.5 / scale}/>)}
              {pending && <circle cx={pending.x} cy={pending.y} r={4 / scale} fill="white" stroke={color} strokeWidth={1.5 / scale}/>}
            </g>}
          </svg>
          {rendering && <span className="rendering-indicator"><LoaderCircle size={13} className="spin"/> Rendering plan</span>}
        </div>
      </div>}
    {tool === 'hand' && <div className="pan-hint"><Move size={13}/> Drag to pan the plan</div>}
  </div>;
}
