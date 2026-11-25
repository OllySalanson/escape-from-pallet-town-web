// The story after the Raid Arena, read in place: every raid starts at the Arena
// and rides home to its rim, and the Seagallop is the islands ferry. Walks a new
// save to the Seagallop's sailor, then a save with raids on record to the sailor
// again, the ferry's plate, the notice board, the Arena's sign, Oak's door, the
// old man on the green (by day), the Arena's trailer card, the Marshal and Bill's
// locker shelf, photographing every dialogue box and logging what it says.
//
//   node tools/playtest/storyLines.mjs <test-mode build url> <out dir> [--port=N]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const said = {};
const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const shoot = async (name) => {
    await step(2);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready && !${GAME}.scene.getScene('base').leaving`;

  const walkTo = async (goal, arrived) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await page.evaluate(arrived)) return;
      if (await base('Boolean(b.boxQuestion)')) {
        await press('ArrowRight');
        await press('Space');
        continue;
      }
      if (await base('b.dialogBox?.visible')) {
        await press('Space');
        continue;
      }
      const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.ready || b.leaving || b.targetTile) return 'wait';
        const goals = ${goal}, s = b.currentTile;
        const W = b.collision[0].length, H = b.collision.length, id = (x, y) => y * W + x, prev = new Map([[id(s.x, s.y), null]]), q = [[s.x, s.y]];
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { let cur = [x, y], k = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) return k; k = p[2]; cur = [p[0], p[1]]; } }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue; if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue; prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
        return 'none'; })()`);
      if (key === 'none') throw new Error(`nothing walks to ${goal}`);
      if (key && key !== 'wait') await press(key);
      await wait(120);
    }
    throw new Error(`never got to ${goal}`);
  };
  const walkToTile = async (tile) =>
    walkTo(JSON.stringify([tile]), `(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.targetTile && b.currentTile.x === ${tile.x} && b.currentTile.y === ${tile.y}; })()`);

  /** Walks beside what stands on `target` (an expression for a tile), faces it, presses and photographs every box. */
  const talkTo = async (name, target) => {
    const tile = await base(target);
    if (!tile) {
      console.log(`  (no ${name} here)`);
      return;
    }
    const fronts = `[[0,-1],[0,1],[-1,0],[1,0]].map(([dx, dy]) => ({ x: ${tile.x} + dx, y: ${tile.y} + dy })).filter((t) => !b.isBlocked(t))`;
    await walkTo(fronts, `(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.targetTile && Math.abs(b.currentTile.x - ${tile.x}) + Math.abs(b.currentTile.y - ${tile.y}) === 1; })()`);
    const at = await base('b.currentTile');
    const key = at.x < tile.x ? 'ArrowRight' : at.x > tile.x ? 'ArrowLeft' : at.y < tile.y ? 'ArrowDown' : 'ArrowUp';
    await press(key);
    await wait(200);
    await press('Space');
    said[name] = [];
    for (let box = 1; box < 12; box += 1) {
      await wait(300);
      for (let typing = 0; typing < 40 && (await base('b.describeForTest().dialogue?.complete === false')); typing += 1) await wait(100);
      await wait(200);
      const dialogue = await base('b.describeForTest().dialogue');
      if (!dialogue) break;
      said[name].push(dialogue.text);
      await shoot(`${name}-${box}`);
      if (await base('Boolean(b.boxQuestion)')) {
        await press('ArrowRight');
      }
      await press('Space');
    }
    console.log(`${name}: ${JSON.stringify(said[name])}`);
  };
  const person = (id) => `(() => { const p = b.describeForTest().near.people?.find((each) => each.name === '${id}'); return p ? p.tile : null; })()`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // A new save: the sailor, before any raid.
  await walkToTile({ x: 12, y: 18 });
  await talkTo('sailor-fresh', person('SAILOR'));

  // Raids on record (five out, three home), money and standing with Bill.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.traderMoneySpent = 5200; save.stash.items.money = 1000;
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 5, extracted: 3, wiped: 2 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour, continued');

  await walkToTile({ x: 12, y: 18 });
  await talkTo('sailor-raids', person('SAILOR'));
  await walkToTile({ x: 13, y: 21 });
  await wait(600);
  await shoot('ferry-plate');
  await talkTo('notice-board', '({ x: 18, y: 17 })');
  await talkTo('arena-sign', '({ x: 3, y: 14 })');
  const lab = await base(`b.doors.find((each) => each.id === 'oaks-lab').tiles[0]`);
  await walkToTile({ x: lab.x, y: lab.y + 2 });
  await wait(600);
  await shoot('lab-door');
  await walkToTile({ x: 55, y: 17 });
  await talkTo('old-man', person('OLD MAN'));

  // Through the Arena's door: its trailer, held on its last card.
  await walkTo(`b.room ? [] : b.doors.find((each) => each.id === 'raid-arena').tiles`, `${sceneIs('arenaIntro')} || (${baseReady} && ${GAME}.scene.getScene('base').room?.id === 'raid-arena')`);
  if (await page.evaluate(sceneIs('arenaIntro'))) {
    await wait(50_000);
    await shoot('trailer-card');
    await press('Space');
    await wait(1500);
  }
  await until(`${baseReady} && ${GAME}.scene.getScene('base').room?.id === 'raid-arena'`, 'the hall');
  await wait(1000);
  await talkTo('marshal', 'b.room.keeper.position');

  // Bill's locker shelf.
  await page.evaluate(`void ${GAME}.scene.getScene('base').scene.start('base', { from: 'raid-arena' })`);
  await wait(1500);
  await until(baseReady, 'the yard');
  await walkTo(`b.room ? [] : b.doors.find((each) => each.id === 'bills-cottage').tiles`, `(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.room?.id === 'bills-cottage'; })()`);
  await wait(600);
  await talkTo('bill-shelf', `(() => { const t = b.place.room.things.find((each) => each.good?.kind === 'berth'); return t ? t.tiles[0] : null; })()`);
  await page.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(said, null, 1));
