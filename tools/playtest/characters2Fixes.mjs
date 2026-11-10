// The faults the second round of playing as six strangers found (1 Nov), each
// played where a player meets it, on stepped frames against a test-mode build
// (`tools/playtest/README.md`). Run against a build of `main` and of the fix,
// it photographs the same moments both ways.
//
//   node tools/playtest/characters2Fixes.mjs <url> <out-dir> [--port=N]
//
// Prints one PASS or FAIL per check, as the fix means it to come out, and
// leaves a picture of each. Exit code 1 is a FAIL.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'characters-2-fixes-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const FRAME_MS = 1000 / 60;
// `--only=stake,job,joy,bill,rack` plays just those.
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
  // What the arrow is doing, on either build: `main` keeps the mark itself in the cache.
  const way = () =>
    page.evaluate(`(() => { const w = ${world}; w.raidWay?.(); const c = w.wayCache; const mark = c && 'mark' in c ? c.mark : c;
      const prize = w.raidHud?.prizeText; return { out: mark?.out ?? null, target: mark ? { x: (mark.target.x - 8) / 16, y: (mark.target.y - 8) / 16 } : null, cue: w.objectiveCue, prize: prize?.visible ? String(prize.text).replace(/\\n/g, ' / ') : '' }; })()`);
  const said = () => page.evaluate(`String(${base}.dialogBox.textObject?.text ?? '').replace(/\\n/g, ' ')`);

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
  /** SPACE, as somebody who does not read, noting every line said and photographing the one that matters. */
  const listen = async (name, matters) => {
    const lines = [];
    let pictured = false;
    for (let presses = 0; presses < 16; presses += 1) {
      await press('Space');
      await wait(1500);
      const line = await said();
      if (line && lines.at(-1) !== line) lines.push(line);
      if (!pictured && matters.test(line)) {
        pictured = true;
        await wait(2500);
        await shot(name);
      }
    }
    return lines;
  };
  const readThrough = async (scene) => {
    for (let guard = 0; guard < 30 && (await page.evaluate(`${scene}.dialogBox.visible`)); guard += 1) await press('Space');
  };
  const hasBeenOut = `save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 2, extracted: 2, wiped: 0 } }; save.raidProgress.benchRaids = 9; save.raidProgress.arenaIntroSeen = true;`;

  if (wanted('stake')) {
    // Fault 1: the stake will not go in the pack, and the arrow lets it go.
    await gameWith(`(save) => { save.raidProgress.arenaIntroSeen = true; }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await jumpIn(page, { press, until, wait });
    await readThrough(world);
    await page.evaluate(`(() => { const w = ${world}; const stake = w.lootForCurrentMap().find((l) => l.id.endsWith('/stake'));
      stake.itemId = 'parts-crate'; stake.quantity = 2;
      const takes = () => w.bag.fits(stake.itemId, stake.quantity) || w.bag.tidyWouldFit(stake.itemId, stake.quantity);
      for (let guard = 0; guard < 40 && takes(); guard += 1) { if (!w.bag.add('potion', 1)) break; } })()`);
    await step(12);
    const full = await way();
    await shot('stake-no-room');
    check('a stake the pack cannot take sends the arrow out', full.out === true, JSON.stringify(full));
    check('the prize chip says how much room it needs', /NO ROOM: NEEDS \d+ SQUARES/.test(full.prize), full.prize);
    await page.evaluate(`(() => { const w = ${world}; while (w.bag.count('potion') > 0 && !(w.bag.fits('parts-crate', 2) || w.bag.tidyWouldFit('parts-crate', 2))) w.bag.remove('potion', 1); })()`);
    await step(12);
    const room = await way();
    await shot('stake-room-made');
    check('room made, the gold arrow comes back for it', room.out === false && /^TAKE /.test(room.cue), JSON.stringify(room));
  }

  if (wanted('job')) {
    // Fault 10, at the rail: what a pressured job does to the hunter, in words.
    await gameWith(`(save) => { ${hasBeenOut} save.raidProgress.standingContractsBanked = 6; }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await openHallPanel(page, 'rim', { press, until, wait });
    await until(`${sceneIs('hub')}`, 'the card');
    await wait(300);
    await shot('rail-hunter-line');
    const card = await page.evaluate(`document.querySelector('.rim-stakes, .px-commit')?.innerText ?? document.body.innerText`);
    check('the hunter line says what the job does', /this job: \d+s sooner/.test(card), card.replace(/\n+/g, ' | ').slice(0, 400));

    // Fault 4: with a job, the arrow and the chip are after the same stop.
    await jumpIn(page, { press, until, wait });
    await readThrough(world);
    await step(12);
    const job = await way();
    const stops = await page.evaluate(`(${world}.runSession.plan.contract?.markers ?? []).map((m) => ({ ...m.position, cue: m.cue }))`);
    await shot('job-arrow');
    const atStop = job.target && stops.some((stop) => stop.x === job.target.x && stop.y === job.target.y);
    check('the gold arrow goes to the job the chip names', atStop && stops.some((stop) => job.cue.startsWith(stop.cue)), `${JSON.stringify(job)} stops ${JSON.stringify(stops)}`);
  }

  if (wanted('joy')) {
    // Fault 8: a debt already at the cap holds the next heal back.
    await gameWith(`(save) => { ${hasBeenOut} save.pendingRecoveryMs = 150000; save.stash.pokemon[0].pokemon.currentHp = 3; }`);
    await page.evaluate(`void ${base}.scene.restart({ savedGame: ${base}.saveManager.load(), room: 'pokemon-centre' })`);
    await until(`${base}.ready && ${base}.room?.id === 'pokemon-centre'`, 'the Center');
    const joy = await listen('joy-at-cap', /as short as|It will not cost/);
    const after = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash.pokemon[0].pokemon.currentHp`);
    check('at the cap, SPACE does not heal for free', after === 3, `hp ${after}; she said: ${joy.join(' | ')}`);
  }

  if (wanted('bill')) {
    // Fault 3: Bill says what gets a stranger on his books.
    await gameWith(`(save) => { ${hasBeenOut} save.stash.items.money = 570; }`);
    await page.evaluate(`void ${base}.scene.restart({ savedGame: ${base}.saveManager.load(), room: 'bills-cottage' })`);
    await until(`${base}.ready && ${base}.room?.id === 'bills-cottage'`, 'the cottage');
    const bill = await listen('bill-stranger', /Bring things home|Bank a job/);
    check('Bill names the way in', bill.some((line) => /Bank \d+ jobs? off Oak's board/.test(line)), bill.join(' | '));
  }

  if (wanted('rack')) {
    // Fault 9: the rack's box about a row stands beside it, not over the next.
    await gameWith(`(save) => { ${hasBeenOut} }`);
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await openHallPanel(page, 'rack', { press, until, wait });
    await until(`${sceneIs('hub')} && document.querySelector('[data-describes] [data-count-dir]')`, 'the rack');
    await press('ArrowDown');
    await press('ArrowUp');
    // The box keeps the page's own clock, not the stepped one.
    await sleep(1400);
    await shot('rack-hover');
    const covered = await page.evaluate(`(() => { const tip = document.querySelector('.px-tip'); if (!tip) return 'no box';
      const t = tip.getBoundingClientRect(); const names = [...document.querySelectorAll('.px-row strong')];
      return names.filter((n) => { const r = n.getBoundingClientRect(); return r.right > t.left && t.right > r.left && r.bottom > t.top && t.bottom > r.top; }).map((n) => n.innerText).join(', '); })()`);
    check('the hover box covers no row’s name', covered === '', covered || 'none covered');
  }

} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
