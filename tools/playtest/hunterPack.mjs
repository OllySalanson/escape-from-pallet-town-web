// Plays a chase with several of the pack's hunters on the player's heels, at
// real speed, and measures what it costs a frame (`src/game/world/hunterPack.ts`).
//
//   node tools/playtest/hunterPack.mjs <url of a test-mode build> <out dir> [--attach=PORT] [--chasers=4] [--window=WxH]
//
// It deploys a fresh save on to Greystone Vale and walks a route 100 steps long
// twice - once before the hunters are out, once with `--chasers` hunters set
// after the player six to ten steps behind - by answering the scene's own
// input with the route, so no key's round trip slows the walk. For each walk
// it prints the time `WorldScene.update` took a frame (mean, 95th percentile,
// worst), the time between frames, and the player's pace in tiles a second,
// and photographs the chase. Build it with `VITE_EPTW_TEST_MODE=pixels` (WebGL,
// and nothing live: a plain build would sign in to the harbour and the name
// service). Test mode's loop is ten frames a second off a timer, and frame rate
// is the point, so once the raid is under way the loop is put back on the
// display's own frames for the walks.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((a) => !a.startsWith('--'));
const option = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const chasers = Number(option('chasers', '4'));
const attach = option('attach', null);
const sized = /^(\d+)x(\d+)$/.exec(option('window', '800x512'));
mkdirSync(outDir, { recursive: true });

const window = { width: Number(sized[1]), height: Number(sized[2]) };
const browser = attach ? attachBrowser(Number(attach), { window }) : await launchBrowser({ window });
const world = `${GAME}.scene.getScene('world')`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// In the page: a route away from where the player stands, walked by answering
// `readInput`, and every frame's update timed.
const INSTRUMENT = `(() => {
  const w = ${world};
  const map = w.currentMap;
  const width = map.width;
  // The scene's own rule, figures and all: a route through a townsperson is a bump.
  const blocked = (i) => w.isBlocked({ x: i % width, y: (i / width) | 0 });
  const from = w.currentTile.y * width + w.currentTile.x;
  const dist = new Int32Array(width * map.height).fill(-1);
  const prev = new Int32Array(width * map.height).fill(-1);
  const queue = [from]; dist[from] = 0;
  for (let h = 0; h < queue.length; h++) {
    const here = queue[h];
    if (dist[here] >= 110) continue;
    for (const next of [here - width, here + width, here - 1, here + 1]) {
      if (next < 0 || next >= dist.length || dist[next] !== -1 || blocked(next)) continue;
      if (Math.abs((next % width) - (here % width)) > 1) continue;
      dist[next] = dist[here] + 1; prev[next] = here; queue.push(next);
    }
  }
  const ends = queue.filter((i) => dist[i] === 100);
  const end = ends[ends.length >> 1];
  const route = [];
  for (let i = end; i !== -1; i = prev[i]) route.unshift({ x: i % width, y: (i / width) | 0 });
  window.__route = route;
  window.__frames = [];
  window.__walking = false;
  // Phaser calls the update it bound when the scene booted, so that is the one wrapped.
  const update = window.__sceneUpdate ??= w.sys.sceneUpdate;
  w.sys.sceneUpdate = function (time, delta) {
    const t0 = performance.now();
    update.call(w, time, delta);
    if (window.__walking) window.__frames.push({ cost: performance.now() - t0, delta, at: w.currentTile.x + ',' + w.currentTile.y });
  };
  window.__pack = [];
  window.__steps = [];
  window.__intervals = [];
  if (!window.__stepWrapped) {
    window.__stepWrapped = true;
    const game = ${GAME};
    // The loop calls the step it was started with, so that is the one wrapped.
    const step = game.loop.callback;
    let last = 0;
    game.loop.callback = (time, delta) => {
      const t0 = performance.now();
      step(time, delta);
      if (window.__walking) { window.__steps.push(performance.now() - t0); if (last) window.__intervals.push(t0 - last); }
      last = t0;
    };
  }
  if (!window.__packWrapped) {
    window.__packWrapped = true;
    const advance = w.advanceHunterPack.bind(w);
    const draw = w.drawHunterPack.bind(w);
    let spent = 0;
    w.advanceHunterPack = (...a) => { const t0 = performance.now(); advance(...a); spent += performance.now() - t0; };
    w.drawHunterPack = () => { const t0 = performance.now(); draw(); spent += performance.now() - t0; if (window.__walking) window.__pack.push(spent); spent = 0; };
  }
  const readInput = w.readInput.bind(w);
  w.readInput = () => {
    if (!window.__walking) return readInput();
    const route = window.__route;
    const here = route.findIndex((t) => t.x === w.currentTile.x && t.y === w.currentTile.y);
    const next = here >= 0 ? route[here + 1] : null;
    if (!next) return { up: false, down: false, left: false, right: false };
    return { up: next.y < w.currentTile.y, down: next.y > w.currentTile.y, left: next.x < w.currentTile.x, right: next.x > w.currentTile.x };
  };
  return route.length;
})()`;

