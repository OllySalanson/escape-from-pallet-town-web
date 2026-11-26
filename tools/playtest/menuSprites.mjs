// How long a menu's pictures take to come in the first time it opens, on a
// build served the way GitHub Pages serves it.
//
// The captain, 26 Nov 2026: "I've just gone into Bill's cottage and looked at
// the menu here, and it took a while for everything to load again" - and the
// second time he opened it, everything was there at once. So this opens Bill's
// shelf twice and the raid's result screen once, from a page that has only
// loaded the game, and for each one reads, the moment its markup is in:
//
// - how many of its pictures are drawn, and how many are still to come;
// - how long until the last of them is drawn;
// - how many picture files the server was asked for while it was open.
//
// The server answers every request after `--latency` ms (a round trip from a
// home connection to Pages) with Pages' own `cache-control: max-age=600`.
//
//   node tools/playtest/menuSprites.mjs <build dir> [--latency=80] [--cpu=4] [--stale] [--shot=dir]
//
// `--cpu` slows the page's processor by that factor once the game is loaded.
//
// The build is a test-mode build under the Pages base:
//   VITE_EPTW_TEST_MODE=1 npx vite build --outDir <build dir>
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [dist] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const latency = Number(option('latency') ?? 80);
const shots = option('shot');
const cpu = Number(option('cpu') ?? 1);
// Past Pages' ten minutes every file has to be asked about again: a page open
// that long is served as if each answer were already out of date.
const stale = args.includes('--stale');
if (!dist) {
  throw new Error('menuSprites: name a test-mode build directory');
}
if (shots) mkdirSync(shots, { recursive: true });

