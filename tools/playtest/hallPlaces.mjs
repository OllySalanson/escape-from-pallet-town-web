// Fights whoever stands on THE RAID ARENA's far floor and says where everybody
// stood before the fight, as the player comes back, and once the rival has had
// their say - nobody who stays may move (the owner, 12 Nov 2026: "Misty and the
// green NPC had swapped places"; `docs/screens/arena-misty-swap/`).
//
//   node tools/playtest/hallPlaces.mjs <test-mode build url> <out dir> <raids> <rival|leader> [--pixels] [--lose]
//
// A fresh save with Misty met at her gym and <raids> raids deployed: 1 makes
// Misty the rival (the bout), 2 makes Lt. Surge the rival and Misty a leader to
// practise with (`leader`). The foe is left on 1 HP every turn so the bout is
// won and the ladder moves on, unless --lose. --pixels photographs the three
// moments into <out dir>.
import { mkdirSync } from 'node:fs';
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';
const [url, out, raids, who] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const pixels = process.argv.includes('--pixels');
const win = !process.argv.includes('--lose');
mkdirSync(out, { recursive: true });
const FRAME_MS = 100;
const browser = await launchBrowser({ window: pixels ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  const mode = pixels ? 'pixels' : '1';
  let page = await browser.openPage(`${url}?testmode=${mode}`);
  await page.waitFor(sceneIs('title'), { what: 'title' });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.round(ms / FRAME_MS))}, ${FRAME_MS})`);
  const until = async (expr, what) => { for (let g = 0; g < 600; g++) { if (await page.evaluate(expr)) return; await step(100); } throw new Error('never ' + what); };
  const press = async (code, after = 200) => { await page.tap(code, 0); await step(after); };
  await press('Space', 600);
  await until(sceneIs('base'), 'base');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.('squirtle') === true`, 'starter');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'save');
  await page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = s.raidProgress;
    p.raidRecord = { 'greystone-vale': { deployed: ${Number(raids)}, extracted: 1, wiped: ${Number(raids) - 1} } };
    p.gymsMet = ['vale-gym-misty']; p.arenaIntroSeen = true; p.firstContractExtracted = true;
    for (const st of s.stash.pokemon) { st.pokemon.level = 60; st.pokemon.moves = []; st.pokemon.currentHp = 9999; }
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(s)); })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=${mode}` });
  await page.waitFor(sceneIs('title'), { what: 'title2' });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space', 600);
  await until(sceneIs('base'), 'base2');
  await step(1000);
  const base = (e) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${e}; })()`);
  const inHall = `(() => { const b = ${GAME}.scene.getScene('base'); return b.sys.isActive() && b.ready && !b.leaving && b.room?.id === 'raid-arena'; })()`;
  const keyTowards = (goals) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); if (!b.sys.isActive() || !b.ready || b.leaving) return null;
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
  for (let g = 0; g < 200 && !(await page.evaluate(inHall)); g++) {
    if (await base('Boolean(b.dialogBox?.visible)')) { await press('Space', 300); continue; }
    const key = await keyTowards(null); if (key && key !== 'there') await press(key); await step(200);
  }
  await until(inHall, 'hall'); await step(600);
  const figures = () => base(`({ rival: b.rivalHere?.id ?? null, rivalAt: b.rivalFigure ? { x: b.rivalFigure.x / 16, y: Math.round(b.rivalFigure.y / 16) } : null,
    leaders: b.leadersHere.map((l) => ({ id: l.gym.rival, tile: l.tile })), leaderSprites: b.leaderFigures.map((f) => ({ x: f.x / 16, key: f.texture.key })), rivalKey: b.rivalFigure?.texture.key, player: { ...b.currentTile } })`);
  console.log('hall on entry:', JSON.stringify(await figures()));
  const target = who === 'rival' ? await base('({ ...(b.rivalAt ?? { x: 35, y: 6 }) })') : (await base('b.leadersHere.find((l) => l.gym.rival === "misty")?.tile'));
  for (let g = 0; g < 400; g++) {
    if (await base('Boolean(b.dialogBox?.visible)')) { await press('Space', 300); continue; }
    const key = await keyTowards([{ x: target.x, y: target.y + 1 }, { x: target.x + 1, y: target.y }, { x: target.x - 1, y: target.y }]);
    if (key === 'there') break; if (key) { await page.tap(key, 0); await step(170); } else await step(100);
  }
  const me = await base('({ ...b.currentTile })');
  await press(me.y > target.y ? 'ArrowUp' : me.x > target.x ? 'ArrowLeft' : 'ArrowRight', 400); await step(400);
  console.log('hint:', await base('b.hintShown'));
  console.log('before the fight:', JSON.stringify(await figures()));
  if (pixels) await page.screenshot(`${out}/1-before.png`);
  await press('Space', 600);
  for (let g = 0; g < 40 && !(await page.evaluate(sceneIs('battle'))); g++) {
    const q = await base('b.boxQuestion ? true : false');
    await press('Space', 400);
  }
  await until(sceneIs('battle'), 'battle');
  console.log('battle:', await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return JSON.stringify({ ex: s.exhibition, party: s.state?.player?.pokemon?.name + ':' + s.state?.player?.pokemon?.level }); })()`));
  let last = null; for (let g = 0; g < 900 && !(await page.evaluate(sceneIs('base'))); g++) { const said = await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); return s?.sys.isActive() ? (s.dialog?.textObject?.text ?? '') + ' |mode=' + s.mode + ' cmd=' + s.selectedCommand : null; })()`); if (win) await page.evaluate(`(() => { const s = ${GAME}.scene.getScene('battle'); for (const p of s.trainer?.party ?? []) if (p.currentHp > 1) p.currentHp = 1; if (s.state?.enemy && s.state.enemy.currentHp > 1) s.state = { ...s.state, enemy: { ...s.state.enemy, currentHp: 1 } }; })()`); if (said !== last) { console.log('  ', said?.replace(/\s+/g, ' ')); last = said; } await page.tap('Space', 0); await step(300); }
  await until(inHall, 'hall after'); await step(900);
  console.log('bouts:', await page.evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.bouts)`));
  console.log('back, first line:', JSON.stringify(await figures()));
  if (pixels) await page.screenshot(`${out}/2-back.png`);
  for (let g = 0; g < 20 && (await base('Boolean(b.dialogBox?.visible)')); g++) await press('Space', 500);
  await step(600);
  console.log('after the words:', JSON.stringify(await figures()));
  if (pixels) await page.screenshot(`${out}/3-after.png`);
} finally { await browser.close(); }
