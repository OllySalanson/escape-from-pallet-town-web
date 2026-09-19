// The way from the title screen into a raid, for every driver here.
//
// A fresh save is offered one insertion, the Floodplain's front door. Anywhere
// else is reached the way a player reaches it: the game writes its own save, its
// `raidProgress` (and nothing else but HP) is edited to what that player's would
// say, the page is reloaded and the raid is deployed from the lobby that save
// opens on - so a gate is open because the raid was built with it open, and an
// insertion is dropped into because its row in the loadout was clicked, not
// because a scene's private state was poked.
export const SAVE_KEY = 'escape-from-pallet-town.save.v1';
export const GAME = 'window.__escapeFromPalletTownGame__';
export const sceneIs = (key) => `${GAME}?.scene.getScenes(true).some((s) => s.scene.key === '${key}')`;

/** `--insertion=id --beaten=bossId,.. --completed=contractId,.. --hp=N`, out of a driver's arguments. */
export function deployOptions(args) {
  const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const list = (name) => (option(name) ?? '').split(',').filter(Boolean);
  return { insertion: option('insertion'), beaten: list('beaten'), completed: list('completed'), hp: option('hp') };
}

/**
 * Title, starter, lobby, loadout, final check, raid. `press`, `click` and `until`
 * are the driver's own, because only it knows whether the game is being stepped;
 * `paused` puts the loop to sleep on every load, for a driver that steps it.
 */
export async function deploy(page, url, { press, click, until, paused = false, insertion, beaten = [], completed = [], hp }) {
  const title = async () => { await page.waitFor(sceneIs('title')); if (paused) await page.evaluate(`${GAME}.pauseLoop()`); };
  await title();
  await press('Space'); await until(sceneIs('starter'));
  await click('Confirm Bulbasaur');
  if (insertion || beaten.length > 0 || completed.length > 0 || hp !== undefined) {
    await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the game to write its save');
    // Every other map's front door is what banking the first contract pays, and a
    // drop-in point is offered to whoever has stood on it. The tool cannot tell
    // which an id is, so the save says both; `availableInsertionIds` reads either.
    // HP is the condition the team came home in, which is a thing a save holds.
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
      p.defeatedBosses = [...new Set([...p.defeatedBosses, ...${JSON.stringify(beaten)}])];
      p.completedContracts = [...new Set([...p.completedContracts, ...${JSON.stringify(completed)}])];
      if (${JSON.stringify(insertion ?? null)}) { p.firstContractExtracted = true; p.reachedInsertions = [...new Set([...p.reachedInsertions, ${JSON.stringify(insertion ?? '')}])]; }
      if (${hp !== undefined}) for (const stored of save.stash.pokemon) stored.pokemon.currentHp = Math.min(stored.pokemon.currentHp, ${Number(hp)});
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url });
    await title();
    await press('Space'); await until(sceneIs('hub'));
    console.log(`continuing from a save with: ${JSON.stringify(await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress`))}`);
  }
  await click('Start a raid');
  if (insertion) {
    // The loadout's own row, by the id it carries: two rows can share a map's name.
    await until(`(() => { const b = document.querySelector('button[data-insertion=${JSON.stringify(insertion)}]'); if (!b) return false; b.click(); return true; })()`, `the lobby to offer insertion "${insertion}"`);
  }
  for (const label of ['Bulbasaur', 'Review & deploy', 'Enter the raid']) await click(label);
  await until(sceneIs('world'));
}
