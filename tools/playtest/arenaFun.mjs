// Plays what THE RAID ARENA does for somebody who has come back to it.
//
//   node tools/playtest/arenaFun.mjs <url> <out-dir> [--window=1200x768] [--port=N] [--only=crowd|landing|memory|coin|bout]
//
// A save is written as it would stand after that many raids, the raid's ending is
// handed to the hall as the result screen hands it, and everything is played with
// the real keys: the crowd's answer to each kind of raid, a wave at the stands, a
// lap of the ring, sticking the landing, what the pit remembers, a coin over the rail
// and a bout for show, whose one promise it checks byte for byte: the save is the
// same after any bout but for the one field the hall writes about it. Exit code 1 is anything not where it should be. It also holds
// the one promise the whole of this rests on: home on the rim, SPACE and ENTER are
// still all that a raid asks.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'arena-fun-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const only = option('only');
const SAVE = 'escape-from-pallet-town.save.v1';
const FRAME_MS = 100;
const address = `${url}?testmode=pixels`;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE)})`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title' });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expression, what) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, after = FRAME_MS * 2) => {
    await page.tap(code, 0);
    await step(after);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
  const shot = (name) => page.screenshot(`${out}/${name}.png`);

  const keyTowards = (goals) =>
    page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving) return null;
      const goals = ${JSON.stringify(goals)} ?? b.doors.find((each) => each.id === 'raid-arena').tiles;
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      if (at(s.x, s.y)) return 'there';
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; let cur = found, key = null;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; }
      return key; })()`);
  const walkTo = async (goal) => {
    for (let guard = 0; guard < 300; guard += 1) {
      const key = await keyTowards([goal]);
      if (key === 'there') return true;
      if (key === null) {
        await step(100);
        continue;
      }
      await page.tap(key, 0);
      await step(170);
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) {
        await step(100);
      }
    }
    expect(`got to ${JSON.stringify(goal)}`, false);
    return false;
  };

  // A new game, across the harbour, past the trailer and into the hall.
  await press('Space');
  await until(sceneIs('base'), 'the starter picker');
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`, 'the picker');
  await step(200);
  await until(sceneIs('base'), 'the harbour');
  await step(1000);
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'; })()`;
  for (let guard = 0; guard < 80 && !(await page.evaluate(inHall)); guard += 1) {
    if (await page.evaluate(sceneIs('arenaIntro'))) {
      await step(700);
      await press('Escape');
      await step(400);
      continue;
    }
    const key = await keyTowards(null);
    if (key && key !== 'there') await press(key);
    await step(200);
  }
  await until(inHall, 'the great hall');
  await step(500);

  /** Writes the raids on the record, and comes home to the rim from a raid that ended as told. */
  const comeHome = async (mood, record, tile = { x: 35, y: 56 }) => {
    await page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE)})); s.raidProgress.raidRecord = { 'greystone-vale': ${JSON.stringify(record)} }; localStorage.setItem(${JSON.stringify(SAVE)}, JSON.stringify(s)); })()`);
    await base(`(() => { b.currentTile = ${JSON.stringify(tile)}; b.scene.start('base', { arrival: 'raid', room: 'raid-arena', raidMood: ${JSON.stringify(mood)}, at: ${JSON.stringify(tile)} }); return 1; })()`);
    await step(200);
    await until(inHall, 'the hall again');
  };
  const posedUp = () => base(`b.arena.posed.filter((each) => each.visible).length`);

  // --- the crowd ---------------------------------------------------------------
  if (!only || only === 'crowd') {
    // Near the outer wall, on the south side, so the seats are in the picture whatever the look does.
    await comeHome('roar', { deployed: 16, extracted: 14, wiped: 2 });
    expect('the view has gone round to the crowd', await base('b.crowdLookMs > 0'));
    await step(1300);
    await shot('crowd-roar');
    expect('a big haul has them on their feet', (await posedUp()) > 20);
    await step(1200);
    await shot('crowd-roar-paper');
    expect('and throwing paper', await base('b.arena.crowd.paperMs !== null'));
    await step(6000);

    await comeHome('groan', { deployed: 16, extracted: 13, wiped: 3 });
    await step(1200);
    await shot('crowd-groan');
    expect('a wipe gets nobody up but those leaving', (await posedUp()) < 25);
    expect('and the fires burn low', await base('b.arena.crowd.fireShare < 0.7'));

    // The house it was before a raid was ever banked, and the house after many.
    await comeHome('clap', { deployed: 1, extracted: 1, wiped: 0 });
    await step(1000);
    await shot('crowd-thin-house');
    const thin = await base('b.arena.house');
    await comeHome('clap', { deployed: 30, extracted: 20, wiped: 2 });
    await step(1000);
    await shot('crowd-full-house');
    expect('a veteran plays to a fuller house', (await base('b.arena.house')) > thin);

    // Home on the rim, SPACE and ENTER: nothing here gets in the way.
    await comeHome('roar', { deployed: 16, extracted: 14, wiped: 2 });
    await step(200);
    await press('Space', 700);
    for (let guard = 0; guard < 16 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 500);
    }
    await until(sceneIs('hub'), 'the rim');
    expect('SPACE on the rim still looks down at once, whatever the crowd is doing', await page.evaluate(sceneIs('hub')));
    await step(400);
    await press('Escape', 500);
    await step(9000);

    // A wave at the stands from the outer floor, beside whoever waits for a bout.
    await walkTo({ x: 31, y: 5 });
    await press('ArrowUp', 300);
    await step(2600);
    expect(`the far wall offers a wave (${await base('b.hintShown')})`, (await base('b.hintShown')) === '[SPACE] WAVE TO THE CROWD');
    expect('nobody up before it', (await posedUp()) === 0);
    await press('Space', 800);
    await shot('crowd-wave');
    expect('the nearest section waves back', (await posedUp()) > 3);
    await step(3000);
    expect('and sits down again', (await posedUp()) === 0);

    // A run round the outer floor has the view on the people getting up for it.
    for (const [name, x, y] of [['ne', 47, 11], ['e', 60, 33], ['se', 47, 55]]) {
      await walkTo({ x, y });
      await shot(`crowd-run-${name}`);
    }
    expect('a run round the outer floor gets them up', (await posedUp()) > 3);
    await step(2600);

    // A lap of the ring, on the rim.
    const centre = { x: 35.5, y: 33 };
    const rim = (await base(`b.arenaRim.map((t) => ({ x: t.x, y: t.y }))`)).sort(
      (a, b) => Math.atan2(a.y - centre.y, a.x - centre.x) - Math.atan2(b.y - centre.y, b.x - centre.x),
    );
    let start = 0;
    let away = 1e9;
    rim.forEach((tile, index) => {
      const d = Math.abs(tile.x - 32) + Math.abs(tile.y - 56);
      if (d < away) {
        away = d;
        start = index;
      }
    });
    await walkTo(rim[start]);
    let bandOnTheRim = false;
    let lapSign = false;
    for (let index = 1; index <= rim.length + 2; index += 1) {
      await walkTo(rim[(start + index) % rim.length]);
      bandOnTheRim ||= await base('b.arena.crowd.band !== null');
      if (index === Math.round(rim.length * 0.3) || index === Math.round(rim.length * 0.5)) await shot(`crowd-lap-${index}`);
      lapSign ||= await base('Boolean(b.hallSign)');
    }
    await step(400);
    await shot('crowd-lap-done');
    expect('nobody gets up for somebody walking the rim to choose a way in', !bandOnTheRim);
    expect('and a whole lap is called', lapSign);
    console.log('sign:', await base(`b.hallSign?.text?.text`));
  }

  // --- the landing -------------------------------------------------------------
  /** Over the fence, stepping the fall; `pressAt` is when in the landing to press the key, or null. */
  const jumpIn = async (pressAt, name) => {
    await walkTo({ x: 35, y: 56 });
    await press('ArrowUp', 200);
    await press('Space', 700);
    for (let guard = 0; guard < 16 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 500);
    }
    await until(sceneIs('hub'), 'the rim');
    await step(500);
    await press('Enter', 100);
    for (let frame = 0; frame < 80 && !(await page.evaluate(sceneIs('world'))); frame += 1) {
      await page.keyDown('ArrowLeft');
      await step(100);
      if (name && frame === 20) await shot(`${name}-steering`);
    }
    await page.keyUp('ArrowLeft');
    const world = (expression) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return ${expression}; })()`);
    let pressed = pressAt === null;
    for (let frame = 0; frame < 40 && (await world('Boolean(w.arrival)')); frame += 1) {
      const elapsed = await world('w.arrival.elapsedMs');
      if (name && frame === 4) await shot(`${name}-ring`);
      if (!pressed && elapsed >= pressAt) {
        pressed = true;
        await page.tap('Space', 0);
      }
      await step(50);
    }
    await step(150);
    if (name) await shot(`${name}-landed`);
    const record = await page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE)})).raidProgress.landings ?? null`);
    for (let guard = 0; guard < 6 && (await world('w.dialogBox.visible')); guard += 1) {
      await press('Space', 400);
    }
    await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); w.extractThrough(w.runSession.plan.extractionPoints[0]); })()`);
    await step(800);
    await until(sceneIs('extraction'), 'the result screen');
    await step(1500);
    await press('Enter', 200);
    await until(sceneIs('base'), 'home');
    for (let guard = 0; guard < 60 && (await base('Boolean(b.fogLift)')); guard += 1) {
      await step(100);
    }
    await step(200);
    return record;
  };
  if (!only || only === 'landing') {
    const landed = (record) => record?.streak ?? 0;
    expect('a press as the ring shuts sticks it', landed(await jumpIn(530, 'landing-clean')) === 1);
    expect('and again makes two', landed(await jumpIn(530, 'landing-second')) === 2);
    expect('a press too early is a landing like any other', landed(await jumpIn(150, 'landing-early')) === 0);
    expect('and so is no press at all', landed(await jumpIn(null, null)) === 0);
    const record = await jumpIn(530, null);
    expect(`the most there have been is kept (${JSON.stringify(record)})`, record?.best === 2 && record?.streak === 1);
  }

  // --- what the pit remembers ----------------------------------------------------
  if (!only || only === 'memory') {
    const held = () => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE)})).raidProgress.raidMemory ?? null`);
    const world = (expression) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return ${expression}; })()`);
    /** A raid walked along a line of the map, ending as told: a real walk's record, with the steps stepped by hand. */
    const raid = async (fromX, fromY, dx, dy, ending) => {
      await walkTo({ x: 35, y: 56 });
      await press('ArrowUp', 200);
      await press('Space', 700);
      for (let guard = 0; guard < 16 && (await base('b.dialogBox.visible')); guard += 1) {
        await press('Space', 500);
      }
      await until(sceneIs('hub'), 'the rim');
      await step(500);
      await press('Enter', 100);
      await until(sceneIs('world'), 'the raid');
      for (let guard = 0; guard < 40 && (await world('Boolean(w.arrival)')); guard += 1) {
        await step(100);
      }
      for (let guard = 0; guard < 6 && (await world('w.dialogBox.visible')); guard += 1) {
        await press('Space', 400);
      }
      await world(`(() => { const s = w.currentTile; for (let n = 0; n < 60; n += 1) { w.currentTile = { x: ${fromX} + n * ${dx}, y: ${fromY} + n * ${dy} }; w.surveyGround(); } return 1; })()`);
      if (ending === 'out') {
        await world(`(() => { w.extractThrough(w.runSession.plan.extractionPoints[0]); return 1; })()`);
      } else {
        await world(`(() => { const r = w.runSession.manager; r.elapsedMsValue = r.durationMs - 300; return 1; })()`);
        await step(1000);
        for (let guard = 0; guard < 8 && (await world('w.dialogBox.visible')); guard += 1) {
          await press('Space', 400);
        }
      }
      await step(1500);
      await until(sceneIs('extraction'), 'the result screen');
      await step(1500);
      await press('Enter', 200);
      await until(sceneIs('base'), 'home');
      for (let guard = 0; guard < 80 && (await base('Boolean(b.fogLift)')); guard += 1) {
        await step(100);
      }
      await step(300);
    };
    await raid(150, 190, 1, 0, 'out');
    let memory = await held();
    expect('a raid out leaves a flag where it got out', memory?.marks.at(-1)?.kind === 'out' && memory.marks.at(-1).line.startsWith('OUT BY '));
    expect('and its walk', (memory?.trail?.points.length ?? 0) > 20);
    await shot('memory-flag');
    await raid(200, 150, 0, 1, 'clock');
    memory = await held();
    expect('a raid lost to the clock leaves a cross saying so', memory?.marks.at(-1)?.line === 'THE CLOCK RAN OUT HERE');
    await shot('memory-cross');
    // Round the rim until it names one.
    const centre = { x: 35.5, y: 33 };
    const rim = (await base(`b.arenaRim.map((t) => ({ x: t.x, y: t.y }))`)).sort(
      (a, b) => Math.atan2(a.y - centre.y, a.x - centre.x) - Math.atan2(b.y - centre.y, b.x - centre.x),
    );
    let named = null;
    for (let index = 0; index < rim.length && !named; index += 3) {
      await walkTo(rim[index]);
      await step(200);
      if (await base('b.arena.markText.visible')) {
        named = await base('b.arena.markText.text');
        await shot('memory-named');
      }
    }
    console.log('the rim names:', named);
    expect('walking the rim, it says what a mark was', named !== null);
  }

  // --- a coin over the rail --------------------------------------------------------
  if (!only || only === 'coin') {
    const saved = () => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE)}))`);
    const money = async () => (await saved()).stash.items?.money ?? (await saved()).stash.supplies?.money ?? 0;
    // Money, as found on raids, and one coin short of the first thing coming back.
    await page.evaluate(`(() => { const k = ${JSON.stringify(SAVE)}; const s = JSON.parse(localStorage.getItem(k)); const held = s.stash.items ? s.stash.items : s.stash.supplies; held.money = 400; s.raidProgress.pit = { fed: 14, taken: 0 }; localStorage.setItem(k, JSON.stringify(s)); })()`);
    await base(`(() => { b.scene.start('base', { room: 'raid-arena', at: { x: 35, y: 56 } }); return 1; })()`);
    await step(300);
    await until(inHall, 'the hall again');
    await walkTo({ x: 35, y: 56 });
    await press('ArrowUp', 300);
    expect('nothing advertises the coin to somebody just arriving at the rail', !(await base('b.hintShown')).includes('[C]'));
    await step(10500);
    await shot('coin-hint');
    expect(`the rail says a coin can go over (${await base('b.hintShown')})`, (await base('b.hintShown')).includes('[C] TOSS A COIN'));
    const before = await money();
    await page.tap('KeyC', 0);
    await step(300);
    await shot('coin-over');
    expect('it costs a coin', before - (await money()) === 10);
    await page.tap('KeyC', 0);
    await step(100);
    expect('and only one can be in the air', before - (await money()) === 10);
    expect('the hint has gone once it has been done', !(await base('b.hintShown')).includes('[C]'));
    await step(3600);
    expect('something comes back', await base('Boolean(b.pitGiftImage)'));
    await shot('coin-gift-flying');
    await step(1400);
    await shot('coin-gift-landed');
    const on = await base('b.currentTile');
    await base(`(() => { b.scene.start('base', { room: 'raid-arena', at: ${JSON.stringify(on)} }); return 1; })()`);
    await step(300);
    await until(inHall, 'the hall again');
    expect('and it is still there on the next visit, until it is picked up', await base('Boolean(b.pitGiftImage)'));
    await walkTo({ x: 30, y: 57 });
    await step(300);
    expect('walking on to it picks it up', (await saved()).raidProgress.pit.taken === 1);
    await shot('coin-gift-taken');
    for (let guard = 0; guard < 6 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 400);
    }
    const stash = (await saved()).stash;
    expect('and it is in the vault', ((stash.items ?? stash.supplies)['pika-cushion'] ?? 0) === 1);
    await walkTo(on);
  }

  // --- bouts for show --------------------------------------------------------------
  if (!only || only === 'bout') {
    const raw = () => page.evaluate(`localStorage.getItem(${JSON.stringify(SAVE)})`);
    /** The whole save but the one field the hall writes about a bout. */
    const allButBouts = async () => {
      const save = JSON.parse(await raw());
      delete save.raidProgress.bouts;
      return JSON.stringify(save);
    };
    const battle = (expression) => page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return ${expression}; })()`);
    const setLevel = (level) =>
      page.evaluate(`(() => { const k = ${JSON.stringify(SAVE)}; const s = JSON.parse(localStorage.getItem(k)); const p = s.stash.pokemon[0].pokemon; p.level = ${level}; p.xp = Math.pow(${level}, 3); p.currentHp = 9999; localStorage.setItem(k, JSON.stringify(s)); })()`);
    const backToHall = async () => {
      await base(`(() => { b.scene.start('base', { room: 'raid-arena', at: { x: 35, y: 7 } }); return 1; })()`);
      await step(300);
      await until(inHall, 'the hall again');
      // The level above was written by hand: read back and written once, as the game writes a save, so that
      // nothing but the bout is left to change it.
      await base('(b.saveManager.save(b.saveManager.load()), 1)');
    };
    /** Names what differs between two saves, for a fault to say. */
    const differs = (before, after) => {
      const a = JSON.parse(before);
      const b = JSON.parse(after);
      const out = [];
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
          if (key === 'raidProgress') {
            for (const inner of new Set([...Object.keys(a[key]), ...Object.keys(b[key])])) {
              if (JSON.stringify(a[key][inner]) !== JSON.stringify(b[key][inner])) out.push(`raidProgress.${inner}`);
            }
          } else {
            out.push(key);
          }
        }
      }
      return out.join(',') || 'nothing';
    };
    await setLevel(70);
    await backToHall();
    await walkTo({ x: 35, y: 7 });
    await press('ArrowUp', 400);
    await shot('bout-rival');
    const hint = await base('b.hintShown');
    const first = await base('b.rivalHere.name');
    expect(`the next hunter stands on the far floor (${hint})`, hint === `[SPACE] ${first}`);
    /** Speaks to the rival, says yes, and hands back once the fight is up. */
    const challenge = async (name) => {
      await press('Space', 700);
      if (name) await shot(`${name}-greeting`);
      for (let guard = 0; guard < 10 && (await base('!b.boxQuestion')); guard += 1) {
        await press('Space', 500);
      }
      if (name) await shot(`${name}-offer`);
      await press('Space', 400);
      await until(sceneIs('battle'), 'the bout');
      await step(1500);
    };
    /**
     * Fights until the hall is back, pressing the key as a player leaning on it would. A mirror
     * match can go either way, so a driver that means to win leaves the foe a hit from the floor
     * with nothing to throw: one that knows no move stands still (`battleEngine.ts`).
     */
    const fightOn = async (name, win = false) => {
      let shots = 0;
      for (let guard = 0; guard < 600 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
        if (win) {
          await battle(`(() => { if (s.state?.enemy && s.state.enemy.currentHp > 0) { s.state.enemy.currentHp = 1; s.state.enemy.moves = []; } return 1; })()`);
        }
        await page.tap('Space', 0);
        await step(300);
        if (name && guard === 6 && shots === 0) {
          shots = 1;
          await shot(`${name}-fight`);
        }
      }
      await until(inHall, 'the hall after the bout');
      await step(400);
    };
    const saveBefore = await allButBouts();
    await challenge('bout');
    expect('it is the real battle screen, with no raid on it', await battle('Boolean(s.exhibition) && !s.runSession'));
    expect('the team is that rival\'s, against the bench', await battle('s.trainer.party.length >= 1 && s.trainer.party[0].level === 69'));
    await fightOn('bout', true);
    const afterWin = await allButBouts();
    expect(`winning writes nothing but who has been beaten (differs: ${differs(saveBefore, afterWin)})`, afterWin === saveBefore);
    expect('the hall has written who has been beaten', JSON.parse(await raw()).raidProgress.bouts?.beaten.length === 1);
    await shot('bout-won');
    for (let guard = 0; guard < 8 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 500);
    }
    const second = await base('b.rivalHere.name');
    expect(`whoever is next steps up (${second})`, second !== first);

    // A yield is a loss, and starts the run again.
    await challenge(null);
    const before = await allButBouts();
    await battle(`(() => { s.flee(); return 1; })()`);
    await fightOn(null);
    expect('yielding writes nothing but the run being over', (await allButBouts()) === before);
    expect('and it is over', JSON.parse(await raw()).raidProgress.bouts?.beaten.length === 0);
    for (let guard = 0; guard < 8 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 500);
    }

    // Losing outright, down to the last Pokemon.
    await setLevel(5);
    await backToHall();
    await walkTo({ x: 35, y: 7 });
    await press('ArrowUp', 300);
    const lost = await allButBouts();
    await challenge(null);
    await battle(`(() => { s.state.player.currentHp = 1; s.party.pokemon[0].currentHp = 1; return 1; })()`);
    await fightOn(null);
    const afterLoss = await allButBouts();
    expect(`losing writes nothing either (differs: ${differs(lost, afterLoss)})`, afterLoss === lost);
    console.log('after the loss:', JSON.stringify(JSON.parse(await raw()).raidProgress.bouts));
    await shot('bout-lost');
    for (let guard = 0; guard < 8 && (await base('b.dialogBox.visible')); guard += 1) {
      await press('Space', 500);
    }

    // All five in a row, and the banner.
    await setLevel(70);
    await backToHall();
    await walkTo({ x: 35, y: 7 });
    await press('ArrowUp', 300);
    for (let round = 0; round < 5; round += 1) {
      await challenge(null);
      await fightOn(null, true);
      console.log(`bout ${round + 1}:`, JSON.stringify(JSON.parse(await raw()).raidProgress.bouts));
      if (round === 4) await shot('bout-ladder-done');
      for (let guard = 0; guard < 8 && (await base('b.dialogBox.visible')); guard += 1) {
        await press('Space', 500);
      }
    }
    const ladder = JSON.parse(await raw()).raidProgress.bouts;
    expect('all five in a row counts', ladder.ladders === 1 && ladder.beaten.length === 0);
    await backToHall();
    await step(300);
    await shot('bout-banner');
  }
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.error(`${faults.length} fault(s)`);
  process.exit(1);
}
