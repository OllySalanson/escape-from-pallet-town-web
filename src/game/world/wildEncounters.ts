export interface WildEncounterEntry {
  speciesId: string;
  minLevel: number;
  maxLevel: number;
  weight: number;
}

export interface WildEncounterTable {
  stepEncounterRate: number;
  entries: readonly WildEncounterEntry[];
}

export interface WildEncounter {
  speciesId: string;
  level: number;
}

export type EncounterRng = () => number;

// PLACEHOLDER: the real table lives in src/game/pokemon/encounters.ts (data worker); wire it in once that lands.
export const DEFAULT_ENCOUNTERS: WildEncounterTable = {
  stepEncounterRate: 0.18,
  entries: [
    { speciesId: 'bulbasaur', minLevel: 2, maxLevel: 4, weight: 55 },
    { speciesId: 'squirtle', minLevel: 2, maxLevel: 4, weight: 35 },
    { speciesId: 'pikachu', minLevel: 3, maxLevel: 3, weight: 10 },
  ],
};

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
