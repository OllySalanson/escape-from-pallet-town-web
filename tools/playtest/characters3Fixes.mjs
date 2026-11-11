// The faults the characters bug hunt of 11 Nov 2026 found, each played where a
// player meets it, on stepped frames against a test-mode build
// (`tools/playtest/README.md`). Run against a build of `main` and of the fix,
// it photographs the same moments both ways (`docs/screens/characters-3-fixes/`).
//
//   node tools/playtest/characters3Fixes.mjs <url> <out-dir> [--port=N] [--only=locker,grow,room,stone,walk]
//
// Prints one PASS or FAIL per check, as the fix means it to come out, and
// leaves a picture of each. Exit code 1 is a FAIL - which a build of `main` is
// expected to give.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'characters-3-fixes-shots'] = args.filter((arg) => !arg.startsWith('--'));
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
  const world = `${GAME}.scene.getScene('world')`;
  const battle = `${GAME}.scene.getScene('battle')`;
  const text = (selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
  const help = () => text('.px-help');

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
  const hasBeenOut = `save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 2, extracted: 2, wiped: 0 } }; save.raidProgress.benchRaids = 9; save.raidProgress.arenaIntroSeen = true;`;
  /** The partner, turned into another of its line. */
  const partnerIs = (speciesId, level) => `const partner = save.stash.pokemon[0].pokemon; partner.speciesId = '${speciesId}'; partner.level = ${level};`;

  /** THE LOCKER with the cursor on the partner's row, then pressed. */
  const lockerRow = async (name) => {
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await openHallPanel(page, 'locker', { press, until, wait });
    await until(`${sceneIs('hub')} && !!document.querySelector('[data-secure-pokemon]')`, 'the locker');
    await page.evaluate(`document.querySelector('[data-secure-pokemon]').focus()`);
    await wait(300);
    const row = await help();
    await shot(`${name}-row`);
    await page.evaluate(`document.querySelector('[data-secure-pokemon]').click()`);
    await wait(300);
    const pressed = await text('.px-status-line');
    const note = await text('.secure-group .px-note');
    await shot(`${name}-pressed`);
    return { row, pressed, note };
  };

  if (wanted('locker')) {
    // Major 1's wording: a Charizard with both lockers built.
    await gameWith(`(save) => { ${hasBeenOut} ${partnerIs('charizard', 36)} save.raidProgress.workshopUpgrades = ['secure-locker-1', 'secure-locker-2']; }`);
    const { row, pressed, note } = await lockerRow('locker-charizard');
    check('the row says no container will hold it', /Too big for any secure container/.test(row), row);
    check('the press says a wipe will take it and offers nothing impossible', /too big for any secure container/.test(pressed) && !/Take something out|grow the container/.test(pressed), pressed);
    check('the note says nothing here can go in', /fits any secure container/.test(note), note);
  }

  if (wanted('grow')) {
    // A Charmeleon on a fresh base: growing is the answer, and it is named.
    await gameWith(`(save) => { ${hasBeenOut} ${partnerIs('charmeleon', 16)} }`);
    const { row, pressed } = await lockerRow('locker-charmeleon');
    check('the row names what to build', /To secure it, build Secure locker I at Brock/.test(row), row);
    check('the press does not say take something out of a 2x2', !/Take something out/.test(pressed) && /Secure locker I/.test(pressed), pressed);
  }

  if (wanted('room')) {
    // Lesser 1: a full pack, a ball at a wild Pokemon, and the panel it opens.
    await gameWith(`(save) => { ${hasBeenOut} }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await jumpIn(page, { press, until, wait });
    for (let guard = 0; guard < 30 && (await page.evaluate(`${world}.dialogBox.visible`)); guard += 1) await press('Space');
    await page.evaluate(`(() => { const w = ${world}; for (let guard = 0; guard < 60; guard += 1) { if (!w.bag.add('potion', 1)) break; }
      w.transitionToBattle({ wild: { speciesId: 'zubat', level: 6 }, teachingBattle: false }); })()`);
    await until(sceneIs('battle'), 'the fight');
    for (let guard = 0; guard < 20 && (await page.evaluate(`${battle}.mode`)) !== 'main'; guard += 1) await press('Space');
    await until(`${battle}.mode === 'main'`, 'the command menu');
    await page.evaluate(`(() => { const b = ${battle}; const row = b.commandTexts.find((t) => t.text.includes('BALL')); row.emit('pointerdown'); })()`);
    await wait(300);
    const potions = await page.evaluate(`${battle}.bag.count('potion')`);
    // The SPACE that reads the refusal, and the one a masher presses after it.
    for (let guard = 0; guard < 8 && (await page.evaluate(`${battle}.mode`)) !== 'make-room'; guard += 1) await press('Space');
    await wait(300);
    const cursor = await page.evaluate(`(() => { const b = ${battle}; return b.commandTexts[b.selectedCommand - b.makeRoomPage * 6]?.text ?? ''; })()`);
    await shot('make-room-opens');
    check('the panel opens on KEEP THE PACK', /KEEP THE PACK/.test(cursor), cursor);
    await press('Space');
    await wait(400);
    const after = await page.evaluate(`${battle}.bag.count('potion')`);
    await shot('make-room-second-press');
    check('the press after the refusal drops nothing', after === potions, `${potions} Potions, then ${after}`);
  }

  if (wanted('stone')) {
    // Lesser 2: a Thunder Stone on a Pikachu from YOUR THINGS.
    await gameWith(`(save) => { ${hasBeenOut} ${partnerIs('pikachu', 20)} save.stash.items['thunder-stone'] = 1; }`);
    await press('KeyB');
    await until(`${sceneIs('things')} && !!document.querySelector('[data-thing="thunder-stone"]')`, 'YOUR THINGS');
    await page.evaluate(`document.querySelector('[data-thing="thunder-stone"]').click()`);
    await until(`!!document.querySelector('[data-target="0"]')`, 'who it goes to');
    await page.evaluate(`document.querySelector('[data-target="0"]').click()`);
    // Mid-flicker, and then once it has settled on the one it became.
    await wait(500);
    await shot('stone-moment-flicker');
    await wait(1200);
    await shot('stone-moment');
    // The ENTER after the one that used it, as a masher presses it.
    const moment = await page.evaluate(`!!document.querySelector('[data-evolve-moment]')`);
    check('the evolution is a moment on screen', moment);
    await press('Enter');
    await wait(400);
    await shot('stone-after');
    check('a key ends it, and the list says what happened', /evolved into Raichu/.test(await help()), await help());
  }

  if (wanted('walk')) {
    // The clarity note: how much of the clock the job on the board is walking.
    await gameWith(`(save) => { ${hasBeenOut} save.raidProgress.standingContractsBanked = 6; }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await openHallPanel(page, 'rim', { press, until, wait });
    await until(`${sceneIs('hub')} && !!document.querySelector('.rim-stakes')`, 'the card');
    await wait(300);
    const card = await text('.rim-stakes');
    await shot('rim-job-walk');
    check('the Job line says how long the job walks', /Walked straight, it takes \d+:\d\d of your \d+:\d\d/.test(card), card.replace(/\n+/g, ' | '));
  }
} catch (error) {
  failed = true;
  console.log(`FAIL driver - ${error.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
