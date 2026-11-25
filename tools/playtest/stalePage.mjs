// A tab that slept through a publish. GitHub Pages replaces the whole site on
// every publish, so the hashed script and stylesheet an old copy of the page
// names are gone; a tab the browser woke from its cache (or a phone that kept
// the page) asked for them and got 404s, and the player was left looking at
// the bare "LOADING THE GAME..." line, black on white, for good (25 Nov 2026).
//
//   npx vite build --outDir "$SCRATCH/dist"
//   node tools/playtest/stalePage.mjs "$SCRATCH/dist" [--shot=dir] [--before]
//
// The driver serves that build itself, under the Pages folder, and plays three
// pages against it:
//   1. a fresh page: the game mounts, and the page is fetched once;
//   2. a page from before a publish: the first copy of the page names files
//      the build does not have, as a cached one would, and every later copy is
//      the current one - the game must mount after one reload, and no more;
//   3. a page whose files never come (gone for good, or no connection): it
//      must reload once, then stop and say so in the game's own colours, with
//      a button that tries again.
// `--before` reports what an old build does instead of failing.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { PIXEL_WINDOW, LOGIC_WINDOW, launchBrowser, sleep } from './browser.mjs';

const args = process.argv.slice(2);
const dist = args.find((arg) => !arg.startsWith('--'));
if (!dist) {
  throw new Error('usage: stalePage.mjs <build dir> [--shot=dir] [--before]');
}
const shotDir = args.find((arg) => arg.startsWith('--shot='))?.slice('--shot='.length);
const before = args.includes('--before');
const BASE = '/escape-from-pallet-town-web/';
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm',
};

const current = await readFile(join(dist, 'index.html'), 'utf8');
// The page as it was a publish ago: the same page, naming bundles by hashes
// this build never made.
const stale = current.replace(/(assets\/[A-Za-z]+-)[A-Za-z0-9_-]{8}\.(js|css)/g, '$1St4le0ld.$2');
if (stale === current) {
  throw new Error('the build names no hashed bundle in its page');
}

let mode = 'fresh';
let pageLoads = 0;
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (!path.startsWith(BASE)) {
    response.writeHead(404).end();
    return;
  }
  const relative = normalize(path.slice(BASE.length) || 'index.html');
  if (relative === 'index.html') {
    pageLoads += 1;
    const servesStale = mode === 'gone' || (mode === 'publish' && pageLoads === 1);
    response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    response.end(servesStale ? stale : current);
    return;
  }
  try {
    const body = await readFile(join(dist, relative));
    response.writeHead(200, { 'content-type': TYPES[extname(relative)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${BASE}`;

const mounted = `!!document.querySelector('#app > canvas') && !document.querySelector('.boot-wait')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) {
    failures.push(what);
  }
};
const until = async (page, expression, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.evaluate(expression).catch(() => false)) {
      return true;
    }
    await sleep(250);
  }
  return false;
};

const browser = await launchBrowser({ window: shotDir ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  for (const scenario of ['fresh', 'publish', 'gone']) {
    mode = scenario;
    pageLoads = 0;
    const page = await browser.openPage(url);
    if (scenario === 'gone') {
      // Long enough for any reload loop to show itself.
      await until(page, `!!document.querySelector('.boot-failed button')`, 15_000);
      await sleep(3000);
      const said = await page.evaluate(`(() => {
        const box = document.querySelector('.boot-failed');
        return box && { text: box.innerText, button: !!box.querySelector('button'), background: getComputedStyle(document.body).backgroundColor };
      })()`).catch(() => null);
      check(pageLoads === 2, `gone: the page reloaded once and stopped (fetched ${pageLoads} times)`);
      check(!!said?.button, `gone: it says so with a button to try again (${JSON.stringify(said)})`);
      check(said?.background === 'rgb(14, 27, 39)', `gone: in the game's own colours, not black on white (${said?.background})`);
      if (shotDir) {
        await page.screenshot(join(shotDir, 'gone.png'));
      }
      if (said?.button) {
        await page.evaluate(`document.querySelector('.boot-failed button').click()`);
        await until(page, `!!document.querySelector('.boot-failed button')`, 15_000);
        await sleep(3000);
        check(pageLoads === 3, `gone: the button tries once more and stops (fetched ${pageLoads} times)`);
      }
    } else {
      const ok = await until(page, mounted, 60_000);
      check(ok, `${scenario}: the game mounts`);
      check(pageLoads === (scenario === 'fresh' ? 1 : 2), `${scenario}: the page was fetched ${pageLoads} times`);
      if (shotDir && scenario === 'publish') {
        await page.screenshot(join(shotDir, 'publish.png'));
      }
    }
    if (shotDir && scenario === 'publish' && failures.length) {
      await page.screenshot(join(shotDir, 'publish-stuck.png'));
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.log(`${failures.length} fault(s)`);
  if (!before) {
    process.exitCode = 1;
  }
} else {
  console.log('a page from before a publish finds its way into the game');
}
