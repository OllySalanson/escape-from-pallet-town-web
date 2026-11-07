// Plays step 2 of the gyms plan, learn before you risk it, as a player meets it at
// home after losing to Misty in a raid: she waits on THE RAID ARENA's far floor,
// spars with her real gym team for nothing, says what beat you, and the save is
// the same byte for byte afterwards; the Gym Guide at the Arena's door names her
// gym and what does well there; and the telescope shows THE COAST sealed.
//
//   node tools/playtest/gymPractice.mjs <test-mode build url> <out-dir> <save.json> [--port=N] [--window=1200x768]
//
// `save.json` is a save that has met Misty in a raid - `raid.mjs --save-out=` after
// losing to her (docs/screens/gym-practice/README.md has the command). Its first
// Pokémon is rested so it can go on the bench, and its raid count is set so the
// rival on the far floor is somebody else and Misty stands beside them. Exit code 1
// is anything not where it should be.
import { mkdirSync, readFileSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out, savePath] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !out || !savePath) {
  throw new Error('usage: gymPractice.mjs <test-mode build url> <out-dir> <save.json>');
}
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const FRAME_MS = 100;

const save = JSON.parse(readFileSync(savePath, 'utf8'));
for (const { pokemon } of save.stash.pokemon) {
  pokemon.currentHp = 9999;
}
// Two raids gone: the rival up is Lt. Surge, so Misty stands on her own tile.
save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 2, extracted: 1, wiped: 1 } };
save.raidProgress.arenaIntroSeen = true;