const SUMMARY = `(() => {
  const f = window.__frames.slice(5);
  const sorted = (xs) => [...xs].sort((a, b) => a - b);
  const stat = (xs) => { const s = sorted(xs); return { mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), worst: +s[s.length - 1].toFixed(2) }; };
  const seconds = f.reduce((a, b) => a + b.delta, 0) / 1000;
  const tiles = new Set(f.map((x) => x.at)).size;
  return { frames: f.length, update: stat(f.map((x) => x.cost)), pack: stat(window.__pack.slice(5)), wholeFrame: stat(window.__steps.slice(5)), interval: stat(window.__intervals.slice(5)), fps: +(1000 * window.__intervals.slice(5).length / window.__intervals.slice(5).reduce((a, b) => a + b, 0)).toFixed(1), tilesPerSecond: +(tiles / seconds).toFixed(2) };
})()`;

const main = async () => {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: base });
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 600; i += 1) { if (await page.evaluate(expression)) return; await sleep(100); }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => { await page.keyDown(code); await sleep(80); await page.keyUp(code); await sleep(120); };
  const click = async (text) => {
    await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`);
    await sleep(350);
  };
  await page.waitFor(sceneIs('title'));
  // A fresh save every run: the browser may be one a driver has used before.
  await page.evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); })()`);
  await sleep(1500);
  await page.waitFor(sceneIs('title'));
  await sleep(1000);
  await deploy(page, base, { press, until, wait: sleep, click });
  await until(sceneIs('world'));
  for (let i = 0; i < 12 && (await page.evaluate(`${world}.dialogBox.visible`)); i += 1) { await press('Space'); await sleep(250); }
  await sleep(500);
  // The display's own frames for the measuring, as a player's game runs.
  await page.evaluate(`(() => { const l = ${GAME}.loop; l.sleep(); l.forceSetTimeOut = false; l.targetFps = 60;
    l._target = 1000 / 60; l.hasFpsLimit = false; l.resetDelta(); l.wake(true); })()`);
  await sleep(1000);
  console.log('map', await page.evaluate(`${world}.currentMap.id`), 'at', await page.evaluate(`JSON.stringify(${world}.currentTile)`));
  console.log('pack', await page.evaluate(`${world}.runSession.hunterPacks?.get(${world}.currentMap.id)?.hunters.length`), 'hunters');

  const walk = async (label, ms, routed = false) => {
    const length = routed
      ? await page.evaluate('(() => { window.__frames = []; window.__pack = []; window.__steps = []; window.__intervals = []; return window.__route.length; })()')
      : await page.evaluate(INSTRUMENT);
    await page.evaluate(`window.__walking = true`);
    for (let t = 0; t < ms; t += 500) {
      await sleep(500);
      if (args.includes('--log')) {
        console.log('  ', await page.evaluate(`(() => { const w = ${world}; const p = w.runSession.hunterPacks.get(w.currentMap.id);
          return JSON.stringify(w.currentTile) + ' input ' + JSON.stringify(w.readInput()) + ' route ' + JSON.stringify(window.__route.slice(0, 2)) + ' target ' + JSON.stringify(w.targetTile) + ' box ' + w.dialogBox.visible + ' cut ' + !!w.cutscene + ' | ' +
            p.hunters.filter((h) => h.mode !== 'waiting' && Math.abs(h.position.x - w.currentTile.x) < 20 && Math.abs(h.position.y - w.currentTile.y) < 20)
              .map((h) => h.rivalId + ':' + h.mode + '@' + h.position.x + ',' + h.position.y + ' gap ' + h.gap).join('; '); })()`));
      }
    }
    await page.evaluate(`window.__walking = false`);
    const summary = await page.evaluate(SUMMARY);
    console.log(label, `route ${length}`, JSON.stringify(summary));
    return summary;
  };

  if (args.includes('--flee')) {
    // Caught by a hunter of the pack, run from the fight, and back: the hunter
    // that was fought is thrown back and blind, and the rest come on.
    await page.evaluate(`(() => { const w = ${world}; const s = w.runSession;
      s.plan = { ...s.plan, hunter: { ...s.plan.hunter, spawnDelayMs: 0 } }; s.stepsTaken = 99; })()`);
    await sleep(400);
    const caughtBy = await page.evaluate(`(() => {
      const w = ${world}; const pack = w.runSession.hunterPacks.get(w.currentMap.id);
      const h = [...pack.hunters].sort((a, b) => Math.hypot(a.position.x - w.currentTile.x, a.position.y - w.currentTile.y) - Math.hypot(b.position.x - w.currentTile.x, b.position.y - w.currentTile.y))[0];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const t = { x: w.currentTile.x + dx, y: w.currentTile.y + dy };
        if (w.isBlocked(t)) continue;
        Object.assign(h, { mode: 'chase', position: t, next: null, lastSeen: { ...w.currentTile } });
        return h.id + ' ' + h.rivalId;
      }
      return null;
    })()`);
    console.log('caught by', caughtBy);
    const battle = `${GAME}.scene.getScene('battle')`;
    // The catch beat: both turn, a breath, then the rival's lines, read a press at a time.
    for (let i = 0; i < 60 && !(await page.evaluate(sceneIs('battle'))); i += 1) {
      await press('Space');
      await sleep(400);
    }
    await until(sceneIs('battle'), 'the hunter fight');
    console.log('in the fight with', await page.evaluate(`${battle}.trainer?.name`));
    const seen = new Set();
    for (let i = 0; i < 200 && (await page.evaluate(sceneIs('battle'))); i += 1) {
      const b = await page.evaluate(`(() => { const b = ${battle}; return { mode: b.mode, commands: (b.commandTexts ?? []).map((t, i) => (i === b.selectedCommand ? '>' : '') + t.text) }; })()`);
      if (b.mode === 'main') {
        // Walk the menu as raid.mjs does: along the row, and down a row whenever it comes round again.
        const selected = b.commands.find((c) => c.startsWith('>')) ?? '';
        if (!selected.includes('FLEE') && !selected.includes('RUN')) {
          await press(seen.has(selected) ? 'ArrowDown' : 'ArrowRight');
          seen.add(selected);
          await sleep(120);
          continue;
        }
        seen.clear();
      }
      await press('Space');
      await sleep(200);
    }
    await until(sceneIs('world'), 'the world back');
    await sleep(800);
    const after = await page.evaluate(`(() => { const w = ${world}; const pack = w.runSession.hunterPacks.get(w.currentMap.id);
      const h = pack.hunters.find((x) => x.id === ${JSON.stringify((caughtBy ?? '').split(' ')[0])});
      return { player: w.currentTile, hunter: h && { mode: h.mode, position: h.position, timerMs: Math.round(h.timerMs) },
        chip: w.raidHud?.hunterChip?.text ?? null, engaged: pack.engagedId, legacy: w.hunterState }; })()`);
    console.log('after fleeing', JSON.stringify(after));
    await page.screenshot(`${outDir}/fled.png`);
    return null;
  }

  if (args.includes('--marks')) {
    // The marks, photographed: a hunter five tiles off sees the player ("!"),
    // and then stands looking for them ("?").
    await page.evaluate(`(() => { const w = ${world}; const s = w.runSession;
      s.plan = { ...s.plan, hunter: { ...s.plan.hunter, spawnDelayMs: 0 } }; s.stepsTaken = 99; })()`);
    await sleep(400);
    const placed = await page.evaluate(`(() => {
      const w = ${world}; const pack = w.runSession.hunterPacks.get(w.currentMap.id);
      const h = [...pack.hunters].sort((a, b) => Math.hypot(a.position.x - w.currentTile.x, a.position.y - w.currentTile.y) - Math.hypot(b.position.x - w.currentTile.x, b.position.y - w.currentTile.y))[0];
      for (let r = 3; r <= 6; r += 1) for (const [dx, dy, facing] of [[-r, 0, 'right'], [r, 0, 'left'], [0, -r, 'down'], [0, r, 'up']]) {
        const t = { x: w.currentTile.x + dx, y: w.currentTile.y + dy };
        if (w.isBlocked(t)) continue;
        // Seen, as the pack says it: the "!" over it and the beat held long enough to photograph.
        Object.assign(h, { mode: 'alerted', position: t, next: null, facing, timerMs: 5000, lastSeen: { ...w.currentTile } });
        w.onPackEvent({ kind: 'noticed', hunter: h });
        return h.id + '@' + t.x + ',' + t.y;
      }
      return 'nowhere';
    })()`);
    console.log('marks: hunter', placed);
    await sleep(250);
    await page.screenshot(`${outDir}/noticed.png`);
    await page.evaluate(`(() => { const w = ${world}; const pack = w.runSession.hunterPacks.get(w.currentMap.id);
      const h = pack.hunters.find((x) => x.mode === 'alerted' || x.mode === 'chase');
      if (h) Object.assign(h, { mode: 'search', looks: 0, timerMs: 4000, next: null }); w.packMarks.forEach((m) => m.mark.destroy()); w.packMarks.clear(); })()`);
    // Out of its sight while it looks: the player under nothing, so step it behind the camera's edge.
    await sleep(300);
    await page.screenshot(`${outDir}/searching.png`);
    return null;
  }

  // Both walks cover the same ground: the route is planned once, walked with
  // no hunters out, and walked again from the same tile with them chasing.
  const start = await page.evaluate(`JSON.stringify(${world}.currentTile)`);
  await walk('no hunters out:', 6_000);
  await page.evaluate(`(() => { const w = ${world}; const t = ${start};
    const dy = w.player.y - w.currentTile.y * 16; w.targetTile = null; w.currentTile = { ...t };
    w.setPlayerPosition(t.x * 16, t.y * 16 + dy); w.partner?.tuckIn?.(); })()`);
  await sleep(300);
  // Walk back to where the route started so the chase has the same ground.
  // Bring the pack out, and set the nearest few after the player from behind.
  await page.evaluate(`(() => { const w = ${world}; const s = w.runSession;
    s.plan = { ...s.plan, hunter: { ...s.plan.hunter, spawnDelayMs: 0 } }; s.stepsTaken = 99; })()`);
  await sleep(500);
  const placed = await page.evaluate(`(() => {
    const w = ${world}; const pack = w.runSession.hunterPacks.get(w.currentMap.id);
    const map = w.currentMap; const width = map.width;
    const blocked = (i) => map.collision[(i / width) | 0][i % width];
    const from = w.currentTile.y * width + w.currentTile.x;
    const dist = new Int32Array(width * map.height).fill(-1); const queue = [from]; dist[from] = 0;
    for (let h = 0; h < queue.length; h++) { const here = queue[h]; if (dist[here] >= 12) continue;
      for (const next of [here - width, here + width, here - 1, here + 1]) {
        if (next < 0 || dist[next] !== -1 || blocked(next) || Math.abs((next % width) - (here % width)) > 1) continue;
        dist[next] = dist[here] + 1; queue.push(next); } }
    // Behind the player: further from where the route goes than they are.
    const end = window.__route.at(-1); const toEnd = new Int32Array(width * map.height).fill(-1);
    const back = [end.y * width + end.x]; toEnd[back[0]] = 0;
    for (let h = 0; h < back.length; h++) { const here = back[h]; if (toEnd[here] >= 130) continue;
      for (const next of [here - width, here + width, here - 1, here + 1]) {
        if (next < 0 || toEnd[next] !== -1 || blocked(next) || Math.abs((next % width) - (here % width)) > 1) continue;
        toEnd[next] = toEnd[here] + 1; back.push(next); } }
    const mine = toEnd[from];
    const ring = queue.filter((i) => dist[i] >= 6 && dist[i] <= 10 && (toEnd[i] === -1 || toEnd[i] >= mine + dist[i] - 2));
    const hunters = [...pack.hunters].sort((a, b) => Math.hypot(a.position.x - w.currentTile.x, a.position.y - w.currentTile.y) - Math.hypot(b.position.x - w.currentTile.x, b.position.y - w.currentTile.y)).slice(0, ${chasers});
    // All of them keepers of the patch the player is in, so none lets them go at its edge.
    const here = pack.hunters.find((h) => h.ground.rects.some((r) => w.currentTile.x >= r.x && w.currentTile.y >= r.y && w.currentTile.x < r.x + r.width && w.currentTile.y < r.y + r.height));
    hunters.forEach((h, n) => { const i = ring[Math.floor((n + 0.5) * ring.length / hunters.length)];
      Object.assign(h, { mode: 'chase', ground: here.ground, position: { x: i % width, y: (i / width) | 0 }, next: null, lastSeen: { ...w.currentTile }, seenAtMs: Infinity }); });
    return hunters.map((h) => h.rivalId + '@' + h.position.x + ',' + h.position.y);
  })()`);
  console.log('chasing:', placed.join(' '));
  setTimeout(() => page.screenshot(`${outDir}/chase.png`).catch(() => {}), 2_500);
  const chase = await walk(`${chasers} hunters chasing:`, 8_000, true);
  const after = await page.evaluate(`(() => { const w = ${world}; return { scene: w.scene.isActive() ? 'world' : 'not', cutscene: !!w.cutscene, battle: !!w.pendingTrainerBattle,
    modes: w.runSession.hunterPacks.get(w.currentMap.id).hunters.map((h) => h.mode).join(' ') }; })()`);
  console.log('after the chase', JSON.stringify(after));
  await page.screenshot(`${outDir}/after.png`);
  return chase;
};

try {
  await main();
} finally {
  await browser.close();
}
