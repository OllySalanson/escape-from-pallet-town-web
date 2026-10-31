// The base half of an errand (`src/game/hub/errands.ts`), played the way a
// player meets it: into a keeper's room, the interact key at them, and the
// favour said in the dialogue box with YES or NOT NOW under it
// (`BaseScene.speakToKeeper`); bring the thing home and speak to them again,
// and they take it and pay; lose it, and they ask after it.
//
//   node tools/playtest/errands.mjs <url> <out dir> [--save=path.json] [--window=1200x768] [--port=N]
//
// `--port` drives a browser already running on that CDP port (a shared
// machine's own watched one, `attachBrowser`) instead of launching one.
//
// `--save` starts from a save a raid wrote - `raid.mjs --insertion=greystone-vale
// --errands=brocks-crate --grab=brocks-crate --save-out=path.json` is the other
// half, which carries Brock's crate home - so the hand-over is checked against
// a crate a raid actually banked. Without one, the crate is written into the
// vault. Photographs each beat and fails loudly when one is not what it promises.
import { mkdirSync, readFileSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, takePokemon, walkIntoBase, openHallPanel } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
const saved = option('save');
mkdirSync(out, { recursive: true });

const page_url = `${url}?testmode=pixels`;
/** How long a cold page or one line may take on a loaded machine, whose watchdog can pause a browser ten seconds at a time. */
const SLOW_MS = 60_000;
const base = `${GAME}.scene.getScene('base')`;
const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
const page = await browser.openPage(page_url);
try {
  const press = async (code, wait = 200) => {
    await page.tap(code);
    await sleep(wait);
  };
  const click = async (selector, what = selector) => {
    await page.waitFor(
      `(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b || b.disabled) return false; b.click(); return true; })()`,
      { what },
    );
    await sleep(400);
  };
  const progress = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress`);
  const vault = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash`);
  const scene = () =>
    page.evaluate(`(() => { const b = ${base}; return { hub: ${sceneIs('hub')}, box: !!b?.dialogBox?.visible, done: !!b?.dialogBox?.isCurrentMessageComplete, prompt: b?.boxQuestion ? b.boxQuestion.prompt.selected : null, mark: !!b?.keeperMark }; })()`);
  /** The text in the dialogue box once it has finished typing. */
  const boxText = async () => {
    await page.waitFor(`${base}.dialogBox.isCurrentMessageComplete`, { what: 'the line to finish typing', timeoutMs: SLOW_MS });
    return page.evaluate(`${base}.dialogBox.textObject.text.replace(/\\s+/g, ' ').trim()`);
  };
  /** Reads every box until the question comes up, the box goes down or the screen opens, and says what was read. */
  const readOn = async () => {
    const said = [];
    for (let guard = 0; guard < 12; guard += 1) {
      const now = await scene();
      if (now.hub || now.prompt !== null || !now.box) break;
      said.push(await boxText());
      await press('Space', 300);
    }
    return said;
  };
  /** Past whatever is still being said or asked, saying NOT NOW to it. */
  const pastTheTalk = async () => {
    for (let guard = 0; guard < 12; guard += 1) {
      const now = await scene();
      if (now.prompt === null && !now.box) return;
      await press(now.prompt !== null ? 'Escape' : 'Space', 300);
    }
    throw new Error('the talk never ended');
  };
  /** Writes the save and reopens the game on it, standing in the yard. */
  const load = async (edit) => {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${edit})(save);
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: page_url });
    await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
    await press('Space');
    await page.waitFor(sceneIs('base'));
    await sleep(600);
  };
  /** Into a keeper's room, stopping on the mat inside the door. */
  const intoRoom = async (door) => {
    for (let guard = 0; guard < 120; guard += 1) {
      const move = await page.evaluate(
        `(() => { const b = ${base}; if (!b || !b.sys.isActive() || !b.ready || b.leaving) return { wait: true };
          if (b.room) return b.room.id === ${JSON.stringify(door)} ? { done: true } : { key: 'ArrowDown' };
          const goals = b.doors.find((each) => each.id === ${JSON.stringify(door)}).tiles;
          const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
          const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
          const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
          while (queue.length) { const [x, y] = queue.shift();
            if (at(x, y)) { found = [x, y]; break; }
            for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
              if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
              prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
          if (!found) return { unreachable: true };
          let cur = found, key = null;
          for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
          return { key }; })()`,
      );
      if (move?.unreachable) throw new Error(`nothing walks to the ${door}`);
      if (move?.done) {
        await sleep(500);
        return;
      }
      if (move?.key) await page.tap(move.key, 60);
      await sleep(180);
    }
    throw new Error(`never got into the ${door}`);
  };
  const leave = async () => {
    await click('[data-back]', 'back out of the screen');
    await page.waitFor(sceneIs('base'));
    await sleep(500);
  };
  const expectSaid = (lines, start, what) => {
    // First words come ahead of a favour, the first time in a room.
    if (!lines.some((line) => line.startsWith(start))) throw new Error(`${what}: said ${JSON.stringify(lines)}`);
    console.log(`${what}: ${lines.join(' / ')}`);
  };

  // A game, then the save it is checked against.
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: page_url });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  const raidSave = saved ? JSON.parse(readFileSync(saved, 'utf8')) : null;
  // Every favour lies on Greystone Vale, which a new save can drop into: nothing
  // has to be unlocked for a keeper to ask.
  await load(`(save) => {
    const raid = ${JSON.stringify(raidSave)};
    if (raid) Object.assign(save, raid);
    const p = save.raidProgress;
    p.firstWordsHeard = ['lab', 'loadout', 'check', 'center'];
    p.keysLearned = ['walk', 'look'];
    if (!raid) {
      p.errands = [{ id: 'brocks-crate', status: 'started', found: 1, lossesHeard: 0 }];
      save.stash.items['brocks-crate'] = 1;
    }
  }`);

  // The yard, with the look key held: every door says what is waiting inside.
  await page.keyDown('KeyL');
  await sleep(700);
  await page.screenshot(`${out}/yard-look.png`);
  await page.keyUp('KeyL');

  // Nurse Joy wears the "!", asks in the dialogue box, and a NOT NOW takes nothing.
  await intoRoom('pokemon-centre');
  if (!(await scene()).mark) throw new Error('Nurse Joy has a favour and no "!" over her');
  await page.screenshot(`${out}/joy-mark.png`);
  await press('Space', 300);
  expectSaid(await readOn(), 'Could I ask a favour?', 'Joy asks');
  const asking = await scene();
  if (asking.prompt !== 0) throw new Error(`the question is not up with YES first: ${JSON.stringify(asking)}`);
  await page.screenshot(`${out}/joy-question.png`);
  await press('ArrowRight', 300);
  await press('Space', 300);
  expectSaid(await readOn(), 'Of course.', 'Joy hears NOT NOW');
  if ((await progress()).errands.some((e) => e.id === 'medicine-bag')) throw new Error('NOT NOW took the favour on');
  // Her talk ends in the room: no screen opens, and nothing more is asked.
  if (await page.evaluate(sceneIs('hub'))) throw new Error('Joy opened a screen');
  await press('Space', 600);
  expectSaid(await readOn(), 'fit to raid', 'Joy with nothing to ask');
  await press('ArrowDown', 900);

  // Bill asks, and a YES takes it on.
  await press('ArrowDown', 900);
  await intoRoom('bills-cottage');
  await press('Space', 300);
  expectSaid(await readOn(), 'There is a lump of OLD AMBER', 'Bill asks');
  await press('Space', 300);
  expectSaid(await readOn(), 'Great!', 'Bill hears YES');
  if ((await progress()).errands.find((e) => e.id === 'old-amber')?.status !== 'started') throw new Error('YES took nothing on');
  // He goes on to how he reads you and his list; ESC is NOT NOW to it.
  await pastTheTalk();
  await press('ArrowDown', 900);

  // Brock takes the crate home, and pays, in the same box.
  if (!((await vault()).items['brocks-crate'] > 0)) throw new Error('there is no crate in the vault to hand over');
  await intoRoom('brocks-workshop');
  await press('Space', 300);
  expectSaid(await readOn(), "You handed over Brock's crate.", 'Brock thanks');
  const after = await vault();
  if (after.items['brocks-crate'] || after.items['tm39-rock-tomb'] !== 1) throw new Error(`the vault holds ${JSON.stringify(after.items)}`);
  // He goes on to the next thing he would build; nothing opens.
  if (await page.evaluate(sceneIs('hub'))) throw new Error('Brock opened a screen');
  await pastTheTalk();
  // And the crate stands on his bench: one step up off the mat to see it.
  await press('ArrowUp', 600);
  await page.screenshot(`${out}/brock-room.png`);

  // Oak's parcel was found and lost with the pack: he asks after it.
  await load(`(save) => { save.raidProgress.errands = [...save.raidProgress.errands.filter((e) => e.id !== 'oaks-parcel'), { id: 'oaks-parcel', status: 'started', found: 1, lossesHeard: 0 }]; }`);
  await intoRoom('oaks-lab');
  await press('Space', 300);
  expectSaid(await readOn(), 'My parcel never made it home?', 'Oak hears of the loss');
  const oak = (await progress()).errands.find((e) => e.id === 'oaks-parcel');
  if (oak.lossesHeard !== 1) throw new Error(`Oak's loss is recorded as ${JSON.stringify(oak)}`);
  // Oak's board lists every errand in hand under his contracts, and he reads it out.
  const board = await readOn();
  if (!board.some((line) => /Oak's Parcel/i.test(line))) throw new Error(`the board has no errands: ${JSON.stringify(board).slice(0, 300)}`);
  await page.screenshot(`${out}/lab-board.png`);

  // The rim's panel names the errands on the map being looked at. Raids start
  // at the Raid Arena, so out of the lab and across the yard to it.
  await press('Escape');
  await press('ArrowDown', 900);
  await walkIntoBase(page, 'raid-arena');
  await page.waitFor(takePokemon(), { what: 'a Pokémon for the raid' });
  await openHallPanel(page, 'rim');
  await sleep(600);
  const pane = await page.evaluate(`document.querySelector('.rim-layout, .px-body')?.innerText ?? ''`);
  if (!/OLD AMBER/i.test(pane) || !/PINE HOLLOW/.test(pane)) throw new Error(`the rim's panel does not name Bill's amber: ${pane.slice(0, 400)}`);
  await page.screenshot(`${out}/dropin-errand.png`);
  console.log('rim: names the Old Amber in PINE HOLLOW');
} finally {
  await page.close();
  await browser.close();
}
