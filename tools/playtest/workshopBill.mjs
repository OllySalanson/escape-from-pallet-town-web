// Plays Brock's chalk and Bill's shelves as a player meets them, on the keyboard
// and then with the mouse: the quote in the box, YES and NOT NOW, what the room
// shows afterwards, the mat, and the two list screens behind the wall and the PC.
//
//   node tools/playtest/workshopBill.mjs <url> <outDir> [--port=<cdp port>] [--window=WxH]
//
// Attaches to a browser somebody else started, as this PC's WSL Chromium helper
// starts one. A broken promise throws.
import { attachBrowser, launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const [url, out] = process.argv.slice(2);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice(7);
if (!url || !out) throw new Error('usage: workshopBill.mjs <url> <outDir> [--port=<cdp port>]');
const size = process.argv.find((arg) => arg.startsWith('--window='))?.slice(9).split('x').map(Number);
const window = size ? { width: size[0], height: size[1] } : PIXEL_WINDOW;
const browser = port ? attachBrowser(Number(port), { window }) : await launchBrowser({ window });
const testUrl = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels`;
const page = await browser.openPage(testUrl);

const press = async (code, ms = 240) => { await page.tap(code, 60); await sleep(ms); };
const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60000 });
const shot = (name) => page.screenshot(`${out}/${name}.png`);
const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
const said = async () => {
  for (let guard = 0; guard < 40 && (await base('b.dialogBox.visible && !b.dialogBox.isCurrentMessageComplete')); guard += 1) await sleep(100);
  return base(`b.dialogBox.visible ? b.dialogBox.textObject.text : ''`);
};
const expect = (what, ok, detail = '') => {
  if (!ok) throw new Error(`${what} ${detail}`);
  console.log(`ok - ${what}`);
};
const saved = (expression) => page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); return ${expression}; })()`);
const asked = () => base('Boolean(b.boxQuestion)');
const answer = () => base('b.boxQuestion ? b.boxQuestion.prompt.selected : null');
/** Reads every line up to a question, or the box coming down. */
const readOn = async () => {
  const lines = [];
  for (let guard = 0; guard < 16; guard += 1) {
    if (await asked()) return lines;
    if (!(await base('b.dialogBox.visible'))) return lines;
    lines.push(await said());
    await press('Space', 260);
  }
  throw new Error('the talk never ended');
};
const question = () => base(`b.boxQuestion?.prompt.list.find((each) => each.text && !['YES', 'NOT NOW'].includes(each.text))?.text ?? null`);
/** Says NOT NOW to a keeper's favour, the one thing asked ahead of what is being played here. */
const pastAFavour = async (ours) => {
  const lines = await readOn();
  for (let guard = 0; guard < 4 && (await asked()) && !ours.test(await question()); guard += 1) {
    console.log(`  favour: ${await question()}`);
    await press('ArrowRight', 200);
    await press('Space', 400);
    lines.push(...(await readOn()));
  }
  return lines;
};
const settled = () => until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && !b.targetTile; })()`, 'the room');
const editSave = async (change, room) => {
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${change})(save); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: testUrl });
  await until(sceneIs('title'), 'the title');
  await sleep(500);
  await press('Space', 400);
  await until(sceneIs('base'), 'the yard');
  await sleep(600);
  if (room) await intoRoom(room);
};
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
const intoRoom = async (id) => {
  const door = await base(`b.doors.find((each) => each.id === ${JSON.stringify(id)}).tiles[0]`);
  await walkOnto(door, () => base(`b.ready && !b.leaving && b.room?.id === ${JSON.stringify(id)}`));
  await sleep(500);
};
/** Stands the player on a tile facing another, by pushing at it. */
const standFacing = async (tile, facing) => {
  await walkOnto(tile);
  const dx = facing.x - tile.x;
  const dy = facing.y - tile.y;
  const key = dx > 0 ? 'ArrowRight' : dx < 0 ? 'ArrowLeft' : dy > 0 ? 'ArrowDown' : 'ArrowUp';
  if ((await base('b.facing')) !== key.slice(5).toLowerCase()) await press(key, 260);
  await settled();
};
/** A left click on a tile of the room, where the real screen shows it. */
const clickTile = async (tile) => {
  const point = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const rect = b.game.canvas.getBoundingClientRect(); const view = b.cameras.main.worldView; const zoom = rect.width / b.scale.width;
    return { x: rect.left + (${tile.x} * 16 + 8 - view.left) * zoom, y: rect.top + (${tile.y} * 16 + 8 - view.top) * zoom }; })()`);
  await clickAt(point);
};
const clickAt = async ({ x, y }) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
/** Clicks an answer of the question up: 0 is YES, 1 is NOT NOW. */
const clickAnswer = async (index) => {
  const point = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const rect = b.game.canvas.getBoundingClientRect(); const zoom = rect.width / b.scale.width; const prompt = b.boxQuestion.prompt; const text = prompt.optionTexts[${index}];
    return { x: rect.left + (prompt.x + text.x + text.width / 2) * zoom, y: rect.top + (prompt.y + text.y + text.height / 2) * zoom }; })()`);
  await clickAt(point);
};
/** Clicks each line of the box on, as the key moves it on, until the question stands; then waits out its arming. */
const clickOn = async (tile) => {
  for (let guard = 0; guard < 12 && !(await asked()); guard += 1) {
    await sleep(350);
    await clickTile(tile);
  }
  expect('a click moves the box on to the question', await asked());
  await sleep(600);
};
const thing = (predicate) => base(`b.place.room.things.find(${predicate})`);

try {
  await until(sceneIs('title'), 'the title');
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: testUrl });
  await until(sceneIs('title'), 'the title again');
  await sleep(600);
  await press('Space', 700);
  await until(sceneIs('base'), 'the starter');
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, 'Bulbasaur');
  await sleep(300);
  await until(sceneIs('base'), 'the yard');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'a save');
  await sleep(800);

  // --- Brock ---------------------------------------------------------------
  await editSave((save) => {
    save.stash.items['parts-crate'] = 4;
    save.stash.items['linen-roll'] = 4;
    save.stash.items.money = 3000;
    save.stash.items['cable-coil'] = 1;
    save.raidProgress.traderMoneySpent = 1200;
  }, 'brocks-workshop');
  await shot('01-workshop-chalk');
  const crate = await thing(`(each) => each.chalked === 'secure-locker-1'`);
  expect('every empty bay is chalked', (await base(`b.place.room.things.filter((each) => each.chalked).length`)) === 7);

  // From the mat: first words once, then the next rung this vault can pay for.
  await press('Space', 500);
  expect('Brock talks from the mat; no screen', !(await page.evaluate(sceneIs('hub'))));
  const mat = await pastAFavour(/Build it/);
  console.log(`  mat: ${mat.join(' | ')}`);
  expect('he says what the chalk is', mat.join(' ').includes('chalk'));
  await shot('02-workshop-quote-from-mat');
  expect('he asks about a rung this vault can pay for', await asked());
  expect('the question opens on NOT NOW', (await answer()) === 1, await answer());
  await press('ArrowRight', 200);
  expect('Right stays on NOT NOW', (await answer()) === 1);
  await press('Escape', 400);
  await readOn();
  expect('ESC spends nothing', (await saved('save.raidProgress.workshopUpgrades.length')) === 0);

  // Walking at a bay turns the player to face it, and the hint names it.
  const front = { x: crate.tiles[0].x + 2, y: crate.tiles[0].y };
  await standFacing(front, { x: front.x - 1, y: front.y });
  expect('a bay is solid: the player has not walked onto it', (await base('b.currentTile.x')) === front.x);
  expect('the hint names it', (await base('b.hintShown')) === `[SPACE] ${crate.name}`, await base('b.hintShown'));
  await shot('03-facing-a-bay');
  await press('Space', 500);
  console.log(`  bay: ${await said()}`);
  await shot('04-brock-quotes');
  await readOn();
  expect('YES is a key away and it starts on NOT NOW', (await asked()) && (await answer()) === 1);
  await shot('05-brock-asks');
  await press('ArrowLeft', 200);
  expect('Left goes to YES', (await answer()) === 0);
  await press('Space', 300);
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.dialogBox.visible; })()`, 'the room drawn again');
  expect('the locker is built', (await saved('save.raidProgress.workshopUpgrades.join()')) === 'secure-locker-1');
  expect('the materials are gone', (await saved(`(save.stash.items['parts-crate'] ?? 0)`)) === 0);
  expect('the player is where they asked, facing it', (await base('b.currentTile.x')) === front.x && (await base('b.facing')) === 'left');
  console.log(`  built: ${await said()}`);
  await shot('06-built');
  await readOn();

  // A rung that is short, and one behind another.
  const short = await thing(`(each) => each.chalked === 'radio-mast'`);
  const under = { x: short.tiles.at(-1).x, y: short.tiles.at(-1).y + 1 };
  await standFacing(under, short.tiles.at(-1));
  await press('Space', 500);
  const shortLines = await readOn();
  console.log(`  short: ${shortLines.join(' | ')}`);
  expect('a rung he cannot build asks nothing and says what is short', !(await asked()) && shortLines.join(' ').includes('short'));

  // With the mouse: a click on a bay walks up to it and asks.
  const machine = await thing(`(each) => each.chalked === 'recovery-bay-1'`);
  await clickTile(machine.tiles[3]);
  await until(`${GAME}.scene.getScene('base').dialogBox.visible`, 'Brock on the clicked bay');
  console.log(`  clicked: ${await said()}`);
  await shot('07-clicked-bay');
  await clickOn(machine.tiles[3]);
  await clickAnswer(0);
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.dialogBox.visible; })()`, 'built by mouse');
  expect('built by mouse', (await saved('save.raidProgress.workshopUpgrades.join()')).includes('recovery-bay-1'));
  await readOn();

  // The tally on the wall is the whole ladder on a screen, and ESC is back in front of it.
  const tally = await thing(`(each) => each.opens === 'ladder'`);
  const foot = tally.tiles.reduce((low, tile) => (tile.y >= low.y ? tile : low));
  await standFacing({ x: foot.x, y: foot.y + 1 }, foot);
  await shot('08-tally');
  await press('Space', 700);
  await until(sceneIs('hub'), 'the ladder');
  await sleep(500);
  await shot('09-ladder-screen');
  await press('Escape', 600);
  await until(sceneIs('base'), 'back in the room');
  await settled();
  expect('backed out in front of it', (await base('b.currentTile.y')) === foot.y + 1 && (await base('b.currentTile.x')) === foot.x);
  // The playtest's listed fault: Left from KEEP THEM found the screen's back
  // button. Goods for a rung, so the ladder has one to ask about.
  await editSave((save) => {
    save.stash.items['lamp-oil'] = 4;
    save.stash.items['cable-coil'] = 3;
  }, 'brocks-workshop');
  await standFacing({ x: foot.x, y: foot.y + 1 }, foot);
  await press('Space', 700);
  await until(sceneIs('hub'), 'the ladder');
  await sleep(500);
  const armed = await page.evaluate(`(() => { const row = document.querySelector('[data-cursor-start]'); row?.focus(); row?.click(); return row?.textContent ?? null; })()`);
  await sleep(300);
  await shot('10-ladder-asked');
  const focused = () => page.evaluate('document.activeElement?.textContent?.trim()');
  expect('the confirm starts on KEEP THEM', /keep/i.test(await focused()), `${armed} ${await focused()}`);
  await press('ArrowLeft', 200);
  expect('Left from KEEP THEM stays on it: the fault is gone', /keep/i.test(await focused()), await focused());
  await press('ArrowRight', 200);
  expect('Right is the build', /build/i.test(await focused()), await focused());
  await press('Escape', 300);
  await press('Escape', 600);
  await until(sceneIs('base'), 'out of the ladder');

  // --- Bill ----------------------------------------------------------------
  await editSave((save) => { save.raidProgress.traderMoneySpent = 0; save.stash.items.money = 3000; }, 'bills-cottage');
  await shot('11-stranger-sheets');
  await press('Space', 500);
  const bill = await pastAFavour(/whole list/);
  console.log(`  bill: ${bill.join(' | ')}`);
  expect('Bill reads a stranger from the mat', bill.join(' ').includes('I do not know you'));
  expect('and offers his list', await asked());
  await press('ArrowRight', 200);
  await press('Space', 400);
  await readOn();
  expect('NOT NOW opens nothing', !(await page.evaluate(sceneIs('hub'))));
  const sheeted = await thing(`(each) => each.good?.itemId === 'potion'`);
  await standFacing({ x: sheeted.tiles[0].x, y: sheeted.tiles[0].y + 1 }, sheeted.tiles[0]);
  expect('a sheet is named as one', (await base('b.hintShown')) === '[SPACE] UNDER A SHEET', await base('b.hintShown'));
  await press('Space', 500);
  const under2 = await readOn();
  console.log(`  sheet: ${under2.join(' | ')}`);
  expect('he says what is under it, and asks nothing', under2.join(' ').includes('Potion') && !(await asked()));

  await editSave((save) => {
    save.raidProgress.traderMoneySpent = 5200;
    save.stash.items.money = 1000;
    save.stash.items['parts-crate'] = 4;
    save.stash.items['cable-coil'] = 3;
    save.stash.items['radio-valve'] = 2;
    save.stash.items['mooring-rope'] = 2;
    save.stash.items['linen-roll'] = 2;
    save.stash.items['lamp-oil'] = 2;
  }, 'bills-cottage');
  await shot('12-partner-goods');

  // A Potion: YES under the cursor, and he can sell another at once.
  const potion = await thing(`(each) => each.good?.itemId === 'potion'`);
  await standFacing({ x: potion.tiles[0].x, y: potion.tiles[0].y + 1 }, potion.tiles[0]);
  expect('the hint names it', (await base('b.hintShown')) === '[SPACE] POTION', await base('b.hintShown'));
  const money = await saved('save.stash.items.money');
  await press('Space', 500);
  console.log(`  potion: ${await said()}`);
  await shot('13-bill-names-a-potion');
  await readOn();
  expect('a purchase starts on YES', (await asked()) && (await answer()) === 0);
  await shot('14-bill-asks');
  await press('Space', 400);
  console.log(`  bought: ${await said()}`);
  expect('it is bought', (await saved('save.stash.items.money')) === money - 120);
  await readOn();

  // A stone with its price in goods, by keys.
  const stone = await thing(`(each) => each.good?.barterId === 'barter-fire-stone'`);
  await standFacing({ x: stone.tiles[0].x, y: stone.tiles[0].y + 1 }, stone.tiles[0]);
  await press('Space', 500);
  console.log(`  stone: ${await said()}`);
  const stoneLines = await readOn();
  console.log(`  stone: ${stoneLines.join(' | ')}`);
  expect('a barter starts on NOT NOW', (await asked()) && (await answer()) === 1);
  await press('ArrowLeft', 200);
  await press('Space', 300);
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.dialogBox.visible; })()`, 'the room again');
  expect('the deal is struck', (await saved(`save.stash.items['fire-stone']`)) === 1);
  expect('it goes in his book', (await saved('save.raidProgress.traderCabinet.length')) === 1);
  await readOn();
  await shot('15-after-a-barter');

  // A once-only piece of gear, by mouse, leaves a gap on the shelf.
  const claw = await thing(`(each) => each.good?.barterId === 'barter-quick-claw'`);
  await clickTile(claw.tiles[0]);
  await until(`${GAME}.scene.getScene('base').dialogBox.visible`, 'Bill on the clicked good');
  console.log(`  claw: ${await said()}`);
  await clickOn(claw.tiles[0]);
  await clickAnswer(0);
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.dialogBox.visible; })()`, 'the claw struck');
  await readOn();
  expect('bought by mouse', (await saved(`save.stash.items['quick-claw']`)) >= 1);
  expect('no icon stands in the gap', !(await base(`b.place.room.icons.some((icon) => icon.icon === 'quick-claw')`)));
  await shot('16-gap-on-the-shelf');
  await press('Space', 500);
  const gone = await readOn();
  console.log(`  gap: ${gone.join(' | ')}`);
  expect('and he says so', gone.join(' ').includes('only had the one'));

  // The berth starts on NOT NOW too.
  const berth = await thing(`(each) => each.good?.kind === 'berth'`);
  await standFacing({ x: berth.tiles[0].x, y: berth.tiles[0].y + 1 }, berth.tiles[0]);
  await press('Space', 500);
  console.log(`  berth: ${await said()}`);
  await readOn();
  expect('a berth starts on NOT NOW', (await asked()) && (await answer()) === 1);
  await press('Escape', 300);
  await readOn();
  expect('no berth paid', (await saved('save.traderBerthPaid')) !== true);

  // Bill's PC is the whole list, with the counts.
  const pc = await thing(`(each) => each.opens === 'list'`);
  await standFacing({ x: pc.tiles[0].x, y: pc.tiles[0].y + 1 }, pc.tiles[0]);
  await shot('17-bills-pc');
  await press('Space', 700);
  await until(sceneIs('hub'), 'his list');
  await sleep(500);
  await shot('18-list-screen');
  await press('Escape', 600);
  await until(sceneIs('base'), 'back in the cottage');
  await settled();
  expect('backed out in front of the PC', (await base('b.currentTile.y')) === pc.tiles[0].y + 1);

  // A click on the mat goes out.
  await clickTile(await base('b.room.mat'));
  await until(`(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && !b.room; })()`, 'the yard, by mouse');
  console.log('ok - a click on the mat goes out');
  console.log('all good');
} finally {
  await browser.close();
}
