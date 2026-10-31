// Plays the rooms' talk as a player meets it: Oak on the mat and the cork board,
// Joy's price and YES at her counter, BILL'S PC, the Day-Care's words in the
// yard, and Professor Oak on the radio with the full list behind him.
//
//   node tools/playtest/inRoomTalk.mjs <url> <outDir> [--port=<cdp port>] [--window=WxH]
//
// Attaches to a browser somebody else started, as this PC's WSL Chromium helper
// starts one. Every step is a key press; a broken promise throws.
import { attachBrowser, launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const [url, out] = process.argv.slice(2);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice(7);
if (!url || !out) throw new Error('usage: inRoomTalk.mjs <url> <outDir> [--port=<cdp port>]');
const size = process.argv.find((arg) => arg.startsWith('--window='))?.slice(9).split('x').map(Number);
const window = size ? { width: size[0], height: size[1] } : PIXEL_WINDOW;
const browser = port ? attachBrowser(Number(port), { window }) : await launchBrowser({ window });
const page = await browser.openPage(url.includes('testmode') ? url : `${url}${url.includes('?') ? '&' : '?'}testmode=pixels`);

const press = async (code, ms = 240) => { await page.tap(code, 60); await sleep(ms); };
const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60000 });
const shot = (name) => page.screenshot(`${out}/${name}.png`);
const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
const world = (expression) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return ${expression}; })()`);
/** What the box says, once it has finished typing it. */
const said = async () => {
  for (let guard = 0; guard < 40 && (await base('b.dialogBox.visible && !b.dialogBox.isCurrentMessageComplete')); guard += 1) await sleep(100);
  return base(`b.dialogBox.visible ? b.dialogBox.textObject.text : ''`);
};
const expect = (what, ok, detail = '') => {
  if (!ok) throw new Error(`${what} ${detail}`);
  console.log(`ok - ${what}`);
};
const editSave = async (change) => {
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${change})(save); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: `${url}${url.includes('?') ? '&' : '?'}testmode=pixels` });
  await until(sceneIs('title'), 'the title');
  await sleep(500);
  await press('Space', 400);
  await until(sceneIs('base'), 'the yard');
  await sleep(600);
};
/** Walks onto a tile, by key presses over the scene's own collision. */
const walkOnto = async (goal, arrived = () => false) => {
  for (let guard = 0; guard < 90; guard += 1) {
    if (await arrived()) return;
    const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.ready || b.leaving || b.targetTile) return 'wait';
      const goal = ${JSON.stringify(goal)}, s = b.currentTile;
      if (s.x === goal.x && s.y === goal.y) return null;
      const W = b.collision[0].length, H = b.collision.length, id = (x, y) => y * W + x, prev = new Map([[id(s.x, s.y), null]]), q = [[s.x, s.y]];
      while (q.length) { const [x, y] = q.shift(); if (x === goal.x && y === goal.y) { let cur = [x, y], k = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) return k; k = p[2]; cur = [p[0], p[1]]; } }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue; if (!(nx === goal.x && ny === goal.y) && b.isBlocked({ x: nx, y: ny })) continue; prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
      throw new Error('nothing walks there'); })()`);
    if (key === null) return;
    if (key === 'wait') await sleep(100);
    else await press(key, 200);
  }
  throw new Error('never got there');
};
/** Walks under a tile and faces it. */
const walkUnder = async (tile) => {
  await walkOnto({ x: tile.x, y: tile.y + 1 });
  if ((await base('b.facing')) !== 'up') await press('ArrowUp', 200);
};
/** In through a door from the yard, onto the mat. */
const intoRoom = async (id) => {
  const door = await base(`b.doors.find((each) => each.id === ${JSON.stringify(id)}).tiles[0]`);
  await walkOnto(door, () => base(`b.ready && !b.leaving && b.room?.id === ${JSON.stringify(id)}`));
  await sleep(500);
};
/** Out of a room onto the yard. */
const outOfRoom = async () => {
  const mat = await base('b.room.mat');
  await walkOnto(mat);
  await press('ArrowDown', 700);
  await until(`${GAME}.scene.getScene('base').room === undefined || ${GAME}.scene.getScene('base').room === null`, 'the yard');
  await sleep(400);
};

