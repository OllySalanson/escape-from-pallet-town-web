// Stormcrown, played the way a raid gets there: the explorer run dropped at
// Gull Strand, into the sea cave onto the Greystone Caves' B4F, across it to the
// hole in its far corner, down to B5F, across the deepest floor to the Chimney,
// up the mountain round its three crags, a fight with Mew by the cairn and its
// one throw, and out over the top by the Cloud Stair
// (`docs/screens/greystone-vale/README.md`, "Stormcrown").
//
//   node tools/playtest/stormcrown.mjs <dev server url> <out dir> [--port=N] [--real]
//
// The walk is planned over the scene's own collision and its own links, so a
// way through a door or down a hole is pressed into exactly as a player
// presses into it, and planned again after every step (the hunter and wild
// fights move things). It fails if a place on the way is never reached, if
// Mew does not fight as a legend - no ball while it can fight, one throw once
// it is beaten - or if the raid does not end by the Cloud Stair.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = option('port');
if (!base || !outDir) throw new Error('usage: stormcrown.mjs <dev server url> <out dir> [--port=N] [--real]');
mkdirSync(outDir, { recursive: true });
const real = args.includes('--real');
const url = new URL(base);
if (!real) url.searchParams.set('testmode', 'pixels');

// Stormcrown is the vale's cell [1, -1]: 128 tiles in from the map's west edge,
// on its north edge (`plan.ts`, `districtRect`).
const STORMCROWN = { x: 128, y: 0 };
const local = (x, y) => ({ x: STORMCROWN.x + x, y: STORMCROWN.y + y });
const CHIMNEY_FOOT = local(24, 55);
const BESIDE_MEW = local(28, 4);
const SHELTER = local(52, 27);

