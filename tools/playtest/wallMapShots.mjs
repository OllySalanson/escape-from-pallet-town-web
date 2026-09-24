// Walks up to the wall map in Oak's Lab, reads it, and photographs every step:
// the board on the wall, the four maps at a glance, each map close up, and the
// drop-in screen's picture of the place, which is the same picture.
//
//   node tools/playtest/wallMapShots.mjs <url> <out dir> [--window=1200x768]
//     [--survey=path.json] [--beaten=bossId,..]
//
// `--survey` takes a save's walked ground (`raid.mjs --progress=path.json`
// writes one; `tools/tileset/sampleSurvey.mts` makes a plausible one without a
// raid) and `--beaten` the keepers whose signs go up. It fails loudly - a
// thrown error, not a picture - when a promise the wall makes is broken: the
// hint line names the key where the board can be read from, the key opens it,
// every map can be read close up with the arrow keys and ENTER, and backing
// out stands the player where they read it from rather than at the door.
import { mkdirSync, readFileSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
const survey = option('survey')
  ? (JSON.parse(readFileSync(option('survey'), 'utf8')).surveyed ?? JSON.parse(readFileSync(option('survey'), 'utf8')))
  : {};
const beaten = (option('beaten') ?? '').split(',').filter(Boolean);
mkdirSync(out, { recursive: true });

const base = (expression) => `(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => {
    await page.tap(code);
    await sleep(220);
  };
  const shoot = async (name) => {
    await sleep(500);
    const overflow = JSON.parse(
      await page.evaluate(
        `JSON.stringify([document.documentElement.scrollHeight - document.documentElement.clientHeight, document.documentElement.scrollWidth - document.documentElement.clientWidth])`,
      ),
    );
    if (overflow.some((over) => over > 0)) {
      throw new Error(`${name}: the page scrolls by ${overflow}`);
    }
    await page.screenshot(`${out}/${name}.png`);
    console.log(name);
  };
  // Walks the room over its own collision to a tile, then faces a way.
  const walkTo = async (goal, face) => {
    for (let guard = 0; guard < 80; guard += 1) {
      const move = await page.evaluate(
        base(`(() => { if (!b.ready || b.leaving || b.targetTile) return { wait: true };
          const s = b.currentTile; if (s.x === ${goal.x} && s.y === ${goal.y}) return { done: true };
          const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
          const prev = new Map([[id(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
          while (q.length) { const [x, y] = q.shift(); if (x === ${goal.x} && y === ${goal.y}) { found = [x, y]; break; }
            for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
              prev.set(id(nx, ny), [x, y, k]); q.push([nx, ny]); } }
          if (!found) return { unreachable: true };
          let cur = found, key = null; for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
          return { key }; })()`),
      );
      if (move.unreachable) throw new Error(`nothing in the lab walks to ${goal.x},${goal.y}`);
      if (move.done) break;
      if (move.key) await page.tap(move.key);
      await sleep(260);
    }
    await press(face);
  };

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); Object.assign(save.raidProgress, ${JSON.stringify({
    firstContractExtracted: true,
    completedContracts: ['recover-lost-field-kit'],
    unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    defeatedBosses: beaten,
    surveyed: survey,
  })}); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('base'));

  // Into the lab, then off the mat to the floor in front of the board.
  await walkIntoBase(page, 'oaks-lab');
  await press('Escape');
  await page.waitFor(sceneIs('base'));
  await sleep(600);
  // The floor under the middle of the board, read off the room the scene built.
  const board = JSON.parse(
    await page.evaluate(
      base(`(() => { const tiles = b.place.room.things.find((thing) => thing.opens === 'wall-map').tiles;
        const foot = Math.max(...tiles.map((tile) => tile.y)); const xs = tiles.filter((tile) => tile.y === foot).map((tile) => tile.x);
        return JSON.stringify({ x: xs[Math.floor(xs.length / 2)], y: foot + 1 }); })()`),
    ),
  );
  await walkTo(board, 'ArrowUp');
  const hint = await page.evaluate(base('b.hintShown'));
  if (hint !== '[SPACE] THE WALL MAP') {
    throw new Error(`in front of the board the hint line says '${hint}'`);
  }
  await shoot('lab-wall');

  await press('Space');
  await page.waitFor(sceneIs('hub'));
  await page.waitFor(`document.querySelectorAll('canvas[data-picture][data-painted]').length === 4`, {
    what: 'the four maps to be painted',
  });
  await shoot('wall-map');

  // Every map close up, reached with the keyboard alone.
  const order = JSON.parse(
    await page.evaluate(`JSON.stringify([...document.querySelectorAll('[data-wall-map]')].map((card) => card.dataset.wallMap))`),
  );
  for (const mapId of order) {
    for (let guard = 0; guard < 8; guard += 1) {
      if ((await page.evaluate(`document.activeElement?.dataset.wallMap ?? ''`)) === mapId) break;
      await press('ArrowRight');
    }
    if ((await page.evaluate(`document.activeElement?.dataset.wallMap ?? ''`)) !== mapId) {
      throw new Error(`the arrow keys never reach ${mapId} on the wall`);
    }
    await press('Enter');
    await page.waitFor(`document.querySelector('canvas[data-picture="wall:${mapId}"][data-painted]') !== null && document.querySelectorAll('canvas[data-picture]').length === 1`, {
      what: `${mapId} close up`,
    });
    await shoot(`close-up-${mapId}`);
    await press('Escape');
    await page.waitFor(`document.querySelectorAll('canvas[data-picture][data-painted]').length === 4`);
  }

  // Out of the screen, back in front of the board rather than at the door.
  await press('Escape');
  await page.waitFor(sceneIs('base'));
  await sleep(600);
  const standing = await page.evaluate(base('JSON.stringify({ room: b.room?.id, tile: b.currentTile })'));
  if (standing !== JSON.stringify({ room: 'oaks-lab', tile: board })) {
    throw new Error(`backing out of the wall map left the player at ${standing}`);
  }

  // And the drop-in screen, which draws the same picture as big as it goes.
  await walkIntoBase(page, 'oaks-lab');
  for (const label of ['Start a raid', 'Bulbasaur', 'Choose drop-in']) {
    await page.waitFor(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`,
      { what: label },
    );
    await sleep(250);
  }
  await page.waitFor(`document.querySelector('canvas[data-picture][data-painted]') !== null`, { what: 'the drop-in picture' });
  await shoot('drop-in');
} finally {
  await browser.close();
}
