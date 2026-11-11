// The raid pack's small fixes, played in a real raid on Greystone Vale:
//
//   1. X on a pocket row drops one of it, and the row's help and the hints say so.
//   2. What was dropped lies on the tile the player stood on, drawn there, for
//      the rest of the raid - and stepping off and back on picks it up again,
//      with the drop taken back rather than a find recorded.
//   3. A disc's row says how many of yours could learn it.
//   4. Reading a disc plays the two-second moment (the move tried once at a
//      practice post), which any key cuts short.
//
//   node tools/playtest/raidPackFixes.mjs <test-mode url> [out dir] [--attach=PORT] [--window=WxH]
//
// `--attach=PORT` drives a browser already running on that CDP port (a shared
// machine's own headless browser); otherwise it launches one and closes it.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const [base, outDir = 'docs/screens/raid-pack-fixes'] = args.filter((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: raidPackFixes.mjs <url> [out dir] [--attach=PORT] [--window=WxH]');
}
const size = /^(\d+)x(\d+)$/.exec(option('window') ?? '1280x800');
const window = { width: Number(size[1]), height: Number(size[2]) };
const url = new URL(base);
if (!url.searchParams.has('testmode')) url.searchParams.set('testmode', 'pixels');
mkdirSync(outDir, { recursive: true });

