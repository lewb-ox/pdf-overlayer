import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The Electron build loads the app from file://, so assets must be relative.
  base: './',
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] },
});
