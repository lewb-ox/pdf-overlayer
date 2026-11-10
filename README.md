# PDF Overlayer

A browser-based editor for marking rooms on architectural PDF plans. Built with React, TypeScript, Vite, PDF.js and pdf-lib. Source PDFs and saved projects are processed locally in your browser; no upload service or account is required.

## Run locally

Use Node.js 22.13+ (or a current LTS release).

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. The editor starts with a clearly labelled example plan so you can try the tools immediately.

## Working with a plan

1. **Open PDF** loads a PDF or an editable `.overlayer.json` project. You can also drag a file into the editor.
2. Choose a **colour category**. Click its swatch to change the colour, its pencil to edit the label, or **+** to add a category. Opacity applies to all rooms in that category. Unused categories can be removed under **Manage selected category**.
3. Choose **Straight edge** and click each corner of a room. Click the first point or press Enter to close it. A completed room always has a closed path; fewer than three distinct points cannot be saved.
4. Choose **Curved edge** to add a curve: click its endpoint, then click its bend. Alternate straight and curved tools within one shape. To curve the closing edge, click the first point and then the bend. Curves use editable quadratic Bézier segments.
5. **Select** a room to rename it or assign another category. Drag its white vertices and gold curve handles to refine the outline. The room list provides visibility controls; hidden rooms are excluded from export and from the page legend.
6. Drag the **legend** to clear space on the page. It lists the visible categories used on that page. Each page has its own legend position and visibility setting.
7. **Save editable project** downloads the source PDF together with all room shapes, categories and legend positions. Reopen it using Open PDF to continue later. Changes are held in memory until saved; there is no automatic browser storage.
8. **Export PDF** produces the original document with vector overlays and legends. Finish or cancel the current shape first.

On smaller screens, open the colours and rooms panel using the menu button above the plan. Zoom in for accurate drawing and use Pan to move around.

## Scale and export

Export adds vector drawing commands to the existing PDF. It does not rasterise the original plan, resize pages or replace the source content. It preserves the original MediaBox, CropBox, page rotation and UserUnit. Drawing coordinates use the inverse PDF.js viewport transform, including rotated and cropped pages.

**Print the exported PDF at Actual size / 100%.** A printer's Fit to page option can change the physical scale even when the file's dimensions are unchanged. The editor preserves an existing drawing scale; it does not infer or calibrate one from plan measurements.

Legend labels use an embedded DM Sans Latin font. Unsupported characters produce an explicit export error rather than silently losing text. Password-protected PDFs must be saved as an unprotected copy before opening. Maximum input size is 100 MB for PDFs and 160 MB for projects. Very tall legends must be shortened or hidden on that page before export.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Select | V |
| Straight edge | P |
| Curved edge | C |
| Pan | H |
| Close shape | Enter |
| Cancel shape / clear selection | Esc |
| Remove latest point or pending curve endpoint | Backspace |
| Delete selected room | Delete / Backspace |
| Undo | Cmd/Ctrl Z |
| Redo | Cmd/Ctrl Shift Z |
| Save project | Cmd/Ctrl S |

Undo/redo retains the latest 80 committed edits. Point undo also works while tracing.

## Validation

```sh
npm test
npm run build
npm run test:e2e
```

The end-to-end suite uses an installed Google Chrome in an isolated headless session. Change `channel` in `playwright.config.ts` if you use another Playwright browser.

Tests cover mixed lines and curves, closing curves, node editing, colour labels and opacity, legend movement and visibility, undo/redo, project save/reopen and malformed files. Export tests reopen and render a four-page PDF with all four rotations, nonzero crop origins and non-default UserUnit, checking overlay pixels, source text, legends and unchanged page boxes.

## Static deployment

`npm run build` creates `dist/`. Serve that directory over HTTP(S) using a static host. No backend or secrets are required. All PDF workers and fonts are bundled locally. For hosting under a subpath, set Vite's `base` to that path before building.
