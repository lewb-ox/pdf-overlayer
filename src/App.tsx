import { useCallback, useEffect, useReducer, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Eye, EyeOff, FileText, FolderOpen, Hand, Layers2, LoaderCircle, Maximize, Menu, Minus, MousePointer2, PanelLeftClose, Pencil, Plus, Redo2, Save, ShieldCheck, Spline, Trash2, Undo2, Upload, VectorSquare, X } from 'lucide-react';
import { PlanCanvas } from './PlanCanvas';
import { base64ToBytes, bytesToBase64, createDemo, demoState, download, exportPdf, openDocument } from './pdf';
import { emptyState, getLegend, uid, validShape, validateProject, type Category, type EditorState, type Overlay, type PageInfo, type Point, type ProjectFile, type Tool, type Vertex } from './model';

interface History { past: EditorState[]; present: EditorState; future: EditorState[] }
type Action = { type: 'commit' | 'reset'; state: EditorState } | { type: 'undo' | 'redo' };
function reducer(history: History, action: Action): History {
  if (action.type === 'reset') return { past: [], present: action.state, future: [] };
  if (action.type === 'commit') return { past: [...history.past.slice(-79), history.present], present: action.state, future: [] };
  if (action.type === 'undo' && history.past.length) return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] };
  if (action.type === 'redo' && history.future.length) return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
  return history;
}
function IconButton({ label, children, className = '', ...rest }: { label: string; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} {...rest}>{children}</button>;
}
const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: <MousePointer2 size={17}/> },
  { id: 'line', label: 'Straight edge', key: 'P', icon: <VectorSquare size={17}/> },
  { id: 'curve', label: 'Curved edge', key: 'C', icon: <Spline size={18}/> },
  { id: 'hand', label: 'Pan', key: 'H', icon: <Hand size={17}/> },
];

