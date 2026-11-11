// The four clarity findings of the second first-hour bug hunt of 11 Nov 2026,
// each played where a player meets it, on stepped frames against a test-mode
// build (`tools/playtest/README.md`). Run against a build of `main` and of the
// fix, it photographs the same moments both ways (`docs/screens/first-hour-2-fixes/`).
//
//   node tools/playtest/firstHour2Fixes.mjs <url> <out-dir> [--port=N] [--only=marshal,noballs,fainted]
//
// Prints one PASS or FAIL per check, as the fix means it to come out, and
// leaves a picture of each. Exit code 1 is a FAIL - which a build of `main` is
// expected to give. (The fourth finding, the partner's gear on the result
// screen, was fixed by #510 and is photographed by its own fixer.)
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'first-hour-2-fixes-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const FRAME_MS = 1000 / 60;
const only = option('only')?.split(',');
const wanted = (name) => !only || only.includes(name);
const browser = option('port') ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
let failed = false;
const check = (name, ok, detail = '') => {
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

try {
  const page = await browser.openPage('about:blank');
  const step = (n = 6) => page.evaluate(`${GAME}.stepFrames(${n}, ${FRAME_MS})`);
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 1500; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(6);
    }
    throw new Error(`never saw ${what}`);
  };
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const press = async (code) => {
    await page.tap(code, 0);
    await step(4);
    await wait(120);
  };
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const base = `${GAME}.scene.getScene('base')`;
  const text = (selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);

  /** A fresh game, the save edited, and back in through CONTINUE. */
  const gameWith = async (edit) => {
    await page.send('Page.navigate', { url });
    await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
    await page.evaluate(`localStorage.clear()`);
    await page.send('Page.navigate', { url });
    await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(sceneIs('base'), 'the base');
    await until(`${base}.takeStarterForDriver?.('charmander') === true`, 'the table');
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
    await until(`${base}.ready && !${base}.room`, 'the yard');
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${edit})(save); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url });
    await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(`${sceneIs('base')} && ${base}.ready`, 'the base again');
  };
  // Out twice and home twice, with the hall's first words heard, so nobody explains the room again.
  const hasBeenOut = `save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 2, extracted: 2, wiped: 0 } }; save.raidProgress.benchRaids = 9; save.raidProgress.arenaIntroSeen = true;
    save.raidProgress.firstWordsHeard = [...new Set([...(save.raidProgress.firstWordsHeard ?? []), 'loadout'])];`;
  // Every ball the vault holds thrown, which is how a catch-happy newcomer gets here.
  const noBalls = `for (const id of Object.keys(save.stash.items)) if (/ball$/.test(id)) delete save.stash.items[id];`;

  /** Walks to the tile east of the marshal, faces her and speaks. */
  const speakToMarshal = async () => {
    for (let guard = 0; guard < 200; guard += 1) {
      const move = await page.evaluate(
        `(() => { const b = ${base}; if (!b.ready || b.targetTile) return { wait: true };
          const k = b.room.keeper.position, goal = { x: k.x + 1, y: k.y };
          const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
          // A station's floor tile and the rim open their panels, so the walk goes round them.
          const opens = new Set([...b.arenaStations.flatMap((each) => each.tiles.map((t) => id(t.x, t.y + 1))), ...b.arenaRim.map((t) => id(t.x, t.y))]);
          if (s.x === goal.x && s.y === goal.y) return b.facing === 'left' ? { there: true } : { key: 'ArrowLeft' };
          const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
          while (queue.length) { const [x, y] = queue.shift();
            if (x === goal.x && y === goal.y) { found = [x, y]; break; }
            for (const [dx, dy, key] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || opens.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
              prev.set(id(nx, ny), [x, y, key]); queue.push([nx, ny]); } }
          if (!found) return { unreachable: true };
          let cur = found, key = null;
          for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
          return { key }; })()`,
      );
      if (move.unreachable) throw new Error('nothing walks to the marshal');
      if (move.there) break;
      if (move.key) await press(move.key);
      await wait(180);
    }
    await press('Space');
    await wait(1500);
    return String(await page.evaluate(`${base}.dialogBox?.visible ? ${base}.dialogBox.textObject?.text : ''`)).replace(/\s+/g, ' ');
  };

  if (wanted('marshal')) {
    // Finding 1: no balls at all, and Bill still sees a stranger.
    await gameWith(`(save) => { ${hasBeenOut} ${noBalls} }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    // The walk in leaves the bench open: put the Charmander on it and step back into the hall.
    await until(`${sceneIs('hub')} && !!document.querySelector('[data-pokemon]')`, 'the bench');
    await page.evaluate(`(() => { const row = document.querySelector('[data-pokemon]'); if (!row.classList.contains('is-selected')) row.click(); })()`);
    await wait(300);
    await wait(300);
    for (let guard = 0; guard < 6 && (await page.evaluate(sceneIs('hub'))); guard += 1) await press('Escape');
    await until(`${base}.ready && !${sceneIs('hub')}`, 'the hall');
    const said = await speakToMarshal();
    await shot('marshal-no-balls');
    check('the marshal does not send a stranger to Bill', !/Bill sells them/.test(said) && /stranger/.test(said), said);
    await press('Space');
    await wait(1500);
    const then = String(await page.evaluate(`${base}.dialogBox?.visible ? ${base}.dialogBox.textObject?.text : ''`)).replace(/\s+/g, ' ');
    await shot('marshal-no-balls-then');
    check('and says where balls come from instead', /out there/.test(then) && /jobs/.test(then), then);
  }

  if (wanted('noballs')) {
    // Finding 4: the rim card with no balls at base.
    await gameWith(`(save) => { ${hasBeenOut} ${noBalls} }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await openHallPanel(page, 'rim', { press, until, wait });
    await until(`${sceneIs('hub')} && !!document.querySelector('.rim-stakes')`, 'the card');
    await wait(300);
    const card = await text('.confirm-bar');
    await shot('rim-no-balls');
    check('the card says a found ball still catches', /only catch with a ball you find out there/.test(card) && !/nothing can be caught/.test(card), card.replace(/\n+/g, ' | '));
  }

  if (wanted('fainted')) {
    // Finding 3: home from a wipe with everyone fainted, at the rail before Joy.
    await gameWith(`(save) => { ${hasBeenOut} for (const stored of save.stash.pokemon) stored.pokemon.currentHp = 0; }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await openHallPanel(page, 'rim', { press, until, wait });
    await until(`${sceneIs('hub')} && !!document.querySelector('.rim-stakes')`, 'the card');
    await wait(300);
    const card = await text('.confirm-bar');
    await shot('rim-all-fainted');
    check('the card says Joy can revive them', /Nurse Joy can revive them/.test(card), card.replace(/\n+/g, ' | '));
    check('and nothing in red about a wipe costing everything', !/a wipe costs you everything/.test(card));
  }
} catch (error) {
  failed = true;
  console.log(`FAIL driver - ${error.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
