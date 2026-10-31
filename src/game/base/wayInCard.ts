import { getSpeciesById } from '../pokemon/species';
import { runInsertion } from '../run/runGeneration';
import type { RaidProgress } from '../save/SaveManager';
import { districtAt } from '../world/districts';
import { districtTableFor } from '../world/nightRaids';
import { surveyedTiles } from '../world/survey';
import { getWorldMap, type WorldMapId } from '../worldMap';
import type { RimLanding } from './arenaRim';
import type { OverviewCard } from './valeOverviewView';

/** A place's own words, as far as the first comma or full stop: a card is small. */
const firstClause = (words: string): string => {
  const end = words.search(/[,.:;]/);
  return end < 0 ? words : words.slice(0, end);
};

/** How many kinds of wildlife a card names; anything past that is a count. */
const WILD_NAMED = 3;

/**
 * What the telescope says beside the way in under its cursor (`valeOverviewView.ts`):
 * its name, its own words, and what lives there if this save has walked it. Only what
 * tells one way in from another, and only what is known: nobody at base can say what
 * lives somewhere nobody has been, and nothing here says what this raid holds.
 */
export function wayInCard(
  landing: RimLanding,
  progress: Pick<RaidProgress, 'surveyed'>,
  night: boolean,
): OverviewCard {
  const insertion = runInsertion(landing.id);
  if (!insertion) {
    return { title: landing.id.toUpperCase(), lines: [] };
  }
  const mapId: WorldMapId = insertion.mapId;
  const map = getWorldMap(mapId);
  const walked = surveyedTiles(progress.surveyed?.[mapId], map.width).has(landing.tile.y * map.width + landing.tile.x);
  const lines = [`${firstClause(insertion.description)}.`];
  if (!walked) {
    lines.push('Not walked yet.');
  } else {
    const district = districtAt(mapId, landing.tile);
    const table = (district && districtTableFor(district, night)) ?? map.encounters;
    const kinds = [...(table?.entries ?? [])]
      .sort((a, b) => b.weight - a.weight)
      .map((entry) => getSpeciesById(entry.speciesId)?.name ?? entry.speciesId)
      .filter((name, index, all) => all.indexOf(name) === index);
    if (kinds.length > 0) {
      const named = kinds.slice(0, WILD_NAMED).join(', ');
      const rest = kinds.length - WILD_NAMED;
      lines.push(`${night ? 'By night' : 'Wild'}: ${named}${rest > 0 ? ` +${rest}` : ''}`);
    }
  }
  return { title: insertion.label.toUpperCase(), lines };
}

/** The same, remembered for one look through the glass: a card is asked for on every frame the cursor is on it. */
export function wayInCards(
  progress: Pick<RaidProgress, 'surveyed'>,
  night: boolean,
): (landing: RimLanding) => OverviewCard {
  const seen = new Map<string, OverviewCard>();
  return (landing) => {
    let card = seen.get(landing.id);
    if (!card) {
      card = wayInCard(landing, progress, night);
      seen.set(landing.id, card);
    }
    return card;
  };
}
