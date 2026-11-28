// Records a visit to Bill's cottage as a short clip, the way a player has it:
// the room from the mat (his shelves), a word with Bill, YES to his list, and
// the cursor walked along it. One frame every 4 game frames (15 a second of
// game time) with the loop stepped, so the clip runs at real speed whatever the
// machine is doing and two builds' clips can be laid side by side.
//
//   node tools/playtest/billShopClip.mjs <cdp port> <test-mode build url> <save.json> <out dir> [--room-ms=2400] [--read-ms=900]
//
// Writes <out dir>/frames/*.png and <out dir>/visit.json: the boxes said, the
// question answered, what the list showed (its cards and their words) and the
// game time from the first press to the list. `encodeClip.mjs` beside it lays
// several visits end to end as one clip.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const [port, url, savePath, out] = process.argv.slice(2);
const flag = (name, fallback) => Number(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const ROOM_MS = flag('room-ms', 2400);
const READ_MS = flag('read-ms', 900);
const FRAME_MS = 16;
const FRAMES_PER_SHOT = 4;
const SHOT_MS = FRAME_MS * FRAMES_PER_SHOT;
if (!out) {
  console.error('usage: billShopClip.mjs <cdp port> <build url> <save.json> <out dir>');
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
const hold = async (ms) => {
  for (let held = 0; held < ms; held += SHOT_MS) await shoot();
};
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
  return { dialogue: b.dialogue ?? null, choice: b.choice ?? null, menu: ${sceneIs('hub')} ? (d.menu?.heading ?? 'hub') : null, busy: d.busy };
})()`;
/** The list as a player reads it: every card's words, and how many carry a padlock. */
const LIST = `(() => {
  const cards = [...document.querySelectorAll('.trader-card')];
  return {
    cards: cards.map((card) => card.innerText.replace(/\\s+/g, ' ').trim()),
    padlocks: document.querySelectorAll('.trader-card .trader-lock').length,
    side: document.querySelector('.trader-standing')?.innerText.replace(/\\s+/g, ' ').trim() ?? null,
  };
})()`;

/**
 * `--spoil` makes the list worse on purpose - a store front's banner and a
 * badge on every card - for a judge's sanity pair: a judge who prefers it is
 * not reading the pictures.
 */
const SPOIL = process.argv.includes('--spoil');
const SPOIL_LIST = `(() => {
  const banner = document.createElement('div');
  banner.textContent = 'LIMITED TIME! SALE ENDS 00:59 - ONLY 2 LEFT - UNLOCK ALL WITH TRUST POINTS!';
  banner.style.cssText = 'position:fixed;left:0;right:0;top:46px;z-index:99;background:#e0103a;color:#fff;font:700 22px monospace;padding:6px;text-align:center';
  document.body.append(banner);
  for (const card of document.querySelectorAll('.trader-card')) {
    const badge = document.createElement('span');
    badge.textContent = 'HOT -50%';
    badge.style.cssText = 'position:absolute;right:2px;top:2px;background:#ffd400;color:#c00;font:700 13px monospace;padding:1px 3px;transform:rotate(8deg)';
    card.style.position = 'relative';
    card.append(badge);
  }
})()`;

const visit = { save: savePath, boxes: [], question: null, msToList: 0, list: null, room: null };
try {
  await page.waitFor(`typeof ${GAME}?.stepFrames === 'function'`, { what: 'the game', timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await stepUntil(sceneIs('title'), 'the title');
  await step(60);
  await page.tap('Space');
  await stepUntil(`${sceneIs('base')} && ${base}.ready`, 'the harbour', 3000);
  await page.evaluate(`(() => { const b = ${base}; b.scene.start('base', { savedGame: b.savedGame, room: 'bills-cottage' }); })()`);
  await stepUntil(`${base}.ready && ${base}.room?.id === 'bills-cottage' && !${base}.leaving`, 'the cottage', 3000);
  visit.room = await page.evaluate(`(() => { const things = ${base}.describeForTest?.()?.things ?? null; return things; })()`).catch(() => null);
  await hold(ROOM_MS);
  // A word with Bill, from the mat, and YES to his list.
  await page.tap('Space');
  const started = gameMs;
  let readFor = 0;
  for (let guard = 0; guard < 600; guard += 1) {
    await shoot();
    const screen = await page.evaluate(SCREEN);
    if (screen.menu) break;
    if (screen.choice) {
      visit.question = `${screen.choice.question} [${screen.choice.options.join(' / ')}]`;
      const yes = screen.choice.options.findIndex((option) => /yes/i.test(option));
      await hold(READ_MS);
      if (screen.choice.selected !== yes) {
        await page.tap(yes < screen.choice.selected ? 'ArrowUp' : 'ArrowDown');
        await hold(300);
      }
      await page.tap('Space');
      continue;
    }
    if (screen.dialogue) {
      if (screen.dialogue.complete && visit.boxes[visit.boxes.length - 1] !== screen.dialogue.text) {
        visit.boxes.push(screen.dialogue.text);
        readFor = 0;
      }
      if (screen.dialogue.complete) {
        readFor += SHOT_MS;
        if (readFor >= READ_MS) {
          await page.tap('Space');
          readFor = 0;
        }
      }
    }
  }
  visit.msToList = gameMs - started;
  await stepUntil(`document.querySelectorAll('.trader-card').length > 0`, 'his list', 600);
  if (SPOIL) await page.evaluate(SPOIL_LIST);
  visit.list = await page.evaluate(LIST);
  await hold(1500);
  // The cursor along his goods, as a player looks them over.
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown']) {
    await page.tap(key);
    await hold(550);
  }
  await hold(1200);
} catch (error) {
  await page.screenshot(join(out, 'failed.png')).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
writeFileSync(join(out, 'visit.json'), `${JSON.stringify(visit, null, 2)}\n`);
console.log(JSON.stringify({ boxes: visit.boxes, question: visit.question, msToList: visit.msToList, cards: visit.list?.cards.length, padlocks: visit.list?.padlocks, side: visit.list?.side }, null, 2));
