// Plays THE POINT's coin telescope (`src/game/base/seaTelescope.ts`) the way a
// player does, and photographs it:
//
//   node tools/playtest/seaTelescope.mjs <test-mode build url> <out dir> [--port=N] [--clock=day|dusk|night] [--clip]
//
// A new game is started, the harbour restarted standing on the walk behind
// the telescope, and SPACE pressed at it. The swoop down behind the player is
// photographed as it goes, then the glass: Z zooms, the arrows point it at the
// nearest kind out at sea, and it is held there until the glass has seen it.
// The driver fails unless the kind is then in the save's Pokédex as met and
// not as owned, and unless ESC brings the harbour's camera back exactly as it
// was. `--clip` writes the whole of it as an animated PNG at half size. It
// steps a paused loop at 60fps frames, so it needs a test-mode build
// (`?testmode=pixels` for pictures worth judging; `tools/playtest/README.md`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { animatedPng, decodePng } from './apng.mjs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const clip = args.includes('--clip');
const FRAME_MS = 1000 / 60;
const WINDOW = PIXEL_WINDOW;
const clock = option('clock');
const CLOCK_HOUR = { day: 12, dusk: 19, night: 23 };
const zoneFor = (hour) => {
  let offset = (hour - new Date().getUTCHours() + 24) % 24;
  if (offset > 14) offset -= 24;
  return offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
};
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`sea telescope: ${why}`);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  if (clock !== undefined) {
    if (!(clock in CLOCK_HOUR)) fail('--clock is day, dusk or night');
    await page.send('Emulation.setTimezoneOverride', { timezoneId: zoneFor(CLOCK_HOUR[clock]) });
  }
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const frames = [];
  // The clip runs from SPACE at the telescope, through the first kind seen, and from ESC to the
  // harbour back again: every third frame of it, at the game's own pixels (the window is 3x).
  let recording = false;
  const record = async () => {
    if (!clip || !recording) return;
    if ((await page.evaluate(`${GAME}.loop.frame`)) % 3 === 0) {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, ...WINDOW, scale: 1 / 3 } });
      frames.push(decodePng(Buffer.from(data, 'base64')));
    }
  };
  const step = async (count = 1) => {
    for (let index = 0; index < count; index += 1) {
      await page.evaluate(`${GAME}.stepFrames(1, ${FRAME_MS})`);
      await record();
    }
  };
  const fastStep = (count) => (clip && recording ? step(count) : page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`));
  const wait = async (ms) => fastStep(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const tap = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const glass = `${base}.describeForTest().seaTelescope`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;

  await tap('Space');
  await until(sceneIs('base'));
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  await page.evaluate(`void ${base}.scene.start('base', { at: { x: 120, y: 14 } })`);
  await until(baseReady, 'the harbour at THE POINT');
  await wait(1700);
  // Face the telescope, the way a player walking up to it would.
  await tap('ArrowDown');
  await wait(200);
  const hint = await page.evaluate(`${base}.describeForTest().hint`);
  if (!/TELESCOPE/.test(hint ?? '')) fail(`the hint at the telescope says ${JSON.stringify(hint)}`);
  await page.screenshot(`${out}/1-at-the-telescope.png`);
  const before = await page.evaluate(`(() => { const c = ${base}.cameras.main; return { zoom: c.zoom, rotation: c.rotation, x: c.scrollX, y: c.scrollY }; })()`);

  recording = true;
  await tap('Space');
  const shots = [
    ['2-swooping', 'swoop-in', 30],
    ['3-behind', 'behind-hold', 6],
    ['4-pushing-in', 'push', 28],
  ];
  for (const [name, phase, after] of shots) {
    await until(`${glass}?.phase === '${phase}'`, `the ${phase}`);
    await step(after);
    await page.screenshot(`${out}/${name}.png`);
  }
  await until(`${glass}?.phase === 'open'`, 'the glass open');
  await step(10);
  await page.screenshot(`${out}/5-the-glass.png`);

  // A kind out at sea, at the glass's closest zoom, held in the middle until it is seen:
  // the first near one, then the first far one if the sea has one.
  const sightings = await page.evaluate(`${glass}.sightings`);
  const near = sightings.find((each) => each.band === 'near');
  if (!near) fail('nothing out at sea');
  const far = sightings.find((each) => each.band === 'far' && each.species !== near.species);
  for (const [index, code] of ['KeyZ', 'KeyZ'].entries()) {
    await tap(code);
    await step(20);
    const zoom = await page.evaluate(`${glass}.zoom`);
    if (zoom !== [2, 4][index]) fail(`Z took the glass to ${zoom}, not ${[2, 4][index]}`);
  }
  // Steered with the arrow keys, as a player steers it, onto the body of a kind and held there.
  const held = new Set();
  const press = async (code, down) => {
    if (down && !held.has(code)) {
      held.add(code);
      await page.keyDown(code);
    } else if (!down && held.has(code)) {
      held.delete(code);
      await page.keyUp(code);
    }
  };
  const hold = async (sighting, name) => {
    for (let frame = 0; frame < 60 * 40; frame += 1) {
      const now = await page.evaluate(`${glass}`);
      const seen = now.spotted.find((each) => each.species === sighting.species);
      if (seen) {
        for (const code of [...held]) await press(code, false);
        return seen;
      }
      const body = now.sightings.find((each) => each.id === sighting.id)?.body;
      const dx = body ? body.x - now.aim.x : 0;
      const dy = body ? body.y - now.aim.y : 0;
      await press('ArrowRight', dx > 1);
      await press('ArrowLeft', dx < -1);
      await press('ArrowDown', dy > 1);
      await press('ArrowUp', dy < -1);
      await step(1);
      if (frame === 90) await page.screenshot(`${out}/6-holding-${name}.png`);
    }
    return fail(`${sighting.species} was never seen: ${JSON.stringify(await page.evaluate(`${glass}`))}`);
  };
  for (const [name, sighting] of [['near', near], ['far', far]]) {
    if (!sighting) continue;
    const seen = await hold(sighting, name);
    await step(30);
    recording = false;
    await page.screenshot(`${out}/7-seen-${name}.png`);
    const progress = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress`);
    const dexId = await page.evaluate(`${base}.seaGlassForDriver?.dexIdOf(${sighting.id})`);
    if (!(progress.pokedexSeen ?? []).includes(dexId)) fail(`${sighting.species} is not met in the Pokédex`);
    if ((progress.pokedexOwned ?? []).includes(dexId)) fail(`${sighting.species} is owned, not only met`);
    console.log(`seen ${sighting.species} (${name}, new: ${seen.fresh}); met ${JSON.stringify(progress.pokedexSeen)}; owned ${JSON.stringify(progress.pokedexOwned)}`);
  }

  // Back out to the whole sea, and panned across it.
  await tap('KeyZ');
  await step(20);
  for (const code of ['ArrowLeft', 'ArrowRight']) {
    await page.keyDown(code);
    await step(40);
    await page.keyUp(code);
  }
  await page.screenshot(`${out}/8-panned.png`);

  recording = true;
  await tap('Escape');
  await until(`${glass} === null`, 'the glass put down');
  await step(10);
  const after = await page.evaluate(`(() => { const c = ${base}.cameras.main; return { zoom: c.zoom, rotation: c.rotation, x: c.scrollX, y: c.scrollY, visible: c.visible, cameras: ${base}.cameras.cameras.length }; })()`);
  if (after.zoom !== before.zoom || after.rotation !== before.rotation || !after.visible || after.cameras !== 1) {
    fail(`the harbour's camera came back ${JSON.stringify(after)}, not ${JSON.stringify(before)}`);
  }
  recording = false;
  await page.screenshot(`${out}/9-back.png`);
  if (clip) {
    writeFileSync(`${out}/telescope.png`, animatedPng(frames, 3 * FRAME_MS));
    console.log(`clip: ${frames.length} frames`);
  }
  console.log('the telescope swooped in, saw a kind out at sea, and put the harbour back as it was');
} finally {
  await browser.close();
}
