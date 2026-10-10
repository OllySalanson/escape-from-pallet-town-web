// Walks the harbour with the partner at heel and plays every promise it makes
// (`src/game/base/partner.ts`), photographing it as it goes:
//
//   node tools/playtest/harbourPartner.mjs <test-mode build url> <out dir> [--starter=charmander] [--clips]
//
// It is stepped at exact 60fps frames on a paused loop (so it needs a test-mode
// build, `?testmode=pixels` for a picture worth judging) and fails loudly - a
// thrown error, not a picture - when the partner is ever anywhere but the tile
// the player has just left, blocks a walk, cannot be faced or spoken to, comes
// back through a door without its player, or follows a save that lost it.
// `--clips` also writes three short animated PNGs (walk, talk, door) cropped
// round the player at 2x, for a pull request or a README.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const starter = option('starter') ?? 'charmander';
const clips = args.includes('--clips');
const FRAME_MS = 1000 / 60;
/** 2x: the 400x256 stage drawn at twice its size. */
const WINDOW = { width: 800, height: 512 };
/** The part of the 2x screen a clip keeps: round the middle, where the camera holds the player. */
const CLIP_CROP = { x: 240, y: 156, width: 320, height: 224 };
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`harbour partner: ${why}`);
};

// -- the clips: a tiny animated-PNG writer, so nothing needs installing -------

function decodePng(bytes) {
  let at = 8;
  let width = 0;
  let height = 0;
  let colourType = 6;
  const data = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('ascii');
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colourType = body[9];
    } else if (type === 'IDAT') {
      data.push(body);
    }
    at += 12 + length;
  }
  const channels = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      row[x] = (value + predicted) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      pixels.set([row[x * channels], row[x * channels + 1], row[x * channels + 2], 255], (y * width + x) * 4);
    }
    previous = row;
  }
  return { width, height, pixels };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

/** Every frame laid end to end as one looping APNG at 30 frames a second. */
function animatedPng(images) {
  const { width, height } = images[0];
  const scanlines = (image) => {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y += 1) {
      image.pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    }
    return deflateSync(raw, { level: 9 });
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const control = Buffer.alloc(8);
  control.writeUInt32BE(images.length, 0);
  control.writeUInt32BE(0, 4);
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('acTL', control)];
  let sequence = 0;
  images.forEach((image, index) => {
    const frame = Buffer.alloc(26);
    frame.writeUInt32BE(sequence++, 0);
    frame.writeUInt32BE(width, 4);
    frame.writeUInt32BE(height, 8);
    frame.writeUInt32BE(0, 12);
    frame.writeUInt32BE(0, 16);
    frame.writeUInt16BE(1, 20);
    frame.writeUInt16BE(30, 22);
    frame[24] = 0;
    frame[25] = 0;
    parts.push(chunk('fcTL', frame));
    const data = scanlines(image);
    if (index === 0) {
      parts.push(chunk('IDAT', data));
    } else {
      const numbered = Buffer.alloc(data.length + 4);
      numbered.writeUInt32BE(sequence++, 0);
      data.copy(numbered, 4);
      parts.push(chunk('fdAT', numbered));
    }
  });
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// -- the walk ---------------------------------------------------------------

