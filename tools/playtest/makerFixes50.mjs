// Playtest 50's map maker and playtest-mode findings, played in the real game:
// the maker's layout (DRAFTS, FIT, the overview over a map that nearly fits),
// OPEN FILE, the help lines, leaving a WALK IT with Escape, the walk tick
// through a change that changes the walk, and the explorer run's PLAYTEST
// BOARD (a real board with its own caption, nothing over the Pokémon Center's)
// with its UPSTAIRS row asking nobody's name.
//
//   nice -n 15 node tools/playtest/makerFixes50.mjs <test-mode build url> <out dir> [--port=N] [--only=a,b]
//
// Prints PASS or FAIL per check and exits non-zero on any FAIL.
import { mkdirSync, readFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, OPEN_PLANT_FOLDS as OPEN_FOLDS, sleep } from './browser.mjs';
import { GAME } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((a) => a.startsWith('--port='))?.slice('--port='.length);
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');
const runs = (name) => !only || only.includes(name);
const WINDOW = { width: 1280, height: 800 };
const STORE = 'escape-from-pallet-town.maker.v1';
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
mkdirSync(outDir, { recursive: true });
const sample = JSON.parse(readFileSync(new URL('../../src/maps/sample/sample-lane.json', import.meta.url), 'utf8'));

