// Records what is written on the overworld while a player does the ordinary
// things - walks the harbour's front, goes in at a door, comes out, and lands
// on a raid - as short clips and stills at a laptop's window (1200x768), on
// the real renderer. One frame every 4 game frames (15 a second of game
// time), with the loop stepped, so a clip runs at real speed whatever the
// machine is doing and two builds' clips can be laid side by side.
//
//   node tools/playtest/quietClip.mjs <cdp port> <test-mode build url> <save.json> <out dir> [--part=harbour|raid|all]
//
// The harbour part plays the walk from the pier gate up to THE GAME CORNER,
// through its door and one step in, then out again and west along the front
// to THE RAID ARENA's square, where the regulars stand. The raid part deploys
// the save's team at the vale's front door and walks its first few steps.
// The shared harbour is on (`harbour=local`), so the regulars walk it as a
// real player sees them.
//
// Writes <out dir>/<part>/frames/*.png, <part>.webm, <part>.gif, stills at the
// moments named in `words.json`, and `words.json`: every piece of writing the
// scene was showing at each still (`describe()`), so two builds' words can be
// counted against each other.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, jumpIn, sceneIs } from './deploy.mjs';

const [port, url, savePath, out] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const part = process.argv.find((arg) => arg.startsWith('--part='))?.slice(7) ?? 'all';
// `--bare` takes every word off the harbour but its place-name board before each
// frame: the plainest screen the harbour can show, a fixed point to judge others against.
const BARE = process.argv.includes('--bare');
// Hidden after every update, so the frame drawn is the bare one.
const BARE_JS = `(() => {
  const b = ${GAME}.scene.getScene('base');
  if (!b || b.__bare) return;
  b.__bare = true;
  b.events.on('postupdate', () => {
    const keep = new Set([b.placeSign?.frame, b.placeSign?.text].filter(Boolean));
    for (const child of b.children.list) if (child.scrollFactorX === 0 && !keep.has(child)) child.setVisible(false);
    for (const label of b.worldLabels ?? []) label.hide?.();
  });
})()`;
/** A time zone where it is midday now, so every build's harbour is lit the same. */
const middayZone = () => {
  let offset = (12 - new Date().getUTCHours() + 24) % 24;
  if (offset > 14) offset -= 24;
  return offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
};
if (!out) {
  console.error('usage: quietClip.mjs <cdp port> <build url> <save.json> <out dir> [--part=harbour|raid|all]');
  process.exit(2);
}
const FRAME_MS = 16;
const FRAMES_PER_SHOT = 4;
const browser = attachBrowser(Number(port), { window: PIXEL_WINDOW });
const save = JSON.parse(readFileSync(savePath, 'utf8'));
const base = `${GAME}.scene.getScene('base')`;
const words = {};

async function recorder(page, name) {
  const dir = join(out, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'frames'), { recursive: true });
  let shots = 0;
  const step = (frames) => page.evaluate(`${GAME}.stepFrames(${frames}, ${FRAME_MS})`);
  const shoot = async (frames = FRAMES_PER_SHOT) => {
    await step(frames);
    if (BARE) await page.evaluate(BARE_JS);
    await page.screenshot(join(dir, 'frames', `${String(shots).padStart(4, '0')}.png`));
    shots += 1;
  };
  const hold = async (ms) => {
    for (let held = 0; held < ms; held += FRAMES_PER_SHOT * FRAME_MS) await shoot();
  };
  /** Holds a key down for `ms` of game time, recording. */
  const walk = async (code, ms) => {
    await page.keyDown(code);
    for (let held = 0; held < ms; held += FRAMES_PER_SHOT * FRAME_MS) await shoot();
    await page.keyUp(code);
  };
  const still = async (label) => {
    const file = join(dir, `${label}.png`);
    copyFileSync(join(dir, 'frames', `${String(shots - 1).padStart(4, '0')}.png`), file);
    // Every piece of writing on the canvas (\`describe().texts\`) and the page's own over it.
    words[`${name}/${label}`] = await page.evaluate(`(() => {
      const d = ${GAME}.describe();
      return { canvas: (d.texts ?? []).map((t) => t.text.replace(/\\s+/g, ' ').trim()).filter(Boolean) };
    })()`);
  };
  const stepUntil = async (expression, what, maxFrames = 3000) => {
    for (let frames = 0; frames < maxFrames; frames += 10) {
      if (await page.evaluate(expression)) return;
      await step(10);
    }
    await page.screenshot(join(dir, 'failed.png')).catch(() => undefined);
    const seen = await page.evaluate(`JSON.stringify(${GAME}.describe()).slice(0, 1500)`).catch(() => '');
    throw new Error(`never saw ${what}: ${seen}`);
  };
  const encode = () => {
    const fps = 1000 / (FRAMES_PER_SHOT * FRAME_MS);
    const frames = join(dir, 'frames', '%04d.png');
    const ffmpeg = (args) => spawnSync('nice', ['-n', '15', 'ffmpeg', '-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    ffmpeg(['-framerate', String(fps), '-i', frames, '-vf', 'scale=600:-2:flags=neighbor', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', join(out, `${name}.webm`)]);
    ffmpeg(['-framerate', String(fps), '-i', frames, '-vf', 'scale=480:-2:flags=neighbor,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none', '-loop', '0', join(out, `${name}.gif`)]);
  };
  return { step, shoot, hold, walk, still, stepUntil, encode };
}

