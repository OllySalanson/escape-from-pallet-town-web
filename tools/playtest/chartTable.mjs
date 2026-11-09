// Plays the treasure map's lab half and the telescope's rumour rings
// (`src/game/treasure/chartTable.ts`, `src/game/base/rumourRings.ts`) in a
// browser something else started - this machine's own headless one - by its
// CDP port, photographing every beat:
//
//   node tools/playtest/chartTable.mjs <cdp port> <url> <out dir>
//   node tools/playtest/chartTable.mjs <cdp port> <url> <out dir> --save=raided.json
//
// With no `--save`: a new game that has pinned the bottled chart on MARLOW's
// board and heard two rumours (`--heard`), as a player a few days in has.
// Oak's CHART TABLE has the shore traced and a pencilled ring where the moor
// piece goes; his cork board has the rumours on scraps; and THE RAID ARENA's
// telescope has a chalk "?" over HIGH MOOR and GREYSTONE PEAKS.
//
// Then the raid, which finds THE LONG SHADOW at dusk and banks its piece:
//
//   node tools/playtest/raid.mjs <url> --attach=<port> --testmode --pixels --clock=dusk \
//     --hunt=shore --heard=board-long-shadow,angler-red-one --grab=chart-piece-1 --save-out=raided.json
//
// With `--save=raided.json`: home from that raid. The moor piece lies on the
// table in its own colours, the moor's ring is ticked off, the board's moor
// scrap is down, and pinning it at MARLOW's turns it to a tracing on the table.
import { attachBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const [port, url, out] = process.argv.slice(2);
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const HEARD = ['board-long-shadow', 'angler-red-one'];
mkdirSync(out, { recursive: true });
const browser = attachBrowser(Number(port), { window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
const fullUrl = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels`;
const log = (...words) => console.log(...words);
const press = async (code, after = 160) => {
  await page.tap(code, 60);
  await sleep(after);
};
const until = (expression, what, timeoutMs = 60_000) => page.waitFor(expression, { what, timeoutMs });
const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
const settled = `(() => { const b = ${GAME}.scene.getScene('base'); return ${sceneIs('base')} && b.ready && !b.leaving; })()`;
const inRoom = (id) => `${settled} && ${GAME}.scene.getScene('base').room?.id === ${JSON.stringify(id)}`;
let shot = 0;
const snap = async (name) => {
  shot += 1;
  const path = `${out}/${String(shot).padStart(2, '0')}-${name}.png`;
  await page.screenshot(path);
  log('shot', path);
};
const failures = [];
const expect = (what, ok, detail = '') => {
  log(ok ? 'ok  ' : 'FAIL', what, detail);
  if (!ok) failures.push(what);
};
const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);

/** Walks onto a tile, by key presses over the scene's own collision. */
async function walkTo(goals, label) {
  for (let guard = 0; guard < 600; guard += 1) {
    const move = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return { wait: true };
      const goals = ${JSON.stringify(goals)};
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      if (at(s.x, s.y)) return { arrived: true };
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift();
        if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return { unreachable: true, from: s, goals, room: b.room?.id ?? null };
      let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return { key }; })()`);
    if (move.unreachable) throw new Error(`cannot walk to ${label}: ${JSON.stringify(move)}`);
    if (move.arrived) return;
    if (move.wait) {
      await sleep(100);
      continue;
    }
    await page.tap(move.key, 60);
    await sleep(120);
  }
  throw new Error(`never got to ${label}`);
}

async function face(direction) {
  const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction];
  if ((await base('b.facing')) !== direction) await press(key, 250);
}

/** Presses past whatever is being said, answering NOT NOW to any question (YES with `yes`); with a `name`, photographs every page of it. */
async function readThrough(name, { yes = false } = {}) {
  for (let pageNo = 1; pageNo < 60; pageNo += 1) {
    const state = await base(`({ box: b.dialogBox.visible, question: Boolean(b.boxQuestion) })`);
    if (!state.box && !state.question) return;
    if (name) {
      await sleep(2200);
      await snap(`${name}-${pageNo}`);
    }
    if (state.question && !yes) await press('ArrowRight');
    await press('Space', 350);
  }
  throw new Error('the talking never stopped');
}

