// Plays THE GREAT LIBRARY end to end (`src/game/library/`) in a browser something
// else started - this machine's own headless one - by its CDP port: the door,
// the room, the golden plinth (locked, or open in the explorer run), a book
// opened, a page caught going over, clicks both ways and ESC back out.
//   node tools/playtest/greatLibrary.mjs <cdp port> <url> <out dir> [--explorer]
import { attachBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';
import { mkdirSync } from 'node:fs';

const [port, url, out] = process.argv.slice(2);
const explorer = process.argv.includes('--explorer');
mkdirSync(out, { recursive: true });
const browser = attachBrowser(Number(port), { window: PIXEL_WINDOW });
const page = await browser.openPage(`${url}${url.includes('?') ? '&' : '?'}testmode=pixels${explorer ? '&playtest' : ''}`);
const log = (...words) => console.log(...words);
const press = async (code) => {
  await page.tap(code, 60);
  await sleep(150);
};
const until = (expression, what, timeoutMs = 60_000) => page.waitFor(expression, { what, timeoutMs });
const base = `${GAME}.scene.getScene('base')`;

try {
  await until(`${GAME}?.scene.getScenes(true).length > 0`, 'the game');
  if (!explorer) {
    await until(sceneIs('title'), 'the title');
    await sleep(800);
    await press('Space');
    await until(`${sceneIs('base')} && ${base}.ready`, 'the lab');
    await sleep(500);
    await page.evaluate(`${base}.takeStarterForDriver('bulbasaur')`);
  }
  await until(`${sceneIs('base')} && ${base}.ready && !${base}.room`, 'the yard');
  await sleep(800);

  async function walkTo(goals, label) {
    for (let guard = 0; guard < 300; guard += 1) {
      // Never mid-step: read then, the tile is the one being left, and a tap made for it walked a
      // fresh save one tile past the library's step (playtest 51, finding 13).
      const move = await page.evaluate(`(() => { const b = ${base}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return { wait: true };
        const goals = ${JSON.stringify(goals)};
        const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
        const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
        if (at(s.x, s.y)) return { arrived: true };
        const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
        while (queue.length) { const [x, y] = queue.shift();
          if (at(x, y)) { found = [x, y]; break; }
          for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
            if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
            prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
        if (!found) return { unreachable: true, from: s, goals, room: b.room?.id ?? null };
        let cur = found, key = null;
        for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
        return { key }; })()`);
      if (move.unreachable) throw new Error(`cannot walk to ${label}: ${JSON.stringify(move)}`);
      if (move.arrived) return;
      if (move.key) await page.tap(move.key, 60);
      await sleep(120);
    }
    throw new Error(`never got to ${label}`);
  }

  const door = await page.evaluate(`${base}.doors.find((d) => d.id === 'great-library').tiles`);
  await walkTo([{ x: door[0].x, y: door[0].y + 1 }], 'the library step');
  await until(`!${base}.targetTile`, 'standing on the step');
  await page.screenshot(`${out}/01-outside.png`);
  // One step up from the step is through the doors.
  await page.tap('ArrowUp', 60);
  await until(`${base}.room?.id === 'great-library' && ${base}.ready && !${base}.leaving`, 'the library');
  await sleep(1200);
  await page.screenshot(`${out}/02-library.png`);

  // The golden plinth, from in front.
  await walkTo([{ x: 7, y: 8 }], 'the golden plinth');
  await press('ArrowUp');
  await press('Space');
  await sleep(600);
  const goldenOpened = await page.evaluate(sceneIs('library-book'));
  log('golden plinth opened a book:', goldenOpened);
  await page.screenshot(`${out}/03-golden-${goldenOpened ? 'open' : 'locked'}.png`);
  if (goldenOpened) {
    const book = `${GAME}.scene.getScene('library-book')`;
    await sleep(800);
    log('reading', JSON.stringify(await page.evaluate(`${book}.reading`)));
    await press('ArrowRight');
    await sleep(700);
    await press('ArrowRight');
    await sleep(700);
    await press('ArrowRight');
    await sleep(700);
    await page.screenshot(`${out}/04-golden-spread.png`);
    await press('Escape');
    await until(`!${sceneIs('library-book')} && ${base}.sys.isActive()`, 'back in the library');
  } else {
    // Read to the end of what it says, then ESC past the rest, as a player can.
    await sleep(1500);
    await page.screenshot(`${out}/03b-golden-locked-read.png`);
    await press('Escape');
    await sleep(400);
  }

  // THE BOLTHOLE on its lectern.
  await walkTo([{ x: 5, y: 8 }], 'the Bolthole lectern');
  // The harbour comes back from the last book a frame or two after the key
  // that closed it, so a press made in between is asked again.
  for (let tries = 0; tries < 4 && !(await page.evaluate(sceneIs('library-book'))); tries += 1) {
    await press('ArrowUp');
    await press('Space');
    await sleep(1500);
  }
  await until(sceneIs('library-book'), 'the book open');
  const book = `${GAME}.scene.getScene('library-book')`;
  await sleep(1200);
  log('reading', JSON.stringify(await page.evaluate(`${book}.reading`)));
  await page.screenshot(`${out}/05-book-open.png`);
  // A page caught going over: the loop held, the key let in, and a few frames run.
  await page.evaluate(`${GAME}.pauseLoop()`);
  await page.tap('ArrowRight', 0);
  await page.evaluate(`${GAME}.stepFrames(1, 16)`);
  await page.evaluate(`${GAME}.stepFrames(8, 16)`);
  await page.screenshot(`${out}/06-turning-early.png`);
  await page.evaluate(`${GAME}.stepFrames(9, 16)`);
  await page.screenshot(`${out}/07-turning-late.png`);
  await page.evaluate(`${GAME}.stepFrames(20, 16)`);
  await page.screenshot(`${out}/08-turned.png`);
  log('after one turn', JSON.stringify(await page.evaluate(`${book}.reading`)));
  await page.evaluate(`${GAME}.resumeLoop ? ${GAME}.resumeLoop() : ${GAME}.unpauseLoop?.()`);
  await sleep(300);
  // Back with a click on the left page, on with clicks on the right.
  const click = async (x, y) => {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(800);
  };
  await click(300, 380);
  log('after a click on the left page', JSON.stringify(await page.evaluate(`${book}.reading`)));
  for (let i = 0; i < 8; i += 1) await click(900, 380);
  log('after clicks on the right page', JSON.stringify(await page.evaluate(`${book}.reading`)));
  await page.screenshot(`${out}/09-last-spread.png`);
  await press('Escape');
  await until(`!${sceneIs('library-book')} && ${base}.sys.isActive()`, 'back in the library');
  await sleep(500);
  log('back in', await page.evaluate(`${base}.room?.id`), JSON.stringify(await page.evaluate(`${base}.currentTile`)));
  await page.screenshot(`${out}/10-closed.png`);
} catch (error) {
  await page.screenshot(`${out}/failed.png`).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
