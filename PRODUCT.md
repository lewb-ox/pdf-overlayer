# PDF Overlayer

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Delegated and confirmed: React, TypeScript and Vite. PDF.js renders plans; pdf-lib adds vector overlays to the original PDF. Processing stays in the browser.

## Users
People marking rooms on architectural PDF plans. Specific organisations and roles are undecided.

## Product Purpose
Apply labelled, semi-transparent colours to rooms, then export the original-scale plan with its overlays and legend.

## Capabilities and Constraints
- Compact editor with the PDF as the primary workspace, confirmed by the user.
- Point-and-click complex polygons, mixed straight and curved segments, and mandatory closed shapes.
- Editable colour categories with labels and transparency.
- A legend included in exported PDFs.
- System, light and dark interface themes with a remembered user override. System is the default; the PDF page and exported document colours remain unchanged.
- Preserve source page dimensions, crop boxes, rotation and vector content.
- User chose direct implementation rather than a visual mockup round.
- Inferred useful extensions: page navigation, undo/redo, node editing, and downloadable editable projects.

## Product Principles
- Keep the plan prominent and controls nearby.
- Preserve physical plan scale in exported files.
- Make drawing state and closure explicit.
- Keep imported documents on the user's device.
