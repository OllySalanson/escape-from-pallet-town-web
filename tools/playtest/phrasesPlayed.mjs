// THE HARBOUR's quick phrases in the places a player trips over them, played
// through the real keys and pointer on a stepped clock:
//
//   - T tapped mid-step, walking along, with an arrow still held: the list opens
//     when the step ends, its cursor where it was left, and closing it walks on.
//   - A click on a row in the great hall says the phrase and walks nobody.
//   - The partner's note beside this player's own bubble: no shared pixel.
//   - A regular standing about beside a door never takes the door's name: it
//     stays up from the doorstep, read through them if it has to be over them.
//
//   node tools/playtest/phrasesPlayed.mjs <test-mode build url> <out dir> [--port=N] [--window=1200x768]
//
// Fails loudly - a thrown error - on any of those, and photographs each.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
mkdirSync(out, { recursive: true });
const BASE = `${GAME}.scene.getScene('base')`;
const FRAME_MS = 1000 / 60;
const WINDOW = option('window')
  ? { width: Number(option('window').split('x')[0]), height: Number(option('window').split('x')[1]) }
  : PIXEL_WINDOW;
const faults = [];
const fault = (why) => {
  faults.push(why);
  console.log(`FAULT ${why}`);
};
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const browser = option('port') ? attachBrowser(Number(option('port')), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.keyDown('Space');
  await page.keyUp('Space');
  await page.waitFor(sceneIs('starter'), { timeoutMs: 60_000 });
  await page.waitFor(`(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`, { timeoutMs: 60_000 });
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('confirm') && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    { timeoutMs: 60_000 },
  );
  await page.waitFor(`${sceneIs('base')} && ${BASE}.ready`, { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);

  const step = (frames = 1, ms = FRAME_MS) => page.evaluate(`${GAME}.stepFrames(${frames}, ${ms})`);
  const tap = async (code) => {
    await page.keyDown(code);
    await step();
    await page.keyUp(code);
    await step();
  };
  const go = async (data) => {
    await page.evaluate(`void ${BASE}.scene.start('base', ${JSON.stringify(data)})`);
    for (let wait = 0; wait < 40 && !(await page.evaluate(`${sceneIs('base')} && ${BASE}.ready && !${BASE}.leaving`)); wait += 1) {
      await step(3, 100);
    }
    await step(4, 100);
  };
  const talking = () => page.evaluate(`${BASE}.talking`);

  // T tapped in the middle of a step, the arrow still held.
  await step(25, 100);
  const cursorBefore = 0;
  await page.keyDown('ArrowRight');
  await step(3);
  await page.keyDown('KeyT');
  await step();
  await page.keyUp('KeyT');
  await step(10);
  if (!(await talking()).listOpen) fault('T tapped mid-step never opened the list');
  const cursor = await page.evaluate(`${BASE}.phrasePicker?.index ?? null`);
  if (cursor !== cursorBefore) fault(`the held arrow moved the list's cursor to ${cursor}`);
  const stood = await page.evaluate(`(() => { const b = ${BASE}; return { target: b.targetTile, tile: b.currentTile }; })()`);
  if (stood.target) fault(`still walking under the list, to ${JSON.stringify(stood.target)}`);
  await page.screenshot(`${out}/t-mid-step.png`);
  await tap('KeyT');
  await step(14);
  const after = await page.evaluate(`${BASE}.currentTile`);
  if (after.x === stood.tile.x) fault('the arrow still held did not walk on once the list was shut');
  await page.keyUp('ArrowRight');
  await step(14);

  // The partner beside the player, its note over its head, and the bubble going up.
  const place = await page.evaluate(`${BASE}.partner.place`);
  const me = await page.evaluate(`${BASE}.currentTile`);
  if (place.tile.y !== me.y) fault(`the partner is not beside the player: ${JSON.stringify(place.tile)} and ${JSON.stringify(me)}`);
  await tap('KeyT');
  await page.evaluate(`${BASE}.phrasePicker.select(11)`);
  await tap('Space');
  await page.evaluate(`void ${BASE}.partner.showBubble('note')`);
  await step(3);
  const own = await page.evaluate(`${BASE}.ownBubble?.box`);
  const note = await page.evaluate(`${BASE}.partner.bubbleRect()`);
  if (!own || !note) fault('no bubble, or no note');
  else if (overlap(own, note)) fault(`the note is over the bubble: ${JSON.stringify({ own, note })}`);
  await page.screenshot(`${out}/note-beside-bubble.png`);
  await step(40, 100);

  // A click on a row of the list in the great hall.
  await go({ room: 'raid-arena' });
  await step(20, 100);
  for (let read = 0; read < 12 && (await page.evaluate(`${BASE}.dialogBox.visible`)); read += 1) {
    await tap('Space');
    await step(4, 100);
  }
  await step(100, 100);
  await tap('KeyT');
  const row = await page.evaluate(`(() => { const p = ${BASE}.phrasePicker; const r = p.rows[8]; const z = ${GAME}.canvas.getBoundingClientRect(); const s = z.width / ${BASE}.scale.width; return { x: z.left + (r.x + 6) * s, y: z.top + (r.y + 6) * s }; })()`);
  const hallTile = await page.evaluate(`${BASE}.currentTile`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: row.x, y: row.y });
  await step(2);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: row.x, y: row.y, button: 'left', clickCount: 1 });
  await step(2);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: row.x, y: row.y, button: 'left', clickCount: 1 });
  await step(30);
  const said = await talking();
  if (said.saying !== 'GG!') fault(`the row clicked did not say GG!: ${JSON.stringify(said)}`);
  const hallAfter = await page.evaluate(`(() => { const b = ${BASE}; return { tile: b.currentTile, panel: !!b.arenaPanel, cursor: ${GAME}.canvas.style.cursor }; })()`);
  if (hallAfter.tile.x !== hallTile.x || hallAfter.tile.y !== hallTile.y) fault(`the click walked the player to ${JSON.stringify(hallAfter.tile)}`);
  await page.screenshot(`${out}/hall-click.png`);

  // Every doorstep through a stretch of regulars walking by: its name stays up.
  const doors = await page.evaluate(`${BASE}.doors.filter((d) => d.id !== 'bolthole').map((d) => ({ id: d.id, at: d.returnTo }))`);
  for (const door of doors) {
    await go({ at: door.at });
    await step(5, 100);
    let hidden = 0;
    for (let look = 0; look < 300; look += 1) {
      await step(2, 100);
      const up = await page.evaluate(`${BASE}.worldLabels.filter((l) => l.label.visible).length`);
      if (up === 0) hidden += 1;
    }
    console.log(`${door.id}: nothing named from its doorstep at ${hidden} of 300 looks`);
    if (hidden > 15) fault(`${door.id}'s name was down for ${hidden} of 300 looks`);
    await page.screenshot(`${out}/doorstep-${door.id}.png`);
  }
} finally {
  await browser.close();
}
console.log(faults.length === 0 ? 'no faults' : `${faults.length} faults`);
if (faults.length > 0) process.exitCode = 1;
