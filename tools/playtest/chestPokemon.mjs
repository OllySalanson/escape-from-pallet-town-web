// Plays THE CHEST's POKéMON tab (`scenes/ChestPokemonScene.ts`): a new game is
// given fourteen Pokémon in two boxes and a held item, then at THE CHEST:
//
//   - on THINGS, with a real mouse (the captain, 28 Nov 2026: hover to look,
//     drag to move, a click nothing): the card answers for the thing hovered
//     and the cursor's again once the mouse is off it; a click on a thing and
//     on the card's ENTER key changes nothing and moves no cursor; a thing
//     dragged into the pack is packed, and one let go off every container is
//     put back, with nothing left carried either way;
//   - P on the chest's THINGS goes to its POKéMON tab: every Pokémon in one
//     grid in the order an old save's boxes kept them, no boxes named, the
//     card following the cursor;
//   - ENTER takes the one under the cursor on the next raid, G puts one out in
//     the garden, L puts one in front;
//   - a Pokémon dragged from the grid onto THE NEXT RAID joins the team (and
//     leaves the garden), and one dragged from the GARDEN back onto the grid
//     comes in;
//   - hovering a Pokémon shows its card and moving off brings the cursor's
//     back; a click on one is nothing - no card, no cursor, no change;
//   - things are given: a stone over a Pokémon it does nothing for goes red and
//     asks nothing, dropped on Eevee it asks and evolves it; a berry clicked and
//     then a Pokémon clicked asks nothing, and the berry dragged onto Machop
//     asks and is held; a disc chosen with ENTER and a
//     Pokémon with ENTER asks, N says no and YES teaches; T and a drag off the
//     card take what is held back into the chest;
//   - B goes back to THINGS, and every change is in the save.
//
//   node tools/playtest/chestPokemon.mjs <test-mode build url> <out dir> [--port=CDP port] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`chestPokemon: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(3);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const tab = `${GAME}.scene.getScene('chest-pokemon')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const focused = () => page.evaluate(`document.activeElement?.closest('[data-mon]')?.dataset.mon ?? null`);
  const centre = (selector) =>
    page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`);
  const mouse = (type, at) =>
    page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: at.buttons === 0 ? 'none' : 'left', buttons: at.buttons ?? (type === 'mousePressed' || type === 'mouseMoved' ? 1 : 0), clickCount: type === 'mouseMoved' ? 0 : 1 });
  /** Presses on one thing, carries it in steps to another, and lets go. */
  const drag = async (fromSelector, toSelector) => {
    // In view first, as a player would have it before picking it up: the
    // cursor put on it, because the screen keeps the cursor's tile in view and
    // a scroll alone was put back to wherever the cursor last was.
    await page.evaluate(`(() => { const node = document.querySelector(${JSON.stringify(fromSelector)}); node?.focus(); node?.scrollIntoView({ block: 'nearest' }); })()`);
    await step(4);
    const from = await centre(fromSelector);
    const to = await centre(toSelector);
    if (!from || !to) fail(`nothing to drag from ${fromSelector} to ${toSelector}`);
    await mouse('mouseMoved', from);
    await mouse('mousePressed', from);
    for (let i = 1; i <= 8; i += 1) {
      await mouse('mouseMoved', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
      await step(1);
    }
    await mouse('mouseReleased', to);
    await wait(200);
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  // Fourteen more Pokémon, one of them holding an Oran Berry - written as a save
  // from before THE CHEST wrote them: in two boxes, and stored in another order
  // than the boxes keep them, so the grid's order is the boxes', read once.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon[0];
    const kinds = [['pikachu', 14], ['machop', 15], ['growlithe', 16], ['psyduck', 13], ['gastly', 13], ['eevee', 12], ['abra', 12],
      ['pidgey', 11], ['geodude', 10], ['oddish', 9], ['bulbasaur', 8], ['squirtle', 8], ['rattata', 6], ['magikarp', 5]];
    const first = [partner.id];
    const second = [];
    const stored = kinds.map(([speciesId, level], index) => {
      const id = speciesId + '-' + (90 + index);
      if (index < 8) first.push(id); else second.push(id);
      return { id, pokemon: { ...partner.pokemon, speciesId, level, currentHp: 999, xp: level * level * level, moves: ['Tackle'], nickname: null, heldItemId: speciesId === 'pikachu' ? 'oran-berry' : null, primaryStatus: null } };
    });
    save.stash.pokemon = [...stored.reverse(), partner];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: first }, { name: 'Box 2', pokemonIds: second }];
    save.stash.items = { ...(save.stash.items ?? {}), 'oran-berry': 2, 'sitrus-berry': 1, 'thunder-stone': 1, 'tm40-aerial-ace': 1 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);

  // At THE CHEST: SPACE, then P for the POKéMON tab.
  await page.evaluate(`void ${base}.scene.start('base', { room: 'bolthole', at: { x: 12, y: 6 }, facing: 'up' })`);
  await until(baseReady, 'the front room');
  await wait(400);
  await press('Escape');
  await wait(200);
  await press('Space');
  await until(`${sceneIs('things')} && Boolean(document.querySelector('#screens [data-chest-tab="pokemon"]'))`, 'the chest with its tabs');
  await wait(400);
  await shoot('01-things-tab');

  // THINGS with a real mouse: hovering is the look, a click nothing, a drag the move.
  {
    const things = `#screens [data-grid="stash"]`;
    const cardName = () => page.evaluate(`document.querySelector('#screens [data-hand-card] .things-hand-words')?.textContent?.trim() ?? ''`);
    const cursorAt = () => page.evaluate(`document.activeElement?.dataset?.gridPiece ?? document.activeElement?.className ?? null`);
    const pieces = await page.evaluate(`[...document.querySelectorAll('${things} [data-grid-piece]')].map((piece) => piece.dataset.gridPiece)`);
    if (pieces.length < 2) fail(`the stash has ${pieces.length} things to look at`);
    const cursor = await cursorAt();
    const restingCard = await cardName();
    const other = pieces.find((piece) => piece !== cursor);
    const otherAt = await centre(`${things} [data-grid-piece="${other}"]`);
    await mouse('mouseMoved', { ...otherAt, buttons: 0 });
    await step(3);
    const hoveredCard = await cardName();
    if (hoveredCard === restingCard) fail(`hovering ${other} left the card on "${restingCard}"`);
    await shoot('things-01-hovered');
    const away = await centre('#screens .px-title');
    await mouse('mouseMoved', { ...away, buttons: 0 });
    await step(3);
    if ((await cardName()) !== restingCard) fail(`off the stash the card says "${await cardName()}", not the cursor's "${restingCard}"`);
    const savedBefore = JSON.stringify((await saved()).raidProgress);
    await mouse('mouseMoved', otherAt);
    await mouse('mousePressed', otherAt);
    await mouse('mouseReleased', otherAt);
    await wait(200);
    if ((await cursorAt()) !== cursor) fail(`a click on ${other} moved the cursor to ${await cursorAt()}`);
    if (await page.evaluate(`Boolean(document.querySelector('#screens .px-grid-ghost, #screens .is-carried'))`)) fail('a click picked a thing up');
    const putIn = await centre('#screens [data-hand-card] [data-hand="pack"]');
    if (putIn) {
      await mouse('mouseMoved', putIn);
      await mouse('mousePressed', putIn);
      await mouse('mouseReleased', putIn);
      await wait(200);
    }
    if (JSON.stringify((await saved()).raidProgress) !== savedBefore) fail('a mouse click changed the save');
    // Dragged into the pack: packed, and nothing carried after.
    const berry = pieces.find((piece) => piece !== 'cargo:thunder-stone' && piece.startsWith('cargo:'));
    const kind = berry?.slice('cargo:'.length);
    const packedBerries = () => page.evaluate(`document.querySelectorAll('#screens [data-grid="pack"] [data-grid-piece$=":${kind}"]').length`);
    const packedBefore = await packedBerries();
    const berryAt = await centre(`${things} [data-grid-piece="${berry}"]`);
    const packAt = await page.evaluate(`(() => { const cells = [...document.querySelectorAll('#screens [data-grid="pack"] .px-grid-cells > i')]; const r = cells[cells.length - 1].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!berryAt) fail('nothing in the stash to drag');
    await mouse('mouseMoved', berryAt);
    await mouse('mousePressed', berryAt);
    for (let i = 1; i <= 8; i += 1) {
      await mouse('mouseMoved', { x: berryAt.x + ((packAt.x - berryAt.x) * i) / 8, y: berryAt.y + ((packAt.y - berryAt.y) * i) / 8 });
      await step(1);
    }
    await mouse('mouseReleased', packAt);
    await wait(200);
    if ((await packedBerries()) !== packedBefore + 1) fail(`dragging ${kind} into the pack left ${await packedBerries()} there`);
    if (await page.evaluate(`Boolean(document.querySelector('#screens .px-grid-ghost, #screens .is-carried'))`)) fail('a thing is still carried after the drag');
    await shoot('things-02-dragged-into-pack');
    // Let go off every container: put back, nothing carried.
    const stoneAt = await centre(`${things} [data-grid-piece="cargo:thunder-stone"]`);
    await mouse('mouseMoved', stoneAt);
    await mouse('mousePressed', stoneAt);
    for (let i = 1; i <= 8; i += 1) {
      await mouse('mouseMoved', { x: stoneAt.x + ((away.x - stoneAt.x) * i) / 8, y: stoneAt.y + ((away.y - stoneAt.y) * i) / 8 });
      await step(1);
    }
    await mouse('mouseReleased', away);
    await wait(200);
    if (await page.evaluate(`Boolean(document.querySelector('#screens .px-grid-ghost, #screens .is-carried'))`)) fail('a drag let go off the containers left the thing carried');
    if (!(await centre(`${things} [data-grid-piece="cargo:thunder-stone"]`))) fail('the Thunder Stone let go off the containers is not back in the stash');
    console.log(`chestPokemon: THINGS hovers, ignores clicks, and drags ${kind} into the pack`);
  }

  await press('KeyP');
  await until(`${sceneIs('chest-pokemon')} && Boolean(document.querySelector('#screens .chest-mon-grid'))`, 'the POKéMON tab');
  await wait(400);
  await shoot('02-pokemon-tab');
  const grid = await page.evaluate(`[...document.querySelectorAll('#screens .chest-mons [data-mon]')].map((tile) => tile.dataset.mon)`);
  console.log(`the grid: ${grid.join(' ')}`);
  if (grid.length !== 15) fail(`${grid.length} Pokémon in the grid, not 15`);
  if (grid[0] !== 'charmander-1' || grid[1] !== 'pikachu-90' || grid[14] !== 'magikarp-103') fail('the grid is not in the order the boxes kept');
  if (await page.evaluate(`Boolean(document.querySelector('#screens .chest-mons').textContent.match(/Box/))`)) fail('the grid names a box');
  const holding = await page.evaluate(`Boolean(document.querySelector('#screens .chest-mons [data-mon="pikachu-90"] .chest-mark.is-held'))`);
  if (!holding) fail('Pikachu does not show the berry it holds');

  // The keys: the cursor right onto Pikachu, ENTER takes it, L leads it, G on Psyduck puts it out.
  if ((await focused()) !== grid[0]) fail(`the cursor starts on ${await focused()}`);
  await press('ArrowRight');
  if ((await focused()) !== 'pikachu-90') fail(`right went to ${await focused()}`);
  const card = await page.evaluate(`[...document.querySelectorAll('#screens .chest-card')].filter((c) => !c.hidden).map((c) => c.dataset.shownBy)`);
  if (card.join() !== 'pikachu-90') fail(`the card shown is ${card}`);
  await press('Enter');
  if (!(await page.evaluate(`${tab}.teamIds.includes('pikachu-90')`))) fail('ENTER did not take Pikachu');
  await press('KeyL');
  if ((await page.evaluate(`${tab}.teamIds[0]`)) !== 'pikachu-90') fail('L did not put Pikachu in front');
  await shoot('03-pikachu-leads');
  // The garden starts as the six highest level not going: G brings Psyduck in, and puts Rattata out.
  const focus = async (id) => {
    await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="${id}"]').focus()`);
    await step(2);
  };
  if (!(await page.evaluate(`${tab}.gardenIds.includes('psyduck-93')`))) fail('Psyduck is not in the garden to start with');
  await focus('psyduck-93');
  await press('KeyG');
  if (await page.evaluate(`${tab}.gardenIds.includes('psyduck-93')`)) fail('G did not bring Psyduck in');
  await focus('rattata-102');
  await press('KeyG');
  if (!(await page.evaluate(`${tab}.gardenIds.includes('rattata-102')`))) fail('G did not put Rattata out');

  // The pointer: Machop dragged from the grid onto THE NEXT RAID leaves the
  // garden for the team, and Rattata dragged from the garden back to the grid comes in.
  await drag('#screens .chest-mons [data-mon="machop-91"]', '#screens .chest-team [data-drop="team"]');
  if (!(await page.evaluate(`${tab}.teamIds.includes('machop-91')`))) fail('dropping Machop on the team did not take it');
  if (await page.evaluate(`${tab}.gardenIds.includes('machop-91')`)) fail('Machop is on the team and in the garden');
  await drag('#screens .chest-garden [data-mon="rattata-102"]', '#screens .chest-mon-scroll');
  if (await page.evaluate(`${tab}.gardenIds.includes('rattata-102')`)) fail('dragging Rattata back to the grid left it in the garden');
  await shoot('04-dragged');
  // Hovering is the look, and a click is nothing: no card, no cursor, no change.
  const before = await page.evaluate(`${tab}.teamIds.join()`);
  const cursorBefore = await focused();
  const shownCard = () => page.evaluate(`[...document.querySelectorAll('#screens .chest-card')].filter((c) => !c.hidden).map((c) => c.dataset.shownBy).join()`);
  const restingCard = await shownCard();
  await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="geodude-98"]').scrollIntoView({ block: 'nearest' })`);
  await step(2);
  const geodude = await centre('#screens .chest-mons [data-mon="geodude-98"]');
  await mouse('mouseMoved', { ...geodude, buttons: 0 });
  await step(3);
  if ((await shownCard()) !== 'geodude-98') fail(`hovering Geodude shows ${await shownCard()}`);
  await shoot('05-hovered-geodude');
  const off = await centre('#screens .px-title');
  await mouse('mouseMoved', { ...off, buttons: 0 });
  await step(3);
  if ((await shownCard()) !== restingCard) fail(`off Geodude the card is ${await shownCard()}, not the cursor's ${restingCard}`);
  await mouse('mouseMoved', geodude);
  await mouse('mousePressed', geodude);
  await mouse('mouseReleased', geodude);
  await mouse('mouseMoved', { ...off, buttons: 0 });
  await wait(200);
  if ((await page.evaluate(`${tab}.teamIds.join()`)) !== before) fail('a click on Geodude changed the team');
  if ((await focused()) !== cursorBefore) fail(`a click on Geodude moved the cursor to ${await focused()}`);
  if ((await shownCard()) !== restingCard) fail(`a click on Geodude left its card up: ${await shownCard()}`);
  // The card's ENTER key, clicked, is nothing too: a Pokémon is moved by dragging it.
  const cardEnter = await centre('#screens .chest-card:not([hidden]) [data-key="team"]');
  if (cardEnter) {
    await mouse('mouseMoved', cardEnter);
    await mouse('mousePressed', cardEnter);
    await mouse('mouseReleased', cardEnter);
    await wait(200);
    if ((await page.evaluate(`${tab}.teamIds.join()`)) !== before) fail("a click on the card's ENTER key changed the team");
  }

  const save = await saved();
  const bench = save.raidProgress.lastBench ?? [];
  if (bench[0] !== 'pikachu-90' || !bench.includes('machop-91')) fail(`the save's team is ${bench}`);
  if ((save.raidProgress.garden ?? []).some((id) => id === 'psyduck-93' || id === 'rattata-102')) fail(`the save's garden is ${save.raidProgress.garden}`);

  // Giving things (part 3). A stone over a Pokémon it does nothing for goes red and asks nothing.
  const count = async (id) => (await saved()).stash.items?.[id] ?? 0;
  const holds = async (id) => (await saved()).stash.pokemon.find((one) => one.id === id)?.pokemon.heldItemId ?? null;
  const asking = () => page.evaluate(`Boolean(document.querySelector('#screens [data-ask]'))`);
  const charmander = grid[0];
  {
    await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="${charmander}"]').scrollIntoView({ block: 'nearest' })`);
    await step(2);
    const from = await centre('#screens [data-gift="thunder-stone"]');
    const to = await centre(`#screens .chest-mons [data-mon="${charmander}"]`);
    await mouse('mouseMoved', from);
    await mouse('mousePressed', from);
    for (let i = 1; i <= 8; i += 1) {
      await mouse('mouseMoved', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
      await step(1);
    }
    if (!(await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="${charmander}"]').classList.contains('is-gift-no')`))) fail('a Thunder Stone over Charmander is not marked as no');
    await shoot('06-stone-over-charmander');
    await mouse('mouseReleased', to);
    await wait(200);
    if (await asking()) fail('a Thunder Stone on Charmander asked a question');
  }
  // Onto Eevee: the question, YES, and the evolution.
  await drag('#screens [data-gift="thunder-stone"]', '#screens .chest-mons [data-mon="eevee-95"]');
  if (!(await asking())) fail('a Thunder Stone on Eevee asked nothing');
  const words = await page.evaluate(`document.querySelector('#screens .chest-ask-words').textContent`);
  if (!/USE THE THUNDER STONE ON EEVEE\?/i.test(words)) fail(`the question was "${words}"`);
  await shoot('07-ask-stone');
  await press('Enter');
  await until(`Boolean(document.querySelector('#screens [data-evolve-moment]'))`, 'the evolution');
  await wait(1400);
  await shoot('08-evolved');
  await press('Space');
  await until(`Boolean(document.querySelector('#screens .chest-mon-grid'))`, 'the grid after the evolution');
  const eevee = (await saved()).stash.pokemon.find((one) => one.id === 'eevee-95')?.pokemon.speciesId;
  if (eevee !== 'jolteon') fail(`Eevee became ${eevee}`);
  if ((await count('thunder-stone')) !== 0) fail('the stone was not spent');
  // Click the Sitrus Berry, click Machop: nothing. Drag it onto Machop: the question, and YES.
  const sitrus = await centre('#screens [data-gift="sitrus-berry"]');
  await mouse('mouseMoved', sitrus); await mouse('mousePressed', sitrus); await mouse('mouseReleased', sitrus);
  await wait(150);
  await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="machop-91"]').scrollIntoView({ block: 'nearest' })`);
  await step(2);
  const machop = await centre('#screens .chest-mons [data-mon="machop-91"]');
  await mouse('mouseMoved', machop); await mouse('mousePressed', machop); await mouse('mouseReleased', machop);
  await wait(150);
  if (await asking()) fail('click, click asked a question: a click is nothing');
  if (await page.evaluate(`Boolean(document.querySelector('#screens .is-armed'))`)) fail('a click on the berry left it chosen');
  await drag('#screens [data-gift="sitrus-berry"]', '#screens .chest-mons [data-mon="machop-91"]');
  if (!(await asking())) fail('the berry dragged onto Machop asked nothing');
  await shoot('09-ask-berry');
  const yes = await centre('#screens [data-ask-yes]');
  await mouse('mouseMoved', yes); await mouse('mousePressed', yes); await mouse('mouseReleased', yes);
  await wait(200);
  if ((await holds('machop-91')) !== 'sitrus-berry') fail(`Machop holds ${await holds('machop-91')}`);
  await shoot('10-machop-holds');
  // Keys: the disc chosen with ENTER, Pidgey with ENTER: N says no, then YES teaches it.
  const teachPidgey = async () => {
    await page.evaluate(`document.querySelector('#screens [data-gift="tm40-aerial-ace"]').focus()`);
    await step(2);
    await press('Enter');
    await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="pidgey-97"]').focus()`);
    await step(2);
    await press('Enter');
  };
  await teachPidgey();
  if (!(await asking())) fail('ENTER, ENTER asked nothing');
  await press('KeyN');
  if (await asking()) fail('N left the question up');
  await teachPidgey();
  await press('Enter');
  await wait(200);
  const pidgeyMoves = (await saved()).stash.pokemon.find((one) => one.id === 'pidgey-97')?.pokemon.moves ?? [];
  if (!JSON.stringify(pidgeyMoves).includes('Aerial Ace')) fail(`Pidgey knows ${JSON.stringify(pidgeyMoves)}`);
  // Taking back: T on Pikachu, and Machop's berry dragged off its card into TO GIVE.
  const oranBefore = await count('oran-berry');
  await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="pikachu-90"]').focus()`);
  await step(2);
  await press('KeyT');
  if ((await holds('pikachu-90')) !== null || (await count('oran-berry')) !== oranBefore + 1) fail('T did not take the Oran Berry back');
  await page.evaluate(`document.querySelector('#screens .chest-mons [data-mon="machop-91"]').focus()`);
  await step(2);
  await drag('#screens [data-held="machop-91"]', '#screens [data-drop="gifts"]');
  if ((await holds('machop-91')) !== null) fail('dragging the Sitrus Berry off Machop did not take it back');
  await shoot('11-taken-back');

  // B: back to the chest's THINGS.
  await press('KeyB');
  await until(`${sceneIs('things')} && /the chest/i.test(document.querySelector('#screens .px-title h1')?.textContent ?? '')`, 'THINGS again');
  await wait(300);
  await press('Escape');
  await until(baseReady, 'the front room again');
  console.log('chestPokemon: every check passed');
} finally {
  await browser.close();
}
