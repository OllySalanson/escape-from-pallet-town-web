// THE BOLTHOLE carries the player's name and never asks for one at its door
// (`src/game/home/houseName.ts`). Played twice, both on the same page:
//
//   new      - a new game with no name on the device: the door says THE
//              BOLTHOLE, and walking in asks nothing.
//   existing - a save with raids behind it and a name already chosen (MISTY):
//              the door says MISTY’S BOLTHOLE from the first look, the name is
//              kept as it was, and walking in asks nothing.
//
//   node tools/playtest/houseName.mjs <url> <out dir> [--look]
//
// `--look` photographs and reports without failing, for the picture of how it
// was before (the house asking the name at its door). Pictures land in
// `<out dir>/{new,existing}-{yard,inside}.png` (`docs/screens/house-name/`).
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const lookOnly = args.includes('--look');
const NAME_KEY = 'escape-from-pallet-town.player.name';
mkdirSync(out, { recursive: true });

const BASE = `${GAME}.scene.getScene('base')`;
const state = () =>
  `(() => { const b = ${BASE}; const live = b && b.sys.isActive() && b.ready && !b.leaving;
    return { live: !!live, room: live && b.room ? b.room.id : null, tile: live ? b.currentTile : null,
      asked: !!document.querySelector('[data-name-field]') }; })()`;
const firstStep = (goals) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const goals = ${JSON.stringify(goals)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
  if (at(s.x, s.y)) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || (!at(nx, ny) && b.isBlocked({ x: nx, y: ny }))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

const faults = [];
const expectThat = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  const walkTo = async (goals, done = async () => false) => {
    for (let guard = 0; guard < 160; guard += 1) {
      if (await done()) return;
      const key = await page.evaluate(firstStep(goals));
      if (key === 'here') return;
      if (key === 'unreachable') {
        if (await done()) return;
        throw new Error(`nothing reaches ${JSON.stringify(goals)}`);
      }
      if (key) await press(key);
      else await sleep(150);
    }
    throw new Error(`gave up walking to ${JSON.stringify(goals)}`);
  };
  const doorCaption = async () =>
    (await page.evaluate(`${BASE}.worldLabels.map((label) => label.label.text)`)).find((text) => /BOLTHOLE/.test(text.split('\n')[0])) ?? null;
  const intoTheGame = async () => {
    await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
    await press('Space');
    await page.waitFor(sceneIs('base'), { timeoutMs: 60000 });
  };
  /** Up to the house's front, a photograph with its caption up, then in through the door. */
  const visitTheHouse = async (pass) => {
    await page.waitFor(`(() => { const s = ${state()}; return s.live && s.room === null; })()`, { what: 'the yard', timeoutMs: 60000 });
    const door = await page.evaluate(`${BASE}.doors.find((d) => d.id === 'bolthole')`);
    // One row below the step, where the door's caption speaks without the
    // door taking the player in.
    await walkTo([{ x: door.returnTo.x, y: door.returnTo.y + 1 }]);
    await sleep(900);
    await page.screenshot(`${out}/${pass}-yard.png`);
    const caption = await doorCaption();
    await walkTo(door.tiles, async () => (await page.evaluate(state())).room === 'bolthole');
    await page.waitFor(`(() => { const s = ${state()}; return s.live && s.room === 'bolthole'; })()`, { what: 'inside the house', timeoutMs: 60000 });
    await sleep(1200);
    await page.screenshot(`${out}/${pass}-inside.png`);
    return { caption, asked: (await page.evaluate(state())).asked };
  };

  // A new player: nobody has a name on this device yet.
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`(() => { localStorage.removeItem('${NAME_KEY}'); localStorage.removeItem('${SAVE_KEY}'); })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await intoTheGame();
  await page.waitFor(`${BASE}?.takeStarterForDriver?.('charmander') === true`, { timeoutMs: 60000 });
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`, { timeoutMs: 60000 });
  const fresh = await visitTheHouse('new');
  console.log(`new: door "${fresh.caption?.replace('\n', ' / ')}", asked at the door: ${fresh.asked}`);
  expectThat(fresh.caption?.split('\n')[0] === 'THE BOLTHOLE', 'a new player’s house is THE BOLTHOLE until there is a name');
  expectThat(!fresh.asked, 'a new player walks into the house without being asked a name');

  // An existing save: raids behind it, and a name chosen before.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 3, extracted: 2, wiped: 1 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
    localStorage.setItem('${NAME_KEY}', 'MISTY'); })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await intoTheGame();
  const kept = await visitTheHouse('existing');
  console.log(`existing: door "${kept.caption?.replace('\n', ' / ')}", asked at the door: ${kept.asked}`);
  expectThat(kept.caption?.split('\n')[0] === 'MISTY’S BOLTHOLE', 'an existing player’s house carries the name they chose');
  expectThat((await page.evaluate(`localStorage.getItem('${NAME_KEY}')`)) === 'MISTY', 'the name chosen before is kept as it was');
  expectThat(!kept.asked, 'an existing player walks into the house without being asked a name');
} finally {
  await browser.close();
}
if (faults.length > 0 && !lookOnly) {
  throw new Error(`${faults.length} broken: ${faults.join('; ')}`);
}
