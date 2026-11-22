import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { GITHUB_PAGES_BASE } from '../vite.config';

/**
 * What a friend sees before the game has drawn a pixel: the browser tab, and
 * the card a chat app makes of a pasted link. A chat app reads the document
 * without running it, so all of it has to be in index.html itself.
 */
const PUBLISHED = 'https://ollysalanson.github.io/escape-from-pallet-town-web/';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');

const meta = (attribute: 'name' | 'property', key: string): string | undefined =>
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe('the page head', () => {
  it('names the game, and only the game, in the tab', () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe('Escape from Pallet Town');
  });

  it('gives the tab a real icon, and every icon it names ships', async () => {
    const icons = [...html.matchAll(/<link\s+rel="(?:icon|apple-touch-icon)"\s+href="([^"]+)"/g)].map((match) => match[1]);
    expect(icons).toEqual(['/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png']);
    for (const icon of icons) {
      await expect(readFile(new URL(`public${icon}`, root))).resolves.toBeTruthy();
    }
  });

  it('describes a shared link, with a picture at a full address that the build publishes', async () => {
    expect(meta('property', 'og:title')).toBe('Escape from Pallet Town');
    expect(meta('property', 'og:description')).toMatch(/heist/);
    expect(meta('name', 'description')).toMatch(/heist/);
    expect(new URL(PUBLISHED).pathname).toBe(GITHUB_PAGES_BASE);
    expect(meta('property', 'og:url')).toBe(PUBLISHED);
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');

    const image = meta('property', 'og:image');
    expect(image?.startsWith(PUBLISHED)).toBe(true);
    const published = await readFile(new URL(`public/${image!.slice(PUBLISHED.length)}`, root));
    // The repository's own link preview, the same bytes (tools/readme/drawArt.mjs writes both).
    expect(published.equals(await readFile(new URL('docs/readme/social-preview.png', root)))).toBe(true);
    expect([meta('property', 'og:image:width'), meta('property', 'og:image:height')]).toEqual([
      String(published.readUInt32BE(16)),
      String(published.readUInt32BE(20)),
    ]);
  });
});
