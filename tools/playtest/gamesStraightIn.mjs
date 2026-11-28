// Plays a harbour minigame from the SPACE that opens it, as a player would,
// and photographs each step: the game standing ready, the list of who plays
// behind P, ESC back to the game, the beat running out into play, the result
// card, P from there, and PLAY on the list standing somebody else ready. At
// THE DIG it also holds that the first arrow in the ready beat starts the dig
// and moves the spade. Stepped loop, against a test-mode build; exits 1 on a
// failed check. `docs/screens/games-straight-in/` was made with it.
//
//   node tools/playtest/gamesStraightIn.mjs <cdp port> <build url> <save.json> <out dir> <scene key> (--room=<id> --opens=<thing> | --at=x:y --facing=<dir>)
//
// `--room=game-corner --opens=pokemon-jump` for a cabinet; `--at=69:19 --facing=right`
// (THE DIG), `--at=62:12 --facing=up` (THE DERBY), `--at=86:29 --facing=left` (THE
// FISHING DERBY) or `--at=118:8 --facing=up` (THE FIELD-MOVE COURSE) for the yard.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const [port, url, savePath, out, sceneKey] = process.argv.slice(2);
const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const ROOM = option('room', null);
const OPENS = option('opens', null);
const AT = option('at', null);
const FACING = option('facing', 'up');
mkdirSync(out, { recursive: true });

const browser = attachBrowser(Number(port), { window: PIXEL_WINDOW });
const save = JSON.parse(readFileSync(savePath, 'utf8'));
const page = await browser.openPage(`${url}?testmode=pixels`, { save });
const base = `${GAME}.scene.getScene('base')`;
const game = `${GAME}.scene.getScene('${sceneKey}')`;
const step = (frames) => page.evaluate(`${GAME}.stepFrames(${frames}, 16)`);
const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
};
async function stepUntil(expression, what, maxFrames = 1500) {
  for (let frames = 0; frames < maxFrames; frames += 5) {
    if (await page.evaluate(expression)) return;
    await step(5);
  }
  throw new Error(`never saw ${what}`);
}
const shot = (name) => page.screenshot(join(out, `${name}.png`));
const phase = () => page.evaluate(`${game}.phaseKind`);
const listUp = `Boolean(document.querySelector('#screens .game-corner-screen [data-play]'))`;
const AT_TILE = AT
  ? Object.fromEntries(AT.split(/[,:]/).map((n, i) => [i ? 'y' : 'x', Number(n)]))
  : null;
const FACE_KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[
  FACING
];
const TOWARDS = `(() => { const b = ${base}; if (!b.ready || b.leaving || b.targetTile) return { wait: true };
  const things = b.place?.room?.things ?? [];
  const thing = things.filter((t) => t.opens === ${JSON.stringify(OPENS)});
  const goals = ${AT_TILE ? `[${JSON.stringify(AT_TILE)}]` : `thing.flatMap((t) => t.tiles.filter((tile) => !t.tiles.some((o) => o.x === tile.x && o.y === tile.y + 1)).map((tile) => ({ x: tile.x, y: tile.y + 1 }))).filter((g) => !b.collision[g.y]?.[g.x])`};
  const facing = ${JSON.stringify(AT_TILE ? FACING : 'up')}, faceKey = ${JSON.stringify(AT_TILE ? FACE_KEY : 'ArrowUp')};
  const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
  const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
  if (at(s.x, s.y)) return b.facing === facing ? { arrived: true } : { key: faceKey };
  const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
  while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
      if (!at(nx, ny) && (c[ny][nx] || (Math.abs(nx - s.x) + Math.abs(ny - s.y) <= 1 && b.isBlocked({ x: nx, y: ny })))) continue;
      prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
  if (!found) return { unreachable: true };
  let cur = found, key = null;
  for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
  return { key }; })()`;