const BASE = '/escape-from-pallet-town-web/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
const pictures = [];
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  await sleep(latency);
  if (!path.startsWith(BASE)) {
    response.writeHead(404).end();
    return;
  }
  const relative = normalize(path.slice(BASE.length) || 'index.html');
  if (extname(relative) === '.png') pictures.push(relative);
  try {
    const body = await readFile(join(dist, relative));
    response.writeHead(200, { 'content-type': TYPES[extname(relative)] ?? 'application/octet-stream', 'cache-control': stale ? 'no-cache' : 'max-age=600' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${BASE}?testmode=pixels`;

/**
 * Watches the menu layer from now on: the moment a picture is put in it, and
 * the moment it is drawn. `done()` answers for the screen opened since.
 */
const WATCH = `(() => {
  const seen = [];
  const note = (img) => {
    if (seen.some((each) => each.img === img)) return;
    const entry = { img, src: img.getAttribute('src'), at: performance.now(), drawn: img.complete && img.naturalWidth > 0 ? performance.now() : null };
    seen.push(entry);
    if (entry.drawn === null) img.addEventListener('load', () => { entry.drawn = performance.now(); }, { once: true });
  };
  const scan = (node) => {
    if (node.nodeType !== 1) return;
    if (node.tagName === 'IMG') note(node);
    node.querySelectorAll?.('img').forEach(note);
  };
  new MutationObserver((records) => records.forEach((record) => {
    record.addedNodes.forEach(scan);
    if (record.type === 'attributes' && record.target.tagName === 'IMG') note(record.target);
  })).observe(document.querySelector('#screens'), { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  window.__menuSprites = {
    reset: () => { seen.length = 0; },
    done: () => {
      const first = Math.min(...seen.map((each) => each.at));
      const late = seen.filter((each) => each.drawn === null || each.drawn - each.at > 1);
      return JSON.stringify({
        pictures: seen.length,
        drawnAtOnce: seen.length - late.length,
        stillComing: late.length,
        lastDrawnMs: seen.length ? Math.round(Math.max(...seen.map((each) => (each.drawn ?? Infinity) - first))) : 0,
        neverDrawn: seen.filter((each) => each.drawn === null).map((each) => each.src),
        lateFrom: Object.entries(late.reduce((kinds, each) => { const src = each.src ?? ''; const kind = src.startsWith('data:') ? 'data' : src.split('assets/').pop().split('/').slice(0, -1).join('/'); kinds[kind] = (kinds[kind] ?? 0) + 1; return kinds; }, {})).map(([kind, n]) => kind + ' ' + n).join(', '),
      });
    },
  };
})()`;

const report = {
  outcome: 'ESCAPED', eyebrow: 'Extracted · Deer Gap', headline: 'YOU WALKED OUT.', summary: '', clockLabel: '2:38 used of 3:00', elapsedMs: 158000, durationMs: 180000, haulTier: 'light',
  ledger: { pokemon: [], items: [{ itemId: 'money', label: 'Pokédollars', quantity: 10 }, { itemId: 'mooring-rope', label: 'Mooring rope', quantity: 1 }, { itemId: 'lamp-oil', label: 'Lamp oil', quantity: 1 }] },
  ledgerFound: { pokemon: [], items: [{ itemId: 'money', label: 'Pokédollars', quantity: 10 }, { itemId: 'mooring-rope', label: 'Mooring rope', quantity: 1 }, { itemId: 'lamp-oil', label: 'Lamp oil', quantity: 1 }] },
  ledgerPaid: { pokemon: [], items: [] }, ledgerHeading: 'Banked', ledgerEmptyText: 'Nothing was banked.',
  secured: { pokemon: [], items: [] }, risked: { pokemon: [], items: [] }, gambleVerdict: '', securedEmptyText: '', spent: [], dropped: [], progress: [], progressSummary: null,
  gear: [], gearSummary: null, pack: null, packSummary: null, pressure: [], baseNote: null, saved: true,
};

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
const results = {};
try {
  const page = await browser.openPage(url);
  const press = async (code) => {
    await page.tap(code);
    await sleep(160);
  };
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await press('Space');
  await page.waitFor(sceneIs('base'), { timeoutMs: 60_000 });
  await page.waitFor(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, { what: 'the starter' });
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  // A vault with something on Bill's barter table, as a player back from a few raids has.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.raidProgress, { firstContractExtracted: true });
    save.stash.items = { potion: 4, 'poke-ball': 4, 'parts-crate': 3, 'cable-coil': 2, 'mooring-rope': 1, 'lamp-oil': 1, money: 300 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  // A fresh page, as a player coming back to the game opens it.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await press('Space');
  await page.waitFor(sceneIs('base'), { timeoutMs: 60_000 });
  await sleep(1500);
  // A slower machine than this one, as the captain's laptop is, once the game has loaded.
  if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.evaluate(WATCH);

  const measure = async (name) => {
    const asked = pictures.length;
    await sleep(60);
    if (shots) await page.screenshot(`${shots}/${name}-at-open.png`);
    await sleep(3000);
    results[name] = { ...JSON.parse(await page.evaluate('window.__menuSprites.done()')), picturesFetched: pictures.length - asked };
    if (shots) await page.screenshot(`${shots}/${name}-settled.png`);
    console.log(`${name.padEnd(18)} ${JSON.stringify(results[name])}`);
  };

  const before = pictures.length;
  await walkIntoBase(page, 'bills-cottage');
  results.walk = pictures.length - before;
  await measure('bill-first-open');
  await press('Escape');
  await sleep(500);
  await page.evaluate('window.__menuSprites.reset()');
  await press('Space');
  await page.waitFor(sceneIs('hub'));
  await measure('bill-second-open');
  await press('Escape');
  await sleep(500);
  await page.evaluate('window.__menuSprites.reset()');
  await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('extraction', { report: ${JSON.stringify(report)} })`);
  await page.waitFor(`Boolean(document.querySelector('#screens .menu-overlay [data-continue]'))`, { what: 'the result' });
  await measure('extraction-open');
} finally {
  await browser.close();
  server.close();
}
