// The pack laid out by hand, and whether it stays that way.
//
//   node tools/playtest/packArrange.mjs http://localhost:5173/ <out dir> [--plain]
//
// It plays the one thing nothing else can: a player picking a piece of their
// pack up, turning it, putting it down somewhere else, and then finding it
// still there - on the loadout, inside the raid, and after the page has been
// reloaded off the save. Every move is a real key event on a real control,
// because the promise being checked is that the whole of it works with no
// mouse at all.
//
// The case it was written for is the captain's own (2026-09-20): a pack with
// seven of eighteen squares free and no seat for a four-square find, because
// nothing could be turned on its side.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const [base, outDir = 'docs/screens/pack-arrange'] = args.filter((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: packArrange.mjs <dev server url> <out dir> [--plain]');
}
const url = new URL(base);
if (!flag('plain')) {
  url.searchParams.set('testmode', 'pixels');
}

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? '  ok  ' : '  NO  '}${what}`);
  if (!ok) {
    failures.push(what);
  }
};

/** Where every block of a container sits, read off the markup the player sees. */
const layoutOf = (name) => `(() => {
  const grid = document.querySelector('[data-grid=${JSON.stringify(name)}]');
  if (!grid) return null;
  return [...grid.querySelectorAll('[data-grid-piece]')]
    .map((b) => b.dataset.gridPiece + ' @ ' + b.style.gridColumn + ' / ' + b.style.gridRow)
    .sort()
    .join(' | ');
})()`;

mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 300; guard += 1) {
      if (await page.evaluate(expression)) {
        return;
      }
      await sleep(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await sleep(50);
    await page.keyUp(code);
    await sleep(140);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await sleep(350);
  };
  /** Puts the cursor on one block of a container, the way an arrow key would. */
  const focusPiece = (name, piece) =>
    page.evaluate(
      `(() => { const b = document.querySelector('[data-grid=${JSON.stringify(name)}] [data-grid-piece=${JSON.stringify(piece)}]'); if (!b) return false; b.focus(); return true; })()`,
    );
  /** Packs one more of a supply by the loadout row's own stepper. */
  const packOne = async (itemId) => {
    await until(
      `(() => { const b = document.querySelector('button[data-count-kind="item"][data-count-id=${JSON.stringify(itemId)}][data-count-dir="1"]'); if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`,
      `the pack to take one more ${itemId}`,
    );
    await sleep(200);
  };

  // --- A save with supplies in the vault, opened on the loadout -------------
  await until(sceneIs('title'), 'the title screen');
  await press('Space');
  await until(sceneIs('starter'), 'the starter picker');
  await until(
    `(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`,
    'the picker to offer Bulbasaur',
  );
  await click('Confirm Bulbasaur');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the game to write its save');
  await page.evaluate(
    `(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
      save.stash.items = { ...save.stash.items, potion: 6, 'super-potion': 4, 'poke-ball': 6 };
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`,
  );
  await page.send('Page.navigate', { url: url.href });
  await until(sceneIs('title'), 'the title screen again');
  await press('Space');
  await until(sceneIs('hub'), 'the lobby');
  await click('Start a raid');
  await click('Bulbasaur');
  for (const itemId of ['super-potion', 'super-potion', 'potion', 'potion', 'poke-ball']) {
    await packOne(itemId);
  }

  const packed = await page.evaluate(layoutOf('pack'));
  console.log(`\npacked automatically: ${packed}`);
  check(packed !== null, 'the loadout draws the pack as blocks the cursor can reach');
  await page.screenshot(`${outDir}/loadout-packed.png`);

  // --- Picking a piece up, turning it and putting it down, by keyboard ------
  await focusPiece('pack', 'item:0:super-potion');
  await press('Enter');
  const carrying = await page.evaluate(
    `Boolean(document.querySelector('[data-grid="pack"] .px-grid-ghost'))`,
  );
  check(carrying, 'ENTER on a block picks it up and draws what is being carried');
  await page.screenshot(`${outDir}/carrying.png`);

  await press('KeyR');
  const lyingDown = await page.evaluate(
    `(() => { const g = document.querySelector('[data-grid="pack"] .px-grid-ghost'); return g ? g.style.gridColumn.includes('span 2') : false; })()`,
  );
  check(lyingDown, 'R turns the carried piece, and the ghost shows the shape before it lands');

  // Carry it to the far end of the bottom row, where nothing else is standing.
  for (let step = 0; step < 6; step += 1) {
    await press('ArrowRight');
  }
  for (let step = 0; step < 3; step += 1) {
    await press('ArrowDown');
  }
  const ghostSeat = await page.evaluate(
    `(() => { const g = document.querySelector('[data-grid="pack"] .px-grid-ghost'); return g ? { seat: g.style.gridColumn + ' / ' + g.style.gridRow, bad: g.classList.contains('is-bad') } : null; })()`,
  );
  console.log(`carried to: ${JSON.stringify(ghostSeat)}`);
  check(ghostSeat !== null, 'the arrow keys carry it a square at a time');
  await page.screenshot(`${outDir}/carried-and-turned.png`);

  await press('Enter');
  const arranged = await page.evaluate(layoutOf('pack'));
  console.log(`arranged by hand:     ${arranged}`);
  check(arranged !== packed, 'ENTER puts it down somewhere else, and the pack keeps it there');
  check(
    await page.evaluate(
      `!document.querySelector('[data-grid="pack"] .px-grid-ghost')`,
    ),
    'nothing is left in the hand once it is put down',
  );
  await page.screenshot(`${outDir}/arranged.png`);

  // --- The same move with a pointer, dragged rather than carried -----------
  const cellCentre = async (name, x, y) =>
    page.evaluate(
      `(() => { const cells = document.querySelectorAll('[data-grid=${JSON.stringify(name)}] .px-grid-cells > i'); const cols = Number(document.querySelector('[data-grid=${JSON.stringify(name)}]').dataset.gridCols); const r = cells[${y} * cols + ${x}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
  const mouse = async (type, at, extra = {}) =>
    page.send('Input.dispatchMouseEvent', {
      type,
      x: at.x,
      y: at.y,
      button: 'left',
      buttons: type === 'mouseReleased' ? 0 : 1,
      clickCount: 1,
      pointerType: 'mouse',
      ...extra,
    });
  const before = await page.evaluate(layoutOf('pack'));
  const from = await cellCentre('pack', 2, 0);
  const to = await cellCentre('pack', 0, 2);
  await mouse('mousePressed', from);
  await sleep(80);
  await mouse('mouseMoved', { x: from.x + 20, y: from.y + 20 });
  await sleep(80);
  await mouse('mouseMoved', to);
  await sleep(120);
  const dragGhost = await page.evaluate(
    `Boolean(document.querySelector('[data-grid="pack"] .px-grid-ghost'))`,
  );
  check(dragGhost, 'dragging with the pointer picks a piece up and shows where it would land');
  await page.screenshot(`${outDir}/dragging.png`);
  await mouse('mouseReleased', to);
  await sleep(300);
  const dragged = await page.evaluate(layoutOf('pack'));
  console.log(`dragged:              ${dragged}`);
  check(dragged !== before, 'letting go puts it down where the pointer was');

  // --- The secure container is a container too ------------------------------
  await click('Secure slot');
  await sleep(300);
  const secureBefore = await page.evaluate(layoutOf('secure'));
  check(secureBefore !== null, 'the secure container draws blocks the cursor can reach as well');
  await page.screenshot(`${outDir}/secure.png`);
  await click('Back to loadout');
  await sleep(300);

  // --- Adding something must not re-shuffle what was arranged ---------------
  await packOne('poke-ball');
  const afterAdding = await page.evaluate(layoutOf('pack'));
  const movedPiece = dragged
    .split(' | ')
    .find((entry) => entry.startsWith('item:0:super-potion'));
  check(
    afterAdding.includes(movedPiece),
    'packing one more supply leaves every piece the player placed where it was',
  );

  // --- Into the raid, and the pack opens laid out the same way --------------
  await click('Choose drop-in');
  await click('Review & deploy');
  await click('Enter the raid');
  await until(sceneIs('world'), 'the raid');
  await sleep(900);
  // The raid opens on its briefing, and the world reads no other key until the
  // box is gone: the bag is only one key away once there is nothing to read.
  for (let guard = 0; guard < 8; guard += 1) {
    if (!(await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`))) {
      break;
    }
    await press('Space');
    await sleep(250);
  }
  await press('KeyB');
  await until(`document.querySelectorAll('.menu-overlay').length > 0`, 'the raid bag');
  await sleep(400);
  const inRaid = await page.evaluate(layoutOf('pack'));
  console.log(`in the raid:          ${inRaid}`);
  check(inRaid === afterAdding, 'the raid opens the pack laid out exactly as it was packed');
  await page.screenshot(`${outDir}/in-raid-bag.png`);

  // --- Tidy is a deed the player asks for, never one done to them -----------
  await click('Tidy');
  await sleep(400);
  const tidied = await page.evaluate(layoutOf('pack'));
  console.log(`tidied:               ${tidied}`);
  check(tidied !== inRaid, 'TIDY packs the pack again from scratch');
  await page.screenshot(`${outDir}/tidied.png`);

  // --- And a layout made in the field comes home ----------------------------
  await focusPiece('pack', 'item:0:poke-ball');
  await press('Enter');
  for (let step = 0; step < 6; step += 1) {
    await press('ArrowRight');
  }
  for (let step = 0; step < 3; step += 1) {
    await press('ArrowDown');
  }
  await press('Enter');
  const fieldLayout = await page.evaluate(layoutOf('pack'));
  console.log(`arranged in the field:${fieldLayout}`);
  check(fieldLayout !== tidied, 'the pack can be arranged inside the raid too');
  await page.screenshot(`${outDir}/arranged-in-raid.png`);
  await press('KeyB');
  await sleep(300);

  const saved = await page.evaluate(
    `${GAME}.scene.getScene('world').bag.arrangement.items.length`,
  );
  check(saved > 0, 'the raid pack is carrying the seats the player chose');

  console.log(
    failures.length === 0
      ? `\nEvery check passed. Screens in ${outDir}/`
      : `\n${failures.length} check(s) failed:\n - ${failures.join('\n - ')}`,
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
} finally {
  await browser.close();
}