export function App() {
  const [history, dispatch] = useReducer(reducer, { past: [], present: emptyState(), future: [] });
  const state = history.present;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [source, setSource] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [filename, setFilename] = useState('');
  const [page, setPage] = useState(0);
  const [isDemo, setIsDemo] = useState(true);
  const [busy, setBusy] = useState<string | null>('Preparing example plan');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [activeCategory, setActiveCategory] = useState('teaching');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Vertex[]>([]);
  const [pending, setPending] = useState<Point | null>(null);
  const [closingCurve, setClosingCurve] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [actualScale, setActualScale] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [dirty, setDirty] = useState(false);
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadToken = useRef(0);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const draftCategory = useRef(activeCategory);
  const category = state.categories.find(c => c.id === activeCategory) ?? state.categories[0];
  const currentOverlays = state.overlays.filter(o => o.page === page);
  const chosen = state.overlays.find(o => o.id === selected);
  const info = pages[page];
  const loading = busy !== null;

  const commit = useCallback((value: EditorState) => { dispatch({ type: 'commit', state: value }); setDirty(true); }, []);
  const cancelDraft = () => { setDraft([]); setPending(null); setClosingCurve(false); };
  const switchTool = (next: Tool) => {
    if ((next === 'select' || next === 'hand') && draft.length) { setNotice('Finish or cancel the current shape before changing tools.'); return; }
    if (pending) { setNotice('Place the curve bend, or press Backspace to undo the curve endpoint.'); return; }
    setTool(next); setSelected(null);
  };
  const loadSource = useCallback(async (bytes: Uint8Array, name: string, nextState?: EditorState, demo = false) => {
    const token = ++loadToken.current;
    setBusy('Opening plan'); setError(null);
    let opened: Awaited<ReturnType<typeof openDocument>> | undefined;
    try {
      // Reject encrypted documents up front rather than failing only at export.
      await PDFDocument.load(bytes);
      opened = await openDocument(bytes);
      if (token !== loadToken.current) { await opened.document.loadingTask.destroy(); return; }
      if (nextState && (nextState.overlays.some(o => o.page >= opened!.pages.length) || Object.keys(nextState.legends).some(key => Number(key) >= opened!.pages.length))) {
        await opened.document.loadingTask.destroy(); throw new Error('The saved project references a page that is missing from its PDF.');
      }
      const previous = documentRef.current;
      documentRef.current = opened.document;
      setPdf(opened.document); setPages(opened.pages); setSource(bytes); setFilename(name);
      const initial = nextState ?? emptyState();
      dispatch({ type: 'reset', state: initial });
      setActiveCategory(initial.categories[0].id); setSelected(null); setPage(0); setZoom(null);
      setDraft([]); setPending(null); setClosingCurve(false); setIsDemo(demo); setDirty(false); setTool('select');
      setEditingCategory(null); setSidebarOpen(false);
      void previous?.loadingTask.destroy();
    } catch (e) {
      if (token !== loadToken.current) return;
      const message = e instanceof Error ? e.message : 'Unknown PDF error.';
      setError(/encrypt|password/i.test(message) ? 'Password-protected PDFs are not supported. Save an unprotected copy and open it here.' : `Could not open this file. ${message}`);
    } finally { if (token === loadToken.current) setBusy(null); }
  }, []);

  useEffect(() => {
    let alive = true;
    createDemo().then(bytes => { if (alive && loadToken.current === 0) void loadSource(bytes, 'Example · Ground floor.pdf', demoState(), true); }).catch(() => { if (alive) { setBusy(null); setError('The example could not be loaded. You can still open your own PDF.'); } });
    return () => { alive = false; ++loadToken.current; void documentRef.current?.loadingTask.destroy(); };
  }, [loadSource]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty || draft.length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, draft.length]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (selected && !state.overlays.some(o => o.id === selected)) setSelected(null); }, [state, selected]);
  useEffect(() => { if (!state.categories.some(c => c.id === activeCategory)) setActiveCategory(state.categories[0].id); }, [state.categories, activeCategory]);

  const openFile = async (file?: File) => {
    if (!file || loading) return;
    const maxMB = /\.json$/i.test(file.name) ? 160 : 100;
    if (file.size > maxMB * 1024 * 1024) { setError(`This file is larger than ${maxMB} MB. Open a smaller PDF or project.`); return; }
    if (!/\.(pdf|json)$/i.test(file.name)) { setError('Open a PDF plan or a saved .overlayer.json project.'); return; }
    if ((dirty || draft.length) && !window.confirm('Open another file? Unsaved changes and the current shape will be lost. Choose Cancel to save your project first.')) return;
    try {
      if (/\.json$/i.test(file.name)) {
        const project = validateProject(JSON.parse(await file.text()));
        await loadSource(base64ToBytes(project.pdf), project.filename, project.state);
      } else await loadSource(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this file.'); }
  };

  const finishShape = (vertices = draft) => {
    if (pending) { setNotice('Click to place the curve bend first, or press Backspace to remove its endpoint.'); return; }
    if (!validShape(vertices)) { setNotice('Add at least three distinct, non-collinear points to close a room.'); return; }
    const id = uid();
    const overlay: Overlay = { id, page, name: `Room ${state.overlays.length + 1}`, categoryId: draftCategory.current, vertices };
    commit({ ...state, overlays: [...state.overlays, overlay] });
    cancelDraft(); setSelected(id); setTool('select'); setNotice('Room closed. Drag its points to refine the shape.');
  };
  const addPoint = (point: Point, close: boolean) => {
    if (loading) return;
    if (pending) {
      if (closingCurve) {
        const vertices = draft.map((v, i) => i === 0 ? { ...v, control: point } : v);
        if (validShape(vertices)) {
          const id = uid();
          commit({ ...state, overlays: [...state.overlays, { id, page, name: `Room ${state.overlays.length + 1}`, categoryId: draftCategory.current, vertices }] });
          cancelDraft(); setSelected(id); setTool('select'); setNotice('Curved room closed. Drag its handles to refine it.');
        }
      } else { setDraft([...draft, { ...pending, control: point }]); setPending(null); }
      return;
    }
    if (!draft.length) { draftCategory.current = category.id; setDraft([point]); return; }
    if (close) {
      if (tool === 'curve') { setPending(draft[0]); setClosingCurve(true); }
      else finishShape();
      return;
    }
    if (Math.hypot(point.x - draft.at(-1)!.x, point.y - draft.at(-1)!.y) * actualScale < 3) return;
    if (tool === 'curve') setPending(point);
    else setDraft([...draft, point]);
  };
  const undo = () => {
    if (pending) { setPending(null); setClosingCurve(false); }
    else if (draft.length) setDraft(draft.slice(0, -1));
    else if (history.past.length) { dispatch({ type: 'undo' }); setDirty(true); }
  };
  const redo = () => { if (!draft.length && history.future.length) { dispatch({ type: 'redo' }); setDirty(true); } };
  const removeOverlay = (id: string) => { commit({ ...state, overlays: state.overlays.filter(o => o.id !== id) }); if (selected === id) setSelected(null); };
  const updateOverlay = (update: Partial<Overlay>) => { if (chosen) commit({ ...state, overlays: state.overlays.map(o => o.id === chosen.id ? { ...o, ...update } : o) }); };
  const updateCategory = (id: string, update: Partial<Category>) => commit({ ...state, categories: state.categories.map(c => c.id === id ? { ...c, ...update } : c) });
  const saveLabel = () => {
    if (!editingCategory) return;
    if (!categoryLabel.trim()) { setNotice('A category needs a label. Its previous label has been kept.'); }
    else if (categoryLabel.trim() !== state.categories.find(c => c.id === editingCategory)?.label) updateCategory(editingCategory, { label: categoryLabel.trim() });
    setEditingCategory(null);
  };
  const saveProject = () => {
    if (!source || loading || draft.length) return;
    const project: ProjectFile = { format: 'pdf-overlayer', version: 1, filename, pdf: bytesToBase64(source), state };
    download(JSON.stringify(project), filename.replace(/\.pdf$/i, '') + '.overlayer.json', 'application/json');
    setDirty(false); setNotice('Project downloaded. Open this file later to continue editing.');
  };
  const exportPlan = async () => {
    if (!source || loading || draft.length) return;
    setBusy('Exporting PDF'); setError(null);
    try {
      const bytes = await exportPdf(source, state, pages);
      download(bytes, filename.replace(/\.pdf$/i, '').replace('Example · ', '') + '-overlays.pdf', 'application/pdf');
      setNotice('PDF exported at the original page dimensions. Print at Actual size / 100% to retain the scale.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed. Please try again.'); }
    finally { setBusy(null); }
  };

  const actionsRef = useRef({ undo, redo, finishShape, cancelDraft, saveProject, removeOverlay, switchTool });
  actionsRef.current = { undo, redo, finishShape, cancelDraft, saveProject, removeOverlay, switchTool };
  const contextRef = useRef({ selected, draft, loading, helpOpen }); contextRef.current = { selected, draft, loading, helpOpen };
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable) return;
      const ctx = contextRef.current;
      if (e.key === 'Escape') { actionsRef.current.cancelDraft(); setSelected(null); setHelpOpen(false); setSidebarOpen(false); return; }
      if (ctx.loading || ctx.helpOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? actionsRef.current.redo() : actionsRef.current.undo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); actionsRef.current.saveProject(); }
      else if (e.key === 'Enter' && ctx.draft.length) { e.preventDefault(); actionsRef.current.finishShape(); }
      else if (e.key === 'Backspace' && ctx.draft.length) { e.preventDefault(); actionsRef.current.undo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ctx.selected) { e.preventDefault(); actionsRef.current.removeOverlay(ctx.selected); }
      else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const match = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
        if (match) actionsRef.current.switchTool(match.id);
      }
    };
    window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const changePage = (next: number) => {
    if (draft.length) { setNotice('Finish or cancel your shape before changing pages.'); return; }
    setPage(next); setSelected(null); setZoom(null);
  };
  const zoomBy = (factor: number) => setZoom(Math.max(0.1, Math.min(5, actualScale * factor)));
  const setLegendVisible = (visible: boolean) => { if (info) commit({ ...state, legends: { ...state.legends, [page]: { ...getLegend(state, page, info), visible } } }); };
  const instruction = pending ? 'Click to place the curve bend. Backspace removes the endpoint.'
    : draft.length ? `${draft.length} points · Click the first point or press Enter to close.`
    : tool === 'line' ? 'Click the corners of a room. Return to the first point to close.'
    : tool === 'curve' ? 'Click a start point, then a curve endpoint and its bend.'
    : tool === 'hand' ? 'Drag the plan to move around. Use + and − to zoom.'
    : chosen ? 'Drag white points to adjust corners; gold handles adjust curves.'
    : 'Select a room to edit it, or choose a drawing tool to start.';

  return <div className="app" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } }} onDrop={e => { e.preventDefault(); setDropping(false); void openFile(e.dataTransfer.files[0]); }}>
    <input ref={fileRef} className="visually-hidden" type="file" accept=".pdf,.overlayer.json,.json,application/pdf,application/json" aria-label="Open PDF or project" onChange={e => { void openFile(e.target.files?.[0]); e.target.value = ''; }}/>
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Layers2 size={22} strokeWidth={1.5}/></span><span>PDF <strong>Overlayer</strong><small>Room by room.</small></span></div>
      <div className="document-name"><FileText size={15}/><span>{filename || 'No plan open'}</span>{dirty && <span className="unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes"/>}</div>
      <div className="header-actions"><button className="secondary-button open-button" onClick={() => fileRef.current?.click()} disabled={loading}><FolderOpen size={16}/><span>Open PDF</span></button>
        <IconButton label="Save editable project (⌘/Ctrl S)" onClick={saveProject} disabled={!source || loading || draft.length > 0}><Save size={17}/></IconButton>
        <button className="primary-button export-button" onClick={() => void exportPlan()} disabled={!source || loading || draft.length > 0}>{busy === 'Exporting PDF' ? <LoaderCircle size={16} className="spin"/> : <ArrowDownToLine size={16}/>}<span>{busy === 'Exporting PDF' ? 'Exporting…' : 'Export PDF'}</span></button>
      </div>
    </header>
    <div className="editor-body">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close colour panel" onClick={() => setSidebarOpen(false)}/>}
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Colours and rooms" inert={loading || undefined}>
        <div className="sidebar-heading"><h1>Menu</h1><p>Edit your plan</p><IconButton label="Close colour panel" className="mobile-sidebar-close" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17}/></IconButton></div>
        <section className="category-section" aria-labelledby="category-heading">
          <div className="section-heading"><h2 id="category-heading">Colour key</h2><IconButton label="Add category" disabled={state.categories.length >= 100 || draft.length > 0} onClick={() => {
            const id = uid(); const label = `Category ${state.categories.length + 1}`;
            commit({ ...state, categories: [...state.categories, { id, label, color: '#9677B0', opacity: 0.3 }] }); setActiveCategory(id); setEditingCategory(id); setCategoryLabel(label);
          }}><Plus size={16}/></IconButton></div>
          <div className="category-list">
            {state.categories.map(c => <div className={`category-row ${activeCategory === c.id ? 'active' : ''}`} key={c.id}>
              <label className="color-input-wrap" style={{ '--swatch': c.color } as React.CSSProperties} title={`Change ${c.label} colour`}><input type="color" aria-label={`${c.label} colour`} value={c.color} onChange={e => updateCategory(c.id, { color: e.target.value })}/></label>
              {editingCategory === c.id ? <input autoFocus className="category-label-input" aria-label="Category label" value={categoryLabel} maxLength={80} onChange={e => setCategoryLabel(e.target.value)} onBlur={saveLabel} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } else if (e.key === 'Escape') { e.preventDefault(); setEditingCategory(null); } }}/>
                : <button className="category-select" disabled={draft.length > 0} onClick={() => setActiveCategory(c.id)} aria-pressed={activeCategory === c.id}><span>{c.label}</span><span className="category-count">{state.overlays.filter(o => o.categoryId === c.id).length}</span></button>}
              <IconButton label={`Edit ${c.label} label`} className="category-edit" onClick={() => { setEditingCategory(c.id); setCategoryLabel(c.label); }}><Pencil size={12}/></IconButton>
            </div>)}
          </div>
          <div className="opacity-control"><label htmlFor="opacity">Opacity <output>{Math.round(category.opacity * 100)}%</output></label><input id="opacity" aria-label={`${category.label} opacity`} type="range" min="5" max="85" step="1" value={Math.round(category.opacity * 100)} onChange={e => updateCategory(category.id, { opacity: Number(e.target.value) / 100 })}/><div className="opacity-captions"><span>Subtle</span><span>Solid</span></div></div>
          <details className="category-manage"><summary>Manage selected category<ChevronDown size={12}/></summary><div><span>{category.label}</span><button className="text-danger" disabled={state.categories.length === 1 || state.overlays.some(o => o.categoryId === category.id) || draft.length > 0} onClick={() => commit({ ...state, categories: state.categories.filter(c => c.id !== category.id) })}><Trash2 size={12}/> Remove</button></div><p>Only unused categories can be removed.</p></details>
        </section>
        <section className="rooms-section" aria-labelledby="rooms-heading">
          <div className="section-heading"><h2 id="rooms-heading">Room overlays <span>{currentOverlays.length}</span></h2><span className="subtle-label">This page</span></div>
          <div className="room-list">
            {currentOverlays.length ? currentOverlays.map(o => <div className={`room-row ${selected === o.id ? 'selected' : ''} ${o.hidden ? 'hidden-room' : ''}`} key={o.id}>
              <button className="room-select" onClick={() => { if (draft.length) { setNotice('Finish or cancel your shape before selecting a room.'); return; } setSelected(o.id); setTool('select'); }} aria-pressed={selected === o.id}><span className="room-color" style={{ background: state.categories.find(c => c.id === o.categoryId)?.color }}/><span>{o.name}</span></button>
              <IconButton label={`${o.hidden ? 'Show' : 'Hide'} ${o.name}`} onClick={() => commit({ ...state, overlays: state.overlays.map(item => item.id === o.id ? { ...item, hidden: !item.hidden } : item) })}>{o.hidden ? <EyeOff size={14}/> : <Eye size={14}/>}</IconButton>
            </div>) : <div className="room-empty"><VectorSquare size={20}/><p>No rooms marked yet.</p><button onClick={() => { setTool('line'); setSidebarOpen(false); }}>Draw your first room <ArrowRight size={12}/></button></div>}
          </div>
          {chosen && <div className="room-properties" key={chosen.id}><label htmlFor="room-name">Room name</label><RoomNameInput name={chosen.name} onSave={name => updateOverlay({ name })}/>
            <label htmlFor="room-category">Category</label><select id="room-category" value={chosen.categoryId} onChange={e => updateOverlay({ categoryId: e.target.value })}>{state.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <div className="room-properties-footer"><span>{chosen.vertices.length} points · Closed</span><button className="text-danger" onClick={() => removeOverlay(chosen.id)}><Trash2 size={12}/> Delete room</button></div>
          </div>}
        </section>
        <section className="legend-section" aria-labelledby="legend-heading"><div className="section-heading"><h2 id="legend-heading">Plan legend</h2><button type="button" role="switch" aria-checked={info ? getLegend(state, page, info).visible : true} aria-label="Show legend on this page" className="switch" onClick={() => info && setLegendVisible(!getLegend(state, page, info).visible)}><span/></button></div><p>Included in your PDF. Drag it on the plan to reposition.</p><span className="legend-note">Shows visible categories used on this page.</span></section>
        <div className="sidebar-footer"><ShieldCheck size={14}/><span>Your files stay in your browser.</span></div>
      </aside>
      <main className="workspace">
        <div className="workspace-toolbar"><div className="drawing-tools"><IconButton label="Show colours and rooms" className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={18}/></IconButton><div className="tool-group" role="toolbar" aria-label="Drawing tools">{TOOLS.map(t => <button key={t.id} className={`tool-button ${tool === t.id ? 'is-active' : ''}`} aria-label={`${t.label} (${t.key})`} title={`${t.label} (${t.key})`} aria-pressed={tool === t.id} disabled={loading} onClick={() => switchTool(t.id)}>{t.icon}<span>{t.label}</span></button>)}</div><span className="toolbar-divider"/><IconButton label="Undo (⌘/Ctrl Z)" disabled={loading || (!history.past.length && !draft.length)} onClick={undo}><Undo2 size={16}/></IconButton><IconButton label="Redo (⌘/Ctrl Shift Z)" disabled={loading || !history.future.length || draft.length > 0} onClick={redo}><Redo2 size={16}/></IconButton></div><IconButton label="Drawing help" onClick={() => setHelpOpen(true)}><CircleHelp size={17}/></IconButton></div>
        <div className="document-toolbar"><div className="page-controls"><IconButton label="Previous page" disabled={loading || page === 0 || draft.length > 0} onClick={() => changePage(page - 1)}><ArrowLeft size={14}/></IconButton><span>Page <select aria-label="PDF page" value={page} disabled={loading || draft.length > 0} onChange={e => changePage(Number(e.target.value))}>{pages.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select> of {pages.length || '—'}</span><IconButton label="Next page" disabled={loading || page >= pages.length - 1 || draft.length > 0} onClick={() => changePage(page + 1)}><ArrowRight size={14}/></IconButton></div><div className="zoom-controls"><IconButton label="Zoom out" disabled={!info || actualScale <= 0.1} onClick={() => zoomBy(1 / 1.25)}><Minus size={14}/></IconButton><span className="zoom-value">{Math.round(actualScale * 100)}%</span><IconButton label="Zoom in" disabled={!info || actualScale >= 5} onClick={() => zoomBy(1.25)}><Plus size={14}/></IconButton><span className="toolbar-divider"/><button className={`fit-button ${zoom === null ? 'is-fit' : ''}`} onClick={() => setZoom(null)} disabled={!info}><Maximize size={13}/><span>Fit page</span></button></div></div>
        {isDemo && <div className="demo-banner"><span><span className="example-badge">Example plan</span><span className="demo-text">A little colour makes a lot clear. Try the tools, or start with your own plan.</span></span><button onClick={() => fileRef.current?.click()} disabled={loading}>Open your PDF <ArrowRight size={13}/></button></div>}
        <div className="canvas-container"><PlanCanvas pdf={pdf} info={info} page={page} state={state} tool={tool} zoom={zoom} onScale={setActualScale} selected={selected} onSelect={id => { setSelected(id); if (id) setActiveCategory(state.overlays.find(o => o.id === id)?.categoryId ?? category.id); }} onCommit={commit} draft={draft} pending={pending} closingCurve={closingCurve} color={state.categories.find(c => c.id === (draft.length ? draftCategory.current : category.id))?.color ?? category.color} opacity={category.opacity} onPoint={addPoint} onOpen={() => fileRef.current?.click()} onError={setError}/>
          {draft.length > 0 && <div className="draft-bar"><span className="drawing-dot"/><span>Drawing room <strong>{draft.length} points</strong></span><button className="draft-cancel" onClick={cancelDraft}>Cancel <kbd>Esc</kbd></button><button className="primary-button" disabled={!validShape(draft) || !!pending} onClick={() => finishShape()}><Check size={14}/> Close shape <kbd>↵</kbd></button></div>}
          {loading && <div className="busy-overlay" role="status"><LoaderCircle size={23} className="spin"/><span>{busy}…</span></div>}
        </div>
        <footer className="workspace-status"><div><span className={`status-dot ${draft.length ? 'is-drawing' : ''}`}/><span>{instruction}</span></div><span className="page-dimensions">{info ? `${(info.width / 72 * 25.4).toFixed(1)} × ${(info.height / 72 * 25.4).toFixed(1)} mm` : ''}<span>Original scale</span></span></footer>
      </main>
    </div>
    {error && <div className="message error-message" role="alert"><span>{error}</span><IconButton label="Dismiss error" onClick={() => setError(null)}><X size={16}/></IconButton></div>}
    {notice && !error && <div className="message notice-message" role="status"><Check size={16}/><span>{notice}</span><IconButton label="Dismiss notification" onClick={() => setNotice(null)}><X size={14}/></IconButton></div>}
    {dropping && <div className="drop-overlay" onDragLeave={() => setDropping(false)}><Upload size={36}/><h2>Drop your plan here.</h2><p>PDF plan or saved Overlayer project</p></div>}
    {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)}/>}
  </div>;
}