let failed = false;
const expect = (what, ok) => {
  note(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
};
try {
  await page.waitFor(`typeof ${GAME}?.stepFrames === 'function'`, {
    what: 'the game',
    timeoutMs: 60_000,
  });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await stepUntil(sceneIs('title'), 'the title');
  await step(60);
  await page.tap('Space');
  await stepUntil(`${sceneIs('base')} && ${base}.ready`, 'the harbour', 3000);
  if (ROOM) {
    await page.evaluate(
      `(() => { const b = ${base}; b.scene.start('base', { savedGame: b.savedGame, room: ${JSON.stringify(ROOM)} }); })()`,
    );
    await stepUntil(
      `${base}.ready && !${base}.leaving && ${base}.room?.id === ${JSON.stringify(ROOM)}`,
      'the room',
      3000,
    );
  }
  if (AT) {
    note(
      `starts in ${await page.evaluate(`${base}.room?.id ?? 'the harbour'`)} at ${await page.evaluate(`JSON.stringify(${base}.currentTile)`)}`,
    );
    await page.evaluate(
      `(() => { const b = ${base}; b.scene.start('base', { savedGame: b.savedGame, at: ${JSON.stringify(AT_TILE)}, facing: ${JSON.stringify(FACING)} }); })()`,
    );
    await stepUntil(
      `${base}.ready && !${base}.leaving && !${base}.room`,
      'the harbour outside',
      3000,
    );
    note(`outside at ${await page.evaluate(`JSON.stringify(${base}.currentTile)`)}`);
  }
  await step(30);
  for (let guard = 0; guard < 600; guard += 1) {
    const move = await page.evaluate(TOWARDS);
    if (move.unreachable) throw new Error('cannot walk there');
    if (move.arrived) break;
    if (move.key) {
      const from = await page.evaluate(`JSON.stringify(${base}.currentTile)`);
      await page.tap(move.key);
      await step(12);
      if (
        (await page.evaluate(`JSON.stringify(${base}.currentTile)`)) === from &&
        !move.key.startsWith('Face')
      ) {
        const aside = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][guard % 4];
        await page.tap(aside);
        await step(12);
      }
    }
    await step(4);
  }
  await step(20);
  await page.tap('Space');
  await stepUntil(
    `${sceneIs(sceneKey)} && ${game}.phaseKind === 'ready'`,
    'the game standing ready',
    600,
  );
  await step(20);
  expect(
    'one press opens the game standing ready, with no list over it',
    !(await page.evaluate(listUp)),
  );
  await shot('01-ready');
  checks: {
    const choice = await page.evaluate(
      `typeof ${game}.canPick === 'function' ? ${game}.canPick() : ${game}.lineups.length > 1`,
    );
    if (!choice) {
      // Nobody else to choose: the plate names no key, and P does nothing.
      await page.tap('KeyP');
      await step(10);
      expect(
        'with nobody else to choose, P opens nothing',
        !(await page.evaluate(listUp)) && (await phase()) === 'ready',
      );
      await stepUntil(`${game}.phaseKind === 'playing'`, 'play starting by itself', 600);
      for (let frames = 0; frames < 4000 && (await phase()) !== 'result'; frames += 30) {
        if (frames === 600) await page.tap('Escape');
        await step(30);
      }
      await step(90);
      expect('the game ends on its result card', (await phase()) === 'result');
      await shot('04-result');
      await page.tap('KeyP');
      await step(10);
      expect(
        'P on the result card opens nothing either',
        !(await page.evaluate(listUp)) && (await phase()) === 'result',
      );
      break checks;
    }
    // An arrow in the beat is the game's, never who plays.
    const before = JSON.stringify(await page.evaluate(`${game}.lineupIds ?? []`));
    const standing = await page.evaluate(
      `JSON.stringify(${game}.jumping ?? ${game}.lineupAt ?? null)`,
    );
    if (sceneKey === 'dig') {
      const from = await page.evaluate(`${game}.cursor.x`);
      await page.tap('ArrowLeft');
      await step(4);
      expect(
        "LEFT in THE DIG's ready beat starts the dig and moves the spade",
        (await phase()) === 'playing' && (await page.evaluate(`${game}.cursor.x`)) === from - 1,
      );
      await shot('01b-dig-first-arrow');
      await page.tap('Escape');
      note(`after ESC: ${await phase()} active ${await page.evaluate(sceneIs(sceneKey))}`);
      await stepUntil(`${game}.phaseKind === 'result'`, 'the dig stopped', 600);
      note(`at result: ${await phase()} active ${await page.evaluate(sceneIs(sceneKey))}`);
      await step(10);
      note(`10 frames on: ${await phase()} active ${await page.evaluate(sceneIs(sceneKey))}`);
      await page.tap('KeyP');
      await step(10);
      note(`after P: ${await phase()} active ${await page.evaluate(sceneIs(sceneKey))}`);
      expect(
        'P on the result card opens the list',
        (await page.evaluate(listUp)) && (await phase()) === 'choosing',
      );
      await page.tap('Escape');
      await step(10);
      expect(
        'ESC on the list is back to the game standing ready',
        !(await page.evaluate(listUp)) && (await phase()) === 'ready',
      );
      await step(20);
    }
    await page.tap('ArrowRight');
    await step(4);
    if (sceneKey !== 'dig')
      expect(
        'RIGHT in the ready beat changes nobody',
        (await page.evaluate(`JSON.stringify(${game}.jumping ?? ${game}.lineupAt ?? null)`)) ===
          standing && (await phase()) === 'ready',
      );
    else {
      note(`after RIGHT: ${await phase()}`);
      await page.tap('Escape');
      await step(4);
      note(`after ESC: ${await phase()} active ${await page.evaluate(sceneIs(sceneKey))}`);
      await stepUntil(`${game}.phaseKind === 'result'`, 'the dig stopped again', 600);
      await step(90);
      await page.tap('Space');
      await stepUntil(`${game}.phaseKind === 'ready'`, 'the dig again', 600);
      await step(20);
    }
    await page.tap('KeyP');
    await step(10);
    expect(
      'P opens the list of who plays',
      (await page.evaluate(listUp)) && (await phase()) === 'choosing',
    );
    await step(30);
    await shot('02-list');
    await page.tap('Escape');
    await step(10);
    expect(
      'ESC on the list is back to the game standing ready',
      !(await page.evaluate(listUp)) && (await phase()) === 'ready',
    );
    await shot('03-back-ready');
    await stepUntil(
      `${game}.phaseKind === 'playing' || ${game}.phaseKind === 'running'`,
      'play starting by itself',
      600,
    );
    expect('the beat runs out into play by itself', true);
    // Nobody plays: the game ends on its own, or ESC stops it.
    for (let frames = 0; frames < 4000; frames += 30) {
      if ((await phase()) === 'result') break;
      if (frames === 600) await page.tap('Escape');
      await step(30);
    }
    await step(90);
    expect('the game ends on its result card', (await phase()) === 'result');
    await shot('04-result');
    await page.tap('KeyP');
    await step(10);
    expect(
      'P on the result card opens the list',
      (await page.evaluate(listUp)) && (await phase()) === 'choosing',
    );
    await step(30);
    await shot('05-list-after');
    note(`lineups ${before}`);
    // Somebody else chosen on the list, and PLAY: back to the game, them standing ready.
    const picked = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('#screens .game-corner-screen :is([data-jumper],[data-picker],[data-runner],[data-player-pick])')];
    const row = rows.find((each) => !each.classList.contains('is-selected') && each.getAttribute('aria-disabled') !== 'true');
    if (!row) return null;
    row.click();
    return row.dataset.jumper ?? row.dataset.picker ?? row.dataset.runner ?? row.dataset.playerPick;
  })()`);
    note(`chose ${picked}`);
    await step(60);
    await page.evaluate(
      `document.querySelector('#screens .game-corner-screen [data-play]')?.click()`,
    );
    await step(10);
    const who = await page.evaluate(
      `JSON.stringify(${game}.jumping ?? (${game}.lineups?.[${game}.lineupAt] ?? []).map((p) => p.id))`,
    );
    expect(
      `PLAY on the list stands the one chosen ready (${who})`,
      !(await page.evaluate(listUp)) &&
        (await phase()) === 'ready' &&
        (picked === null || who.includes(picked)),
    );
    await step(20);
    await shot('06-ready-chosen');
  }
} catch (error) {
  failed = true;
  note(`ERROR ${error.message}`);
  await shot('failed').catch(() => undefined);
} finally {
  await browser.close();
}
writeFileSync(join(out, 'log.txt'), `${log.join('\n')}\n`);
process.exit(failed ? 1 : 0);
