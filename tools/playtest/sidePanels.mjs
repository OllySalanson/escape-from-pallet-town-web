// The raid's pack, party and disc-reading and the harbour's favours as side
// panels (`src/game/ui/sidePanel.ts`), played in a real raid and photographed:
// each opens down the right with the map still there, whoever is walking still
// on screen and the clock and hunter chips beside it; while one is up the clock
// and every hunter stand exactly where they stood, and they move again the
// moment it closes. Everything is done by key, then again by click for the ways
// out. Fails loudly when a promise is not kept.
//
//   node tools/playtest/sidePanels.mjs <url> <out dir> [--window=1280x800] [--port=N]
//
// `--port` drives a browser already running on that CDP port (`attachBrowser`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
mkdirSync(out, { recursive: true });

const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const SLOW_MS = 60_000;
const port = option('port');
const browser = port
  ? attachBrowser(Number(port), { window: { width, height } })
  : await launchBrowser({ window: { width, height } });
const page = await browser.openPage(url.href);
const world = `${GAME}.scene.getScene('world')`;

const expect = (ok, what) => {
  if (!ok) throw new Error(what);
  console.log(`ok: ${what}`);
};
const press = async (code, settle = 350) => {
  await page.tap(code, 60);
  await sleep(settle);
};
const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: SLOW_MS });
const click = async (text) => {
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    `button ${text}`,
  );
  await sleep(350);
};
const shot = (name) => page.screenshot(`${out}/${name}-${width}x${height}.png`);
const panelUp = (selector) => page.evaluate(`Boolean(document.querySelector('${selector}'))`);
const focused = () => page.evaluate(`(document.activeElement?.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 60)`);

/** The moment, as the raid knows it: how much clock is gone, and where every hunter stands. */
const moment = () =>
  page.evaluate(`(() => { const w = ${world};
    return JSON.stringify({ elapsed: w.runSession.manager.snapshot().elapsedMs, tile: w.currentTile,
      hunters: w.hunterPackHere()?.hunters.map((h) => [h.id, h.position, h.mode]) ?? [] }); })()`);

/** Where the panel, the player and the chips are on the page, in CSS pixels. */
const layout = (selector) =>
  page.evaluate(`(() => { const w = ${world}; const canvas = w.game.canvas.getBoundingClientRect();
    const scale = canvas.width / w.scale.width; const cam = w.cameras.main;
    const panel = document.querySelector('${selector}').getBoundingClientRect();
    const playerX = canvas.left + (w.player.x - cam.scrollX) * scale;
    const chips = w.raidHud.occupied.map((c) => ({ left: canvas.left + c.x * scale, right: canvas.left + (c.x + c.width) * scale }));
    return { panelLeft: panel.left, panelRight: panel.right, panelWidth: panel.width, canvasLeft: canvas.left, canvasRight: canvas.right, playerX, chipsRight: Math.max(...chips.map((c) => c.right)), layout: document.querySelector('${selector}').dataset.layout }; })()`);

/** What every panel over a raid promises while it is up. */
async function holdsTheRaid(selector, name) {
  const at = await layout(selector);
  if (at.layout === 'sheet') {
    console.log(`note: ${name} is the whole screen at this window, as a sheet`);
  } else {
    expect(at.panelLeft > at.canvasLeft, `${name} leaves the map beside it`);
    expect(at.playerX > at.canvasLeft && at.playerX < at.panelLeft, `${name}: the player is on screen beside it (${Math.round(at.playerX)} of ${Math.round(at.panelLeft)})`);
    expect(at.chipsRight <= at.panelLeft, `${name}: no chip is under it`);
  }
  const before = await moment();
  await sleep(1200);
  expect((await moment()) === before, `${name}: the clock and every hunter stand still while it is up`);
}

