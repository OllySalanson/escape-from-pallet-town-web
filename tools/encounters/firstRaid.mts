/**
 * What the first raid costs a fresh save, printed.
 *
 *   npx vite-node tools/encounters/firstRaid.mts
 *   npx vite-node tools/encounters/firstRaid.mts -- --trials=400
 *
 * The first contract is the one raid every player plays at level 5, and it is
 * a chain of fights rather than one: the authored teaching Pidgey, then
 * whatever the reeds roll on the walk to the lost kit and on down the shore
 * road, then RAIDER MAYA at the narrows. `floodplainCheckpoint.test.ts` holds
 * Maya alone; this plays the chain, with what each fight leaves behind carried
 * into the next - HP, the Potions drunk and the experience earned, which at
 * these levels is a level by the second wild Pidgey.
 *
 * The player is played the way `trainerMeasure.ts` plays one, and every fight
 * goes through it: best damaging move every turn, no switching, no running,
 * and the pack's Potions drunk a turn at a time as the battle screen charges
 * them, whatever is left carried on to the next fight. The columns are how many
 * wild fights the walk rolled before Maya, and the first line says how many the
 * direct walk expects, read off the map. Maya is printed twice: as the first
 * contract meets her (`trainersForContract`) and as every later raid does.
 */
import { MINIMUM_SUPPLIES } from '../../src/game/stash/Stash';
import { Pokemon } from '../../src/game/pokemon';
import { experienceAwardForDefeat } from '../../src/game/pokemon/Pokemon';
import { getSpeciesById } from '../../src/game/pokemon/species';
import type { WildEncounterTable } from '../../src/game/pokemon/encounters';
import { createSeededRng } from '../../src/game/run/rng';
import { FIRST_CONTRACT, frontDoorFor } from '../../src/game/run/runGeneration';
import { districtAt, weatherAt } from '../../src/game/world/districts';
import { encounterTableAt } from '../../src/game/world/localEncounters';
import { TEACHING_ENCOUNTER } from '../../src/game/world/teachingEncounter';
import {
  createRunTrainerEncounters,
  trainersForContract,
  type RunTrainerEncounter,
} from '../../src/game/world/trainers';
import { playTrainerBattle } from '../../src/game/world/trainerMeasure';
import { WORLD_MAPS } from '../../src/game/worldMap';

const argument = (name: string, fallback: number): number =>
  Number(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const TRIALS = argument('trials', 400);

const map = WORLD_MAPS[FIRST_CONTRACT.mapId];
const findMaya = (trainers: readonly RunTrainerEncounter[]) =>
  trainers.find((encounter) => encounter.trainer.id === 'floodplain-checkpoint-maya')!;
// As the first contract meets her, and as every later raid does.
const maya = findMaya(trainersForContract(createRunTrainerEncounters(), FIRST_CONTRACT.id));
const mayaLater = findMaya(createRunTrainerEncounters());
const kit = FIRST_CONTRACT.markers[0].position;
const landing = frontDoorFor(FIRST_CONTRACT.mapId)!.position;

/** Breadth-first walk over the map's own collision, as a list of tiles. */
const walk = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const key = (x: number, y: number) => y * map.width + x;
  const previous = new Map<number, number>([[key(from.x, from.y), -1]]);
  const queue = [from];
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index];
    if (x === to.x && y === to.y) break;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (map.collision[ny][nx] || previous.has(key(nx, ny))) continue;
      previous.set(key(nx, ny), key(x, y));
      queue.push({ x: nx, y: ny });
    }
  }
  const tiles: { x: number; y: number }[] = [];
  for (let at = key(to.x, to.y); at !== -1; at = previous.get(at)!) {
    tiles.unshift({ x: at % map.width, y: Math.floor(at / map.width) });
  }
  return tiles;
};

// The walk the briefing describes: Landing to the kit, then down to the tile
// at the head of Maya's watch, where her sight would stop the walk anyway.
const watchHead = { x: maya.position.x, y: maya.position.y - (maya.sightRange ?? 0) };
const route = [...walk(landing, kit), ...walk(kit, watchHead).slice(1)];
const rolls = route.filter((tile) => map.tallGrass[tile.y][tile.x]);
const expected = rolls.reduce(
  (total, tile) => total + (encounterTableAt(map.id, tile, map.encounters)?.stepEncounterRate ?? 0),
  0,
);
const reeds = encounterTableAt(map.id, kit, map.encounters)!;

