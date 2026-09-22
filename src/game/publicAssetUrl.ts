/**
 * A URL beneath Vite's configured `base` for a file copied from `public/`.
 *
 * Phaser, DOM markup and CSS must all agree on this prefix when the game is
 * served from a subpath such as GitHub Pages.
 */
export function publicAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL;
  const path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${base}${path}`;
}
