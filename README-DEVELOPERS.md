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
