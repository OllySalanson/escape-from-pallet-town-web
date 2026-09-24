// Why is that caption missing? Stands the player at a tile in the real game and asks the two rules,
// with the scene's own inputs. First `captionReveal.ts`: most captions are missing because they are
// not speaking - nothing near, nobody looking - and that is the map working, so they are listed as
// SILENT with how far off they are. Then `labelPlacement.ts`, for the ones that are speaking and
// still not drawn: off the view, under the HUD, over map art or a person, under a canopy, or against
// a caption seated before it. For the seat that only canopy spoils it names the crown tiles.
//
//   nice -n 15 node tools/playtest/whyHidden.mjs <dev server url> name:x:y ["CAPTION TEXT"] [--look] [--insertion=id] [--beaten=bossId,..]
//
// --look holds the look key, so every caption in view speaks and the question is placement again.
//
// Guessed at, a missing caption cost three felled trees that changed nothing. Read, the same case
// turned out to be one's own planting, then a watched tile, then the caption of the gate next door.
// Runs in the 3x PIXEL_WINDOW on purpose: the 1x window gives the game a smaller stage, and captions
// that every player sees are reported hidden there.
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy, deployOptions } from './deploy.mjs';
const [base, stop, asked] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// A third argument names a caption that IS drawn, to ask why it sits where it does and not in a
// better seat: `... holt:54:40 "ORCHARD FENCE"`.
const ASKED = JSON.stringify(asked ?? null);
const LOOK = process.argv.includes('--look');
const url = new URL(base); url.searchParams.set('testmode', 'pixels');
const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (e, what = e) => { for (let i = 0; i < 300; i += 1) { if (await page.evaluate(e)) return; await wait(100); } throw new Error(`never saw ${what}`); };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => { await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`); await wait(350); };
  await deploy(page, url.href, { press, click, until, wait, paused: true, ...deployOptions(process.argv.slice(2)) });
  await wait(600);
  for (let i = 0; i < 12; i += 1) { await press('Space'); await wait(200); }
  const [name, x, y] = stop.split(':');
  await page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); const off = w.player.y - w.currentTile.y * 16; w.currentTile = { x: ${x}, y: ${y} }; w.setPlayerPosition(${x} * 16, ${y} * 16 + off); })()`);
  await wait(900);
  // The look is held for the rest of the check, so `describe()` says every caption in view speaks.
  if (LOOK) await page.keyDown('KeyL');
  await wait(300);
  const out = await page.evaluate(`(async () => { const m = await import('/src/game/ui/labelPlacement.ts'); const w = ${GAME}.scene.getScene('world');
    const v = w.cameras.main.worldView; const bounds = { x: v.left, y: v.top, width: v.width, height: v.height };
    const furniture = (w.raidHud?.occupied ?? []).map((c) => ({ x: c.x + v.left, y: c.y + v.top, width: c.width, height: c.height }));
    const surroundings = { bounds, furniture, keepClear: [...w.captionKeepClear(), ...w.worldLabels.map((l) => l.request().subject)], canopy: w.canopyInView(bounds), player: w.captionPlayer() };
    const lines = [];
    // Silent is the ordinary answer now, and not a fault: say how far off each one is.
    const reveal = await import('/src/game/ui/captionReveal.ts');
    w.worldLabels.forEach((l) => { const s = l.speech; const sub = l.request().subject;
      const cx = sub.x + sub.width / 2, cy = sub.y + sub.height / 2;
      if (l.request().speaks || cx < v.left || cx > v.right || cy < v.top || cy > v.bottom) return;
      lines.push('SILENT: ' + l.label.text.replace(/\\n/g, ' / ') + '  (' + reveal.stepsToNearest(w.currentTile, s.tiles)
        + ' steps off, a ' + s.voice + ' speaks within ' + reveal.CAPTION_NEAR_STEPS + ' - or hold L)'); });
    // seated in the rule's own order: warnings before names
    const order = m.seatingOrder(w.worldLabels.map((l) => l.request())); const turn = (i) => order.indexOf(i);
    // a caption silenced by its group (one keeper's doors named together) is not a missing one
    const speaking = m.resolveGroups(w.worldLabels.map((l) => l.request()), bounds);
    w.worldLabels.forEach((l, i) => { const r = speaking[i][0]; if (!r) return; const cx = r.subject.x + r.subject.width / 2, cy = r.subject.y + r.subject.height / 2;
      const wanted = ${ASKED} !== null && l.label.text.includes(${ASKED});
      if ((l.label.visible && !wanted) || cx < v.left || cx > v.right || cy < v.top || cy > v.bottom) return;
      const seated = w.worldLabels.filter((o, j) => turn(j) < turn(i) && o.label.visible).map((o) => ({ x: o.windowX, y: o.windowY, width: o.request().width, height: o.request().height }));
      lines.push((l.label.visible ? 'SEATED at view-xy ' + Math.round(l.windowX - v.left) + ',' + Math.round(l.windowY - v.top) + ': ' : 'HIDDEN: ') + l.label.text.replace(/\\n/g, ' / ') + '  (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
      const seats = m.explainSeats(r, surroundings, seated);
      // what it is competing with: the subject it names, then every caption seated before it
      lines.push('   names view-xy ' + Math.round(r.subject.x - v.left) + ',' + Math.round(r.subject.y - v.top) + ' ' + Math.round(r.subject.width) + 'x' + Math.round(r.subject.height));
      w.worldLabels.forEach((o, j) => { if (turn(j) < turn(i) && o.label.visible) lines.push('   seated view-xy ' + String(Math.round(o.windowX - v.left)).padStart(4) + ',' + String(Math.round(o.windowY - v.top)).padStart(4) + ' ' + Math.round(o.request().width) + 'x' + Math.round(o.request().height) + '  ' + o.label.text.split('\\n')[0]); });
      // the seat that only canopy is wrong with, and least of it: name the crowns in it, as tiles
      const fixable = seats.filter((s) => s.outsideView + s.underHud + s.overMapArt + s.againstCaption === 0).sort((a, b) => a.underCanopy - b.underCanopy)[0];
      if (fixable) { const rect = { x: fixable.x, y: fixable.y, width: r.width, height: r.height };
        const hit = surroundings.canopy.filter((c) => c.x < rect.x + rect.width && c.x + c.width > rect.x && c.y < rect.y + rect.height && c.y + c.height > rect.y);
        lines.push('   >> least-bad seat: ' + fixable.seat + ' (canopy ' + fixable.underCanopy + '). crown tiles in it: ' + hit.map((c) => 'x' + (c.x / 16) + '..' + ((c.x + c.width) / 16 - 1) + ' y' + (c.y / 16)).join('  ')); }
      else lines.push('   >> no seat has only canopy wrong with it');
      for (const s of seats) lines.push('   ' + s.seat.padEnd(5) + ' view-xy ' + String(Math.round(s.x - v.left)).padStart(4) + ',' + String(Math.round(s.y - v.top)).padStart(4)
        + '  offscreen ' + String(s.outsideView).padStart(5) + '  hud ' + String(s.underHud).padStart(4) + '  art/people ' + String(s.overMapArt).padStart(5) + '  canopy ' + String(s.underCanopy).padStart(5) + '  player ' + String(s.overPlayer).padStart(5) + '  caption ' + String(s.againstCaption).padStart(5)); });
    return lines.join('\\n'); })()`);
  console.log(out || '(no hidden on-screen captions here)');
} finally { await browser.close(); }
