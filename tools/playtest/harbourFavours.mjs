// The harbour's own favours (`src/game/hub/errands.ts`, `harbourGiver`), played
// the way a player meets them: a "!" over somebody walking the yard, walk up to
// them, the interact key, the favour in the dialogue box and YES or NOT NOW
// (`BaseScene.speakForFavour`) - and the Gym Guide's word on the day's work
// (`base/gymGuide.ts`). Photographs each beat and fails loudly when one is not
// what it promises.
//
//   node tools/playtest/harbourFavours.mjs <url> <out dir> [--window=1200x768] [--port=N]
//
// `--port` drives a browser already running on that CDP port (`attachBrowser`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

const page_url = `${url}?testmode=pixels`;
/** How long a cold page or one line may take on a loaded machine, whose watchdog can pause a browser ten seconds at a time. */
const SLOW_MS = 60_000;
const base = `${GAME}.scene.getScene('base')`;
const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
const page = await browser.openPage(page_url);
try {
  const press = async (code, wait = 250) => {
    await page.tap(code);
    await sleep(wait);
  };
  const progress = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress`);
  const scene = () =>
    page.evaluate(`(() => { const b = ${base}; return { box: !!b?.dialogBox?.visible, prompt: b?.boxQuestion ? b.boxQuestion.prompt.selected : null, marks: [...(b?.harbourMarks?.keys() ?? [])] }; })()`);
  const boxText = async () => {
    await page.waitFor(`${base}.dialogBox.isCurrentMessageComplete`, { what: 'the line to finish typing', timeoutMs: SLOW_MS });
    return page.evaluate(`${base}.dialogBox.textObject.text.replace(/\\s+/g, ' ').trim()`);
  };
  /** Reads every box until the question comes up or the box goes down, and says what was read. */
  const readOn = async () => {
    const said = [];
    for (let guard = 0; guard < 12; guard += 1) {
      const now = await scene();
      if (now.prompt !== null || !now.box) break;
      said.push(await boxText());
      await press('Space', 300);
    }
    return said;
  };
  /** A picture of the line in the box, once it has finished typing. */
  const shotOfLine = async (name) => {
    await page.waitFor(`${base}.dialogBox.isCurrentMessageComplete`, { what: 'the line to finish typing', timeoutMs: SLOW_MS });
    await page.screenshot(`${out}/${name}.png`);
  };
  const expectSaid = (lines, start, what) => {
    if (!lines[0]?.startsWith(start)) throw new Error(`${what}: said ${JSON.stringify(lines)}`);
    console.log(`${what}: ${lines.join(' / ')}`);
  };
  /**
   * Up to somebody about the harbour and facing them: a walk to the nearest
   * free tile beside wherever they stand this frame, then a press towards them
   * (a figure is solid, so the press turns the player rather than stepping).
   */
  const walkUpTo = async (id) => {
    for (let guard = 0; guard < 200; guard += 1) {
      const move = await page.evaluate(
        `(() => { const b = ${base}; if (!b || !b.ready || b.leaving || b.dialogBox.visible) return { wait: true };
          const at = b.harbourLife.spriteAt(${JSON.stringify(id)}); if (!at) return { missing: true };
          const fig = { x: Math.round(at.x / 16), y: Math.round((at.y + 4) / 16) };
          const s = b.currentTile;
          const beside = [[0,1,'ArrowUp'],[0,-1,'ArrowDown'],[1,0,'ArrowLeft'],[-1,0,'ArrowRight']];
          for (const [dx, dy, k] of beside) if (s.x === fig.x + dx && s.y === fig.y + dy) return { face: k };
          const goals = beside.map(([dx, dy]) => ({ x: fig.x + dx, y: fig.y + dy })).filter((g) => !b.isBlocked(g));
          const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
          const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
          while (queue.length) { const [x, y] = queue.shift();
            if (goals.some((g) => g.x === x && g.y === y)) { found = [x, y]; break; }
            for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny)) || b.isBlocked({ x: nx, y: ny })) continue;
              prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
          if (!found) return { wait: true };
          let cur = found, key = null;
          for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
          return { key }; })()`,
      );
      if (move?.missing) throw new Error(`nobody called ${id} is out in the harbour`);
      if (move?.face) {
        await page.tap(move.face, 60);
        await sleep(300);
        const facing = await page.evaluate(`${base}.harbourLife.at((() => { const b = ${base}; const d = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[b.facing]; return { x: b.currentTile.x + d[0], y: b.currentTile.y + d[1] }; })())?.id ?? null`);
        if (facing === id) return;
        continue;
      }
      if (move?.key) await page.tap(move.key, 60);
      await sleep(180);
    }
    throw new Error(`never got face to face with ${id}`);
  };

  // A new game: nothing to unlock, the harbour's favours lie on Greystone Vale.
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: page_url });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await page.waitFor(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`,
  );
  await page.waitFor(sceneIs('base'));
  await sleep(1500);
  const marks = (await scene()).marks.sort();
  if (JSON.stringify(marks) !== JSON.stringify(['safari-warden', 'ss-anne-captain'])) throw new Error(`the "!" stands over ${JSON.stringify(marks)}`);
  console.log(`"!" over: ${marks.join(', ')}`);

  // The Safari Warden on the green: he cannot be understood, and NOT NOW takes nothing.
  await walkUpTo('safari-warden');
  await page.screenshot(`${out}/1-warden-mark.png`);
  await press('Space', 400);
  await shotOfLine('2-warden-asks');
  expectSaid(await readOn(), 'Hif fuff hefifoo!', 'the Warden asks');
  if ((await scene()).prompt !== 0) throw new Error('the question is not up with YES first');
  await page.screenshot(`${out}/3-warden-question.png`);
  await press('ArrowRight');
  await press('Space', 400);
  expectSaid(await readOn(), 'Hoh...', 'the Warden hears NOT NOW');
  if ((await progress()).errands?.some((e) => e.id === 'gold-teeth')) throw new Error('NOT NOW took the favour on');
  if ((await scene()).marks.includes('safari-warden')) throw new Error('the "!" stayed up over the Warden after NOT NOW');
  // Spoken to again before a raid: his everyday line, which nobody can make out.
  await press('Space', 400);
  expectSaid(await readOn(), 'Hoh hoh!', 'the Warden, asked already');

  // The captain on the long pier: YES.
  await walkUpTo('ss-anne-captain');
  await page.screenshot(`${out}/4-captain-mark.png`);
  await press('Space', 400);
  expectSaid(await readOn(), 'THE WRECK was my first ship.', 'the captain asks');
  await page.screenshot(`${out}/5-captain-question.png`);
  await press('Space', 400);
  expectSaid(await readOn(), 'Thank you.', 'the captain hears YES');
  if ((await progress()).errands?.find((e) => e.id === 'ships-log')?.status !== 'started') throw new Error('YES took nothing on');
  // Spoken to again: the spyglass, as before.
  await press('Space', 400);
  const spyglass = await readOn();
  if (spyglass[0]?.startsWith('THE WRECK')) throw new Error('the captain asked his favour twice');
  console.log(`the captain, asked already: ${spyglass[0]}`);

  // The log home: handed over on the pier, and HM01 paid.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items['ships-log'] = 1;
    save.raidProgress.errands = save.raidProgress.errands.map((e) => (e.id === 'ships-log' ? { ...e, found: 1 } : e));
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: page_url });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await sleep(1500);
  await walkUpTo('ss-anne-captain');
  await press('Space', 400);
  await shotOfLine('6-captain-handover');
  expectSaid(await readOn(), "You handed over Ship's log.", 'the captain thanks');
  const vault = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash.items`);
  if (vault['ships-log'] || vault['hm01-cut'] !== 1) throw new Error(`the vault holds ${JSON.stringify(vault)}`);
  console.log('HM01 is in the vault');

  // The Gym Guide at the Raid Arena's door says the day's work (`base/gymGuide.ts`).
  await walkUpTo('gym-guide');
  await press('Space', 400);
  await shotOfLine('7-gym-guide');
  const guide = await readOn();
  expectSaid(guide, "Yo, champ! Today's job:", 'the Gym Guide');
  if (!guide.some((line) => line.startsWith('It pays '))) throw new Error('the Gym Guide never said what the job pays');
} finally {
  await page.close();
  await browser.close();
}
