// A double battle: ITEM > POTION > the hurt Squirtle on the left. Is the Rattata on the right then asked for its move?
// Run against the dev server: node tools/playtest/doubleItem.mjs http://localhost:5173/
const R = new URL('./', import.meta.url).pathname;
const { launchBrowser } = await import(R + 'browser.mjs');
const { createHands, GAME } = await import(R + 'ai-player/game.mjs');
const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  const page = await browser.openPage(`${process.argv[2]}?testmode=1`);
  await page.waitFor(`${GAME}?.scene?.isActive('title')`, { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await page.evaluate(`(async () => {
    const { Pokemon, PokemonParty } = await import('/src/game/pokemon/index.ts');
    const { getSpeciesById } = await import('/src/game/pokemon/species.ts');
    const { Bag, RAID_BAG_GRID } = await import('/src/game/items/index.ts');
    const make = (id, level) => new Pokemon(getSpeciesById(id), level);
    const squirtle = make('squirtle', 12); squirtle.currentHp = 5;
    const rattata = make('rattata', 10);
    const bag = new Bag({ potion: 2 }, RAID_BAG_GRID);
    const trainer = { id: 'double-item', name: 'MISTY', party: [make('staryu', 8), make('horsea', 8)], defeatText: 'Hm.', unitCount: 2 };
    ${GAME}.scene.getScene('title').scene.start('battle', { party: new PokemonParty([squirtle, rattata]), trainer, bag, returnScene: 'title' });
    return 0;
  })()`);
  const hands = createHands(page);
  await hands.step(5);
  const pick = async (pattern) => {
    const b = (await hands.settle(60)).scene.battle;
    const index = b.commands.findIndex((c) => pattern.test(c));
    await page.evaluate(`(() => { const sc = ${GAME}.scene.getScene('battle'); sc.selectedCommand = ${Math.max(0, index)}; sc.updateSelection(); return 0; })()`);
    await hands.beat(); await hands.press('Space', 3);
  };
  for (let i = 0; i < 20; i += 1) {
    const b = (await hands.settle(60)).scene.battle;
    if (b.mode === 'main') break;
    await hands.press('Space', 3);
  }
  await pick(/ITEM/); await pick(/POTION/i); await pick(/SQUIRTLE/i);
  const after = (await hands.settle(60)).scene.battle;
  console.log('after the Potion:', after.mode, JSON.stringify(after.commands), after.message?.text ?? '');
  const start = (await hands.look()).lastEvent;
  if (after.mode === 'moves') {
    await pick(/TACKLE/);
    if ((await hands.settle(60)).scene.battle.mode === 'target') await pick(/./);
  }
  for (let i = 0; i < 30; i += 1) {
    const b = (await hands.settle(60)).scene.battle;
    if (!b || b.mode === 'main') break;
    await hands.press('Space', 3);
  }
  console.log((await hands.eventsSince(start)).filter((e) => e.kind === 'talked').map((e) => e.text).join(' | '));
} finally { await browser.close(); }
