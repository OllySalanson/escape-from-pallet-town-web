import type { GridPosition } from '../movement/gridMovement';
import type { ExtractionReport } from '../run/extractionReport';

/**
 * What a raid brought home, stood on the quay beside the Seagallop the first time
 * the player is next out in the yard, when she ties up and sounds her horn.
 *
 * The result screen stays: it is the only place that can say what was secured,
 * what was at risk, what was spent and who levelled, and it says the same things
 * of a lost raid, where there is nothing to stand anywhere. Nor is the Arena's
 * homecoming touched: the rim, the crowd and the cloud lifting off what was walked
 * are what a raid comes home to. This is the one thing neither shows, which is
 * the haul as a pile of things.
 *
 * Nothing is stored. It is the boat's rule (`boatDueHome`): it lasts that one visit
 * to the yard and a reload forgets it, and the things are in the vault all along,
 * so these are only pictures and may be walked over, as ground loot is on a raid.
 */

/**
 * Stacked on the quay above her stern, beside the porter and his crates, then along
 * the row behind: clear of the Slowpoke and the sailor, who stand at the edge too.
 */
export const HAUL_SPOTS: readonly GridPosition[] = [
  ...[6, 5, 4, 3].map((x) => ({ x, y: 19 })),
  ...[6, 5, 4, 3, 7, 8, 9, 10].map((x) => ({ x, y: 18 })),
];

/** What stands for a Pokémon carried home. */
const CAUGHT_POKEMON_ICON = 'poke-ball';

/**
 * What to stand on the quay: an item a kind, then a Poké Ball a Pokémon. Only what
 * the raid itself brought out, because what a contract paid never rode the boat,
 * and nothing at all from a lost raid, whose ledger is what was lost.
 */
export function haulFromReport(report: Pick<ExtractionReport, 'outcome' | 'ledgerFound'>): readonly string[] {
  if (report.outcome !== 'ESCAPED') {
    return [];
  }
  return [...report.ledgerFound.items.map((item) => item.itemId), ...report.ledgerFound.pokemon.map(() => CAUGHT_POKEMON_ICON)];
}

/** Which of it stands where: as many as the quay has room for. */
export function haulLaidOut(haul: readonly string[]): readonly { readonly itemId: string; readonly at: GridPosition }[] {
  return haul.slice(0, HAUL_SPOTS.length).map((itemId, index) => ({ itemId, at: HAUL_SPOTS[index] }));
}

/** Short, because it has to find a seat on a busy quay beside a boat and a jetty. */
export const HAUL_CAPTION = 'YOUR HAUL\nFor the vault';

/** The sailor, while it is on the quay. */
export const HAUL_SAILOR_LINE = 'That’s your haul we’ve landed. It’s all going up to your vault.';
