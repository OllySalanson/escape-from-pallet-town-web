// Plays the fixes to the wave 3 playtest's findings as a playtester meets them,
// and photographs each, on the explorer run (`?playtest`):
//
//  1. THE PROMENADE DERBY is drawn in THE HARBOUR's own tiles, the standings
//     and the sprint in a column of their own off the track;
//  2. last place is told what pays, never "A new best!" or "the day has paid";
//  3. the foe in a bout stands on its spot, inside the field;
//  4. a big partner following the player up to the dojo counter is drawn
//     behind them, never over their legs;
//  5. BERRY PICKING's meter says MISSES LEFT;
//  6. the board's PRACTISE TO LOSE puts a Lv 10 Caterpie alone on the bench and
//     stands the player beside the leader, so a lost practice says what beat you;
//  7. the dojo's hint is along the foot, clear of the class board;
//  8. reading the class board, the head mark is out of its writing;
//  9. reading HIGH SCORES the same, its first line a score, and its picture
//     every game on the promenade;
// 10. a jumper stands on the dirt in POKéMON JUMP;
// 11. YOUR TEAM will not send nobody.
//
//   node tools/playtest/waveThreePolish.mjs <test-mode build url> <out dir> [--port=<cdp port>] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels`).
// Exit code 1 is anything not where it should be.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';