const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`, { save });
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
  const raw = () => page.evaluate(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && b.room?.id === 'raid-arena'; })()`;
  const inYard = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && !b.room; })()`;

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
  const walkTo = async (goals) => {
    for (let guard = 0; guard < 400; guard += 1) {
      if (await base('Boolean(b.dialogBox?.visible)')) {
        await press('Space', 300);
        continue;
      }
      const key = await keyTowards(goals);
      if (key === 'there') return true;
      if (key === null) {
        await step(100);
        continue;
      }
      await page.tap(key, 0);
      await step(170);
      for (let settling = 0; settling < 6 && (await base('Boolean(b.targetTile)')); settling += 1) await step(100);
    }
    expect(`got to ${JSON.stringify(goals)}`, false);
    return false;
  };
  /** Waits for the line in the box to finish typing, so a photograph holds all of it. */
  const typed = async () => {
    for (let guard = 0; guard < 60 && !(await base('Boolean(b.dialogBox?.isCurrentMessageComplete)')); guard += 1) await step(100);
  };
  /** Presses through the dialogue box, photographing the line that matches. */
  const readThrough = async (match, name) => {
    let seen = null;
    for (let guard = 0; guard < 40; guard += 1) {
      if (await base('Boolean(b.boxQuestion)')) break;
      const line = await base(`b.dialogBox?.visible ? (b.dialogBox.textObject?.text ?? b.dialogBox.fullText ?? '') : null`);
      if (line === null) break;
      if (match && seen === null && match.test(line.replace(/\s+/g, ' '))) {
        await typed();
        await shot(name);
        seen = line.replace(/\s+/g, ' ');
      }
      await press('Space', 500);
    }
    return seen;
  };

  // In from the title, across the yard and through the Arena's door.
  await press('Space', 600);
  await until(sceneIs('base'), 'the harbour');
  await step(1000);
  for (let guard = 0; guard < 120 && !(await page.evaluate(inHall)); guard += 1) {
    if (await base('Boolean(b.dialogBox?.visible)')) {
      await press('Space', 300);
      continue;
    }
    const key = await keyTowards(null);
    if (key && key !== 'there') await press(key);
    await step(200);
  }
  await until(inHall, 'the great hall');
  await step(600);

  // --- Misty, on the far floor ----------------------------------------------------
  const leaders = await base('b.leadersHere.map((l) => ({ id: l.gym.bossId, tile: l.tile }))');
  expect(`Misty waits on the far floor beside ${await base('b.rivalHere?.name')} (${JSON.stringify(leaders)})`, leaders.length === 1 && leaders[0].id === 'vale-gym-misty');
  const misty = leaders[0].tile;
  await walkTo([{ x: misty.x, y: misty.y + 1 }]);
  await press('ArrowUp', 400);
  await step(600);
  await shot('00-misty-in-the-hall');
  expect(`the hint offers practice (${await base('b.hintShown')})`, (await base('b.hintShown')) === '[SPACE] PRACTISE WITH MISTY');
  const before = await raw();
  await press('Space', 700);
  await readThrough(/Try my gym team/, '01-misty-offers');
  expect('she asks', await base('Boolean(b.boxQuestion)'));
  await shot('02-practise-for-free');
  await press('Space', 400);
  await until(sceneIs('battle'), 'the practice');
  await step(1500);
  const team = await page.evaluate(`${GAME}.scene.getScene('battle').trainer.party.map((p) => p.base.id + ':' + p.level + ':' + p.moves.map((m) => m.base.name).join('|'))`);
  expect(`it is her real gym team (${team.join(', ')})`, team[0]?.startsWith('staryu:15:Rain Dance'));
  expect('on the real battle screen, with no raid on it', await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return Boolean(s.exhibition?.practice) && !s.runSession; })()`));
  let lostLine = null;
  let fightShot = false;
  let lastSaid = null;
  for (let guard = 0; guard < 600 && !(await page.evaluate(sceneIs('base'))); guard += 1) {
    const said = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return s?.sys.isActive() && s.dialog?.isCurrentMessageComplete ? s.dialog.textObject?.text : null; })()`);
    if (said && said !== lastSaid && args.includes('--said')) {
      lastSaid = said;
      console.log(`battle says: ${said.replace(/\s+/g, ' ')}`);
    }
    if (said && !fightShot && /SWIFT SWIM/.test(said)) {
      fightShot = true;
      await shot('03-practice-fight');
    }
    if (said && /What beat you\?/.test(said.replace(/\s+/g, ' ')) && lostLine === null) {
      lostLine = said.replace(/\s+/g, ' ');
      await shot('04-what-beat-you-in-practice');
    }
    await page.tap('Space', 0);
    await step(300);
  }
  expect(`a lost practice says what beat you (${lostLine})`, lostLine !== null);
  await until(inHall, 'the hall after the practice');
  await step(900);
  await typed();
  await shot('05-misty-after');
  const after = await raw();
  expect('the save is the same byte for byte: a practice writes nothing', before === after);
  await readThrough(null);

  // --- the telescope: THE COAST sealed --------------------------------------------
  await walkTo([await base(`({ ...b.arenaTelescopes[0].stance })`)]);
  await step(400);
  await press('Space');
  await until(`${GAME}.scene.getScene('base').telescope?.isOpen === true`, 'the glass');
  await step(800);
  await shot('06-telescope-coast-sealed');
  const coast = await base(`(() => { const t = b.telescope; const scale = t.source.scale; return t.rules.screenOf({ x: 128 * scale, y: 290 * scale }); })()`);
  const canvas = await page.evaluate(`(() => { const r = ${GAME}.canvas.getBoundingClientRect(); return { left: r.left, top: r.top, zoom: r.width / ${GAME}.scale.width }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: canvas.left + coast.x * canvas.zoom, y: canvas.top + coast.y * canvas.zoom });
  await step(600);
  await shot('07-telescope-coast-card');
  const card = await base('b.telescope.cardNow()?.title ?? null');
  expect(`the card over the Coast names it (${card})`, card === 'THE COAST');
  await press('Escape', 800);
  await step(600);

  // --- the Gym Guide at the door ------------------------------------------------------
  for (let guard = 0; guard < 120 && !(await page.evaluate(inYard)); guard += 1) {
    if (await base('Boolean(b.dialogBox?.visible)')) {
      await press('Space', 300);
      continue;
    }
    const key = await keyTowards(await base('b.room?.mat ? [b.room.mat] : null'));
    await press(key === 'there' ? 'ArrowDown' : (key ?? 'ArrowDown'));
  }
  await until(inYard, 'the yard');
  await step(800);
  const guide = await base(`(() => { const f = b.harbourLife.figures.find((each) => each.id === 'gym-guide'); return f ? { ...f.position } : null; })()`);
  const fronts = [[0, 1, 'ArrowUp'], [0, -1, 'ArrowDown'], [1, 0, 'ArrowLeft'], [-1, 0, 'ArrowRight']].map(([dx, dy, key]) => ({ x: guide.x + dx, y: guide.y + dy, key }));
  await walkTo(fronts.map(({ x, y }) => ({ x, y })));
  const here = await base('({ ...b.currentTile })');
  await press(fronts.find((each) => each.x === here.x && each.y === here.y).key, 300);
  await press('Space', 600);
  const advice = await readThrough(/You've met MISTY/, '08-gym-guide-advice');
  expect(`the Gym Guide names the next gym and says she spars now (${advice})`, advice !== null);
  await page.evaluate(`${GAME}.resumeLoop?.()`);
} finally {
  await browser.close();
}
if (faults.length > 0) {
  console.log(`${faults.length} fault(s)`);
  process.exit(1);
}