try {
  await until(sceneIs('title'), 'the title');
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: `${url}${url.includes('?') ? '&' : '?'}testmode=pixels` });
  await until(sceneIs('title'), 'the title again');
  await sleep(600);
  await press('Space', 700);
  await until(sceneIs('base'), 'the starter');
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, 'Bulbasaur');
  await sleep(300);
  await until(sceneIs('base'), 'the yard');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'a save');
  await sleep(800);

  // Oak, on the mat: he talks, nothing opens.
  await walkIntoBase(page, 'oaks-lab', { press: (code) => press(code, 200) });
  await sleep(500);
  await shot('01-lab-room');
  await press('Space', 700);
  expect('Oak greets a newcomer in the room', (await said()).includes('there you are!'), await said());
  expect('no screen opened', !(await page.evaluate(sceneIs('hub'))));
  await shot('02-oak-first-words');
  await press('Escape', 500);
  const onward = (await base('Boolean(b.boxQuestion)')) ? 'a question' : await said();
  console.log(`after ESC: ${onward}`);
  await shot('03-oak-after-skip');
  // Past his favour, if he asked, to the board.
  for (let guard = 0; guard < 12 && !/RESUPPLY/.test(await said()); guard += 1) {
    await press((await base('Boolean(b.boxQuestion)')) ? 'ArrowRight' : 'Escape', 300);
    if (await base('Boolean(b.boxQuestion)')) await press('Space', 300);
    if (!(await base('b.dialogBox.visible || Boolean(b.boxQuestion)'))) { await press('Space', 500); }
  }
  console.log(`oak reads: ${await said()}`);
  await shot('04-oak-reads-the-board');
  expect('Oak reads a notice off the board', /RESUPPLY/.test(await said()));
  await press('Escape', 400);
  for (let guard = 0; guard < 4 && (await base('Boolean(b.boxQuestion) || b.dialogBox.visible')); guard += 1) await press('Escape', 300);
  expect('still in the lab, on the mat', (await base('b.room?.id')) === 'oaks-lab' && !(await page.evaluate(sceneIs('hub'))));

  // The board on the wall, read like the wall map.
  const board = await base(`b.place.room.things.find((thing) => thing.reads === 'board').tiles`);
  const foot = board.filter((tile) => tile.y === Math.max(...board.map((each) => each.y)));
  await walkUnder(foot[1]);
  await sleep(400);
  expect('the hint names the board', (await base('b.hintShown')) === '[SPACE] THE BOARD', await base('b.hintShown'));
  await shot('05-cork-board');
  await press('Space', 700);
  await shot('06-cork-board-read');
  expect('the board reads a notice in the box', /RESUPPLY|Nothing pinned/.test(await said()), await said());
  await press('Escape', 400);

  // Joy: a hurt team, her price, NOT NOW and then YES.
  await editSave((save) => {
    save.stash.pokemon[0].pokemon.currentHp = 3;
    save.raidProgress.firstWordsHeard = ['lab', 'loadout'];
  });
  await intoRoom('pokemon-centre');
  await shot('10-center-room');
  await press('Space', 700);
  expect('Joy welcomes a newcomer in the room', (await said()).includes('Welcome to the Pokémon Center'), await said());
  await shot('11-joy-first-words');
  expect('no screen opened', !(await page.evaluate(sceneIs('hub'))));
  await press('Escape', 500);
  // Her favour, if she has one to ask, then the price.
  for (let guard = 0; guard < 8 && !/off your next raid/.test(await said()); guard += 1) {
    if (await base('Boolean(b.boxQuestion)')) { await press('ArrowRight', 200); await press('Space', 400); }
    else await press('Escape', 400);
  }
  console.log(`joy: ${await said()}`);
  expect('she says the price', /off your next raid/.test(await said()));
  await sleep(600);
  await shot('12-joy-price');
  await press('Space', 500);
  expect('she asks, YES first', (await base('b.boxQuestion?.prompt.selected')) === 0);
  await shot('13-joy-asks');
  const clockBefore = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).pendingRecoveryMs ?? 0`);
  await press('ArrowRight', 200);
  await press('Space', 500);
  expect('NOT NOW spends nothing', (await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).pendingRecoveryMs ?? 0`)) === clockBefore);
  await press('Escape', 400);
  // One key to the same place again, and YES this time.
  await press('Space', 700);
  await press('Escape', 300);
  await until(`Boolean(${GAME}.scene.getScene('base').boxQuestion)`, 'her question');
  await press('Space', 1500);
  await until(`${GAME}.scene.getScene('base').ready && ${GAME}.scene.getScene('base').dialogBox.visible`, 'her thanks');
  await sleep(700);
  console.log(`joy: ${await said()}`);
  await shot('14-joy-healed');
  const healed = JSON.parse(await page.evaluate(`localStorage.getItem('${SAVE_KEY}')`));
  expect('the team is healed and the clock is booked', healed.pendingRecoveryMs > 0 && healed.stash.pokemon[0].pokemon.currentHp > 3);
  await press('Space', 400);

  // BILL'S PC, by the wall: the boxes, and back to where it was read from.
  const pc = await base(`b.place.room.things.find((thing) => thing.opens === 'boxes').tiles[0]`);
  await walkUnder(pc);
  await sleep(400);
  expect('the hint names the PC', (await base('b.hintShown')) === "[SPACE] BILL'S PC", await base('b.hintShown'));
  await shot('15-pc');
  await press('Space', 900);
  await until(sceneIs('hub'), 'the boxes');
  await sleep(500);
  await shot('16-boxes');
  expect('no bill along the foot of the boxes', !(await page.evaluate(`Boolean(document.querySelector('.recovery-panel'))`)));
  await press('Escape', 900);
  await until(sceneIs('base'), 'the room again');
  await sleep(500);
  expect('back in front of the PC', (await base('b.currentTile.x')) === pc.x && (await base('b.currentTile.y')) === pc.y + 1);
  await outOfRoom();

  // The Day-Care: his words in the yard, a short pick list, and his words again in the yard.
  await editSave((save) => {
    save.stash.pokemon.push({ id: 'pidgey-1', pokemon: { speciesId: 'pidgey', level: 4, currentHp: 17, xp: 96, moves: ['Tackle'], primaryStatus: null } });
  });
  const man = await base('b.figures.get("day-care-man") ? { x: Math.round(b.figures.get("day-care-man").x / 16), y: Math.round((b.figures.get("day-care-man").y + 4) / 16) } : null');
  console.log(`day-care man: ${JSON.stringify(man)}`);
  await walkOnto({ x: man.x - 1, y: man.y });
  if ((await base('b.facing')) !== 'right') await press('ArrowRight', 200);
  await sleep(300);
  await press('Space', 700);
  expect('he speaks in the yard', (await said()).includes('DAY-CARE service'), await said());
  await shot('20-day-care-says');
  await press('Escape', 900);
  await until(sceneIs('hub'), 'his list');
  await sleep(600);
  await shot('21-day-care-list');
  expect('his words are not on the list', !(await page.evaluate(`document.body.innerText.includes('I run the DAY-CARE')`)));
  await until(`(() => { const b = document.querySelector('button[data-day-care-leave="pidgey-1"].px-row'); if (!b) return false; b.click(); return true; })()`, 'the Pidgey');
  await until(sceneIs('base'), 'the yard again');
  await until(`${GAME}.scene.getScene('base').ready && ${GAME}.scene.getScene('base').dialogBox.visible`, 'his answer');
  await sleep(700);
  expect('he answers in the yard', (await said()).includes('look after your Pidgey'), await said());
  await shot('22-day-care-left');
  await press('Escape', 500);
  await press('Space', 700);
  await press('Escape', 400);
  await until(`Boolean(${GAME}.scene.getScene('base').boxQuestion)`, 'his question');
  await shot('23-day-care-asks');
  await press('Space', 1200);
  await until(`${GAME}.scene.getScene('base').ready && ${GAME}.scene.getScene('base').dialogBox.visible`, 'his thanks');
  await sleep(600);
  await shot('24-day-care-gives-back');
  expect('it comes back', (await said()).includes('Here’s your Pokémon'), await said());
  await press('Escape', 500);

  // Oak on the radio, in a raid.
  await walkIntoBase(page, 'raid-arena', { press: (code) => press(code, 200), wait: sleep });
  await until(takePokemon(), 'a Pokémon on the bench');
  await sleep(300);
  // The marshal says what is down there in the hall, the first time, before the rim's panel opens.
  await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('hub'); if (b) b.goBack(); })()`);
  await until(sceneIs('base'), 'the hall');
  await jumpIn(page, { press: (code) => press(code, 200), until, wait: sleep });
  await until(sceneIs('world'), 'the raid');
  await sleep(1500);
  for (let guard = 0; guard < 6 && (await world('w.dialogBox.visible')); guard += 1) { await press('Space', 300); }
  await sleep(500);
  const clockBeforeRadio = await world('w.runSession.manager.snapshot().elapsedMs');
  await press('KeyO', 800);
  for (let guard = 0; guard < 40 && !(await world('w.dialogBox.isCurrentMessageComplete')); guard += 1) await sleep(100);
  const radio = await world('w.dialogBox.textObject.text');
  console.log(`radio: ${radio}`);
  expect('Oak comes on the radio with no screen', radio.startsWith('Oak here!') && !(await page.evaluate(sceneIs('objectives'))), radio);
  await shot('30-radio');
  await sleep(1500);
  const clockOnRadio = await world('w.runSession.manager.snapshot().elapsedMs');
  expect('the radio is free of the clock', clockOnRadio - clockBeforeRadio < 1000, `${clockOnRadio - clockBeforeRadio}ms`);
  await press('KeyO', 800);
  await until(sceneIs('objectives'), 'the full list');
  expect('O again is the full list, and he has gone', !(await world('w.dialogBox.visible')));
  await shot('31-full-list');
  await press('Escape', 600);
  await until(`!${sceneIs('objectives')}`, 'the raid again');
  await press('KeyO', 700);
  await press('Escape', 400);
  expect('ESC hangs up', !(await world('w.dialogBox.visible')));
  console.log('all played');
}
catch (error) { console.error(error); process.exitCode = 1; }
finally { await page.close(); await browser.close(); }
