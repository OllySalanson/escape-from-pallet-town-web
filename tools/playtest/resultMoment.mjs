// Photographs the stage a raid that got out opens on (`ExtractionScene`'s
// moment, `run/resultMoment.ts`) for six raids - a haul, a catch, a job done,
// an empty one, a team of six and one the browser could not save - on a save that has been on one raid, so Oak's next job is
// on its card. It deploys into the vale and ends the raid there on a report
// made here, through the world's own hand-over, so the stage stands in the
// place the raid got out of; the others are opened on the same picture of
// the place. It checks that everything on the stage is inside the window, that
// the place was handed over, and that every find reached the chest.
//
//   node tools/playtest/resultMoment.mjs <test-mode build dir> <out dir> [--window=1280x800] [--clip] [--port=CDP port]
//
// `--clip` also records the haul's stage playing in, a frame every 100ms, as
// one animated PNG at half size, and every fourth frame as a picture of its own.
// `--port` uses a browser already running rather than starting one.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { animatedPng, decodePng } from './apng.mjs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

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
const pageUrl = url;

const group = (pokemon, items) => ({ pokemon, items });
const item = (itemId, label, quantity) => ({ itemId, label, quantity });
const pidgey = { name: 'Pidgey', dexId: 16, level: 7, currentHp: 21, maxHp: 21 };
// The team that walked out: one that grew a level, one most of the way through its own, one that earned nothing.
const mate = (name, dexId, level, fromLevel, barFrom, barTo) => ({ name, dexId, level, currentHp: 20, maxHp: 30, fromLevel, barFrom, barTo });
const team = [mate('Bulbasaur', 1, 13, 12, 0, 0.3), mate('Pikachu', 25, 10, 10, 0.2, 0.75), mate('Pidgey', 16, 8, 8, 0.4, 0.4)];
const pack = { itemId: 'raid-pack', name: 'Raid pack', squares: 18, fate: 'kept' };
const common = {
  outcome: 'ESCAPED', summary: '', clockLabel: '2:38 used of 3:00', elapsedMs: 158000, durationMs: 180000, haulTier: 'light',
  ledgerHeading: 'Banked', ledgerEmptyText: 'Nothing was banked.', secured: group([], []), risked: group([], []), gambleVerdict: '',
  securedEmptyText: '', spent: [], dropped: [], progress: [], progressSummary: null, gear: [], gearSummary: null, pack,
  packSummary: null, pressure: [], baseNote: null, saved: true, headline: 'YOU WALKED OUT.', team,
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
  // A full team of six, which closes up to stand in the room there is.
  six: {
    ...common, eyebrow: 'Extracted · High Moor', haulTier: 'loaded', elapsedMs: 80000, ledger: group([], haul), ledgerFound: group([], haul), ledgerPaid: group([], []),
    team: [...team, mate('Charmeleon', 5, 18, 17, 0, 0.5), mate('Gyarados', 130, 22, 22, 0.1, 0.6), mate('Butterfree', 12, 14, 14, 0.5, 0.9)],
  },
  // A raid the browser could not save: nothing went into the chest, so none is drawn.
  unsaved: { ...common, eyebrow: 'Extracted · Mere Path', haulTier: 'thin', elapsedMs: 70000, saved: false, ledger: group([], haul), ledgerFound: group([], haul), ledgerPaid: group([], []) },
};

/** How much slower the stage plays while it is recorded, and which frames of the recording are also kept as stills. */
const RECORD_RATE = 0.2;
const STILLS = [3, 6, 10, 14, 18, 24];

/** Anything on the stage drawn outside the stage, or over the padding it keeps clear at its head and foot. */
const ESCAPED = `(() => {
  const stage = document.querySelector('[data-moment-stage]');
  if (!stage) return ['no stage'];
  const box = stage.getBoundingClientRect();
  const style = getComputedStyle(stage);
  const top = box.top + parseFloat(style.paddingTop), bottom = box.bottom - parseFloat(style.paddingBottom);
  return [...stage.querySelectorAll('.moment-deed, .moment-haul, .moment-mate, .moment-mate img, .moment-stats, .moment-home, .moment-next, .moment-actions')]
    .filter((node) => { const r = node.getBoundingClientRect(); return r.top < top - 0.5 || r.bottom > bottom + 0.5 || r.left < box.left - 0.5 || r.right > box.right + 0.5; })
    .map((node) => node.className);
})()`;

/** What the stage shows once it has played: where it stands, who is on it and what reached the chest. */
const STAGE = `JSON.stringify((() => {
  const stage = document.querySelector('[data-moment-stage]');
  const game = ${GAME};
  return {
    inPlace: stage.classList.contains('is-in-place') && game.textures.exists('raid-result-place'),
    worldPixel: getComputedStyle(stage).getPropertyValue('--u').trim() === getComputedStyle(document.querySelector('#screens')).getPropertyValue('--world-px').trim(),
    mates: stage.querySelectorAll('.moment-mate').length,
    flights: stage.querySelectorAll('[data-stow-thing]').length,
    filled: stage.querySelectorAll('.moment-home-cell.is-in').length,
    stowed: stage.classList.contains('is-stowed'),
    chest: stage.querySelector('.moment-chest') !== null,
    fit: [...stage.classList].filter((name) => name.startsWith('is-tight')).join(' '),
    lidShut: Number.parseFloat(getComputedStyle(stage.querySelector('.moment-chest') ?? stage).backgroundPositionX) === 0,
  };
})())`;

