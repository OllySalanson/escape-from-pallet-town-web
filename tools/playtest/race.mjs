// A race against LINNET, played through real key events: deploy to Greystone
// Vale's Mill Square on a save past its first raid, walk to her, ask, say YES,
// sit through the countdown and run a line to THE LAST HOUSE, holding the keys
// a player holds - turning a beat before each corner, as a player does - on a
// stepped loop at 60 frames a second. Prints the race clock, who crossed first,
// the mark and every line said at the finish.
//
//   node tools/playtest/race.mjs http://localhost:5173/ [--line=road|dry|wade|cut]
//        [--ask-from=west|east|south] [--stone=N] [--shot=dir] [--pixels] [--fight] [deploy.mjs flags]
//
// --pixels plays ?testmode=pixels at PIXEL_WINDOW, for pictures: run it against a
// test-mode build, never the dev server (README.md, 'Memory').
//
// --line=road   follows LINNET's own boardwalk (a first-timer who follows her)
// --line=dry    the reeds' dry way: the fewest steps, a wild tile costing three
// --line=reeds  the dry way, never up the woodcutter's ride even when it is open
// --line=wade   the fewest steps whatever the grass
// --line=cut    as dry, which with --opened=greystone-vale/door-2 (or a Cut) takes
//               the woodcutter's ride
// --slow=N      a slow starter: N ms late off the line after GO
// --first       a save on its first raid: LINNET is there and wants you home first
// --record-out=file  writes the course's record (best time, mark, best run) after the race
// --record-in=file   puts that record in the save before asking, so the race is run
//                    against a best - its ghost walks beside the player
//
// Every check is stepped (test mode, the loop paused), so a run is the same run
// whatever the machine is doing. See tools/playtest/README.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser } from './browser.mjs';
import { GAME, deploy, deployOptions } from './deploy.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const base = args.find((arg) => !arg.startsWith('--'));
if (!base) throw new Error('usage: race.mjs <dev server url> [--line=road|dry|wade|cut]');
const line = option('line') ?? 'dry';
const askFrom = option('ask-from') ?? 'west';
const shots = option('shot');
const slowMs = Number(option('slow') ?? 0);
if (shots) mkdirSync(shots, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', flag('pixels') ? 'pixels' : '1');

const FRAME_MS = 1000 / 60;
const LINNET = { x: 84, y: 169 };
const ASK = { west: { x: 83, y: 169, face: 'ArrowRight' }, east: { x: 85, y: 169, face: 'ArrowLeft' }, south: { x: 84, y: 170, face: 'ArrowUp' } }[askFrom];
const FINISH = [{ x: 72, y: 218 }, { x: 72, y: 219 }];

const browser = await launchBrowser({ window: flag('pixels') ? PIXEL_WINDOW : LOGIC_WINDOW });
const out = [];
const note = (text) => { out.push(text); console.log(text); };
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, holdMs = 50) => {
    await page.keyDown(code);
    await wait(holdMs);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const deployed = Object.fromEntries(Object.entries(deployOptions(args)).filter(([, value]) => value !== undefined));
  await deploy(page, url.href, { press, click, until, wait, paused: true, ...(flag('first') ? {} : { insertion: 'greystone-vale', banked: 1 }), ...deployed });
  const W = `${GAME}.scene.getScene('world')`;
  const state = () => page.evaluate(`(() => { const w = ${W}; const g = ${GAME};
    const battle = g.scene.getScenes(true).some((s) => s.scene.key === 'battle');
    if (battle || !g.scene.getScenes(true).some((s) => s.scene.key === 'world')) return { battle: true, race: w.runSession?.race ?? null };
    const d = w.describeForTest();
    return { battle, tile: w.currentTile, target: w.targetTile, dialog: w.dialogBox.visible, complete: w.dialogBox.isCurrentMessageComplete,
      said: d.dialogue?.text ?? null, choice: d.choice ?? null, race: d.race ?? null, busy: d.busy, elapsedMs: d.raid?.elapsedMs ?? null }; })()`);

  let fights = 0;
  /** Reads every line, answers nothing; a fight is run from unless --fight. */
  const clear = async ({ answer } = {}) => {
    let lastSaid = '';
    for (let guard = 0; guard < 800; guard += 1) {
      const s = await state();
      if (s.battle) {
        const b = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('battle'); if (!${GAME}.scene.getScenes(true).some((s) => s.scene.key === 'battle')) return { mode: 'gone', commands: [] };
          const cursor = b.mode === 'make-room' ? b.selectedCommand - b.makeRoomPage * 6 : b.selectedCommand;
          return { mode: b.mode, commands: b.commandTexts.map((t, i) => (i === cursor ? '\\u25b6 ' : '') + t.text) }; })()`);
        if (b.mode === 'gone') { await wait(100); continue; }
        if (b.mode === 'main' && !flag('fight')) {
          const selected = (b.commands.find((c) => c.startsWith('▶')) ?? '');
          if (!selected.includes('RUN')) { await press(selected.includes('FIGHT') || selected.includes('BAG') ? 'ArrowDown' : 'ArrowRight'); continue; }
        }
        await press('Space');
        await wait(150);
        continue;
      }
      if (s.choice) {
        if (answer) { await answer(s.choice); continue; }
        return s;
      }
      if (s.dialog) {
        if (s.said && s.complete && s.said !== lastSaid) { lastSaid = s.said; note(`  says: ${s.said}`); }
        if (!s.complete) { await wait(100); continue; }
        await press('Space');
        await wait(60);
        continue;
      }
      if (s.busy) { await wait(100); continue; }
      return s;
    }
    throw new Error('interruptions never cleared');
  };

  /** A path over the live world, by the line asked for. */
  const plan = (goals, mode) => page.evaluate(`(() => { const w = ${W}; const c = w.collisionData, H = c.length, Wd = c[0].length;
    const grass = w.currentMap.tallGrass, terrain = w.currentMap.terrain; const s = w.currentTile;
    const made = new Set(['sand', 'stone', 'earth', 'paving', 'boards', 'gravel']);
    const goals = ${JSON.stringify(goals)}; const isGoal = (x, y) => goals.some((g) => g.x === x && g.y === y);
    const mode = ${JSON.stringify(mode)}; const wade = mode === 'dry' || mode === 'cut' || mode === 'reeds' ? 3 : 0;
    const id = (x, y) => y * Wd + x; const cost = new Map([[id(s.x, s.y), 0]]); const prev = new Map([[id(s.x, s.y), null]]);
    const buckets = [[[s.x, s.y]]];
    for (let d = 0; d < buckets.length; d += 1) for (const [x, y] of buckets[d] ?? []) {
      if (cost.get(id(x, y)) !== d) continue;
      if (isGoal(x, y)) { const path = []; let cur = id(x, y); while (cur !== null) { path.push({ x: cur % Wd, y: Math.floor(cur / Wd) }); cur = prev.get(cur); } return path.reverse(); }
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= Wd || ny >= H || w.isBlocked({ x: nx, y: ny })) continue;
        if (mode === 'reeds' && nx >= 82 && nx <= 83 && ny >= 188 && ny <= 201) continue;
        if (mode === 'road' && !made.has(terrain[ny][nx]) && !isGoal(nx, ny)) continue;
        const step = d + 1 + (grass[ny][nx] ? wade : 0); const k = id(nx, ny);
        if (cost.has(k) && cost.get(k) <= step) continue; cost.set(k, step); prev.set(k, id(x, y)); (buckets[step] ??= []).push([nx, ny]); } }
    return null; })()`);

  let lineShot = false;
  const KEY = (from, to) => (to.x > from.x ? 'ArrowRight' : to.x < from.x ? 'ArrowLeft' : to.y > from.y ? 'ArrowDown' : 'ArrowUp');
  /** Walks a path holding keys, turning a beat before each corner. */
  const run = async (path, { stopWhen } = {}) => {
    let held = null;
    const hold = async (key) => { if (held === key) return; if (held) await page.keyUp(held); if (key) await page.keyDown(key); held = key; };
    let i = 0;
    for (let guard = 0; guard < 20000; guard += 1) {
      const s = await state();
      if (s.choice) {
        await hold(null);
        return { asked: true };
      }
      if (s.dialog && shots && !lineShot && s.race?.phase === 'over') {
        lineShot = true;
        await hold(null);
        await wait(300);
        await page.screenshot(`${shots}/5-at-the-line.png`);
      }
      if (s.battle || s.dialog) {
        await hold(null);
        if (s.battle) fights += 1;
        await clear();
        // Back from a fight or a line: carry on from where the player stands.
        const at = (await state()).tile;
        const k = path.findIndex((t) => t.x === at.x && t.y === at.y);
        if (k < 0) return { off: true };
        i = k;
        continue;
      }
      if (stopWhen && (await stopWhen(s))) { await hold(null); return { stopped: true }; }
      const at = s.tile;
      const k = path.findIndex((t, index) => index >= i && t.x === at.x && t.y === at.y);
      if (k >= 0) i = k;
      if (i >= path.length - 1 && !s.target) { await hold(null); return { arrived: true }; }
      // Mid-step towards path[i+1]: already hold the way after it, so the step
      // that follows begins the moment this one ends.
      const going = s.target ? path.findIndex((t, index) => index > i && t.x === s.target.x && t.y === s.target.y) : i;
      const from = going >= 0 ? going : i;
      if (from >= path.length - 1) { await hold(null); await wait(FRAME_MS); continue; }
      const key = KEY(path[from], path[from + 1]);
      await hold(key);
      await wait(FRAME_MS);
    }
    throw new Error('the walk never ended');
  };

  // The raid opens on its briefing.
  await clear();
  note(`deployed at ${JSON.stringify((await state()).tile)}, first raid ${await page.evaluate(`${W}.runSession.plan?.stagedChase === true`)}`);
  if (option('record-in')) {
    const record = readFileSync(option('record-in'), 'utf8');
    await page.evaluate(`(() => { const key = 'escape-from-pallet-town.save.v1'; const save = JSON.parse(localStorage.getItem(key));
      save.raidProgress.races = { 'mere-dash': ${record} }; localStorage.setItem(key, JSON.stringify(save)); })()`);
    note(`racing against the best in ${option('record-in')}`);
  }
  const toAsk = await plan([ASK], 'wade');
  if (!toAsk) throw new Error('cannot reach LINNET');
  await run(toAsk);
  await press(ASK.face, 30);
  await wait(100);
  if (shots) await page.screenshot(`${shots}/1-before-asking.png`);
  await press('Space');
  // The offer, read to the end, then the question.
  const asked = await clear();
  if (flag('first')) { note(`first raid: ${asked.choice ? 'ASKED - wrong' : 'no question, as it should be'}`); process.exit(0); }
  if (!asked.choice) throw new Error(`no question: ${JSON.stringify(asked)}`);
  note(`  asks: ${asked.choice.question} [${asked.choice.options.join(' / ')}] selected ${asked.choice.selected}`);
  if (shots) await page.screenshot(`${shots}/2-question.png`);
  for (let guard = 0; guard < 4 && (await state()).choice?.selected !== 0; guard += 1) await press('ArrowLeft');
  await press('Space');
  // "On your marks..." is read before the count.
  await clear();
  await until(`${W}.describeForTest().race?.phase === 'running'`, 'GO');
  const go = await state();
  note(`GO at raid clock ${go.elapsedMs}ms, LINNET due ${go.race.racerMs}ms`);
  if (shots) await page.screenshot(`${shots}/3-go.png`);
  if (slowMs > 0) await wait(slowMs);
  const path = await plan(FINISH, line === 'cut' ? 'cut' : line);
  if (!path) throw new Error(`no ${line} line from ${JSON.stringify(go.tile)}`);
  const wild = await page.evaluate(`(() => { const g = ${W}.currentMap.tallGrass; return ${JSON.stringify(path)}.filter((t) => g[t.y][t.x]).length; })()`);
  note(`line ${line}: ${path.length - 1} steps, ${wild} wild`);
  let shotAt = 0;
  const result = await run(path, {
    stopWhen: async (s) => {
      if (flag('debug-ghost') && s.race && s.race.clockMs - shotAt > 2000) note(`ghost: ${await page.evaluate(`(() => { const g = ${W}.raceGhostSprite; return g ? JSON.stringify({ x: g.x / 16, y: g.y / 16, visible: g.visible, alpha: g.alpha, frame: g.frame.name, tex: g.texture.key, trail: (${W}.raceGhost ?? []).length }) : 'none'; })()`)} player ${JSON.stringify(s.tile)}`);
      if (shots && s.race && s.race.clockMs - shotAt > Number(option('shot-every') ?? 5000)) { shotAt = s.race.clockMs; await page.screenshot(`${shots}/4-running-${Math.round(s.race.clockMs / 1000)}s.png`); }
      return false;
    },
  });
  note(`walk: ${JSON.stringify(result)}, fights ${fights}`);
  // Over the line: the result is read as it is said.
  const over = await state();
  if (shots) await page.screenshot(`${shots}/5-over-the-line.png`);
  const stone = Number(option('stone') ?? 0);
  await clear({
    answer: async (choice) => {
      note(`  asks: ${choice.question} [${choice.options.join(' / ')}]`);
      if (shots) await page.screenshot(`${shots}/6-purse.png`);
      for (let guard = 0; guard < 8 && (await state()).choice?.selected !== stone; guard += 1) await press('ArrowRight');
      await press('Space');
    },
  });
  const after = await state();
  note(`race: ${JSON.stringify(after.race ?? over.race)}`);
  const bag = await page.evaluate(`JSON.stringify(${W}.bag.toJSON().items ?? ${W}.bag.toJSON())`);
  note(`pack: ${bag}`);
  const record = await page.evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1')).raidProgress.races ?? null)`);
  note(`save: ${record}`);
  if (option('record-out')) writeFileSync(option('record-out'), JSON.stringify(JSON.parse(record)['mere-dash']));
} finally {
  browser.close();
}