function RoomNameInput({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  return <input id="room-name" aria-label="Room name" value={value} maxLength={100}
    onChange={e => setValue(e.target.value)}
    onBlur={() => { const next = value.trim() || name; setValue(next); if (next !== name) onSave(next); }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="help-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="help-title"><div className="help-heading"><h2 id="help-title">A few points. A clearer plan.</h2><IconButton label="Close help" onClick={onClose}><X size={18}/></IconButton></div><p>Choose a colour category, then trace the room directly on your PDF.</p><dl><dt><VectorSquare size={17}/> Straight edges <kbd>P</kbd></dt><dd>Click each corner. Click your first point, or press Enter, to close the shape. You need at least three points.</dd><dt><Spline size={17}/> Curved edges <kbd>C</kbd></dt><dd>Click the curve endpoint, then click to place its bend. Switch between straight and curved tools while tracing. To curve the closing edge, click the first point and then its bend.</dd><dt><MousePointer2 size={17}/> Adjust a room <kbd>V</kbd></dt><dd>Select an overlay. Drag white points to move corners and gold handles to adjust curves. Change its name and category in the side panel.</dd><dt><Hand size={17}/> Move around <kbd>H</kbd></dt><dd>Drag to pan. Use the zoom buttons for detail and Fit page to see the whole drawing. Drag the legend to a clear area of the plan.</dd><dt><Save size={17}/> Keep your work <kbd>⌘/Ctrl S</kbd></dt><dd>Save an editable project to continue later, including the source PDF. Open it using Open PDF. Export PDF creates a finished copy with all visible overlays and legends. Hidden rooms are excluded.</dd><dt><ArrowDownToLine size={17}/> Preserve scale</dt><dd>Export keeps the source pages at their original dimensions. Print at Actual size / 100%, rather than Fit, to preserve the drawing scale.</dd></dl><div className="help-shortcuts"><span><kbd>⌘/Ctrl Z</kbd> Undo</span><span><kbd>⌘/Ctrl ⇧ Z</kbd> Redo</span><span><kbd>Backspace</kbd> Undo point</span><span><kbd>Esc</kbd> Cancel shape</span></div><button className="primary-button" onClick={onClose}>Got it <Check size={15}/></button></dialog>;
}
