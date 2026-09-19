/**
 * What a raid through each place meets, printed.
 *
 * Tall grass per district, then the table that district rolls on: the mean
 * level, the share above the level-5 partner, and the odds of each species.
 *
 *   npx vite-node tools/encounters/report.mts
 */
import { WORLD_MAPS } from '../../src/game/worldMap';
import { districtsForMap, districtAt } from '../../src/game/world/districts';

for (const map of Object.values(WORLD_MAPS)) {
  const counts = new Map<string, number>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!map.tallGrass[y][x]) continue;
      const name = districtAt(map.id, { x, y })?.id ?? '(none)';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  console.log(`\n${map.id} (${districtsForMap(map.id).length} districts)`);
  for (const [name, n] of counts) console.log(`  ${name.padEnd(28)} ${n} tall-grass tiles`);
}

import { measureTable } from '../../src/game/world/encounterMeasure';
import type { WildEncounterTable } from '../../src/game/pokemon/encounters';

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'];
/** The partner a map is met with: a fresh starter, and a trained one for the forest. */
const PARTNER_LEVEL: Record<string, number> = { 'viridian-forest': 8 };
const partnerLevel = (mapId: string): number => PARTNER_LEVEL[mapId] ?? 5;

const line = (name: string, table: WildEncounterTable, level: number): void => {
  const mix = table.entries
    .map((e) => `${e.speciesId} ${e.minLevel}${e.maxLevel > e.minLevel ? `-${e.maxLevel}` : ''} x${e.weight}`)
    .join(', ');
  const wins = STARTERS.map((s) => `${s.slice(0, 4)} ${(measureTable(table, s, level, 100).winRate * 100).toFixed(0)}%`).join('  ');
  const m = measureTable(table, 'bulbasaur', level, 100);
  console.log(
    `  ${name.padEnd(16)} rate ${table.stepEncounterRate.toFixed(2)} mean Lv ${m.meanLevel.toFixed(1)} above ${(m.aboveShare * 100).toFixed(0)}%  ${wins}`,
  );
  console.log(`      ${mix}`);
};

console.log('\nWhat each place rolls (win = one encounter, partner always uses its best move)');
for (const map of Object.values(WORLD_MAPS)) {
  const level = partnerLevel(map.id);
  console.log(`\n${map.id}, level-${level} partner`);
  if (map.encounters) line('(map fallback)', map.encounters, level);
  for (const district of districtsForMap(map.id)) {
    if (district.encounters) line(district.name, district.encounters, level);
  }
}
