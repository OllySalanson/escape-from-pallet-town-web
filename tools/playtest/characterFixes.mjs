// The faults a round of playing as six strangers found, each played where a player
// meets it, on stepped frames against a test-mode build (`tools/playtest/README.md`).
//
//   node tools/playtest/characterFixes.mjs <url> <out-dir> [--port=N]
//
// Prints one PASS or FAIL per check and leaves a picture of each. Exit code 1 is a FAIL.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'character-fixes-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const FRAME_MS = 1000 / 60;
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
    await until(`${base}.takeStarterForDriver?.('squirtle') === true`, 'the table');
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
    await until(`${base}.ready && !${base}.room`, 'the yard');
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${edit})(save); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url });
    await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
    await page.evaluate(`${GAME}.pauseLoop()`);
    await press('Space');
    await until(`${sceneIs('base')} && ${base}.ready`, 'the base again');
  };
  const hasBeenOut = `save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 2, extracted: 2, wiped: 0 } }; save.raidProgress.benchRaids = 9; save.raidProgress.arenaIntroSeen = true;`;

  // Fault 11: the canvas follows the stage at 1x as it does at every other zoom.
  await gameWith(`(save) => { ${hasBeenOut} }`);
  for (const [width, height] of [[400, 256], [320, 240], [300, 700], [400, 256], [1200, 768]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await step(4);
    const size = await page.evaluate(`(() => { const c = document.querySelector('#app > canvas'), p = document.querySelector('#app'); return { css: c.style.width + 'x' + c.style.height, parent: p.style.width + 'x' + p.style.height }; })()`);
    check(`canvas at ${width}x${height}`, size.css === size.parent, JSON.stringify(size));
  }

  // Fault 12: the walk every new player makes, on one held key.
  await until(`${base}.ready`, 'the yard');
  await page.evaluate(`(() => { const b = ${base}; b.currentTile = { x: 22, y: 12 }; b.setPlayerPosition?.(22 * 16, 12 * 16); })()`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowLeft', key: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await step(40);
  await shot('yard-walk');
  for (let frames = 0; frames < 300 && (await page.evaluate(`${base}.currentTile.x`)) > 9; frames += 10) await step(10);
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowLeft', key: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  const after = await page.evaluate(`${base}.currentTile`);
  check('one key across the yard reaches the runner', after.x <= 9, JSON.stringify(after));

  // Fault 2: hurt at the rail, and what SPACE does.
  await gameWith(`(save) => { ${hasBeenOut} save.stash.pokemon[0].pokemon.currentHp = 1; save.stash.pokemon[0].pokemon.primaryStatus = 'burn'; for (const id of ['potion', 'super-potion']) delete save.stash.items[id]; }`);
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  await openHallPanel(page, 'rim', { press, until, wait });
  await until(`${sceneIs('hub')}`, 'the card');
  await wait(300);
  await shot('rail-hurt');
  const smallest = async (name) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 240, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await step(4);
    await sleep(300);
    await shot(name);
    await page.send('Emulation.setDeviceMetricsOverride', { width: PIXEL_WINDOW.width, height: PIXEL_WINDOW.height, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await step(4);
  };
  await smallest('rail-hurt-320');
  const card = await page.evaluate(`document.querySelector('.rim-stakes')?.innerText ?? ''`);
  check('the card says who is hurt', /at 1\/\d+ and burned/.test(card), card.replace(/\n+/g, ' | '));
  const cursor = await page.evaluate(`document.activeElement?.innerText ?? ''`);
  check('the cursor is on NOT YET', /not yet/i.test(cursor), cursor);
  await press('Space');
  await wait(300);
  check('SPACE on it does not jump', await page.evaluate(`!${sceneIs('world')}`));

  // Fault 4: everybody fainted, and Joy opens on YES.
  await gameWith(`(save) => { ${hasBeenOut} for (const stored of save.stash.pokemon) stored.pokemon.currentHp = 0; }`);
  // Straight on to her mat, then nothing but SPACE, as somebody who does not read.
  await page.evaluate(`void ${base}.scene.restart({ savedGame: ${base}.saveManager.load(), room: 'pokemon-centre' })`);
  await until(`${base}.ready && ${base}.room?.id === 'pokemon-centre'`, 'the Center');
  const healthNow = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash.pokemon[0].pokemon.currentHp`);
  let presses = 0;
  let pictured = false;
  while (presses < 8 && (await healthNow()) === 0) {
    await press('Space');
    presses += 1;
    await wait(500);
    if (!pictured && (await page.evaluate(`Boolean(${base}.boxQuestion)`))) {
      pictured = true;
      await shot('joy-first');
    }
  }
  check('SPACE alone heals somebody with nobody left, and soon', (await healthNow()) > 0 && presses <= 4, `${presses} presses`);

  // Fault 8: a save from before the maps moved, with a team and no bench.
  await gameWith(`(save) => { save.raidProgress.raidRecord = { 'route-1': { deployed: 20, extracted: 12, wiped: 8 } }; save.raidProgress.arenaIntroSeen = true; save.raidProgress.benchRaids = 9; delete save.raidProgress.lastBench; save.stash.pokemon.push({ id: 'pidgey-1', pokemon: { speciesId: 'pidgey', level: 8, currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } }); }`);
  await wait(300);
  await shot('old-save-news');
  const news = await page.evaluate(`${base}.dialogBox.visible`);
  check('somebody says the old maps are shut', news === true);
  for (let guard = 0; guard < 24 && (await page.evaluate(`${base}.dialogBox.visible`)); guard += 1) await press('Space');
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  await openHallPanel(page, 'rim', { press, until, wait });
  await until(`${sceneIs('hub')}`, 'the card');
  await wait(300);
  await shot('old-save-rim');
  check('the bench is not empty at the rail', await page.evaluate(`${GAME}.scene.getScene('hub').flow.party.length === 1 && !${GAME}.scene.getScene('hub').flow.notReady`));

  // The card names who is lost for good. Fault 13: the stamp says what it is.
  await gameWith(`(save) => { ${hasBeenOut} save.raidProgress.benchRaids = 1; save.raidProgress.lastBench = ['squirtle-1', 'pidgey-1']; save.stash.pokemon.push({ id: 'pidgey-1', pokemon: { speciesId: 'pidgey', level: 8, currentHp: 9999, xp: 0, moves: [], pendingMoves: [], primaryStatus: null, heldItemId: null } }); }`);
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  await openHallPanel(page, 'rim', { press, until, wait });
  await until(`${sceneIs('hub')}`, 'the card');
  await wait(300);
  await shot('rail-for-good');
  const stakes = await page.evaluate(`document.querySelector('.rim-stakes')?.innerText ?? ''`);
  check('the card says who is lost for good', /lost for good/.test(stakes), stakes.replace(/\n+/g, ' | '));
  await page.evaluate(`document.querySelector('button[data-start]').click()`);
  await until(`${base}.jump?.breath`, 'the held breath');
  await step(60);
  await shot('held-breath');
  check('the stamp starts AT RISK', (await page.evaluate(`${base}.stakesGoingOver()[0]`)) === 'AT RISK');
  await until(sceneIs('world'), 'the raid');
  await until(`!${GAME}.scene.getScene('world').arrival`, 'the landing');

  // Fault 10: the defeat line-up, with a Pokemon in the secure slot.
  await page.evaluate(`void ${GAME}.scene.getScene('world').transitionToBattle({ wild: { speciesId: 'rattata', level: 3 }, teachingBattle: false })`);
  await until(`${sceneIs('battle')} && ${GAME}.scene.getScene('battle').state`, 'the fight');
  await wait(1500);
  await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('battle'); b.resolveRunWipe(); })()`);
  await until(sceneIs('extraction'), 'the result');
  for (let guard = 0; guard < 8 && !(await page.evaluate(`document.querySelector('[data-defeat]')?.dataset.beat?.includes('held')`)); guard += 1) {
    await wait(900);
    await press('Space');
  }
  await wait(900);
  // The stamps are CSS, which keeps the page's clock and not the stepped one.
  await sleep(1500);
  await shot('defeat-held');
  const overlapping = await page.evaluate(`[...document.querySelectorAll('.defeat-meta')].some((meta) => { const [a, b] = meta.children; if (!a || !b) return false; const r = a.getBoundingClientRect(), s = b.getBoundingClientRect(); return r.right > s.left && s.right > r.left && r.bottom > s.top && s.bottom > r.top; })`);
  check('no level and verdict print over each other', overlapping === false);
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