try {
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await deploy(page, url.href, {
    press: (code) => press(code, 220),
    click,
    until,
    wait: sleep,
    starter: 'Charmander',
    level: '14',
    hp: '9',
    team: ['squirtle:12', 'seel:24'],
    stash: ['potion:4', 'super-potion:2', 'tm40-aerial-ace:1', 'poke-ball:4', 'quick-claw:1'],
    pack: ['tm40-aerial-ace:1', 'quick-claw:1'],
  });
  await until(sceneIs('world'), 'the raid');
  await until(`${world}.dialogBox?.visible === true || ${world}.raidHud !== undefined`, 'the raid to settle');
  await sleep(1500);
  for (let box = 0; box < 10 && (await page.evaluate(`${world}.dialogBox.visible`)); box += 1) {
    await press('Space', 500);
  }

  // Bring the hunters out and one up close, so what a panel holds still is the danger.
  await page.evaluate(`(() => { const w = ${world}; w.runSession.stepsTaken = 60; w.advanceRunClock(70000); })()`);
  await until(`${world}.hunterPackHere()?.hunters.some((h) => h.mode !== 'waiting') === true`, 'the hunters to come out');
  await shot('0-raid');
  const walking = await moment();
  await sleep(300);
  expect((await moment()) !== walking, 'the clock runs in the raid with nothing open');

  // The pack.
  await press('KeyB', 800);
  expect(await panelUp('.bag-menu.side-panel'), 'B opens the pack');
  await holdsTheRaid('.bag-menu', 'the pack');
  await shot('1-pack');

  // Every control in it answers the arrow keys, walked down and then back up.
  const stop = `(() => { const a = document.activeElement; return a.dataset.item ? 'item:' + a.dataset.item : a.dataset.drop ? 'drop' : a.dataset.tidy !== undefined ? 'tidy' : a.classList.contains('px-grid-block') ? 'block' : a.dataset.close !== undefined ? 'close' : a.tagName; })()`;
  const walked = new Set();
  for (let step = 0; step < 14; step += 1) {
    walked.add(await page.evaluate(stop));
    await press('ArrowDown', 120);
  }
  for (let step = 0; step < 14; step += 1) {
    walked.add(await page.evaluate(stop));
    await press('ArrowUp', 120);
  }
  // Where the pack stands beside the list (a sheet, at a small window) Right crosses to it.
  await press('ArrowRight', 120);
  for (let step = 0; step < 4; step += 1) {
    walked.add(await page.evaluate(stop));
    await press('ArrowDown', 120);
  }
  await page.evaluate(`document.querySelector('[data-item="potion"]').focus()`);
  console.log(`the arrows reached: ${[...walked].join(', ')}`);
  for (const want of ['item:potion', 'item:super-potion', 'item:quick-claw', 'item:tm40-aerial-ace', 'block', 'tidy', 'close']) {
    expect(walked.has(want), `the arrows reach ${want}`);
  }
  await page.evaluate(`document.querySelector('[data-item="potion"]').focus()`);
  await sleep(150);
  await press('Tab', 200);
  expect((await page.evaluate(stop)) === 'drop', 'TAB crosses to the deed in the pane under the list');
  await press('Tab', 200);
  await page.evaluate(`document.querySelector('[data-item="potion"]').focus()`);
  await sleep(150);

  // The FEEDBACK panel over it: the raid stays stopped under both, and a picture of the map goes with it.
  const beforeFeedback = await moment();
  await press('KeyF', 900);
  expect(await panelUp('.feedback-panel'), 'F opens FEEDBACK over the pack');
  await sleep(400);
  await press('Escape', 600);
  expect(await panelUp('.bag-menu'), 'ESC comes back to the pack');
  expect((await moment()) === beforeFeedback, 'and the raid did not move under either');
  expect((await focused()).toUpperCase().includes('POTION'), 'the cursor starts on the first thing in it');

  // A real mouse: a click on a row is ENTER, and the title bar's way back goes back.
  const clickOn = async (selector) => {
    const at = await page.evaluate(`(() => { const r = document.querySelector('${selector}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    }
    await sleep(300);
  };
  await clickOn('[data-item="super-potion"]');
  expect(await page.evaluate(`document.querySelectorAll('[data-target]').length === 3`), 'a click on a row asks who, as ENTER does');
  await page.tap('Escape');
  await sleep(300);
  await page.evaluate(`document.querySelector('[data-item="potion"]').focus()`);
  await sleep(150);
  await press('Enter', 500);
  await shot('2-pack-who');
  expect(await page.evaluate(`document.querySelectorAll('[data-target]').length === 3`), 'ENTER on a Potion asks who, in the panel');
  await holdsTheRaid('.bag-menu', 'the pack asking who');
  await press('Enter', 500);
  await shot('3-pack-given');
  await page.evaluate(`document.querySelector('[data-item="tm40-aerial-ace"]')?.focus()`);
  await sleep(200);

  // The disc, in the same panel.
  await press('Enter', 600);
  expect(await page.evaluate(`document.querySelectorAll('[data-pupil]').length === 3`), 'ENTER on a disc opens who can read it');
  await holdsTheRaid('.bag-menu', 'teaching');
  await shot('4-teach');
  const canLearn = await page.evaluate(`[...document.querySelectorAll('[data-pupil]')].findIndex((p) => p.getAttribute('aria-disabled') !== 'true')`);
  expect(canLearn >= 0, 'somebody in the party can read it');
  await page.evaluate(`document.querySelector('[data-pupil="${canLearn}"]').focus()`);
  await sleep(150);
  await press('Enter', 500);
  await shot('5-teach-chosen');
  expect((await focused()).toUpperCase().includes('TEACH') || (await focused()).toUpperCase().includes('PICK A MOVE'), 'choosing a card puts the cursor on the bar');
  // Charmander knows four moves, so the disc asks which one goes, in the panel too.
  await press('Enter', 700);
  expect(await panelUp('.move-chooser-menu.side-panel'), 'a full moveset opens the move chooser as a side panel');
  await holdsTheRaid('.move-chooser-menu', 'the move chooser');
  await shot('5b-move-chooser');
  await press('Escape', 500);
  expect(!(await panelUp('.move-chooser-menu')), 'ESC in the chooser declines');
  expect(await page.evaluate(`document.querySelector('[data-item="tm40-aerial-ace"]') !== null`), 'and the disc is still in the pack');

  // The way out by key: the clock runs again as soon as it shuts.
  await press('Escape', 500);
  expect(!(await panelUp('.bag-menu')), 'ESC shuts the pack');
  const after = await moment();
  await sleep(900);
  expect((await moment()) !== after, 'and the clock is running again');
  await shot('6-back-in-the-raid');

  // The party.
  await press('KeyP', 800);
  expect(await panelUp('.party-menu.side-panel'), 'P opens the party');
  await holdsTheRaid('.party-menu', 'the party');
  await shot('7-party');
  await press('ArrowDown', 300);
  await shot('8-party-down');
  await press('Enter', 300);
  await shot('9-party-holding');
  await press('Escape', 300);
  await press('Tab', 300);
  await shot('10-party-gear');
  const gear = await page.evaluate(`[...document.querySelectorAll('[data-gear-give]')].filter((b) => b.offsetParent !== null).length`);
  expect(gear > 0, 'gear can be given from the panel');
  expect(await page.evaluate(`(() => { const b = document.querySelector('[data-close]'); b.click(); return true; })()`), 'the back button is there for a mouse');
  await sleep(500);
  expect(!(await panelUp('.party-menu')), 'and it shuts the party');

  // Standing at the map's east edge, the panel may not cover the player.
  const square = await page.evaluate(`JSON.stringify(${world}.currentTile)`);
  const standOn = (tile) =>
    page.evaluate(`(() => { const w = ${world}; const off = w.player.y - w.currentTile.y * 16; const t = ${tile};
      w.currentTile = t; w.setPlayerPosition(t.x * 16, t.y * 16 + off); })()`);
  await page.evaluate(`(() => { const w = ${world}; const off = w.player.y - w.currentTile.y * 16;
    const rect = w.currentArea()?.rect ?? { x: 0, width: w.currentMap.width }; const x = rect.x + rect.width - 2; const y = w.currentTile.y;
    w.currentTile = { x, y }; w.setPlayerPosition(x * 16, y * 16 + off); })()`);
  await sleep(400);
  await press('KeyB', 800);
  await holdsTheRaid('.bag-menu', 'the pack at the east edge of the map');
  await shot('11-pack-east-edge');
  await press('Escape', 600);

  // A hunter on the player's tail: the panel stops it mid-chase, with the chip
  // and the rim round what can be seen, and it comes on the moment it shuts.
  await standOn(square);
  await sleep(300);
  await page.evaluate(`(() => { const w = ${world}; const here = w.currentTile; const h = w.hunterPackHere().hunters[0];
    for (const [dx, dy] of [[0, -6], [6, 0], [-6, 0], [0, 6], [5, 2], [-5, 2], [5, -2], [-5, -2]]) {
      const tile = { x: here.x + dx, y: here.y + dy };
      if (!w.isBlocked(tile)) { h.position = tile; h.next = null; h.stepMs = 0; h.mode = 'alerted'; h.timerMs = 120; h.lastSeen = here; break; }
    } })()`);
  await sleep(320);
  await press('KeyB', 500);
  const hunted = JSON.parse(await moment());
  const chasing = hunted.hunters.find(([, , mode]) => mode === 'chase' || mode === 'alerted');
  expect(chasing !== undefined, 'a hunter is on the player when the pack opens');
  await holdsTheRaid('.bag-menu', 'the pack with a hunter on the player');
  expect(await page.evaluate(`${world}.raidHud.hunterText.visible`), 'the hunter chip is showing beside it');
  await shot('12-pack-hunted');
  await page.evaluate(`document.querySelector('[data-close]').click()`);
  await sleep(350);
  const moved = JSON.parse(await moment()).hunters.find(([id]) => id === chasing[0]);
  expect(JSON.stringify(moved) !== JSON.stringify(chasing) || (await page.evaluate(`${world}.cutscene !== null && ${world}.cutscene !== undefined`)), 'and it comes on the moment the panel shuts');
} finally {
  await page.close();
  await browser.close();
}
