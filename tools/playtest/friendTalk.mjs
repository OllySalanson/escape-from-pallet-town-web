// Talking in a raid room (`src/game/raidRoom/roomTalk.ts`): two tabs of one
// browser in one room's raid (`friendTabs.mjs`), on the local stand-in.
//
//   node tools/playtest/friendTalk.mjs <url> <out dir> [--window=800x512]
//
// AMY presses T and 2: OLLY must read HUNTER COMING! on her name plate and on
// his friend chip. AMY walks a little way off and presses G: OLLY must see the
// ping's mark on the tile she pinged and his chip pointing at it. It fails
// loudly - a thrown error - when any of that does not happen, and photographs
// OLLY's screen on the way.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { WORLD, twoInARoom } from './friendTabs.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '800x512').split('x').map(Number);
mkdirSync(out, { recursive: true });

const heard = `(() => { const w = ${WORLD}; if (!w || !w.sys.isActive()) return null;
  return { chip: (w.friendChip() ?? []).join(' / '), plates: [...w.friendFigures.drawn.values()].map((d) => d.name.text),
    pings: [...w.pingMarks.values()].map((p) => p.tile), me: w.currentTile }; })()`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const { olly, amy, bring, press, readOn } = await twoInARoom(browser, url, out);
  const wait = async (tab, what, test, timeoutMs = 10_000) => {
    const started = Date.now();
    for (;;) {
      await bring(tab);
      const now = await tab.evaluate(heard);
      if (now && test(now)) return now;
      if (Date.now() - started > timeoutMs) throw new Error(`${what}: ${JSON.stringify(now)}`);
      await sleep(200);
    }
  };
  await readOn(amy);
  await readOn(olly);

  // A phrase.
  await press(amy, 'KeyT');
  const amyList = await wait(amy, 'AMY opening the phrase list', (s) => s.chip.includes('[2] HUNTER COMING!'));
  console.log(`AMY's list: ${amyList.chip}`);
  await amy.screenshot(`${out}/t1-amy-phrase-list.png`);
  await press(amy, 'Digit2');
  const said = await wait(olly, 'OLLY hearing AMY', (s) => s.chip.includes('AMY: HUNTER COMING!') && s.plates.some((p) => p === 'AMY: HUNTER COMING!'));
  console.log(`OLLY reads "${said.chip}" and AMY's plate says "${said.plates.join(', ')}"`);
  await olly.screenshot(`${out}/t2-olly-hears-amy.png`);

  // A ping, from a few tiles off.
  const open = await amy.evaluate(`(() => { const w = ${WORLD}; const c = w.collisionData, s = w.currentTile;
    const free = (x, y) => y >= 0 && x >= 0 && y < c.length && x < c[0].length && !c[y][x];
    for (const [dx, dy, k] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']]) if (free(s.x + dx, s.y + dy) && free(s.x + 2 * dx, s.y + 2 * dy)) return k; return null; })()`);
  for (let step = 0; step < 2; step += 1) await press(amy, open);
  await sleep(500);
  const amyAt = (await wait(amy, 'AMY standing', () => true)).me;
  await press(amy, 'KeyG');
  const pinged = await wait(olly, 'OLLY seeing AMY’s ping', (s) => s.pings.includes(`${amyAt.x},${amyAt.y}`) && /AMY PING /.test(s.chip));
  console.log(`OLLY sees AMY's ping at ${amyAt.x},${amyAt.y}: "${pinged.chip}"`);
  await sleep(300);
  await olly.screenshot(`${out}/t3-olly-sees-the-ping.png`);
  const pointing = await wait(olly, 'OLLY’s chip pointing at the ping', (s) => /AMY PING [A-Z]+ \d+/.test(s.chip), 8_000);
  console.log(`and his chip points at it: "${pointing.chip}"`);
} finally {
  await browser.close();
}