/** Out of whatever room the player is in, to the yard. */
async function toTheYard() {
  for (let guard = 0; guard < 4 && (await base('Boolean(b.room)')); guard += 1) {
    await walkTo([await base('b.room.mat ?? b.room.stairs[0].tile')], 'the way out');
    await press('ArrowDown', 900);
    await until(settled, 'out of the room');
    await readThrough();
  }
}

async function intoDoor(id) {
  const door = await base(`b.doors.find((d) => d.id === ${JSON.stringify(id)}).tiles`);
  await walkTo(door.map((tile) => ({ x: tile.x, y: tile.y + 1 })), `the step of ${id}`);
  for (let guard = 0; guard < 30 && !(await page.evaluate(inRoom(id))); guard += 1) {
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await press('Escape', 400);
      continue;
    }
    await press('ArrowUp', 400);
  }
  await until(inRoom(id), id);
  await sleep(900);
  await readThrough();
}

/** At Oak's chart table: the room, the table close to, and what is said at it. */
async function atTheTable(name) {
  await walkTo([{ x: 4, y: 6 }], 'in front of the chart table');
  await face('up');
  await sleep(1500);
  await snap(`${name}-lab`);
  await press('Space', 600);
  await readThrough(`${name}-table`);
}

/** Looks through the east telescope, closer once, and points at every ring's mark. */
async function throughTheTelescope(name) {
  const stance = await base(`({ ...b.arenaTelescopes[1].stance })`);
  await walkTo([stance], 'the telescope');
  await face('up');
  await sleep(400);
  await press('Space', 400);
  await until(`${GAME}.scene.getScene('base').telescope?.isOpen === true`, 'the glass');
  await sleep(1500);
  const canvas = await page.evaluate(
    `(() => { const c = ${GAME}.canvas.getBoundingClientRect(); const b = ${GAME}.scene.getScene('base'); return { x: c.left, y: c.top, scale: c.width / b.scale.width }; })()`,
  );
  const hover = (x, y) =>
    page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: canvas.x + x * canvas.scale, y: canvas.y + y * canvas.scale, button: 'none', buttons: 0 });
  // Off every light, so the whole map's first picture is the rings and not a card.
  await hover(4, 4);
  await sleep(1200);
  await snap(`${name}-telescope-whole`);
  const rings = await base(`b.telescope.source.rings.map((ring) => ({ district: ring.district, allFound: ring.allFound, x: ring.centre.x, y: ring.centre.y - ring.radius }))`);
  for (const level of ['whole', 'closer']) {
    if (level === 'closer') {
      await press('KeyZ', 900);
    }
    for (const ring of rings) {
      const at = await base(`(() => { const t = b.telescope; const s = t.source.scale; return t.rules.screenOf({ x: (${ring.x} + 0.5) * s, y: (${ring.y} + 0.5) * s }); })()`);
      if (at.x < 0 || at.y < 0 || at.x > (await base('b.scale.width')) || at.y > (await base('b.scale.height')) - 16) {
        continue;
      }
      await hover(at.x, at.y);
      await sleep(900);
      const card = await base('b.telescope.cardShown');
      expect(`${level}: the ${ring.district} ring's mark reads its rumours`, Boolean(card) && /RUMOUR|RUN TO GROUND/.test(card.title), JSON.stringify(card));
      await snap(`${name}-telescope-${level}-${ring.district.toLowerCase().replace(/[^a-z]+/g, '-')}`);
    }
  }
  await press('Escape', 900);
  await until(`!${GAME}.scene.getScene('base').telescope`, 'the hall again');
  return rings;
}