// A map's links are a table keyed by a tile's index and the way pressed
// (`linkTable` in gridMovement.ts); read back as rows a walk can follow.
const LINKS = `((w) => { const W = w.collisionData[0].length; const ways = ['up', 'down', 'left', 'right'];
  return [...(w.currentMap.links ?? new Map())].map(([key, to]) => { const tile = Math.floor(key / 4);
    return { from: { x: tile % W, y: Math.floor(tile / W) }, toward: ways[key % 4], to: { x: to % W, y: Math.floor(to / W) } }; }); })`;
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
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
  const until = async (expression, what = expression, tries = 300) => {
    for (let i = 0; i < tries; i += 1) {
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
        `(() => { const w = ${WORLD}; if (!w?.dialogBox?.visible) return { text: null }; return { text: w.dialogBox.textObject.text, done: w.dialogBox.isCurrentMessageComplete }; })()`,
      );
      if (line.text === null || line.done) return line.text;
      await wait(100);
    }
    throw new Error('a line never finished typing');
  };
  const clearDialog = async () => {
    for (let guard = 0; guard < 20 && (await page.evaluate(sceneIs('world'))) && (await dialog()) !== null; guard += 1) {
      await press('Space');
      await wait(300);
    }
  };
  const where = () =>
    page.evaluate(
      `(() => { const w = ${WORLD}; const a = w.currentArea?.(); return { area: a?.name ?? 'outdoors', kind: a?.kind ?? 'outdoors', tile: w.currentTile }; })()`,
    );
  const BATTLE = `${GAME}.scene.getScene('battle')`;
  /**
   * A wild fight, or the hunter, met on the way: left by RUN (a Lv 99 always
   * gets away) or the hunter's flee, because what the walk is proving is the
   * way up, and fighting every cave roll out spends the lead's best move dry.
   * A trainer, which cannot be left, is fought on the first move.
   */
  const fightThrough = async () => {
    for (let guard = 0; guard < 400 && (await page.evaluate(sceneIs('battle'))); guard += 1) {
      if (await page.evaluate(`Boolean(document.querySelector('.move-chooser, [data-move-chooser]'))`)) {
        await press('Escape');
        await wait(300);
        continue;
      }
      const menu = await page.evaluate(`(() => { const b = ${BATTLE}; if (b.mode !== 'main' || !b.commandTexts?.length) return null;
        const count = b.mainCommandLabels().length;
        return { at: b.selectedCommand, columns: count > 4 ? 3 : 2, leave: b.trainer ? (b.hunterBattle ? 1 : 0) : count - 1 }; })()`);
      if (menu && menu.at !== menu.leave) {
        const [row, column] = [Math.floor(menu.at / menu.columns), menu.at % menu.columns];
        const [toRow, toColumn] = [Math.floor(menu.leave / menu.columns), menu.leave % menu.columns];
        await press(row !== toRow ? (row < toRow ? 'ArrowDown' : 'ArrowUp') : column < toColumn ? 'ArrowRight' : 'ArrowLeft');
      } else await press('Space');
      await wait(300);
    }
    await until(`${sceneIs('world')} || ${sceneIs('extraction')}`, 'the world after a fight');
    await wait(600);
    await clearDialog();
  };

  /**
   * The next key on the shortest way to `target`, over the scene's collision and
   * through its links: a step is an arrow, and a way through a door or down a
   * hole is the arrow it is pressed with from its landing.
   */
  const nextKey = (target) =>
    page.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, H = c.length, W = c[0].length;
      const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      const through = new Map();
      for (const link of ${LINKS}(w)) { const k = link.from.y * W + link.from.x; if (!through.has(k)) through.set(k, []); through.get(k).push(link); }
      // The hunter is walked into, as a player gets past one standing in a lane:
      // caught, fled, and it falls back off the way the player is going.
      const hunter = w.hunterState?.mapId === w.currentMap.id ? w.hunterState.position : undefined;
      const goal = ${JSON.stringify(target)}; const id = (x, y) => y * W + x; const s = w.currentTile;
      if (s.x === goal.x && s.y === goal.y) return null;
      const first = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
      for (let head = 0; head < queue.length; head += 1) { const [x, y] = queue[head]; const here = first.get(id(x, y));
        const moves = [[0, -1, 'ArrowUp'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight']]
          .filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && (!w.isBlocked({ x: nx, y: ny }) || (nx === goal.x && ny === goal.y) || (hunter && nx === hunter.x && ny === hunter.y)); })
          .map(([dx, dy, key]) => [x + dx, y + dy, key]);
        for (const link of through.get(id(x, y)) ?? []) moves.push([link.to.x, link.to.y, keys[link.toward]]);
        for (const [nx, ny, key] of moves) { if (first.has(id(nx, ny))) continue; first.set(id(nx, ny), here ?? key);
          if (nx === goal.x && ny === goal.y) return here ?? key; queue.push([nx, ny]); } }
      return 'unreachable'; })()`);

  /** Walks to `target` the way a player would, fighting what it meets; false if it cannot. */
  const travel = async (target, what) => {
    for (let guard = 0; guard < 6000; guard += 1) {
      if (await page.evaluate(sceneIs('battle'))) await fightThrough();
      if (await page.evaluate(sceneIs('extraction'))) throw new Error(`the raid ended on the way to ${what}`);
      await clearDialog();
      const key = await nextKey(target);
      if (key === null) return true;
      if (key === 'unreachable') {
        check(false, `${what} can be walked to (from ${JSON.stringify(await where())})`);
        return false;
      }
      const before = JSON.stringify(await where());
      await page.keyDown(key);
      for (let i = 0; i < 12 && JSON.stringify(await where()) === before; i += 1) await wait(50);
      await page.keyUp(key);
      await wait(150);
      if (JSON.stringify(await where()) !== before && (await where()).area !== JSON.parse(before).area) {
        // Through a door: the fade, then wherever it came out.
        await wait(900);
      }
    }
    throw new Error(`never got to ${what}`);
  };

  // -- The explorer run, dropped on Gull Strand -----------------------------------
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url.href, { press, click, until, wait, paused: !real, explorer: true, insertion: 'greystone-vale-the-strand' });
  await until(sceneIs('world'), 'the raid');
  await wait(600);
  await clearDialog();
  check((await page.evaluate(`${WORLD}.currentMap.id`)) === 'greystone-vale', 'the raid is on Greystone Vale');

  // -- Down through the caves: in by the sea cave, B4F's hole, across B5F -------
  const seaCave = await page.evaluate(`(() => { const w = ${WORLD}; const areas = w.currentMap.areas ?? [];
    const inside = (id, { x, y }) => { const r = areas.find((a) => a.id === id)?.rect; return Boolean(r) && x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height; };
    const link = ${LINKS}(w).find((l) => inside('greystone-caves-b4f', l.to) && inside(undefined, l.from));
    return link ? link.from : null; })()`);
  check(seaCave !== null, 'the sea cave opens onto B4F');
  if (seaCave) {
    await travel(seaCave, 'the sea cave');
    await page.screenshot(`${outDir}/stormcrown-1-sea-cave.png`);
  }
  await travel(CHIMNEY_FOOT, 'the Chimney');
  const out = await where();
  check(out.kind === 'outdoors' && out.tile.x === CHIMNEY_FOOT.x && out.tile.y === CHIMNEY_FOOT.y, `out of the Chimney onto Stormcrown (${JSON.stringify(out)})`);
  await page.screenshot(`${outDir}/stormcrown-2-chimney.png`);

  // -- The climb: past the Storm Shelter, to the cairn ---------------------------------
  await travel(SHELTER, 'the Storm Shelter');
  await page.screenshot(`${outDir}/stormcrown-3-shelter.png`);
  await travel(BESIDE_MEW, 'the cairn');
  await page.screenshot(`${outDir}/stormcrown-4-cairn.png`);

  // -- Mew ----------------------------------------------------------------------------
  await press('ArrowUp');
  await wait(200);
  await press('Space');
  await wait(300);
  const cry = await dialog();
  check(/mew/i.test(cry ?? ''), `Mew cries when walked up to ("${cry}")`);
  const pending = await page.evaluate(`${WORLD}.pendingWildBattle ?? null`);
  check(pending?.speciesId === 'mew' && pending?.level === 50 && pending?.legendary === true, `Mew fights as a legend at 50 (${JSON.stringify(pending)})`);
  await clearDialog();
  await until(sceneIs('battle'), 'the fight with Mew');
  await wait(1500);
  await page.screenshot(`${outDir}/stormcrown-5-mew.png`);
  check((await page.evaluate(`${GAME}.scene.getScene('battle').legendThrow`)) === 'fighting', 'no ball while Mew can fight');
  for (let guard = 0; guard < 400 && (await page.evaluate(sceneIs('battle'))); guard += 1) {
    const throwState = await page.evaluate(`${GAME}.scene.getScene('battle').legendThrow`);
    if (throwState !== 'fighting' && throwState !== null) {
      await wait(2500);
      await page.screenshot(`${outDir}/stormcrown-6-one-throw.png`);
      check(true, `Mew beaten: ${throwState}`);
      break;
    }
    await press('Space');
    await wait(300);
  }
  await fightThrough();
  await page.screenshot(`${outDir}/stormcrown-7-after-mew.png`);

  // -- Out over the top --------------------------------------------------------------
  const stair = await page.evaluate(`(() => { const w = ${WORLD}; const e = w.extractionPointsForCurrentMap().find((p) => p.label === 'CLOUD STAIR'); return e ? e.position : null; })()`);
  check(stair !== null, 'the Cloud Stair is a way out');
  if (stair) {
    await travel(stair, 'the Cloud Stair').catch(() => undefined);
    await until(sceneIs('extraction'), 'the raid to end by the Cloud Stair', 200);
    await wait(1500);
    await page.screenshot(`${outDir}/stormcrown-8-out.png`);
    check(true, 'the raid ended by the Cloud Stair');
  }
} catch (error) {
  failures.push(String(error?.message ?? error));
  console.log(`FAIL ${error?.message ?? error}`);
  await page.screenshot(`${outDir}/stormcrown-failure.png`).catch(() => undefined);
} finally {
  // Attached to a browser that outlives the run, the tab is this run's to close.
  await page.close().catch(() => undefined);
  await browser.close?.();
}
console.log(failures.length === 0 ? 'Stormcrown: all ok' : `Stormcrown: ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