const attach = option('attach');
const browser = attach ? attachBrowser(Number(attach), { window }) : await launchBrowser({ window });
const faults = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = sleep;
  // An attached browser keeps the last run's save: start from a fresh one.
  await wait(1500);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, holdMs = 60) => {
    await page.keyDown(code);
    if (holdMs > 0) await wait(holdMs);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const shot = async (name) => {
    await wait(250);
    const path = `${outDir}/${name}.png`;
    await page.screenshot(path);
    console.log(`  ${path}`);
  };
  const world = `${GAME}.scene.getScene('world')`;
  const bagCount = (itemId) => page.evaluate(`${world}.bag.count(${JSON.stringify(itemId)})`);
  const statusLine = () => page.evaluate(`document.querySelector('.px-status-line')?.textContent ?? ''`);
  const openBag = async () => {
    await press('KeyB');
    await until(`Boolean(document.querySelector('.bag-menu'))`, 'the pack');
    await wait(300);
  };
  const closeBag = async () => {
    await press('Escape');
    await until(`!document.querySelector('.bag-menu')`, 'the pack to close');
    await wait(200);
  };

  // A Geodude can read TM39 and the Charmander cannot, which is what the row's
  // "N of yours can learn it" is for.
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait,
    starter: 'Charmander',
    team: ['geodude:12'],
    stash: ['potion:4', 'tm39-rock-tomb:1'],
    pack: ['potion:3', 'tm39-rock-tomb:1'],
  });
  await until(sceneIs('world'), 'the world');
  for (let guard = 0; guard < 12; guard += 1) {
    if (!(await page.evaluate(`${world}.dialogBox.visible`))) break;
    await press('Space');
    await wait(250);
  }

  // 1 and 3: the pocket, a disc row saying who can learn it, and X dropping.
  await openBag();
  const discRow = await page.evaluate(`document.querySelector('[data-item="tm39-rock-tomb"]')?.innerText ?? ''`);
  check(/1 of yours can learn it/i.test(discRow), `the disc row says who can learn it: ${JSON.stringify(discRow.replace(/\n/g, ' / '))}`);
  const hints = await page.evaluate(`document.querySelector('[data-help-text]')?.dataset.helpDefault ?? ''`);
  check(hints.includes('X drop'), `the hints say X drops: ${hints}`);
  await page.evaluate(`document.querySelector('[data-item="potion"]').focus()`);
  await wait(200);
  const help = await page.evaluate(`document.querySelector('[data-help-text]')?.textContent ?? ''`);
  check(/X drops one Potion/.test(help), `the Potion row's help says X drops: ${help}`);
  await shot('1-pocket');
  const tile = await page.evaluate(`({ ...${world}.currentTile })`);
  await press('KeyX');
  await wait(300);
  check((await bagCount('potion')) === 2, 'X took one Potion out of the pack');
  check(/Dropped Potion/.test(await statusLine()), `the pack says so: ${await statusLine()}`);
  await shot('2-dropped');
  await closeBag();

  // 2: it lies on the tile, drawn, and comes back by stepping off and on.
  const lying = await page.evaluate(
    `(() => { const s = ${world}; const piece = (s.runSession.droppedOnTheGround?.[s.currentMap.id] ?? [])[0]; return piece ? { ...piece, drawn: s.lootSprites.has(piece.id) } : null; })()`,
  );
  check(lying?.itemId === 'potion' && lying.position.x === tile.x && lying.position.y === tile.y, `it lies where the player stood: ${JSON.stringify(lying)}`);
  check(lying?.drawn === true, 'it is drawn on the map');
  const dropped = await page.evaluate(`${world}.runSession.manager.snapshot().droppedItems`);
  check(dropped.some((stack) => stack.itemId === 'potion'), 'the raid records it as put down');
  // Step off to a free side and back on.
  const sides = [
    ['ArrowDown', 'ArrowUp', 0, 1],
    ['ArrowUp', 'ArrowDown', 0, -1],
    ['ArrowLeft', 'ArrowRight', -1, 0],
    ['ArrowRight', 'ArrowLeft', 1, 0],
  ];
  let away;
  for (const [out, back, dx, dy] of sides) {
    // Two free tiles that way, so the partner at the player's heel is off the drop for the picture.
    const free = await page.evaluate(
      `${world}.collisionData[${tile.y + dy}]?.[${tile.x + dx}] === false && ${world}.collisionData[${tile.y + 2 * dy}]?.[${tile.x + 2 * dx}] === false`,
    );
    if (free) {
      away = [out, back];
      break;
    }
  }
  check(Boolean(away), 'there is a free tile beside the drop');
  // Two steps off and back to it, so the partner walking at the player's heel
  // is not standing on it for the picture.
  const steps = async (key, count) => {
    for (let step = 0; step < count; step += 1) {
      const from = await page.evaluate(`({ ...${world}.currentTile })`);
      await press(key, 120);
      await until(`(${world}.currentTile.x !== ${from.x} || ${world}.currentTile.y !== ${from.y}) && !${world}.targetTile`, 'a step');
      await wait(150);
    }
  };
  const off = 2;
  await steps(away[0], off);
  await wait(400);
  await shot('3-on-the-ground');
  await steps(away[1], off);
  await until(`${world}.currentTile.x === ${tile.x} && ${world}.currentTile.y === ${tile.y}`, 'the step back');
  await wait(400);
  await shot('4-picked-up-again');
  check((await bagCount('potion')) === 3, 'stepping back onto it picked the Potion up again');
  const after = await page.evaluate(`${world}.runSession.manager.snapshot()`);
  check(!after.droppedItems.some((stack) => stack.itemId === 'potion'), 'the drop is taken back');
  check(!after.foundItems.some((stack) => stack.itemId === 'potion'), 'and no find is recorded');
  for (let guard = 0; guard < 6; guard += 1) {
    if (!(await page.evaluate(`${world}.dialogBox.visible`))) break;
    await press('Space');
    await wait(250);
  }

  // 4: read TM39 to the Geodude and watch the moment.
  await openBag();
  await page.evaluate(`document.querySelector('[data-item="tm39-rock-tomb"]').click()`);
  await until(`Boolean(document.querySelector('[data-pupil]'))`, 'the teaching screen');
  const geodude = await page.evaluate(
    `[...document.querySelectorAll('[data-pupil]')].find((card) => /GEODUDE/.test(card.innerText))?.dataset.pupil`,
  );
  await page.evaluate(`document.querySelector('[data-pupil="${geodude}"]').click()`);
  // TEACH answers nothing within RELEASE_ARMING_MS (500ms) of the card being chosen.
  await wait(600);
  await page.evaluate(`document.querySelector('[data-teach]').click()`);
  await until(`Boolean(document.querySelector('.teach-moment')) || Boolean(document.querySelector('[data-forget]'))`, 'the moment or the chooser');
  if (await page.evaluate(`Boolean(document.querySelector('[data-forget]'))`)) {
    await page.evaluate(`document.querySelector('[data-forget="0"]').click()`);
    await wait(300);
    await page.evaluate(`document.querySelector('[data-forget-confirm]').click()`);
    await until(`Boolean(document.querySelector('.teach-moment'))`, 'the moment');
  }
  await wait(1050);
  const moment = await page.evaluate(`document.querySelector('.teach-moment-words')?.innerText ?? ''`);
  check(/GEODUDE learned ROCK TOMB!/i.test(moment), `the moment says it: ${moment}`);
  await shot('5-disc-read');
  // It ends by itself after two seconds.
  await until(`!document.querySelector('.teach-moment')`, 'the moment to end by itself');
  check(/learned ROCK TOMB/i.test(await statusLine()), `the pack says it after: ${await statusLine()}`);
  check((await bagCount('tm39-rock-tomb')) === 0, 'the TM is used up');
  await shot('6-after-the-moment');
  await closeBag();
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`\n${faults.length} fault(s)`);
  process.exitCode = 1;
} else {
  console.log('\nall checks passed');
}
