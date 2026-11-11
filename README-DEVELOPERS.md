# PDF Overlayer — Developer guide

For installation and everyday use, see the [user README](README.md).

## Technology

The application uses React, TypeScript, Vite, PDF.js and pdf-lib.

## Running locally

Run `npm ci` to install the locked dependencies, then `npm start` to launch the local Vite development server. Open the Local address shown in the terminal.

## Checks

`src/legend.ts` builds the shared layout used by `LegendGraphic.tsx` and PDF export. Keep all text wrapping, category grouping and room numbering in that shared model. Room numbers and optional marker positions are saved with overlays; legend text is stored per page. Older version-1 projects without these optional fields receive automatic numbers when opened.

Theme logic is in `src/theme.ts`, with a small pre-load initialiser in `index.html` to prevent a light flash. Keep their storage key and theme resolution consistent. The interface palette is defined by the light and dark semantic tokens in `src/styles.css`; document colours and the white PDF page are independent of the interface theme. Theme preference is a browser setting, separate from saved PDF projects.

Run these commands from the project folder after installing the dependencies:

```sh
npm test
npm run build
npm run test:e2e
```

The browser tests require an installed Google Chrome. Their configuration is in `playwright.config.ts`. Export checks cover page rotations, crop boxes, non-default PDF units, preserved source text and overlay alignment.

## Building and hosting

`npm run build` creates `dist/` for hosting on an HTTP(S) static server. No backend or secrets are required; PDF workers and fonts are bundled locally.

For a subpath deployment, set Vite's `base` before building.

`npm run preview` serves a local preview of an existing build; it is not a production hosting service.

## macOS desktop packaging

Install dependencies with `npm ci`, then run `npm run desktop:dist` on macOS. electron-builder writes an unsigned `.dmg` and `.zip` to `release/`. The build does not require an Apple Developer account. Build separate artifacts on Apple Silicon and Intel Macs, or configure a universal build after checking all native dependencies. Distribute the DMG and publish a checksum through a trusted release channel. Users must approve the unsigned app once through Finder's Control-click → Open flow or Privacy & Security settings. Signing/notarization requires an Apple Developer account and is not configured here.

The Electron window disables Node integration, enables context isolation and sandboxing, and loads the built local Vite app. Do not add arbitrary remote navigation or enable Node integration for web content.

PDF rendering uses the `pdfjs-dist/legacy/build` entry points for both the API and worker. These include PDF.js's compatibility support for APIs such as `Map.getOrInsertComputed` and `WeakMap.getOrInsertComputed`, which may be absent in Electron's bundled Chromium. Keep the API and worker on the same build and version. `tests/e2e/pdf-compatibility.spec.ts` checks rendering with these APIs initially unavailable.
