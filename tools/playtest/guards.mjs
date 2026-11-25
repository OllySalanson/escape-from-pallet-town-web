// A guard, played the way a player meets one (`src/game/world/guards.ts`):
// deploy into Greystone Vale, walk up to the Gastly sat on the Sailors' Rest in
// Gull Strand, and check every beat of it - it watches from three tiles (the
// hint line names it), it comes at the step beside it with the mark and its
// line, a fight fled leaves it sat where it was and the next step in brings it
// on again, and a fight won takes it off the map so the grave can be worked.
//
//   node tools/playtest/guards.mjs <url> <out dir> [--real]
//
// <url> is a test-mode build for a screenshot session (`README.md`, "Memory");
// the dev server works for a logic check.
//
// Screenshots of the watch, the charge, the fight and the open grave land in
// <out dir>. It deploys at the Stepping Stones with a Lv 12 Squirtle, whose
// Bubble is what a Ghost cannot shrug off.
import { mkdirSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
if (!base || !outDir) throw new Error('usage: guards.mjs <dev server url> <out dir> [--real]');
mkdirSync(outDir, { recursive: true });
const real = args.includes('--real');
const url = new URL(base);
if (!real) url.searchParams.set('testmode', 'pixels');

// Read off the map once the raid is up: where the Sailors' Rest's guard sits, and the grave.
let GUARD = null;
let GRAVE = null;
const browser = await launchBrowser({ window: PIXEL_WINDOW });
const WORLD = `${GAME}.scene.getScene('world')`;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const page = await browser.openPage('about:blank');
if (real) await page.send('Page.bringToFront');
try {
  const wait = (ms) =>
    real
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await wait(60);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const dialog = async () => {
    for (let i = 0; i < 40; i += 1) {
      const line = await page.evaluate(
        `(() => { const box = ${WORLD}.dialogBox; if (!box.visible) return { text: null }; return { text: box.textObject.text, done: box.isCurrentMessageComplete }; })()`,
      );
      if (line.text === null || line.done) return line.text;
      await wait(100);
    }
    throw new Error('a line never finished typing');
  };
  const clearDialog = async () => {
    for (let i = 0; i < 20 && (await dialog()) !== null; i += 1) {
      await press('Space');
      await wait(300);
    }
  };
  const tile = () => page.evaluate(`({ ...${WORLD}.currentTile })`);
  /** The Sailors' Rest's guard, found by where it stands. */
  const GUARD_ID = () => `${WORLD}.guardsHere().find((g) => g.position.x === ${GUARD.x} && g.position.y === ${GUARD.y})`;
  const guardStands = () => page.evaluate(`${WORLD}.guardsHere().some((g) => g.position.x === ${GUARD.x} && g.position.y === ${GUARD.y})`);
  const battle = () => page.evaluate(`${GAME}.describe().scene.battle ?? null`);

  /** Steps, a key at a time, along the shortest walk to `to` that keeps off every tile `avoid` names. */
  const walkTo = async (to, avoid = []) => {
    const path = await page.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, H = c.length, W = c[0].length;
      const avoid = new Set(${JSON.stringify(avoid.map((t) => `${t.x},${t.y}`))});
      const sides = [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']];
      const s = w.currentTile, id = (x, y) => y * W + x; const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
      while (queue.length) { const [x, y] = queue.shift();
        if (x === ${to.x} && y === ${to.y}) { const path = []; let cur = [x, y]; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; path.unshift(p[2]); cur = [p[0], p[1]]; } return path; }
        for (const [dx, dy, k] of sides) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || avoid.has(nx + ',' + ny) || w.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      return null; })()`);
    if (!path) throw new Error(`no walk to ${to.x},${to.y}`);
    for (const key of path) await step(key);
  };
  /** One step, fighting through anything the grass throws up on the way. */
  const step = async (key) => {
    // A tap, not a hold: a key held across a stepped frame walks on a tile.
    await page.keyDown(key);
    await page.keyUp(key);
    await wait(300);
    if (await page.evaluate(`Boolean(${WORLD}.cutscene) || ${WORLD}.pendingWildBattle !== undefined`)) return;
    await clearDialog();
    if (await page.evaluate(sceneIs('battle'))) await fightOut();
  };
  const fightOut = async () => {
    for (let i = 0; i < 400 && (await page.evaluate(sceneIs('battle'))); i += 1) {
      if (await page.evaluate(`Boolean(document.querySelector('.move-chooser, [data-move-chooser]'))`)) await press('Escape');
      else await press('Space');
      await wait(300);
    }
    console.log(JSON.stringify(await page.evaluate(`(() => { const d = ${GAME}.describe(); return { scenes: d.scenes, busy: d.busy, battle: d.scene.battle, menu: d.menu && d.menu.title }; })()`)));
    await until(sceneIs('world'), 'the world after a fight');
    await wait(600);
    await clearDialog();
  };
  /** Into the fight a charge queued, through its line. */
  const intoTheFight = async () => {
    for (let i = 0; i < 20 && !(await page.evaluate(sceneIs('battle'))); i += 1) {
      await press('Space');
      await wait(300);
    }
    await until(sceneIs('battle'), 'the guard’s fight');
    for (let i = 0; i < 60; i += 1) {
      const view = await battle();
      if (view?.commands?.length > 0 && view.mode === 'main') return;
      if (view?.message?.complete) await press('Space');
      await wait(300);
    }
    throw new Error(`never saw the command menu: ${JSON.stringify(await battle())}`);
  };
  /** Moves the battle cursor onto the command starting `label` and presses it. */
  const pick = async (label) => {
    const target = (await battle()).commands.findIndex((text) => text.toUpperCase().startsWith(label.toUpperCase()));
    if (target < 0) throw new Error(`no ${label} in ${JSON.stringify((await battle()).commands)}`);
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown']) {
      if ((await battle())?.cursor === target) break;
      await press(key);
      await wait(150);
    }
    await wait(500);
    await press('Space');
    await wait(400);
  };
  /** Bubble until the fight is over, reading every line between. */
  const emberOut = async () => {
    for (let i = 0; i < 200 && (await page.evaluate(sceneIs('battle'))); i += 1) {
      const view = await battle();
      if (view?.mode === 'main' && view.commands?.length > 0) await pick('FIGHT');
      else if (view?.commands?.some((text) => text.toUpperCase().startsWith('BUBBLE'))) await pick('BUBBLE');
      else {
        await press('Space');
        await wait(300);
      }
    }
    await until(sceneIs('world'), 'the world after beating it');
    await wait(600);
    await clearDialog();
  };
  /** RUN until it works: the menu says the odds ("RUN 46%"), and a failed try is a turn. */
  const runAway = async () => {
    for (let attempt = 0; attempt < 30 && (await page.evaluate(sceneIs('battle'))); attempt += 1) {
      const view = await battle();
      if (view?.mode === 'main' && view.commands?.length > 0) await pick('RUN');
      else {
        await press('Space');
        await wait(300);
      }
    }
    await until(sceneIs('world'), 'the world after running');
    await wait(600);
    await clearDialog();
  };

  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait,
    paused: !real,
    insertion: 'greystone-vale-stepping-stones',
    // A Squirtle at the level Misty's Gym Guide asks for, which is where a
    // player meeting this guard is: Bubble is what gets through a Ghost.
    starter: 'Squirtle',
    level: 12,
    pack: ['potion:0'],
  });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await clearDialog();
  ({ guard: GUARD, grave: GRAVE } = await page.evaluate(`(() => { const map = ${WORLD}.currentMap;
    const guard = map.entities.find((e) => e.guards?.name === 'Sailors’ Rest');
    return { guard: guard.position, grave: map.pois.find((p) => p.id === guard.guards.poiId).position }; })()`));

  // -- From across the yard: it watches, and the hint line says what it guards
  const reach = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) reach.push({ x: GUARD.x + dx, y: GUARD.y + dy });
  // Two steps south of it, in the front of the yard, one step short of its
  // square: the walk in is north.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const at = await tile();
    if (at.x === GUARD.x && at.y === GUARD.y + 2) break;
    await walkTo({ x: GUARD.x, y: GUARD.y + 2 }, reach);
  }
  console.log(`at ${JSON.stringify(await tile())}, ${await page.evaluate(`${WORLD}.currentMap.id`)}`);
  check(await guardStands(), 'the Gastly stands guard on the Sailors’ Rest');
  await wait(300);
  const hint = await page.evaluate(`${WORLD}.hintShown`);
  check(hint === 'GASTLY Lv 12 GUARDS SAILORS’ REST', `three steps off, the hint line names it and its level ("${hint}")`);
  // It hops while it watches: its icon leaves the ground within a hop cycle.
  const heights = [];
  for (let i = 0; i < 8; i += 1) {
    heights.push(await page.evaluate(`${WORLD}.npcSprites.get(${GUARD_ID()}.id).y`));
    await wait(100);
  }
  check(new Set(heights).size > 1, `it hops on the spot while it watches (${heights.join(',')})`);
  const caption = await page.evaluate(`${GAME}.describe().texts.map((t) => t.text).join(' | ')`);
  check(caption.includes('GASTLY Lv 12 HAS A WATER STONE'), 'the grave’s caption says what the Gastly has');
  await page.screenshot(`${outDir}/guard-watching.png`);

  // -- The step beside it: the mark, the lunge, its line, and the fight -----
  await step('ArrowUp');
  const charged = await page.evaluate(`({ cutscene: Boolean(${WORLD}.cutscene), wild: ${WORLD}.pendingWildBattle ?? null })`);
  check(charged.cutscene && charged.wild?.guard !== undefined && charged.wild?.speciesId === 'gastly', `the step beside it starts its charge (${JSON.stringify(charged.wild)})`);
  await wait(200);
  await page.screenshot(`${outDir}/guard-charge-mark.png`);
  const line = await (async () => {
    for (let i = 0; i < 30; i += 1) {
      const text = await dialog();
      if (text) return text;
      await wait(100);
    }
    return null;
  })();
  check(Boolean(line?.includes('GASTLY')), `it cries ("${line}")`);
  await page.screenshot(`${outDir}/guard-charge-line.png`);
  await press('Space');
  await wait(300);
  const second = await dialog();
  check(Boolean(second?.includes('guarding SAILORS’ REST')), `and says what it guards ("${second}")`);
  await page.screenshot(`${outDir}/guard-charge-says.png`);
  await intoTheFight();
  const foe = await battle();
  check(/gastly/i.test(JSON.stringify(foe?.foe)), `the fight is the Gastly (${JSON.stringify(foe?.foe ?? null)})`);
  await page.screenshot(`${outDir}/guard-fight.png`);

  // -- Fled from, it is still sat there, and the next step in brings it on ---
  await runAway();
  check(await guardStands(), 'fled from, it still guards the grave');
  const after = await tile();
  console.log(`back at ${after.x},${after.y}`);
  await wait(500);
  check(!(await page.evaluate(`Boolean(${WORLD}.cutscene) || ${WORLD}.pendingWildBattle !== undefined`)), 'standing still beside it after a flee starts nothing');
  // The way round it the first critic found: back beside it, press SPACE at
  // anything. The hint line says what SPACE does there.
  await wait(300);
  const besideHint = await page.evaluate(`${WORLD}.hintShown`);
  check(besideHint === '[SPACE] FIGHT GASTLY Lv 12', `beside it, the hint line offers the fight SPACE starts ("${besideHint}")`);
  await press('Space');
  await wait(300);

  check(await page.evaluate(`${WORLD}.pendingWildBattle?.speciesId === 'gastly'`), 'SPACE pressed within its reach brings it on, rather than working what is faced');
  const again = await (async () => {
    for (let i = 0; i < 30; i += 1) {
      const text = await dialog();
      if (text) return text;
      await wait(100);
    }
    return null;
  })();
  check(again === 'The GASTLY will not let you near SAILORS’ REST!', `come at again, it says only that ("${again}")`);
  await intoTheFight();
  await runAway();
  check(await page.evaluate(`!${WORLD}.bag.count('water-stone')`), 'running from it twice has taken nothing from the grave');
  await step('ArrowLeft');
  check(await page.evaluate(`${WORLD}.pendingWildBattle?.speciesId === 'gastly'`), 'the next step within its reach brings it on again');

  // -- Beaten, it is gone, and the grave can be worked -----------------------
  await intoTheFight();
  await emberOut();
  check(!(await guardStands()), 'beaten, it is gone for the raid');
  // emberOut cleared the lines on the way back; the event log has what was said.
  const said = await page.evaluate(`JSON.stringify(${GAME}.eventLog(0))`);
  check(said.includes('has given up SAILORS’ REST, and the WATER STONE it was sitting on!'), 'back from the win, it says what it has given up');
  await walkTo(GRAVE);
  await wait(800);
  const searching = await page.evaluate(`Boolean(${WORLD}.search)`);
  check(searching || (await page.evaluate(`${WORLD}.activatedPoiIds.size > 0`)), 'the Sailors’ Rest is worked once it is beaten');
  await wait(4000);
  await page.screenshot(`${outDir}/guard-grave-open.png`);
  await press('Space');
  await wait(4000);
  await clearDialog();
  check(await page.evaluate(`${WORLD}.bag.count('water-stone') === 1`), 'and the Water Stone the Gastly sat on is in the pack');
} finally {
  await page.close();
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('a guard played end to end');
