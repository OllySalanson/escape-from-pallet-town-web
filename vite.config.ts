import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { lowerOwnPriority } from './tools/lowPriority.mjs';

/** The dev server, preview and build run at low CPU priority: `tools/lowPriority.mjs`. */
lowerOwnPriority();

/** GitHub Pages project site: https://ollysalanson.github.io/escape-from-pallet-town-web/ */
export const GITHUB_PAGES_BASE = '/escape-from-pallet-town-web/';

/**
 * The commit a build was made from, so a player's feedback says which code it
 * is about (`src/game/feedback/buildInfo.ts`). CI names it; a local build asks
 * git; a dev server is `dev`.
 */
function buildVersion(): string {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
  define:
    command === 'build'
      ? {
          'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion()),
          'import.meta.env.VITE_BUILD_DATE': JSON.stringify(`${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`),
        }
      : {},
}));
