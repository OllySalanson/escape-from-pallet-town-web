import type { WildEncounterTable } from '../pokemon/encounters';

export type { WildEncounterEntry, WildEncounterTable } from '../pokemon/encounters';

export interface WildEncounter {
  speciesId: string;
  level: number;
}

export type EncounterRng = () => number;

export function rollEncounter(
  table: WildEncounterTable,
  rng: EncounterRng = Math.random,
): WildEncounter | null {
  if (table.stepEncounterRate <= 0 || rng() >= table.stepEncounterRate) {
    return null;
  }

  const entries = table.entries.filter(
    (entry) => entry.weight > 0 && entry.maxLevel >= entry.minLevel,
  );
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  let selection = rng() * totalWeight;
  const selected = entries.find((entry) => {
    selection -= entry.weight;
    return selection < 0;
  }) ?? entries[entries.length - 1];
  const levelRange = selected.maxLevel - selected.minLevel + 1;

  return {
    speciesId: selected.speciesId,
    level: selected.minLevel + Math.floor(rng() * levelRange),
  };
}
