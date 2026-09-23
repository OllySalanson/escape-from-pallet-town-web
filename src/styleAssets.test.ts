import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { GITHUB_PAGES_BASE } from '../vite.config';

/**
 * Every file `style.css` names has to arrive under both ways the game is served:
 * the dev server at `/`, and the GitHub Pages build under `GITHUB_PAGES_BASE`.
 * Getting one of them right is easy and is not the test. A relative
 * `url('./battle/orange-kid.woff2')` happens to land next to the built CSS in
 * `dist/assets/`, so the live site was fine - while the dev server served the
 * stylesheet from `/src/`, the font request came back as the SPA's own HTML,
 * and every menu drew in the browser's monospace with the defeat line-up's
 * figures gone. A root-absolute public path is the form that holds in both: the
 * dev server serves `public/` at `/`, and the build prefixes it with `base`.
 *
 * So this asks Vite itself, both ways, rather than reading the source.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));

/** The files a stylesheet asks for - everything but the drawn cursor and tick, which are inline SVG. */
function fileUrls(css: string): string[] {
  const urls = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((match) => match[2]);
  return [...new Set(urls.filter((url) => !url.startsWith('data:')))];
}

describe("the stylesheet's files", () => {
  it('asks for the game font and the figure sheet at all', async () => {
    // Without this the other two pass on a stylesheet that names nothing.
    const server = await createServer({
      root: ROOT,
      logLevel: 'silent',
      server: { port: 0, strictPort: false },
    });
    try {
      const css = (await server.transformRequest('/src/style.css?direct'))?.code ?? '';
      const urls = fileUrls(css);
      expect(urls.some((url) => url.endsWith('orange-kid.woff2'))).toBe(true);
      expect(urls.some((url) => url.endsWith('character.png'))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('resolves every one of them under the dev server', async () => {
    const server = await createServer({
      root: ROOT,
      logLevel: 'silent',
      server: { port: 0, strictPort: false },
    });
    try {
      await server.listen();
      const page = server.resolvedUrls?.local[0];
      expect(page).toBeTruthy();
      // Fetched from the running server, because a CSS `url()` is resolved by
      // the browser against the page, and the dev server answers anything it
      // cannot find with index.html and a 200 - so a status is not enough.
      const css = await (await fetch(new URL('/src/style.css?direct', page))).text();
      const urls = fileUrls(css);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        const response = await fetch(new URL(url, page));
        expect({ url, status: response.status }).toEqual({ url, status: 200 });
        expect(`${url} ${response.headers.get('content-type')}`).not.toMatch(/text\/html/);
      }
    } finally {
      await server.close();
    }
  });

  it('resolves every one of them in the GitHub Pages build', async () => {
    const output = await build({
      root: ROOT,
      logLevel: 'silent',
      build: { write: false, copyPublicDir: false, rolldownOptions: { input: 'src/style.css' } },
    });
    const bundles = Array.isArray(output) ? output : [output];
    const assets = bundles.flatMap((bundle) => ('output' in bundle ? bundle.output : []));
    const stylesheet = assets.find((asset) => asset.fileName.endsWith('.css'));
    expect(stylesheet?.type).toBe('asset');
    const css = stylesheet?.type === 'asset' ? String(stylesheet.source) : '';
    // The built stylesheet's own address on the Pages site, which a relative
    // `url()` is resolved against.
    const at = new URL(`${GITHUB_PAGES_BASE}${stylesheet?.fileName}`, 'https://pages.test');
    const urls = fileUrls(css);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const path = new URL(url, at).pathname;
      expect({ url, underBase: path.startsWith(GITHUB_PAGES_BASE) }).toEqual({
        url,
        underBase: true,
      });
      // A public file is copied to the root of `dist/` as it is.
      expect({
        url,
        published: existsSync(`${PUBLIC}/${path.slice(GITHUB_PAGES_BASE.length)}`),
      }).toEqual({ url, published: true });
    }
  });
});