const pick = (table: WildEncounterTable, random: () => number): Pokemon => {
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  const entry = table.entries.find((candidate) => (roll -= candidate.weight) < 0) ?? table.entries[0];
  const level = entry.minLevel + Math.floor(random() * (entry.maxLevel - entry.minLevel + 1));
  return new Pokemon(getSpeciesById(entry.speciesId)!, level);
};

/**
 * One fight, played out by the repo's own harness and carried on: the HP it
 * left, the Potions it drank and, for a win, the experience. A wild Pokemon is
 * handed to the harness as a one-Pokemon side, which is the fight exactly as the
 * engine plays it - running is the one thing a wild fight adds, and nobody here
 * runs. False when the starter fell.
 */
const fight = (
  starter: Pokemon,
  foes: readonly Pokemon[],
  seed: number,
  pack: { potions: number },
  trainer = false,
): boolean => {
  const side = { id: 'measured', name: 'MEASURED', party: foes, defeatText: '', unitCount: 1 };
  const result = playTrainerBattle([starter], side, seed, weatherAt(map.id, kit), pack.potions);
  pack.potions -= result.potionsUsed;
  if (!result.won) return false;
  starter.currentHp = Math.max(1, Math.round(result.healthLeft * starter.maxHp));
  for (const foe of foes) {
    starter.gainExperience(experienceAwardForDefeat(foe, { trainer }), { evolve: false });
  }
  return true;
};

const firstRaid = (speciesId: string, wildFights: number, against: RunTrainerEncounter) => {
  const rng = createSeededRng(0xf1257);
  const random = () => rng.next();
  let beaten = 0;
  let reached = 0;
  let levels = 0;
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const starter = new Pokemon(getSpeciesById(speciesId)!, 5);
    const pack = { potions: MINIMUM_SUPPLIES.potion };
    const seed = 1000 + trial * 7919;
    const teacher = new Pokemon(getSpeciesById(TEACHING_ENCOUNTER.speciesId)!, TEACHING_ENCOUNTER.level);
    let standing = fight(starter, [teacher], seed, pack);
    for (let index = 0; standing && index < wildFights; index += 1) {
      standing = fight(starter, [pick(reeds, random)], seed + (index + 1) * 104_729, pack);
    }
    if (!standing) continue;
    reached += 1;
    levels += starter.level;
    // Maya fights in her own place's weather, off her own tile.
    const result = playTrainerBattle([starter], against.trainer, seed + 7, weatherAt(map.id, maya.position), pack.potions);
    if (result.won) beaten += 1;
  }
  return { beaten: beaten / TRIALS, reached: reached / TRIALS, level: reached > 0 ? levels / reached : 0 };
};

console.log(
  `First raid: Landing -> kit -> Maya is ${route.length - 1} steps, ${rolls.length} of them tall grass (${districtAt(map.id, kit)?.name} rolls ${reeds.stepEncounterRate}), so ${expected.toFixed(1)} wild fights expected before her.`,
);
const party = (encounter: RunTrainerEncounter) =>
  encounter.trainer.party.map((pokemon) => `${pokemon.base.name} ${pokemon.level}`).join(' + ');
console.log(`${MINIMUM_SUPPLIES.potion} Potions, ${TRIALS} trials a cell.`);
for (const [title, against] of [
  [`the first contract, where Maya fields ${party(maya)}`, maya],
  [`any later raid, where she fields ${party(mayaLater)}`, mayaLater],
] as const) {
  console.log(`\nBeat Maya on ${title}: after the teaching Pidgey and k reed fights\n(beat her, of those who reached her standing, at the mean level they reached her)`);
  console.log(['starter'.padEnd(12), ...[0, 1, 2, 3].map((k) => `k=${k}`.padStart(20))].join(''));
  for (const starter of ['bulbasaur', 'charmander', 'squirtle']) {
    const cells = [0, 1, 2, 3].map((k) => {
      const { beaten, reached, level } = firstRaid(starter, k, against);
      return `${Math.round(beaten * 100)}% of ${Math.round(reached * 100)}% L${level.toFixed(1)}`.padStart(20);
    });
    console.log(starter.padEnd(12) + cells.join(''));
  }
}
