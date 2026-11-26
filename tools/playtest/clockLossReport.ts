// A raid lost to the clock, shaped like Olly's of 25 Nov 2026, as the game's
// own report: Squirtle the partner, Pikachu in the locker, and a Pidgey and a
// Magikarp the clock took. Written twice - as it is, and without its line-up,
// which is the screen before a clock-out had one. See `clockLossShots.mjs`.
import { writeFileSync } from 'node:fs';
import { Bag } from '../../src/game/items';
import { PIKACHU, Pokemon, SPECIES_BY_ID, SQUIRTLE } from '../../src/game/pokemon';
import { RunManager } from '../../src/game/run/RunManager';
import { buildExtractionReport } from '../../src/game/run/extractionReport';
import { buildWipeSettlement } from '../../src/game/run/raidSettlement';

const squirtle = new Pokemon(SQUIRTLE, 9);
const pikachu = new Pokemon(PIKACHU, 9);
const party = [squirtle, pikachu, new Pokemon(SPECIES_BY_ID.pidgey, 6), new Pokemon(SPECIES_BY_ID.magikarp, 5)];
const items = [{ itemId: 'potion', quantity: 2 }];
const manager = new RunManager();
const secureSlot = { pokemon: [pikachu], partner: squirtle };
manager.startRun({ party, items }, { mapId: 'greystone-vale', durationMs: 300_000, secureGrid: { width: 4, height: 2 } }, secureSlot);
manager.tick(300_000);
const result = manager.resolveWipe(secureSlot);
const carriedOut = new Bag({ potion: 2 }).toJSON();
const wipe = buildWipeSettlement([], carriedOut);
const report = buildExtractionReport({
  outcome: 'WIPED', cause: 'timer', snapshot: manager.snapshot(), durationMs: 300_000,
  lost: { pokemon: result.lostPokemon, items: wipe.destroyedItems }, carriedOut, saved: true, fitToRaid: true,
});
writeFileSync(process.argv[2], JSON.stringify(report));
writeFileSync(process.argv[3], JSON.stringify({ ...report, fallen: undefined }));
console.log(report.headline, '|', report.fallen?.map((f) => f.name + (f.secured ? '+' : '-')).join(' '));