try {
  await page.send('Page.navigate', { url: fullUrl });
  await until(`${GAME}?.scene.getScenes(true).length > 0`, 'the game');
  if (option('save')) {
    // Home from the raid that found THE LONG SHADOW: it lands on the Arena's rim.
    await page.evaluate(`localStorage.setItem('${SAVE_KEY}', ${JSON.stringify(readFileSync(option('save'), 'utf8'))})`);
    await page.send('Page.navigate', { url: fullUrl });
    await until(sceneIs('title'), 'the title');
    await sleep(800);
    await press('Space');
    await until(settled, 'the harbour');
    await sleep(1200);
    await readThrough();
    const game = await saved();
    expect('the moor piece came home in the vault', (game.stash.items['chart-piece-1'] ?? 0) === 1);
    expect('and is written found', (game.raidProgress.secretsFound ?? []).includes('chart-piece-1'));
    if (!(await page.evaluate(inRoom('raid-arena')))) {
      await toTheYard();
      await intoDoor('raid-arena');
    }
    const rings = await throughTheTelescope('home');
    expect('the moor ring is ticked off', rings.find((ring) => ring.district === 'HIGH MOOR')?.allFound === true);
    expect('the peaks ring is still a question', rings.find((ring) => ring.district === 'GREYSTONE PEAKS')?.allFound === false);
    await toTheYard();
    await intoDoor('oaks-lab');
    await atTheTable('home');
    expect('the table says the piece is lying on it', (await base(`b.place.room.things.find((t) => t.name === 'THE CHART TABLE').note`)) === 'A torn chart lies on it');
    // The board: the moor's scrap is down, the tarn's is still up.
    await walkTo([{ x: 10, y: 2 }], 'in front of the board');
    await face('up');
    await sleep(800);
    await press('Space', 600);
    await readThrough('home-board');
    // MARLOW pins it, and the table traces it.
    await toTheYard();
    await intoDoor('great-library');
    await walkTo([{ x: 13, y: 2 }], 'the open bookcase');
    for (let tries = 0; tries < 4 && (await base(`b.room?.id`)) === 'great-library'; tries += 1) {
      await press('ArrowUp', 450);
    }
    await until(inRoom('chart-room'), 'THE CHART ROOM');
    await sleep(900);
    await walkTo([{ x: 5, y: 4 }], 'in front of the board');
    await face('up');
    await press('Space', 600);
    await readThrough('pinned', { yes: true });
    await until(settled, 'the room back');
    await sleep(700);
    await snap('pinned-board');
    expect('the moor piece is pinned', (await saved()).raidProgress.treasureHunt.pinned.includes('moor'));
    await walkTo([{ x: 0, y: 2 }], 'below the arch');
    await press('ArrowUp', 600);
    await until(inRoom('great-library'), 'the library');
    await toTheYard();
    await intoDoor('oaks-lab');
    await atTheTable('traced');
    expect('the table counts two traced', (await base(`b.place.room.things.find((t) => t.name === 'THE CHART TABLE').note`)) === '2 of 4 pieces traced');
  } else {
    await until(sceneIs('title'), 'the title');
    await page.evaluate('localStorage.clear()');
    await page.send('Page.navigate', { url: fullUrl });
    await until(sceneIs('title'), 'the title');
    await sleep(800);
    await press('Space');
    await until(settled, 'the lab');
    await page.evaluate(`${GAME}.scene.getScene('base').takeStarterForDriver('bulbasaur')`);
    await until(`${settled} && !${GAME}.scene.getScene('base').room`, 'the yard');
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
    // A few days in: the bottled chart on MARLOW's board, two rumours heard, a raid behind them.
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
      p.treasureHunt = { roomOpen: true, pinned: ['shore'], chestOpened: false };
      p.rumoursHeard = ${JSON.stringify(HEARD)};
      p.arenaIntroSeen = true;
      p.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: fullUrl });
    await until(sceneIs('title'), 'the title');
    await sleep(800);
    await press('Space');
    await until(settled, 'the harbour');
    await sleep(1000);
    await readThrough();
    await toTheYard();
    await intoDoor('oaks-lab');
    await atTheTable('before');
    expect('the table counts one traced', (await base(`b.place.room.things.find((t) => t.name === 'THE CHART TABLE').note`)) === '1 of 4 pieces traced');
    await walkTo([{ x: 10, y: 2 }], 'in front of the board');
    await face('up');
    await sleep(800);
    await snap('before-board-close');
    await press('Space', 600);
    await readThrough('before-board');
    await toTheYard();
    await intoDoor('raid-arena');
    const rings = await throughTheTelescope('before');
    expect('a ring over each district a rumour named', rings.map((ring) => ring.district).sort().join() === 'GREYSTONE PEAKS,HIGH MOOR', JSON.stringify(rings));
  }
} catch (error) {
  await page.screenshot(`${out}/failed.png`).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} failed: ${failures.join('; ')}`);
  process.exit(1);
}
