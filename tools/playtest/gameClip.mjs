// Records a harbour minigame from the cabinet to play, as a short clip: walk up
// to the thing that opens it, press SPACE, and keep pressing at a reader's pace
// (ENTER on a menu, SPACE on a box or in the game) for a fixed stretch of game
// time, with the loop stepped so the clip runs at real speed on any machine.
//
//   node tools/playtest/gameClip.mjs <cdp port> <test-mode build url> <save.json> <out dir> --room=<room id> --opens=<thing opens> [--seconds=14] [--read-ms=900] [--play-ms=450] [--play-keys=Space+ArrowRight]
//   node tools/playtest/gameClip.mjs <cdp port> <build url> <save.json> <out dir> --at=<x,y> --facing=<dir> [...]
//
// `--room` and `--opens` find the thing in that room (`base/rooms.ts`: 'game-corner'
// with 'pokemon-jump' or 'berry-picking'); `--at` and `--facing` stand the player
// walk to a yard tile and face that way instead (THE DIG, a board on THE PROMENADE). Writes frames, clip.webm
// and play.json: the screens it passed through, with the game time each
// arrived, and how long from the press to the first frame a game scene was up with
// no menu and no box over it.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const [port, url, savePath, out] = process.argv.slice(2);
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const SECONDS = Number(option('seconds', 14));
const READ_MS = Number(option('read-ms', 900));
const PLAY_MS = Number(option('play-ms', 450));
/** The keys played in the game, in turn: SPACE alone for the jump, a move between digs for THE DIG. */
const PLAY_KEYS = option('play-keys', 'Space').split(/[+]/);
let played = 0;
/** How long a game has been up before anything but SPACE is pressed in it: the ready beat and the DERBY's count take no arrow, so one pressed there is lost. */
const PLAY_AFTER = Number(option('play-after', 4500));
let gameSince = null;
const ROOM = option('room', null);
const OPENS = option('opens', null);
const AT = option('at', null);
const FACING = option('facing', 'up');
const FRAME_MS = 16;
const FRAMES_PER_SHOT = 4;
const SHOT_MS = FRAME_MS * FRAMES_PER_SHOT;
/** The scenes a harbour minigame is played in. */
const GAME_SCENES = ['game-corner', 'berry-picking', 'dig', 'field-course', 'derby', 'fishing-derby', 'outdoor'];
if (!out || !((ROOM && OPENS) || AT)) {
  console.error('usage: gameClip.mjs <cdp port> <build url> <save.json> <out dir> (--room=<id> --opens=<thing> | --at=<x,y> --facing=<dir>)');
  process.exit(2);
}
rmSync(join(out, 'frames'), { recursive: true, force: true });
mkdirSync(join(out, 'frames'), { recursive: true });

