// Records a keeper being spoken to, from their room's mat to the menu or
// question they open, as a short clip: what a player sees and how long it
// takes before they can do anything. One frame every 4 game frames (15 a
// second of game time), with the loop stepped, so the clip runs at real speed
// whatever the machine is doing and two builds' clips can be laid side by side.
//
//   node tools/playtest/keeperClip.mjs <cdp port> <test-mode build url> <save.json> <room id> <out dir> [--twice] [--read-ms=900] [--hold-ms=1600]
//
// `--twice` backs out of what opened and speaks again, for the visit a player
// has every time after the first.
//
// Writes <out dir>/frames/*.png, <out dir>/clip.webm, <out dir>/clip.gif and
// <out dir>/talk.json: every dialogue box shown before the menu, the question
// or menu it ended on, the presses it took and the game time from the first
// press to the menu. Room ids are `base/rooms.ts`'s ('pokemon-centre',
// 'bills-cottage', 'brocks-workshop', 'oaks-lab', 'raid-arena', 'prize-window',
// 'game-corner', 'battle-arena'). The reading time per box is fixed
// (`--read-ms`), so a clip's length is the number of boxes.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const [port, url, savePath, roomId, out] = process.argv.slice(2);
const flag = (name, fallback) => Number(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const READ_MS = flag('read-ms', 900);
const HOLD_MS = flag('hold-ms', 1600);
const FRAME_MS = 16;
const FRAMES_PER_SHOT = 4;
if (!out) {
  console.error('usage: keeperClip.mjs <cdp port> <build url> <save.json> <room id> <out dir>');
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
async function shoot(frames = FRAMES_PER_SHOT) {
  await step(frames);
  gameMs += frames * FRAME_MS;
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
/** What is on screen, for deciding the next press: a box, a question, or a menu. */
const SCREEN = `(() => {
  const d = ${GAME}.describe();
  const b = d.scene.base ?? {};
  const covered = ${sceneIs('hub')} || ${sceneIs('boutique')} || ${sceneIs('game-corner')} || ${sceneIs('dojo')} || ${sceneIs('library-book')};
  return { dialogue: b.dialogue ?? null, choice: b.choice ?? null, menu: covered || Boolean(d.menu) ? (d.menu?.heading ?? d.scenes.join(',')) : null, busy: d.busy };
})()`;

const TWICE = process.argv.includes('--twice');
const talk = { room: roomId, visits: [] };

/** One talk, from the key that starts it to the menu or question it opens, read at a fixed pace. */
async function speak() {
  const visit = { boxes: [], endedOn: null, presses: 1, msToAct: 0 };
  await page.tap('Space');
  const started = gameMs;
  let readFor = 0;
  for (let guard = 0; guard < 600; guard += 1) {
    await shoot();
    const screen = await page.evaluate(SCREEN);
    if (screen.menu || screen.choice) {
      visit.endedOn = screen.choice ? `QUESTION: ${screen.choice.question} [${screen.choice.options.join(' / ')}]` : `MENU: ${screen.menu}`;
      break;
    }
    if (screen.dialogue) {
      if (screen.dialogue.complete && visit.boxes[visit.boxes.length - 1] !== screen.dialogue.text) {
        visit.boxes.push(screen.dialogue.text);
        readFor = 0;
      }
      if (screen.dialogue.complete) {
        readFor += FRAMES_PER_SHOT * FRAME_MS;
        if (readFor >= READ_MS) {
          await page.tap('Space');
          visit.presses += 1;
          readFor = 0;
        }
      }
    } else if (!screen.busy && guard > 20) {
      // Said its piece, or nothing, and opened nothing: the room again.
      visit.endedOn = 'NOTHING: back in the room';
      break;
    }
  }
  visit.msToAct = gameMs - started;
  return visit;
}
try {
  await page.waitFor(`typeof ${GAME}?.stepFrames === 'function'`, { what: 'the game', timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await stepUntil(sceneIs('title'), 'the title');
  await step(60);
  await page.tap('Space');
  await stepUntil(`${sceneIs('base')} && ${base}.ready`, 'the harbour', 3000);
  // Straight onto the room's mat, as walking in through its door puts a player.
  await page.evaluate(`(() => { const b = ${base}; b.scene.start('base', { savedGame: b.savedGame, room: ${JSON.stringify(roomId)} }); })()`);
  await stepUntil(`${base}.ready && ${base}.room?.id === ${JSON.stringify(roomId)} && !${base}.leaving`, `the room ${roomId}`, 3000);
  await step(30);
  for (let i = 0; i < 8; i += 1) await shoot();
  talk.visits.push(await speak());
  for (let held = 0; held < HOLD_MS; held += FRAMES_PER_SHOT * FRAME_MS) await shoot();
  if (TWICE) {
    // Back out of what opened, read anything said on the way out, and speak again: the visit a player has every session after the first.
    for (let guard = 0; guard < 200; guard += 1) {
      const screen = await page.evaluate(SCREEN);
      const back = await page.evaluate(`${base}.sys.isActive() && ${base}.ready && !${base}.leaving`);
      if (back && !screen.menu && !screen.choice && !screen.dialogue) break;
      await page.tap(screen.dialogue ? 'Space' : 'Escape');
      for (let i = 0; i < 4; i += 1) await shoot();
    }
    for (let i = 0; i < 12; i += 1) await shoot();
    talk.visits.push(await speak());
    for (let held = 0; held < HOLD_MS; held += FRAMES_PER_SHOT * FRAME_MS) await shoot();
  }
} catch (error) {
  await page.screenshot(join(out, 'failed.png')).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
writeFileSync(join(out, 'talk.json'), `${JSON.stringify(talk, null, 2)}\n`);
const fps = 1000 / (FRAMES_PER_SHOT * FRAME_MS);
const frames = join(out, 'frames', '%04d.png');
const ffmpeg = (args) => spawnSync('nice', ['-n', '15', 'ffmpeg', '-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ffmpeg(['-framerate', String(fps), '-i', frames, '-vf', 'scale=600:-2:flags=neighbor', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', join(out, 'clip.webm')]);
ffmpeg(['-framerate', String(fps), '-i', frames, '-vf', 'scale=480:-2:flags=neighbor,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none', '-loop', '0', join(out, 'clip.gif')]);
console.log(JSON.stringify(talk, null, 2));
