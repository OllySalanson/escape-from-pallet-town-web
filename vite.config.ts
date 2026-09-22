import { defineConfig } from 'vite';

/** GitHub Pages project site: https://ollysalanson.github.io/escape-from-pallet-town-web/ */
export const GITHUB_PAGES_BASE = '/escape-from-pallet-town-web/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
}));
