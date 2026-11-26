// Photographs the stage a raid that got out opens on (`ExtractionScene`'s
// moment, `run/resultMoment.ts`) for four raids - a haul, a catch, a job done
// and an empty one - on a save that has been on one raid, so Oak's next job is
// on its card. It opens the screen on a report made here rather than playing a
// raid, and checks that everything on the stage is inside the window.
//
//   node tools/playtest/resultMoment.mjs <test-mode build dir> <out dir> [--window=1280x800] [--clip]
//
// `--clip` also records the haul's stage playing in, a frame every 100ms, as
// one animated PNG at half size, and every fourth frame as a picture of its own.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { animatedPng, decodePng } from './apng.mjs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [dist, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const clip = args.includes('--clip');
if (!dist) throw new Error('resultMoment: name a test-mode build directory');
mkdirSync(out, { recursive: true });

const BASE = '/escape-from-pallet-town-web/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const relative = normalize(path.slice(BASE.length) || 'index.html');
  try {
    const body = await readFile(join(dist, relative));
    response.writeHead(200, { 'content-type': TYPES[extname(relative)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${BASE}?testmode=pixels`;

const group = (pokemon, items) => ({ pokemon, items });
const item = (itemId, label, quantity) => ({ itemId, label, quantity });
const pidgey = { name: 'Pidgey', dexId: 16, level: 7, currentHp: 21, maxHp: 21 };
const common = {
  outcome: 'ESCAPED', summary: '', clockLabel: '2:38 used of 3:00', elapsedMs: 158000, durationMs: 180000, haulTier: 'light',
  ledgerHeading: 'Banked', ledgerEmptyText: 'Nothing was banked.', secured: group([], []), risked: group([], []), gambleVerdict: '',
  securedEmptyText: '', spent: [], dropped: [], progress: [], progressSummary: null, gear: [], gearSummary: null, pack: null,
  packSummary: null, pressure: [], baseNote: null, saved: true, headline: 'YOU WALKED OUT.',
};
const haul = [item('money', 'Pokédollars', 10), item('mooring-rope', 'Mooring rope', 1), item('lamp-oil', 'Lamp oil', 1)];
const REPORTS = {
  // The captain's raid of 26 Nov 2026.
  haul: { ...common, eyebrow: 'Extracted · Deer Gap', closeCall: 'OUT WITH 0:22 LEFT', ledger: group([], haul), ledgerFound: group([], haul), ledgerPaid: group([], []) },
  catch: {
    ...common, eyebrow: 'Extracted · Mere Path', elapsedMs: 96000,
    ledger: group([pidgey], [item('money', 'Pokédollars', 140), item('super-potion', 'Super Potion', 2)]),
    ledgerFound: group([pidgey], [item('money', 'Pokédollars', 140), item('super-potion', 'Super Potion', 2)]),
    ledgerPaid: group([], []),
    progress: [{ name: 'Bulbasaur', dexId: 1, fromLevel: 6, toLevel: 7, experienceGained: 80, experienceToNextLevel: 40 }],
  },
  job: {
    ...common, eyebrow: 'Extracted · Millbrook', elapsedMs: 121000, closeCall: 'OUT WITH A HUNTER ON YOUR TAIL',
    contract: { description: 'Sealed dispatch', complete: true, reward: 'A Great Ball' },
    ledger: group([], [item('money', 'Pokédollars', 260), item('great-ball', 'Great Ball', 1), item('radio-valve', 'Radio valve', 2), item('potion', 'Potion', 3), item('cable-coil', 'Cable coil', 1), item('thunder-stone', 'Thunder Stone', 1), item('linen-roll', 'Linen roll', 1)]),
    ledgerFound: group([], [item('money', 'Pokédollars', 200), item('radio-valve', 'Radio valve', 2), item('potion', 'Potion', 3), item('cable-coil', 'Cable coil', 1), item('thunder-stone', 'Thunder Stone', 1), item('linen-roll', 'Linen roll', 1)]),
    ledgerPaid: group([], [item('money', 'Pokédollars', 60), item('great-ball', 'Great Ball', 1)]),
  },
  empty: { ...common, eyebrow: 'Extracted · Deer Gap', haulTier: 'empty', elapsedMs: 40000, ledger: group([], []), ledgerFound: group([], []), ledgerPaid: group([], []) },
};

/** Anything on the stage drawn outside the window, or outside the stage. */
const ESCAPED = `(() => {
  const stage = document.querySelector('[data-moment-stage]');
  if (!stage) return ['no stage'];
  const box = stage.getBoundingClientRect();
  return [...stage.querySelectorAll('.moment-hero, .moment-stats, .moment-home, .moment-next')]
    .filter((node) => { const r = node.getBoundingClientRect(); return r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5 || r.right > box.right + 0.5; })
    .map((node) => node.className);
})()`;

const browser = await launchBrowser({ window: { width, height } });
let faults = 0;
try {
  const page = await browser.openPage(url);
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.tap('Space');
  await page.waitFor(sceneIs('base'), { timeoutMs: 60_000 });
  await page.waitFor(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, { what: 'the starter' });
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  // One raid behind it, so Oak's next thing is the first job.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  for (const [name, report] of Object.entries(REPORTS)) {
    await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('extraction', { report: ${JSON.stringify(report)} })`);
    await page.waitFor(`Boolean(document.querySelector('#screens .menu-overlay [data-continue]'))`, { what: `the ${name} result` });
    if (clip && name === 'haul') {
      const frames = [];
      for (let at = 0; at < 30; at += 1) {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 0.5 } });
        frames.push(decodePng(Buffer.from(data, 'base64')));
        if (at % 4 === 0) writeFileSync(`${out}/${name}-frame-${String(at * 100).padStart(4, '0')}ms.png`, Buffer.from(data, 'base64'));
        await sleep(100);
      }
      writeFileSync(`${out}/${name}-clip.png`, animatedPng(frames));
    }
    await sleep(3500);
    await page.screenshot(`${out}/${name}-${width}x${height}.png`);
    const escaped = JSON.parse(await page.evaluate(`JSON.stringify(${ESCAPED})`));
    const words = await page.evaluate(`document.querySelector('[data-moment-stage]')?.innerText.replace(/\\s+/g, ' ').trim()`);
    console.log(`${name.padEnd(6)} ${words}`);
    for (const each of escaped) {
      faults += 1;
      console.log(`  FAULT drawn off the stage: ${each}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (faults > 0) process.exit(1);