const browser = attachBrowser(Number(port), { window: PIXEL_WINDOW });
const save = JSON.parse(readFileSync(savePath, 'utf8'));
const page = await browser.openPage(`${url}${url.includes('?') ? '&' : '?'}testmode=pixels`, { save });
const base = `${GAME}.scene.getScene('base')`;
const step = (frames) => page.evaluate(`${GAME}.stepFrames(${frames}, ${FRAME_MS})`);
let shots = 0;
let gameMs = 0;
async function shoot() {
  await step(FRAMES_PER_SHOT);
  gameMs += SHOT_MS;
  await page.screenshot(join(out, 'frames', `${String(shots).padStart(4, '0')}.png`));
  shots += 1;
}
async function stepUntil(expression, what, maxFrames = 1200) {
  for (let frames = 0; frames < maxFrames; frames += 10) {
    if (await page.evaluate(expression)) return;
    await step(10);
  }
  throw new Error(`never saw ${what}`);
}
const SCREEN = `(() => {
  const d = ${GAME}.describe();
  const b = d.scene.base ?? {};
  const active = ${GAME}.scene.getScenes(true).map((s) => s.scene.key);
  return { scenes: active, menu: d.menu ? (d.menu.heading ?? 'a menu') : null, dialogue: b.dialogue ?? null, choice: b.choice ?? null, busy: d.busy };
})()`;
/** One press towards the thing that opens the game, or null once the player stands facing it. */
const AT_TILE = AT ? Object.fromEntries(AT.split(/[,:]/).map((n, i) => [i ? 'y' : 'x', Number(n)])) : null;
const FACE_KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[FACING];
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
      if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
      prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
  if (!found) return { unreachable: true };
  let cur = found, key = null;
  for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
  return { key }; })()`;

const play = { room: ROOM, opens: OPENS, at: AT, timeline: [], presses: [], msToPlay: null };
try {
  await page.waitFor(`typeof ${GAME}?.stepFrames === 'function'`, { what: 'the game', timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await stepUntil(sceneIs('title'), 'the title');
  await step(60);
  await page.tap('Space');
  await stepUntil(`${sceneIs('base')} && ${base}.ready`, 'the harbour', 3000);
  if (ROOM) {
    await page.evaluate(`(() => { const b = ${base}; b.scene.start('base', { savedGame: b.savedGame, room: ${JSON.stringify(ROOM)} }); })()`);
    await stepUntil(`${base}.ready && !${base}.leaving && ${base}.room?.id === ${JSON.stringify(ROOM)}`, 'the room', 3000);
  }
  await step(30);
  {
    for (let guard = 0; guard < 600; guard += 1) {
      const move = await page.evaluate(TOWARDS);
      if (move.unreachable) throw new Error(`cannot walk to ${AT ?? `what opens ${OPENS} in ${ROOM}`}`);
      if (move.arrived) break;
      if (move.key) await page.tap(move.key);
      await step(4);
    }
    await step(20);
  }
  for (let i = 0; i < 8; i += 1) await shoot();
  await page.tap('Space');
  play.presses.push({ ms: 0, key: 'Space' });
  const started = gameMs;
  let since = 0;
  let last = '';
  while (gameMs - started < SECONDS * 1000) {
    await shoot();
    since += SHOT_MS;
    const screen = await page.evaluate(SCREEN);
    const games = screen.scenes.filter((key) => GAME_SCENES.includes(key));
    const what = screen.menu ? `MENU ${screen.menu}` : screen.choice ? `QUESTION ${screen.choice.question}` : screen.dialogue ? `BOX ${screen.dialogue.text}` : games.length > 0 ? `GAME ${games.join(',')}` : `ROOM`;
    if (what !== last) {
      play.timeline.push({ ms: gameMs - started, what });
      last = what;
    }
    if (play.msToPlay === null && what.startsWith('GAME') && !screen.busy) play.msToPlay = gameMs - started;
    const inGame = what.startsWith('GAME');
    if (inGame && gameSince === null) gameSince = gameMs;
    const settled = inGame && gameMs - gameSince >= PLAY_AFTER;
    if (since >= (settled ? PLAY_MS : READ_MS) && !(screen.dialogue && !screen.dialogue.complete)) {
      const key = screen.menu ? 'Enter' : settled ? PLAY_KEYS[played++ % PLAY_KEYS.length] : 'Space';
      await page.tap(key);
      play.presses.push({ ms: gameMs - started, key });
      since = 0;
    }
  }
} catch (error) {
  await page.screenshot(join(out, 'failed.png')).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
writeFileSync(join(out, 'play.json'), `${JSON.stringify(play, null, 2)}\n`);
const fps = 1000 / SHOT_MS;
const frames = join(out, 'frames', '%04d.png');
const ffmpeg = (args) => spawnSync('nice', ['-n', '15', 'ffmpeg', '-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ffmpeg(['-framerate', String(fps), '-i', frames, '-vf', 'scale=600:-2:flags=neighbor', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', join(out, 'clip.webm')]);
console.log(JSON.stringify({ ...play, presses: play.presses.length }, null, 2));
