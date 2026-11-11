// Millbrook - or THE HARBOUR, with --area=harbour - walked the way a player
// walks it, to count what gets in the way.
//
// The captain, 11 Nov 2026: "when you're walking around, there's just often
// things in your way, and it's quite fiddly to get through places". So this
// lands where a new game lands (Mill Square) and walks every main route out of
// it - the four roads, the doors that open and the doors that do not, the
// orchard, the glade, the allotments - the way a player does: straight down the
// street toward where it is going, the long way first, a tile a press. Every time
// the next tile that way is taken - by a prop, a figure on its beat, a tree - is
// a snag, written down with what was in the way, and the walk steps round it
// over the scene's own collision and carries on.
//
//   node tools/playtest/walkableVillage.mjs <test-mode build url> <out dir> [--area=harbour] [--port=N]
//
// It writes `<out>/snags.json` and a picture at each route's end. Run it against
// a build from before a change and after it to compare (`docs/screens/walkable-millbrook/`,
// `docs/screens/walkable-harbour/`).
//
// --area=harbour walks THE HARBOUR instead (the captain's bench on the way east
// and the parasols on the beach were the two things he named): a new game is
// started, and the routes are walked from where a visit starts (the yard) and
// from where a raid comes home (the jetty), each to a corner the old harbour
// and the new one both leave open, and back. A route ends on a door's step,
// never its doorway, so nobody walks into a room.
import { mkdirSync, writeFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const port = args.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
const area = args.find((arg) => arg.startsWith('--area='))?.slice('--area='.length) ?? 'millbrook';
if (!base || !['millbrook', 'harbour'].includes(area)) throw new Error('usage: walkableVillage.mjs <url> <out dir> [--area=millbrook|harbour] [--port=N]');
const HARBOUR = area === 'harbour';
mkdirSync(out, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const FRAME_MS = 1000 / 60;
// The scene walked: the raid's world, or the harbour's base.
const WORLD = `${GAME}.scene.getScene('${HARBOUR ? 'base' : 'world'}')`;
const BATTLE = `${GAME}.scene.getScene('battle')`;
// Local to the district: Millbrook is the plan's cell [0, 1]. The harbour is its own map.
const ORIGIN = HARBOUR ? { x: 0, y: 0 } : { x: 64, y: 128 };
const LANDING = [30, 32];
// THE HARBOUR's two starts (`BASE_SPAWN`, `BASE_LANDING` in `base/baseMap.ts`).
const SPAWN = [16, 13];
const JETTY = [12, 19];

// Each route is the streets a player would take, as corners; between corners
// the walk goes straight. A way out is walked to the tile before it, because
// stepping on it ends the raid.
const ROUTES = [
  { name: 'north, up the drove road to High Moor', corners: [[30, 1]] },
  { name: 'west, out along the Westward Road', corners: [[30, 31], [1, 31], [1, 30]] },
  { name: 'east, over the brook to The Crossing', corners: [[30, 31], [62, 31]] },
  { name: 'south, down the lane to Reedmere', corners: [[30, 36], [34, 36], [34, 42], [40, 42], [40, 62]] },
  { name: 'to the Pokemon Center door', corners: [[30, 31], [40, 31], [40, 30]] },
  { name: 'to the Mart door', corners: [[30, 36], [34, 36], [34, 42], [46, 42], [46, 40]] },
  { name: 'to the mill door', corners: [[30, 22], [44, 22], [44, 21]] },
  { name: 'to Ott’s cottage door on Old Row', corners: [[30, 31], [10, 31], [10, 17], [13, 17]] },
  { name: 'into the allotments, to the tool shed', corners: [[30, 18], [20, 18], [20, 13], [23, 13]] },
  { name: 'to the gatekeeper’s door', corners: [[30, 31], [55, 31], [55, 28]] },
  { name: 'to Mrs Lark’s door', corners: [[30, 31], [50, 31], [50, 38], [52, 38]] },
  { name: 'into the orchard', corners: [[30, 36], [34, 36], [34, 42], [40, 42], [40, 50], [50, 50]] },
  { name: 'to the woodshed in the glade', corners: [[30, 36], [34, 36], [34, 42], [40, 42], [40, 56], [24, 56], [24, 58], [21, 58]] },
];

// THE HARBOUR's main routes, each from the yard where a visit starts or the
// jetty a raid comes home to. Every corner is open ground in the harbour before
// and after it was made walkable, so the same walk is asked of both; the quay's
// corners go round the long pier's statues and the cove's edge as the quay
// does, because straight on there is the sea or the pier's own front.
const HARBOUR_ROUTES = [
  { from: SPAWN, name: 'to the Raid Arena door', corners: [[8, 13]] },
  { from: SPAWN, name: 'to the Pokemon Center door', corners: [[19, 13], [19, 12]] },
  { from: SPAWN, name: 'to Oak’s Lab door', corners: [[25, 13], [25, 12]] },
  { from: SPAWN, name: 'to Brock’s Workshop door', corners: [[31, 13], [31, 12]] },
  { from: SPAWN, name: 'to the Bolthole step', corners: [[37, 13], [37, 11]] },
  { from: SPAWN, name: 'down the lawn to Bill’s door', corners: [[19, 13], [19, 19], [14, 19], [14, 18]] },
  { from: SPAWN, name: 'east from the gravel to the end of the stone', corners: [[86, 13]] },
  { from: SPAWN, name: 'up THE GREEN to the Boutique door', corners: [[54, 13], [54, 8], [55, 8]] },
  { from: SPAWN, name: 'up THE GREEN to the Great Library door', corners: [[60, 13], [60, 7], [61, 7]] },
  { from: SPAWN, name: 'along THE PROMENADE to the Battle Arena door', corners: [[67, 13]] },
  { from: SPAWN, name: 'along THE PROMENADE to the Game Corner door', corners: [[76, 13], [76, 11]] },
  { from: SPAWN, name: 'along THE PROMENADE to the Field-Move Course gate', corners: [[85, 13], [85, 10]] },
  { from: SPAWN, name: 'along the boardwalk', corners: [[60, 13], [60, 15], [86, 15]] },
  { from: SPAWN, name: 'down the steps and along the beach to THE COVE', corners: [[67, 13], [67, 22], [60, 22], [60, 19], [50, 19]] },
  { from: SPAWN, name: 'down the steps and along the beach to the pleasure pier head', corners: [[67, 13], [67, 22], [80, 22], [80, 28]] },
  { from: SPAWN, name: 'off the pleasure pier and along the sand to THE COVE', corners: [[80, 13], [80, 21], [61, 21], [60, 19], [50, 19]] },
  { from: SPAWN, name: 'down to the jetty in THE COVE', corners: [[54, 13], [54, 21]] },
  { from: JETTY, name: 'from the boat to Bill’s door', corners: [[14, 19], [14, 18]] },
  { from: JETTY, name: 'from the boat to the Raid Arena door', corners: [[12, 18], [8, 18], [8, 13]] },
  { from: JETTY, name: 'from the boat up to the Pokemon Center door', corners: [[19, 19], [19, 12]] },
  { from: JETTY, name: 'from the boat along the quay to the S.S. Anne', corners: [[29, 19], [29, 25]] },
  { from: JETTY, name: 'from the boat along the waterfront to THE COVE', corners: [[30, 19], [34, 19], [35, 21], [46, 21], [47, 19], [50, 19]] },
  { from: JETTY, name: 'from the boat out along the breakwater to the harbour light', corners: [[30, 19], [34, 19], [35, 21], [46, 21], [47, 19], [60, 19], [60, 21], [60, 30], [42, 30]] },
];

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
// By day, as `millbrook.mjs` does: a night raid swaps what is out.
let offset = (12 - new Date().getUTCHours() + 24) % 24;
if (offset > 14) offset -= 24;
await page.send('Emulation.setTimezoneOverride', {
  timezoneId: offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`,
});
const report = { routes: [] };
try {
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression, tries = 600) => {
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
  const line = () =>
    page.evaluate(`(() => { const w = ${WORLD}; return w?.dialogBox?.visible ? w.dialogBox.textObject.text : null; })()`);
  const readAll = async () => {
    for (let guard = 0; guard < 30 && (await page.evaluate(sceneIs(HARBOUR ? 'base' : 'world'))); guard += 1) {
      if ((await line()) === null) break;
      await press('Space');
      await wait(300);
    }
  };
  const fight = async () => {
    for (let guard = 0; guard < 400 && (await page.evaluate(sceneIs('battle'))); guard += 1) {
      const menu = await page.evaluate(`(() => { const b = ${BATTLE}; if (b.mode !== 'main' || !b.commandTexts?.length) return null;
        const count = b.mainCommandLabels().length; return { at: b.selectedCommand, columns: count > 4 ? 3 : 2, leave: b.trainer ? (b.hunterBattle ? 1 : 0) : count - 1 }; })()`);
      if (menu && menu.at !== menu.leave) {
        const [row, column] = [Math.floor(menu.at / menu.columns), menu.at % menu.columns];
        const [toRow, toColumn] = [Math.floor(menu.leave / menu.columns), menu.leave % menu.columns];
        await press(row !== toRow ? (row < toRow ? 'ArrowDown' : 'ArrowUp') : column < toColumn ? 'ArrowRight' : 'ArrowLeft');
      } else await press('Space');
      await wait(300);
    }
    await until(`${sceneIs('world')} || ${sceneIs('extraction')}`, 'the world after a fight');
    await wait(600);
    await readAll();
  };
  const tile = async () => {
    const at = await page.evaluate(`${WORLD}.currentTile`);
    return [at.x - ORIGIN.x, at.y - ORIGIN.y];
  };
  /** What stands on a tile, for the record: a figure's name, or what the collision is. */
  const whatIsAt = (x, y) =>
    HARBOUR
      ? page.evaluate(`(() => { const b = ${WORLD}; const t = { x: ${x}, y: ${y} };
          if (b.doors.some((door) => door.tiles.some((d) => d.x === t.x && d.y === t.y))) return 'doorway';
          const figure = b.harbourLife?.at(t);
          if (figure) return figure.kind + ' ' + figure.id;
          if (b.garden?.holds(t)) return 'pokemon in the garden';
          if (!b.collision[t.y]?.[t.x] && b.isBlocked(t)) return 'person';
          return b.collision[t.y]?.[t.x] !== false ? 'solid' : null; })()`)
      : page.evaluate(`(() => { const w = ${WORLD}; const t = { x: ${ORIGIN.x + x}, y: ${ORIGIN.y + y} };
      const figure = w.currentMap.entities.find((e) => w.entityHolds(e, t));
      if (figure) return figure.kind + ' ' + (figure.pokemon ?? figure.id);
      const trainer = w.trainersForCurrentMap().find((e) => e.position.x === t.x && e.position.y === t.y);
      if (trainer) return 'trainer ' + (trainer.trainer?.name ?? trainer.id);
      return w.collisionData[t.y][t.x] ? 'solid' : null; })()`);
  const KEYS = { '1,0': 'ArrowRight', '-1,0': 'ArrowLeft', '0,1': 'ArrowDown', '0,-1': 'ArrowUp' };
  /** The first step of the shortest walk round, over the scene's own collision. */
  const stepRound = (goal) =>
    page.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData ?? w.collision, H = c.length, W = c[0].length;
      const doorway = (x, y) => (w.doors ?? []).some((door) => door.tiles.some((d) => d.x === x && d.y === y));
      const goal = { x: ${ORIGIN.x + goal[0]}, y: ${ORIGIN.y + goal[1]} }; const id = (x, y) => y * W + x; const s = w.currentTile;
      const first = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
      for (let head = 0; head < queue.length; head += 1) { const [x, y] = queue[head]; const here = first.get(id(x, y));
        for (const [dx, dy, key] of [[0, -1, 'ArrowUp'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight']]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || first.has(id(nx, ny)) || w.isBlocked({ x: nx, y: ny }) || doorway(nx, ny)) continue;
          first.set(id(nx, ny), here ?? key);
          if (nx === goal.x && ny === goal.y) return here ?? key;
          queue.push([nx, ny]);
        } }
      return null; })()`);
  let taken = 0;
  const step = async (key) => {
    taken += 1;
    if (await page.evaluate(sceneIs('battle'))) await fight();
    if ((await line()) !== null) await readAll();
    await page.keyDown(key);
    await page.evaluate(`${GAME}.stepFrames(2, ${FRAME_MS})`);
    await page.keyUp(key);
    for (let i = 0; i < 16 && (await page.evaluate(`Boolean(${WORLD}.targetTile)`)); i += 1) {
      await page.evaluate(`${GAME}.stepFrames(1, ${FRAME_MS})`);
    }
    if (await page.evaluate(sceneIs('battle'))) await fight();
  };
  /** Straight to a corner, the long way first, writing down every snag on the way. */
  const walkTo = async (goal, snags, leg) => {
    // Where this leg has been: going straight never walks back over it, which is
    // what stepping round a snag and then straight back into it would do.
    const been = new Set();
    for (let guard = 0; guard < 300; guard += 1) {
      const [x, y] = await tile();
      been.add(`${x},${y}`);
      const [dx, dy] = [goal[0] - x, goal[1] - y];
      if (dx === 0 && dy === 0) return true;
      // The way a player presses: along the street toward the corner.
      const ways = Math.abs(dx) >= Math.abs(dy)
        ? [[Math.sign(dx), 0], ...(dy !== 0 ? [[0, Math.sign(dy)]] : [])]
        : [[0, Math.sign(dy)], ...(dx !== 0 ? [[Math.sign(dx), 0]] : [])];
      const [wx, wy] = ways[0];
      const blocker = await whatIsAt(x + wx, y + wy);
      if (blocker === null && !been.has(`${x + wx},${y + wy}`)) {
        await step(KEYS[`${wx},${wy}`]);
        continue;
      }
      // One snag is one thing in the way, however many steps it takes to get round.
      const last = snags.at(-1);
      if (blocker !== null && !(last?.leg === leg && last.by === blocker)) {
        snags.push({ leg, at: [x, y], heading: KEYS[`${wx},${wy}`].replace('Arrow', '').toLowerCase(), blocked: [x + wx, y + wy], by: blocker });
      }
      if (blocker === null) console.log(`       (stepping round at ${x},${y}: straight on is back over the walk)`);
      const round = await stepRound(goal);
      if (round === null) return false;
      await step(round);
    }
    return false;
  };
  const walkRoute = async (name, corners, shot) => {
    const snags = [];
    const before = taken;
    let reached = true;
    for (const [k, corner] of corners.entries()) {
      reached = (await walkTo(corner, snags, k)) && reached;
    }
    if (shot) await page.screenshot(`${out}/${shot}.png`);
    console.log(`${reached ? 'ok  ' : 'FAIL'} ${name}: ${taken - before} steps, ${snags.length} snag(s)`);
    for (const snag of snags) console.log(`       at ${snag.at} going ${snag.heading}: ${snag.by} at ${snag.blocked}`);
    report.routes.push({ name, reached, steps: taken - before, snags });
  };

  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(url.origin)})`, { timeout: 90_000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`document.readyState === 'complete'`, { timeout: 90_000 });
  if (HARBOUR) {
    // A new game, as a newcomer starts one, then the harbour from each start in
    // turn: the scene restarted standing there, as `harbourTour.mjs` does.
    await page.waitFor(sceneIs('title'), { timeout: 90_000 });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(sceneIs('base'), 'the harbour');
    await until(`${WORLD}?.takeStarterForDriver?.('bulbasaur') === true`, 'Oak’s table');
    const standAt = async (at) => {
      await page.evaluate(`void ${WORLD}.scene.start('base', ${JSON.stringify(at[0] === SPAWN[0] && at[1] === SPAWN[1] ? {} : { at: { x: at[0], y: at[1] } })})`);
      await until(`${sceneIs('base')} && ${WORLD}.ready && !${WORLD}.place.room`, 'the harbour again');
      await wait(1_700);
      await readAll();
      const [x, y] = await tile();
      if (x !== at[0] || y !== at[1]) throw new Error(`stood at ${x},${y}, not ${at}`);
    };
    for (const [k, route] of HARBOUR_ROUTES.entries()) {
      await standAt(route.from);
      if (k === 0) await page.screenshot(`${out}/00-spawn.png`);
      await walkRoute(route.name, route.corners, `${String(k + 1).padStart(2, '0')}-${route.name.split(/[ ,]+/).slice(0, 5).join('-').toLowerCase().replace(/[^a-z-]/g, '')}`);
      await walkRoute(`back from: ${route.name}`, [...route.corners.slice(0, -1).reverse(), route.from]);
    }
    const total = report.routes.reduce((sum, route) => sum + route.snags.length, 0);
    report.total = total;
    console.log(`${total} snag(s) over ${report.routes.length} walks`);
  } else {
    // The explorer run's clock and partner: what is checked is the village, not
    // whether a level-5 starter outruns the hunter.
    await deploy(page, url.href, { press, click, until, wait, paused: true, explorer: true, insertion: 'greystone-vale' });
    await until(sceneIs('world'), 'the raid');
    await wait(600);
    await readAll();
    const landed = await tile();
    console.log(`landed at ${landed} (Mill Square is ${LANDING})`);
    await page.screenshot(`${out}/00-landing.png`);
    for (const [k, route] of ROUTES.entries()) {
      await walkRoute(route.name, route.corners, `${String(k + 1).padStart(2, '0')}-${route.name.split(/[ ,]+/).slice(0, 4).join('-').toLowerCase().replace(/[^a-z-]/g, '')}`);
      // Back to the landing the way the route came, which is a walk too.
      await walkRoute(`back from: ${route.name}`, [...route.corners.slice(0, -1).reverse(), LANDING]);
    }
    const total = report.routes.reduce((sum, route) => sum + route.snags.length, 0);
    report.total = total;
    console.log(`${total} snag(s) over ${report.routes.length} walks`);
  }
} finally {
  writeFileSync(`${out}/snags.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