const args = process.argv.slice(2);
const [url = 'http://localhost:4173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};
const withParam = (address, param) => `${address}${address.includes('?') ? '&' : '?'}${param}`;

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  const BASE = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready && !${BASE}.leaving`;
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression, tries = 600) => {
    for (let attempt = 0; attempt < tries; attempt += 1) {
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
  const base = (expression) => page.evaluate(`(() => { const b = ${BASE}; return ${expression}; })()`);
  const save = () => page.evaluate(`JSON.parse(localStorage.getItem('${PLAYTEST_SAVE_KEY}'))`);
  /** Starts the harbour again where `data` says, as the PLAYTEST BOARD does, and spends the lost first key. */
  const goTo = async (data, what) => {
    await page.evaluate(`void ${BASE}.goTo({ savedGame: ${BASE}.freshGame(), ...${JSON.stringify(data)} }, 'confirm')`);
    await wait(300);
    await until(baseReady, what);
    await wait(900);
    await press('KeyZ');
  };
  const readLines = async (scene, limit = 900) => {
    const said = [];
    for (let guard = 0; guard < limit && !(await page.evaluate(sceneIs('base'))); guard += 1) {
      const line = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('${scene}'); return s?.sys.isActive() && s.dialog?.isCurrentMessageComplete ? s.dialog.textObject?.text : null; })()`);
      if (line && line !== said.at(-1)) said.push(line);
      await page.tap('Space', 0);
      await wait(250);
    }
    return said;
  };

  // The explorer run, from nothing.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.removeItem('${PLAYTEST_SAVE_KEY}')`);
  await page.send('Page.navigate', { url: withParam(url, 'playtest') });
  await page.waitFor(baseReady, { what: 'the harbour', timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await wait(1200);
  await press('KeyZ');

  // --- 1 and 2: THE PROMENADE DERBY, ridden by a Golem ----------------------
  await page.evaluate(`void ${BASE}.openMinigame('derby')`);
  await until(sceneIs('derby'), 'the derby screen');
  await wait(400);
  const golem = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('derby'); const g = s.savedGame.stash.listPokemon().find((p) => p.pokemon.base.id === 'golem'); return g?.id ?? null; })()`);
  expect(`the kit has a Golem to race badly (${golem})`, golem !== null);
  await page.evaluate(`${GAME}.scene.getScene('derby').playWith(${JSON.stringify(golem)})`);
  await until(`${GAME}.scene.getScene('derby').isPlaying`, 'the race');
  await wait(6500);
  await shoot('01-derby-racing');
  const derbyLook = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('derby'); const c = s.cameras.main;
    return { tiles: Boolean(s.tilemap), trackWidth: c.width, screenWidth: s.scale.width, cameras: s.cameras.cameras.length }; })()`);
  expect(`the derby is laid in the harbour's own tiles (${JSON.stringify(derbyLook)})`, derbyLook.tiles);
  expect('the standings stand in a column off the track', derbyLook.trackWidth < derbyLook.screenWidth && derbyLook.cameras === 2);
  for (let guard = 0; guard < 60 * 60 && (await page.evaluate(`${GAME}.scene.getScene('derby').isPlaying`)); guard += 1) await step(10);
  await wait(400);
  await shoot('02-derby-result');
  const result = await page.evaluate(`document.querySelector('.confirm-bar, .px-commit')?.textContent ?? document.body.textContent`);
  const placed = /(\d)(ST|ND|RD|TH) OF 6/i.exec(result);
  console.log(`  derby result: ${placed?.[0] ?? 'no place'}`);
  if (placed && Number(placed[1]) >= 4) {
    expect('a place off the podium is told what pays', /No tickets\. The podium pays, from 3rd\./.test(result));
    expect('and is never a new best, nor a tier the day has paid', !/A new best|day has paid/.test(result));
  } else {
    console.log('  (the Golem made the podium this time; the wording is held by tickets.test.ts)');
  }
  await press('Escape');
  await until(baseReady, 'the harbour after the derby');
  await wait(300);

  // --- 5: BERRY PICKING's meter ---------------------------------------------
  await page.evaluate(`void ${BASE}.openMinigame('berry-picking')`);
  await until(sceneIs('berry-picking'), 'the berry screen');
  await wait(400);
  await page.evaluate(`document.querySelector('[data-picker^="dodrio"]')?.click()`);
  await wait(200);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('berry-picking').phaseKind === 'playing'`, 'berries falling');
  await wait(4000);
  await shoot('03-berry-meter');
  const meter = await page.evaluate(`${GAME}.scene.getScene('berry-picking').children.list.flatMap((o) => o.list ?? [o]).map((o) => o.text).filter(Boolean)`);
  expect(`the meter says MISSES LEFT (${meter.join(' | ')})`, meter.includes('MISSES LEFT') && !meter.includes('BERRIES DROPPED'));
  await press('Escape');
  await wait(600);
  await press('Escape');
  await until(baseReady, 'the harbour after berries');

  // --- 10: a jumper on the dirt ------------------------------------------------
  await page.evaluate(`void ${BASE}.openGameCorner('jump')`);
  await until(sceneIs('game-corner'), 'the jump screen');
  await wait(400);
  await page.evaluate(`document.querySelector('[data-jumper]:not([aria-disabled])')?.click()`);
  await wait(200);
  await page.evaluate(`document.querySelector('[data-play]').click()`);
  await until(`${GAME}.scene.getScene('game-corner').jumpGame`, 'the vine');
  await wait(600);
  await shoot('04-jumper-on-the-dirt');
  const feet = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('game-corner'); return { feet: s.jumperFeet, ground: s.scale.height - 26, lip: Boolean(s.jumperLip) }; })()`);
  expect(`the jumper's feet are at or under the ground line, behind the lip (${JSON.stringify(feet)})`, feet.lip && feet.feet.every((y) => y > feet.ground));
  await press('Escape');
  await wait(600);
  await press('Escape');
  await until(baseReady, 'the harbour after the jump');

  // --- 4 and 7: THE BATTLE ARENA's counter, a Charizard at heel ----------------
  await goTo({ room: 'battle-arena' }, 'the dojo');
  await shoot('05-dojo-mat-hint');
  const hint = await base(`({ y: b.hintText.visible ? b.hintText.y : null, height: b.scale.height })`);
  expect(`the dojo's hint is along the foot, clear of the class board (${JSON.stringify(hint)})`, hint.y === null || hint.y > hint.height / 2);
  for (let guard = 0; guard < 8; guard += 1) {
    await press('ArrowUp');
    await wait(220);
  }
  await wait(400);
  await shoot('06-partner-behind-at-the-counter');
  const depths = await base(`(() => { const p = b.partner?.place; const s = b.currentTile; const sprite = b.partner?.sprite;
    return { dy: p && p.out ? p.tile.y - s.y : null, partner: sprite?.depth ?? null, player: b.player.depth }; })()`);
  console.log(`  partner against player: ${JSON.stringify(depths)}`);
  if (depths.dy === 1) expect('a partner a row below the player is drawn behind them', depths.partner < depths.player);

  // --- 8: the class board ----------------------------------------------------------
  await goTo({ room: 'battle-arena', at: { x: 1, y: 2 }, facing: 'up' }, 'under the class board');
  await press('Space');
  await wait(500);
  await shoot('07-reading-the-class-board');
  expect('reading the class board, the head mark is out of its writing', !(await base('b.playerHeadMark.visible')));
  for (let guard = 0; guard < 10 && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) {
    await press('Space');
    await wait(250);
  }

  // --- 9: HIGH SCORES --------------------------------------------------------------
  await goTo({ room: 'game-corner', at: { x: 12, y: 3 }, facing: 'up' }, 'under HIGH SCORES');
  await press('Space');
  await wait(500);
  await shoot('08-reading-high-scores');
  const firstLine = await base(`b.dialogBox?.visible ? b.dialogBox.textObject?.text : ''`);
  expect('reading HIGH SCORES, the head mark is out of its writing', !(await base('b.playerHeadMark.visible')));
  expect(`its first line is a score, not the caption again (${String(firstLine).replace(/\s+/g, ' ')})`, /^JUMP:/.test(String(firstLine)));
  for (let guard = 0; guard < 12 && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) {
    await press('Space');
    await wait(250);
  }

  // --- 6 and 3: PRACTISE TO LOSE ---------------------------------------------------
  // The board's PRACTISE TO LOSE row, run as pressing it runs it.
  await page.evaluate(`${BASE}.actOnPlaytestBoard({ kind: 'stand', room: 'raid-arena', facing: 'left', bench: 'weak' })`);
  await wait(300);
  await until(`${baseReady} && ${BASE}.place.room?.room.id === 'raid-arena'`, 'the hall');
  await wait(1500);
  await press('KeyZ');
  await shoot('09-beside-the-leader');
  const bench = (await save()).raidProgress.lastBench;
  const benchSpecies = await base(`b.freshGame().stash.listPokemon().filter((p) => ${JSON.stringify(bench)}.includes(p.id)).map((p) => p.pokemon.base.id + ' ' + p.pokemon.level)`);
  expect(`the bench is one Lv 10 Caterpie (${benchSpecies.join(', ')})`, benchSpecies.length === 1 && benchSpecies[0] === 'caterpie 10');
  expect(`the player stands beside the leader, facing them (${await base('b.facing')})`, (await base('b.facing')) === 'left');
  await press('Space');
  await wait(400);
  for (let guard = 0; guard < 20 && !(await page.evaluate(sceneIs('battle'))); guard += 1) {
    // Through the leader's words to YES.
    await press('Space');
    await wait(300);
  }
  await until(sceneIs('battle'), 'the practice bout');
  await wait(1500);
  await shoot('10-the-foe-on-its-spot');
  const foe = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); const sprite = s.sprites.get('enemy:0') ?? [...s.sprites.values()][0]; return { x: sprite?.x ?? null, keys: [...s.sprites.keys()] }; })()`);
  expect(`the foe has slid all the way in to its spot (${JSON.stringify(foe)})`, foe.x === 245);
  const said = await readLines('battle');
  console.log(`  last lines: ${said.slice(-3).map((line) => line.replace(/\s+/g, ' ')).join(' | ')}`);
  const lost = said.some((line) => /lost the bout/i.test(line));
  expect(`a Lv 10 Caterpie loses the practice: the explorer run's floor is off for a bout for show (${lost ? 'it lost' : 'it did not lose'})`, lost);
  const beat = said.find((line) => /What beat you/.test(line));
  console.log(`  ${beat ? beat.replace(/\s+/g, ' ') : 'nothing stood out as what beat it'}`);
  await until(baseReady, 'the hall after the practice');
  await wait(600);
  await shoot('11-after-the-practice');

  // --- 11: YOUR TEAM will not send nobody --------------------------------------------
  for (let guard = 0; guard < 12 && (await base('Boolean(b.dialogBox?.visible)')); guard += 1) {
    await press('Space');
    await wait(250);
  }
  await goTo({}, 'the yard');
  await press('KeyP');
  await until(sceneIs('team'), 'YOUR TEAM');
  await wait(800);
  const lone = (await save()).raidProgress.lastBench;
  await page.evaluate(`document.querySelector('[data-member="${lone[0]}"]')?.click()`);
  await wait(400);
  await shoot('12-somebody-has-to-go');
  const after = (await save()).raidProgress.lastBench;
  const status = await page.evaluate(`document.querySelector('.px-help, [data-status]')?.textContent ?? document.body.textContent`);
  expect(`taking out the last one is refused (${JSON.stringify(after)})`, after.length === 1 && /Somebody has to go/.test(status));
  await press('Escape');
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s)`);
  process.exit(1);
}
console.log('\nall well');
