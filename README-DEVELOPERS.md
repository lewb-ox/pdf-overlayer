# PDF Overlayer — Developer guide

For installation and everyday use, see the [user README](README.md).

## Technology

The application uses React, TypeScript, Vite, PDF.js and pdf-lib.

## Checks

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
