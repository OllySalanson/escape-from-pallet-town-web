// Plays the midgame bug hunt's finding 1 (11 Nov 2026) as a player meets it: a
// double ENTER bought two off Bill's shelf, spent a PARTNER's ration and said
// "Bought one". Both of his shelves are pressed twice, three frames apart, the
// way a key bounce or an impatient finger does it:
//
//   1. the Potion on his cottage shelves, on the last line of what he says about
//      it - the second press used to land on YES;
//   2. the Potion row on his whole list (the PC), which used to buy on the press.
//
// Each is then bought once on purpose, to show the deal still goes through.
//
//   node tools/playtest/billShelf.mjs <test-mode build url> <out dir> [--port=N] [--before]
//
// It steps a paused loop, so it wants a test-mode page (`?testmode=pixels` for
// pictures worth judging; `tools/playtest/README.md`, "Memory"). `--before` only
// records what a build does, for photographing the fault on an older commit.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const before = args.includes('--before');
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const problems = [];
const expect = (what, ok, detail = '') => {
  console.log(`${ok ? 'ok' : 'NOT OK'} - ${what}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(what);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
let page;
try {
  page = await browser.openPage('about:blank');
  let errors = 0;
  page.on('Runtime.exceptionThrown', () => { errors += 1; });
  await page.send('Runtime.enable');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 600; tries += 1) {
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
  /** Two presses of one key three frames apart: a bounce, or a finger in a hurry. */
  const doublePress = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(1);
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await wait(400);
  };
  const shoot = async (name) => {
    await step(2);
    await page.screenshot(`${out}/${name}.png`);
    console.log(`  ${name}.png`);
  };
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const purse = async () => {
    const { stash, traderRationUsed } = await saved();
    return { money: stash.items.money ?? 0, potions: stash.items.potion ?? 0, ration: traderRationUsed ?? 0 };
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
  const baseReady = `${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`;

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  // A PARTNER with him (three a trip), ₽1000 and no Potions yet.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.traderMoneySpent = 5200; save.stash.items.money = 1000; delete save.stash.items.potion;
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(baseReady, 'the harbour, continued');

  // Into the cottage and up to the Potion on his shelves.
  const walkTo = async (goal, arrived) => {
    for (let guard = 0; guard < 160; guard += 1) {
      if (await page.evaluate(arrived)) return;
      if (await base('Boolean(b.boxQuestion)')) {
        // A keeper's favour asked on the way: NOT NOW.
        await press('ArrowRight');
        await press('Space');
        continue;
      }
      if (await base('b.dialogBox.visible')) {
        await press('Space');
        continue;
      }
      const key = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.ready || b.leaving || b.targetTile) return 'wait';
        const goals = ${goal}, s = b.currentTile;
        const W = b.collision[0].length, H = b.collision.length, id = (x, y) => y * W + x, prev = new Map([[id(s.x, s.y), null]]), q = [[s.x, s.y]];
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { let cur = [x, y], k = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) return k; k = p[2]; cur = [p[0], p[1]]; } }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue; if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue; prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
        return 'none'; })()`);
      if (key === 'none') throw new Error(`nothing walks to ${goal}`);
      if (key && key !== 'wait') await press(key);
      await wait(120);
    }
    throw new Error(`never got to ${goal}`);
  };
  await walkTo(`b.room ? [] : b.doors.find((each) => each.id === 'bills-cottage').tiles`, `(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.leaving && b.room?.id === 'bills-cottage'; })()`);
  await wait(400);
  const potion = await base(`b.place.room.things.find((each) => each.good?.itemId === 'potion')`);
  if (!potion) throw new Error('no Potion on his shelves');
  const front = { x: potion.tiles[0].x, y: potion.tiles[0].y + 1 };
  await walkTo(JSON.stringify([front]), `(() => { const b = ${GAME}.scene.getScene('base'); return b.ready && !b.targetTile && b.currentTile.x === ${front.x} && b.currentTile.y === ${front.y}; })()`);
  if ((await base('b.facing')) !== 'up') await press('ArrowUp');
  await wait(300);

  // 1. His shelf: read what he says, and press twice on the last line.
  const start = await purse();
  await press('Space');
  await until(`${GAME}.scene.getScene('base').dialogBox.visible`, 'Bill on the Potion');
  const lastLine = `(() => { const d = ${GAME}.scene.getScene('base').dialogBox; return d.visible && d.isCurrentMessageComplete && /left for you this trip/.test(d.textObject.text); })()`;
  for (let guard = 0; guard < 8 && !(await page.evaluate(lastLine)); guard += 1) {
    if (await page.evaluate(`${GAME}.scene.getScene('base').dialogBox.isCurrentMessageComplete`)) await press('Space');
    else await wait(200);
  }
  await until(lastLine, 'his price, typed out');
  await shoot('1-cottage-last-line');
  await doublePress('Space');
  await shoot('2-cottage-after-double-press');
  const cottage = await purse();
  const reply = await base(`b.dialogBox.visible ? b.dialogBox.textObject.text : ''`);
  console.log(`  cottage: ${JSON.stringify(start)} -> ${JSON.stringify(cottage)}; he says "${reply}"`);
  // The first press raised his question and the second answered it: on NOT NOW.
  expect('a double press on his last line buys nothing', cottage.money === start.money && cottage.potions === start.potions);
  if (!before) expect('and is answered NOT NOW', /It will be here/.test(reply), reply);
  const readOut = async () => {
    for (let guard = 0; guard < 8 && (await base('b.dialogBox.visible')) && !(await base('Boolean(b.boxQuestion)')); guard += 1) {
      await press('Space');
      await wait(250);
    }
  };
  await readOut();
  if (!before) {
    // Asked again and answered YES on purpose: the question opens on NOT NOW, so Left, then the key.
    await press('Space');
    await until(`${GAME}.scene.getScene('base').dialogBox.visible`, 'Bill on the Potion again');
    await readOut();
    expect('his question opens on NOT NOW', (await base('b.boxQuestion?.prompt.selected')) === 1);
    await shoot('2b-cottage-asks-on-not-now');
    await press('ArrowLeft');
    await wait(300);
    await press('Space');
    await wait(400);
    const bought = await purse();
    console.log(`  cottage, YES on purpose: ${JSON.stringify(bought)}`);
    expect('YES on purpose buys one', bought.money === cottage.money - 120 && bought.potions === cottage.potions + 1);
    await readOut();
  }

  // 2. His whole list: ENTER twice on the Potion row.
  await walkIntoBase(page, 'bills-cottage', { press, until, wait, settleMs: 150 });
  await until(sceneIs('hub'), 'his whole list');
  await wait(500);
  await page.evaluate(`document.querySelector('[data-buy="potion"]')?.focus()`);
  await wait(100);
  await shoot('3-list-on-potion');
  const listStart = await purse();
  await doublePress('Enter');
  await shoot('4-list-after-double-enter');
  const list = await purse();
  const focused = await page.evaluate(`document.activeElement?.textContent?.trim() ?? ''`);
  const status = await page.evaluate(`document.querySelector('.px-status-line')?.textContent ?? ''`);
  console.log(`  list: ${JSON.stringify(listStart)} -> ${JSON.stringify(list)}; cursor on "${focused}"; status "${status}"`);
  // The first ENTER asked and the second landed on KEEP THEM, which puts the
  // question down with the cursor back on the Potion.
  expect('a double ENTER on the row buys nothing', list.money === listStart.money && list.potions === listStart.potions && list.ration === listStart.ration);
  if (!before) {
    expect('and the cursor is back on the Potion', /^Potion/.test(focused), focused);
    await press('Enter');
    await wait(300);
    await shoot('4b-list-asks');
    const asked = await page.evaluate(`document.activeElement?.textContent?.trim() ?? ''`);
    expect('one ENTER asks, with the cursor on KEEP THEM', /keep them/i.test(asked), asked);
    await press('ArrowRight');
    await wait(100);
    await shoot('5-list-on-buy');
    await press('Enter');
    await wait(400);
    await shoot('6-list-bought-one');
    const bought = await purse();
    const said = await page.evaluate(`document.querySelector('.px-status-line')?.textContent ?? ''`);
    console.log(`  list, BUY on purpose: ${JSON.stringify(bought)}; status "${said}"`);
    expect('BUY on purpose buys exactly one, and says so', bought.money === list.money - 120 && bought.potions === list.potions + 1 && /Bought one/.test(said));
  }
  expect('no page errors', errors === 0, String(errors));
  if (problems.length && !before) process.exitCode = 1;
  console.log(problems.length ? `${problems.length} not ok${before ? ' (recorded, --before)' : ''}` : 'ok');
} catch (error) {
  console.error(error);
  await page?.screenshot(`${out}/zz-failed.png`).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