const browser = await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = async (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const state = () =>
    page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const p = b.partner; return {
      tile: b.currentTile, moving: b.targetTile !== null, facing: b.facing, room: b.room && b.room.id,
      partner: p && { tile: p.place.tile, out: p.place.out, facing: p.place.facing, alpha: p.sprite.alpha,
        visible: p.sprite.visible, bubble: !!p.bubble, species: p.species },
      hint: b.hintShown, line: b.dialogBox.visible ? b.dialogBox.textObject.text : null }; })()`);
  const tap = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
  };
  /** Records the picture once a frame for a clip, when clips were asked for. */
  const recording = { name: null, frames: [] };
  const record = async () => {
    if (recording.name && (await page.evaluate(`${GAME}.loop.frame`)) % 2 === 0) {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...CLIP_CROP, scale: 1 } });
      recording.frames.push(Buffer.from(data, 'base64'));
    }
  };
  const frames = async (count) => {
    for (let index = 0; index < count; index += 1) {
      await step(1);
      await record();
    }
  };
  const hold = async (code, ms) => {
    await page.keyDown(code);
    await frames(Math.round(ms / FRAME_MS));
    await page.keyUp(code);
  };
  const startClip = (name) => {
    recording.name = clips ? name : null;
    recording.frames = [];
  };
  const endClip = async () => {
    if (recording.name) {
      writeFileSync(`${out}/${recording.name}.png`, animatedPng(recording.frames.map(decodePng)));
    }
    recording.name = null;
  };
  /** At rest, the partner stands on a neighbour of the player and nowhere else. */
  const expectAtHeel = async (when) => {
    const now = await state();
    if (!now.partner?.out) fail(`${when}: no partner out`);
    const apart = Math.abs(now.partner.tile.x - now.tile.x) + Math.abs(now.partner.tile.y - now.tile.y);
    if (apart !== 1) fail(`${when}: partner ${JSON.stringify(now.partner.tile)} is not beside ${JSON.stringify(now.tile)}`);
    return now;
  };

  // A new game: the starter picked is the partner.
  await tap('Space');
  await until(sceneIs('starter'));
  await until(`(() => { const b = document.querySelector('button[data-starter="${starter}"]'); if (!b) return false; b.click(); return true; })()`);
  await wait(300);
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('confirm') && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    'the confirm button',
  );
  await until(`${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`, 'the harbour');
  startClip('clip-arrive-and-walk');
  await frames(70);
  await page.screenshot(`${out}/arrive.png`);
  const arrived = await expectAtHeel('arriving');
  if (arrived.partner.species !== starter) fail(`the partner is ${arrived.partner.species}, not the ${starter} picked`);

  // Footsteps: every step ends with the partner on the tile the player left.
  for (const [code, ms] of [['ArrowLeft', 600], ['ArrowDown', 150], ['ArrowRight', 300]]) {
    const before = await state();
    await hold(code, ms);
    await until(`!${GAME}.scene.getScene('base').targetTile`);
    const after = await expectAtHeel(`after walking ${code}`);
    if (JSON.stringify(after.tile) === JSON.stringify(before.tile)) fail(`${code} walked nowhere`);
  }
  await frames(50);
  await endClip();
  await page.screenshot(`${out}/walked.png`);

  // Facing it: a tap towards it turns the player and walks nowhere.
  const atRest = await expectAtHeel('before turning');
  const towards = { '1,0': 'ArrowRight', '-1,0': 'ArrowLeft', '0,1': 'ArrowDown', '0,-1': 'ArrowUp' }[
    `${atRest.partner.tile.x - atRest.tile.x},${atRest.partner.tile.y - atRest.tile.y}`
  ];
  startClip('clip-turn-and-talk');
  await frames(10);
  await tap(towards);
  await frames(12);
  const turned = await state();
  if (JSON.stringify(turned.tile) !== JSON.stringify(atRest.tile)) fail('a tap towards the partner walked the player');
  if (!turned.hint.includes(turned.partner.species.toUpperCase())) fail(`facing the partner, the hint said "${turned.hint}"`);
  await page.screenshot(`${out}/facing.png`);

  // Speaking to it: a line in its name, a bubble, and it looks at the player.
  await tap('Space');
  await frames(70);
  const spoken = await state();
  if (!spoken.line?.includes(spoken.partner.species.toUpperCase())) fail(`spoken to, it said "${spoken.line}"`);
  if (!spoken.partner.bubble) fail('spoken to, it showed no bubble');
  await page.screenshot(`${out}/talk.png`);
  for (let press = 0; press < 4; press += 1) {
    await tap('Space');
    await frames(12);
  }
  await frames(60);
  await endClip();

  // Never blocking: holding towards it walks straight through, and it steps back past.
  startClip('clip-swap');
  await hold(towards, 330);
  await until(`!${GAME}.scene.getScene('base').targetTile`);
  const swapped = await expectAtHeel('after walking through it');
  if (JSON.stringify(swapped.tile) === JSON.stringify(atRest.tile)) fail('holding towards the partner never walked');
  await frames(40);
  await endClip();

  // Through a door and out again: in after the player, beside the mat, back out at their side.
  await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const door = b.doors[0];
    b.currentTile = { ...door.returnTo }; b.partner.place = { ...b.partner.place, tile: { x: door.returnTo.x, y: door.returnTo.y + 1 } };
    b.setPlayerPosition(door.returnTo.x * 16, door.returnTo.y * 16 - 11); })()`);
  await frames(30);
  startClip('clip-door');
  await hold('ArrowUp', 170);
  await until(`${GAME}.scene.getScene('base').room !== null && ${GAME}.scene.getScene('base').ready`, 'a room');
  await frames(70);
  const inside = await expectAtHeel('inside a room');
  await page.screenshot(`${out}/room.png`);
  await tap('ArrowDown');
  await until(`${GAME}.scene.getScene('base').room === null && ${GAME}.scene.getScene('base').ready`, 'the yard again');
  await frames(70);
  const outside = await expectAtHeel('back out in the yard');
  await page.screenshot(`${out}/door-out.png`);
  await hold('ArrowDown', 330);
  await frames(40);
  await endClip();
  console.log(`inside ${inside.room}: partner at ${JSON.stringify(inside.partner.tile)}; outside: ${JSON.stringify(outside.partner.tile)}`);

  // Lost: a save whose partner is gone walks the harbour alone.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.partnerId = null; localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await tap('Space');
  await until(`${sceneIs('base')} && ${GAME}.scene.getScene('base').ready`, 'the harbour, partner lost');
  await frames(60);
  if ((await state()).partner !== null) fail('a save that lost its partner still has one following');
  await page.screenshot(`${out}/lost.png`);
  console.log('every promise held');
} finally {
  await browser.close();
}