const results = [];
const report = (name, passed, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const { send, evaluate } = page;
  const shot = async (name) => {
    await page.screenshot(`${outDir}/${name}.png`);
    console.log('shot', name);
  };
  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const click = async (selector) => {
    const at = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element?.scrollIntoView({ block: 'nearest' }); const box = element?.getBoundingClientRect(); return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null; })()`);
    if (!at) throw new Error(`nothing on screen matches ${selector}`);
    await mouse(at.x, at.y);
    await sleep(400);
  };
  const clickTile = async (x, y) => {
    const at = await evaluate(`(() => { const canvas = document.querySelector('.map-maker canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = ${GAME}.scene.getScene('mapmaker').view; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
    await mouse(at.x, at.y);
    await sleep(400);
  };
  const maker = () => `${GAME}.scene.getScene('mapmaker')`;
  /** What the map window shows of the map, and whether the overview is up. */
  const layout = () =>
    evaluate(`(() => {
      const viewport = document.querySelector('.map-maker [data-viewport]');
      const map = document.querySelector('.map-maker canvas[data-map]');
      const overview = document.querySelector('.map-maker [data-overview]');
      const bar = document.querySelector('.map-maker [data-undo]')?.closest('.px-window');
      const v = viewport.getBoundingClientRect(), m = map.getBoundingClientRect();
      return {
        overview: overview ? !overview.hidden : false,
        overflowX: Math.round(Math.max(0, m.right - (v.left + viewport.clientWidth), v.left - m.left)),
        overflowY: Math.round(Math.max(0, m.bottom - (v.top + viewport.clientHeight), v.top - m.top)),
        scrollbarX: viewport.scrollWidth > viewport.clientWidth + 1,
        scrollbarY: viewport.scrollHeight > viewport.clientHeight + 1,
        zoom: ${maker()}.zoom,
        bar: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
        raw: { v: [v.left, v.top, viewport.clientWidth, viewport.clientHeight, v.width, v.height], m: [m.left, m.top, m.width, m.height], file: [${maker()}.view.width, ${maker()}.view.height] },
        status: document.querySelector('.map-maker .px-status, .map-maker [data-status]')?.innerText ?? '',
      };
    })()`);
  const openMaker = async (drafts, current) => {
    await send('Page.navigate', { url: url.href });
    await page.waitFor(`Boolean(${GAME}?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 90_000 });
    await evaluate(`(() => {
      ${drafts ? `localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify({ drafts, current }))});` : `localStorage.removeItem('${STORE}');`}
      window.__errors = [];
      window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
      ${GAME}.scene.getScene('title').scene.start('mapmaker');
    })()`);
    await page.waitFor(`Boolean(document.querySelector('.map-maker [data-stack]'))`);
    await sleep(1500);
  };

  if (runs('layout')) {
    await openMaker();
    await shot('01-maker-fresh');
    const fresh = await layout();
    await click('[data-panel="drafts"]');
    await sleep(800);
    const drafts = await layout();
    await shot('02-drafts-open');
    report('DRAFTS open keeps the bar one row', drafts.bar <= fresh.bar, `bar ${fresh.bar} -> ${drafts.bar}`);
    report('DRAFTS open puts no overview over a map that fits', !drafts.overview, JSON.stringify(drafts));
    await click('[data-panel="map"]');
    await sleep(600);
  }
  if (runs('fit')) {
    // A house with an inside: the OUTSIDE / inside chips stand over the map.
    await openMaker();
    await evaluate(OPEN_FOLDS);
    await click('[data-place="building"][data-building="house"]');
    await clickTile(10, 10);
    await click('[data-tool="select"]');
    await clickTile(11, 11);
    await click('[data-go-inside]');
    await sleep(800);
    await click('[data-area=""]');
    await sleep(800);
    const back = await layout();
    await shot('03-inside-back-outdoors');
    report('outdoors again, no overview over a map a row too tall', !back.overview, JSON.stringify(back));
    await click('[data-fit]');
    await sleep(900);
    const fitted = await layout();
    await shot('04-fit');
    report('FIT shows the whole map', fitted.overflowX === 0 && fitted.overflowY === 0, JSON.stringify(fitted));
  }
  if (runs('maker')) {
    const draft = { ...sample, maker: 'Probe' };
    await openMaker([{ key: 'probe', file: draft, updatedAt: 1 }], 'probe');
    const status = () => evaluate(`document.querySelector('.map-maker')?.innerText.match(/Opened[^\\n]*|[^\\n]*already in your drafts[^\\n]*|[^\\n]*damaged map file[^\\n]*/)?.[0] ?? ''`);
    // OPEN FILE of the very map already in the drafts, then of another map of the same name.
    await evaluate(`${maker()}.openFileText(${JSON.stringify(JSON.stringify(draft))}, 'sample-lane.json')`);
    await sleep(900);
    const again = await status();
    const count = await evaluate(`${maker()}.store.drafts.length`);
    report('opening the same map again opens that draft, and says so', count === 1 && /already in your drafts/.test(again), `${count} drafts; "${again}"`);
    await shot('20-open-same');
    const other = { ...draft, maker: 'Someone Else' };
    await evaluate(`${maker()}.openFileText(${JSON.stringify(JSON.stringify(other))}, 'sample-lane.json')`);
    await sleep(900);
    const opened = await status();
    const names = await evaluate(`${maker()}.store.drafts.map((d) => d.file.name)`);
    report('a different map of the same name opens as a new draft, named apart', new Set(names).size === names.length && /as a new draft/.test(opened), `${JSON.stringify(names)}; "${opened}"`);
    await shot('21-open-other');
    await evaluate(`${maker()}.openFileText(${JSON.stringify(JSON.stringify({ ...draft, name: 'Evil <b>' }))}, 'evil.json')`);
    await sleep(900);
    const broken = await status();
    report('a broken file says what is wrong', /may not use/.test(broken), `"${broken}"`);
    await shot('22-open-broken');
    // Help lines name things as names.
    const helps = await evaluate(`[...document.querySelectorAll('[data-help]')].map((e) => e.dataset.help).join(' | ')`);
    report('no "pokémon" or "rock smash" in lower case in a help line', !/a pokémon|rock smash rock|a pokémon center/.test(helps));
    // WALK IT, then Escape: asked, and back to the maker.
    await openMaker([{ key: 'probe', file: draft, updatedAt: 1 }], 'probe');
    await click('[data-try="walk"]');
    await page.waitFor(`Boolean(${GAME}.scene.getScene('world')?.sys?.isActive())`, { timeoutMs: 60_000 });
    await sleep(3000);
    await shot('23-walk-it');
    await page.tap('Escape');
    await sleep(800);
    await shot('24-escape-asks');
    const asked = await evaluate(`Boolean(${GAME}.scene.getScene('world').trainerPrompt)`);
    report('Escape in a WALK IT asks to go back to the maker', asked);
    await page.tap('ArrowRight');
    await sleep(200);
    await page.tap('Space');
    await page.waitFor(`Boolean(${GAME}.scene.getScene('mapmaker')?.sys?.isActive())`, { timeoutMs: 30_000 });
    await sleep(1500);
    await shot('25-back-in-maker');
    const said = await evaluate(`document.querySelector('.map-maker')?.innerText.includes('ended without leaving by an exit')`);
    report('back in the maker, told the walk did not count', said);
  }

  if (runs('checks')) {
    await openMaker();
    await click('[data-goto-field="data-map-maker"]');
    const focused = await evaluate(`document.activeElement?.hasAttribute('data-map-maker') ?? false`);
    const inView = await evaluate(`(() => { const f = document.querySelector('[data-map-maker]'); const p = f.closest('.px-scroll') ?? f.parentElement; const a = f.getBoundingClientRect(), b = p.getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; })()`);
    report('the first check takes you to Drawn by', focused && inView, `focused ${focused}, in view ${inView}`);
    await shot('26-drawn-by');
  }

  if (runs('board')) {
    // The explorer run, straight in from the address.
    const playtest = new URL(url.href);
    playtest.searchParams.set('playtest', '');
    await send('Page.navigate', { url: playtest.href });
    await page.waitFor(`Boolean(${GAME}?.scene?.getScene('base')?.sys?.isActive())`, { timeoutMs: 90_000 });
    await evaluate(`(() => { window.__errors = []; window.addEventListener('error', (event) => window.__errors.push(String(event.message))); })()`);
    await sleep(2500);
    await shot('10-playtest-landing');
    const base = `${GAME}.scene.getScene('base')`;
    const captions = () =>
      evaluate(`${base}.worldLabels.filter((label) => label.visible).map((label) => label.label.text)`).catch(() => []);
    const plate = await evaluate(`${base}.children.list.some((child) => child.type === 'Text' && child.text === 'PLAYTEST')`);
    report('no PLAYTEST plate nailed over the board', !plate);
    // Stood a step below the board, facing it: its caption speaks.
    await evaluate(`${base}.goTo({ savedGame: ${base}.freshGame(), at: { x: 18, y: 15 } }, 'confirm')`);
    await sleep(2500);
    await shot('11-board-caption');
    console.log('captions', JSON.stringify(await captions()));
    await evaluate(`${base}.readPlaytestBoard({ x: 18, y: 14 })`);
    await sleep(1200);
    await shot('12-board-open');
    await click('[data-board-row="room-bolthole-upstairs"]');
    await sleep(2500);
    await shot('13-upstairs');
    const asked = await evaluate(`Boolean(document.querySelector('.name-screen, [data-name-screen], .player-name'))`);
    report('UPSTAIRS from the board asks nobody YOUR NAME?', !asked);
    await evaluate(`${base}.goTo({ savedGame: ${base}.freshGame(), room: 'battle-arena' }, 'interiorEnter')`);
    await sleep(2500);
    await shot('14-battle-arena');
  }

  const errors = await evaluate('window.__errors ?? []');
  report('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