async function openGame() {
  const page = await browser.openPage(`${url}${url.includes('?') ? '&' : '?'}testmode=pixels&harbour=local`, { save });
  await page.send('Emulation.setTimezoneOverride', { timezoneId: middayZone() });
  await page.send('Page.reload');
  await page.waitFor(`typeof ${GAME}?.stepFrames === 'function'`, { what: 'the game', timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  return page;
}

/**
 * CONTINUE on the title, into the harbour. The shared harbour asks a save with
 * no name for one on the way in, after the title is up: LATER, as a player in a
 * hurry answers, pressed for again while the title is still what is up.
 */
async function intoHarbour(page, r) {
  await r.stepUntil(sceneIs('title'), 'the title');
  const later = `(() => { const b = [...document.querySelectorAll('button')].find((each) => each.innerText.trim() === 'LATER'); if (!b) return false; b.click(); return true; })()`;
  for (let tries = 0; tries < 30 && !(await page.evaluate(sceneIs('base'))); tries += 1) {
    if (!(await page.evaluate(later)) && (await page.evaluate(sceneIs('title')))) await page.tap('Space');
    await r.step(30);
  }
  await r.stepUntil(`${sceneIs('base')} && ${base}.ready`, 'the harbour');
}

async function harbour() {
  const page = await openGame();
  const r = await recorder(page, 'harbour');
  await intoHarbour(page, r);
  // Out of THE GAME CORNER's door, as a player who has just been in stands, then
  // three steps down to the pier gate: the walk starts there.
  await page.evaluate(`void ${base}.scene.start('base', { savedGame: ${base}.savedGame, from: 'game-corner' })`);
  await r.stepUntil(`${base}.ready && !${base}.leaving`, 'outside the game corner');
  await r.step(120);
  await r.walk('ArrowDown', 3 * 300);
  await r.step(240);
  for (let i = 0; i < 4; i += 1) await r.shoot();
  await r.still('pier-square');
  await r.walk('ArrowUp', 3 * 300 + 600);
  await r.stepUntil(`${base}.room?.id === 'game-corner' && ${base}.ready && !${base}.leaving`, 'inside the game corner', 600).catch(() => undefined);
  await r.hold(700);
  await r.still('room-arrival');
  await r.walk('ArrowUp', 300);
  await r.hold(600);
  await r.still('room-first-step');
  // Out again, and along the front to the Raid Arena's square.
  await page.evaluate(`void ${base}.scene.start('base', { savedGame: ${base}.savedGame, from: 'raid-arena' })`);
  await r.stepUntil(`${base}.ready && !${base}.leaving`, 'outside the raid arena');
  await r.hold(1200);
  await r.still('arena-square');
  await r.walk('ArrowDown', 2 * 300);
  await r.walk('ArrowRight', 4 * 300);
  await r.hold(600);
  await r.still('arena-square-walked');
  r.encode();
  await page.close?.();
}

async function raid() {
  const page = await openGame();
  const r = await recorder(page, 'raid');
  await intoHarbour(page, r);
  // Into THE RAID ARENA's hall, to the rim and over, as a player jumps in.
  await page.evaluate(`void ${base}.scene.start('base', { savedGame: ${base}.savedGame, room: 'raid-arena' })`);
  await r.stepUntil(`${base}.ready && ${base}.room?.id === 'raid-arena' && !${base}.leaving`, 'the hall');
  const wait = (ms) => r.step(Math.max(1, Math.round(ms / FRAME_MS)));
  const press = async (code) => {
    await page.keyDown(code);
    await r.step(4);
    await page.keyUp(code);
    await r.step(4);
  };
  const until = async (expression, what = expression) => r.stepUntil(expression, what, 6000);
  await jumpIn(page, { press, until, wait });
  await r.hold(2500);
  await r.still('landing');
  // Oak's word on the radio, read at a second a box, as a player does.
  for (let guard = 0; guard < 12; guard += 1) {
    const open = await page.evaluate(`${GAME}.scene.getScene('world').dialogBox?.visible === true`);
    if (!open) break;
    await r.hold(1000);
    await page.tap('Space');
  }
  await r.hold(800);
  await r.still('read');
  await r.walk('ArrowDown', 900);
  await r.walk('ArrowLeft', 900);
  await r.hold(1500);
  await r.still('walked');
  r.encode();
}

try {
  if (part === 'harbour' || part === 'all') await harbour();
  if (part === 'raid' || part === 'all') await raid();
} finally {
  writeFileSync(join(out, 'words.json'), `${JSON.stringify(words, null, 2)}\n`);
  await browser.close();
}
