import { defineConfig } from 'vite';
import { lowerOwnPriority } from './tools/lowPriority.mjs';

/** The dev server, preview and build run at low CPU priority: `tools/lowPriority.mjs`. */
lowerOwnPriority();

/** GitHub Pages project site: https://ollysalanson.github.io/escape-from-pallet-town-web/ */
export const GITHUB_PAGES_BASE = '/escape-from-pallet-town-web/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
}));