const browser = option('port') ? attachBrowser(Number(option('port')), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
let faults = 0;
const fault = (why) => {
  faults += 1;
  console.log(`  FAULT ${why}`);
};
try {
  const page = await browser.openPage('about:blank');
  const until = (expression, what = expression) => page.waitFor(expression, { what, timeoutMs: 90_000 });
  const press = async (code, holdMs = 60) => {
    await page.keyDown(code);
    await sleep(holdMs);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`);
    await sleep(350);
  };
  // An attached browser keeps the last driver's save: start from none.
  await page.send('Page.navigate', { url: pageUrl });
  await until(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await deploy(page, pageUrl, { press, click, until, wait: sleep, insertion: 'greystone-vale-farmhouse', level: 12, starter: 'Bulbasaur', team: ['pikachu:10', 'pidgey:8'] });
  await until(sceneIs('world'), 'the raid');
  await sleep(1500);
  const world = `${GAME}.scene.getScene('world')`;
  for (let box = 0; box < 12 && (await page.evaluate(`${world}.dialogBox?.visible === true`)); box += 1) {
    await press('Space');
    await sleep(400);
  }
  // One raid behind it, so Oak's next thing is the first job.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  // The first report ends the raid by the world's own hand-over; the picture of
  // the place it hands over is kept for the reports after it.
  await page.evaluate(`(() => { const plugin = ${world}.scene; const start = plugin.start.bind(plugin);
    plugin.start = (key, data) => { window.__place = data?.place; return start(key, data); }; })()`);
  for (const [name, report] of Object.entries(REPORTS)) {
    const recording = clip && name === 'haul';
    if (recording) {
      // Slowed for the camera, the stylesheet's moves and the scene's own clock alike, never the game.
      await page.send('Animation.enable');
      await page.send('Animation.setPlaybackRate', { playbackRate: RECORD_RATE });
      await page.evaluate(`${GAME}.scene.getScene('extraction').time.timeScale = ${RECORD_RATE}`);
    }
    if (await page.evaluate(sceneIs('world'))) {
      await page.evaluate(`void ${world}.handOverWithThePlace(${JSON.stringify(report)})`);
    } else {
      await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('extraction', { report: ${JSON.stringify(report)}, place: window.__place })`);
    }
    await until(`Boolean(document.querySelector('#screens .menu-overlay [data-moment-stage]')) && document.querySelector('[data-moment-headline]')?.textContent.length > 0 && ${GAME}.scene.getScene('extraction').report.eyebrow === ${JSON.stringify(report.eyebrow)} && ${GAME}.scene.getScene('extraction').report.haulTier === ${JSON.stringify(report.haulTier)}`, `the ${name} result`);
    if (recording) {
      const frames = [];
      const stamps = [];
      const started = Date.now();
      let stowedAt = null;
      // Until the chest is shut and the bars and the card have had their second.
      while (frames.length < 60 && (stowedAt === null || Date.now() - stowedAt < 1100 / RECORD_RATE)) {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 0.5 } });
        frames.push(decodePng(Buffer.from(data, 'base64')));
        stamps.push(Date.now() - started);
        if (STILLS.includes(frames.length)) writeFileSync(`${out}/${name}-frame-${String(frames.length).padStart(2, '0')}.png`, Buffer.from(data, 'base64'));
        if (stowedAt === null && (await page.evaluate(`document.querySelector('[data-moment-stage]').classList.contains('is-stowed')`))) stowedAt = Date.now();
        await sleep(320);
      }
      await page.send('Animation.setPlaybackRate', { playbackRate: 1 });
      await page.evaluate(`${GAME}.scene.getScene('extraction').time.timeScale = 1`);
      // Each frame held as long as it stood, brought back to the game's own speed; the last one rests.
      const held = stamps.map((stamp, index) => (index + 1 < stamps.length ? Math.max(20, (stamps[index + 1] - stamp) * RECORD_RATE) : 2000));
      writeFileSync(`${out}/${name}-clip.png`, animatedPng(frames, held));
      console.log(`       recorded ${frames.length} frames over ${Math.round(stamps.at(-1) * RECORD_RATE)}ms of the game`);
    }
    // Played out: the chest is shut, and the bars and the card that follow it have had their second.
    await until(`document.querySelector('[data-moment-stage]').classList.contains('is-stowed')`, `the ${name} stage played out`);
    await sleep(1300);
    await page.screenshot(`${out}/${name}-${width}x${height}.png`);
    const escaped = JSON.parse(await page.evaluate(`JSON.stringify(${ESCAPED})`));
    const words = await page.evaluate(`document.querySelector('[data-moment-stage]')?.innerText.replace(/\\s+/g, ' ').trim()`);
    console.log(`${name.padEnd(6)} ${words}`);
    for (const each of escaped) fault(`drawn off the stage: ${each}`);
    const stage = JSON.parse(await page.evaluate(STAGE));
    console.log(`       ${JSON.stringify(stage)}`);
    if (!stage.inPlace) fault('the stage does not stand in the place the raid got out of');
    if (!stage.worldPixel) fault("the stage is not drawn in the world's pixel");
    if (stage.mates < report.team.length) fault(`only ${stage.mates} of the team are on the stage`);
    if (stage.filled !== stage.flights) fault(`${stage.flights} things flew and ${stage.filled} squares filled`);
    if (!stage.stowed || !stage.lidShut) fault('the chest was left open');
    if (stage.chest !== report.saved) fault(report.saved ? 'no chest is drawn' : 'a chest is drawn for a raid that was not saved');
    console.log(`       fitted: ${stage.fit || 'at full size'}`);
  }
} finally {
  await browser.close();
  server.close();
}
if (faults > 0) process.exit(1);
