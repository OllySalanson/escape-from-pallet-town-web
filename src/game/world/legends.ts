import type { GridPosition } from '../movement/gridMovement';
import { getSpeciesById } from '../pokemon/species';
import type { BuiltInMapId } from '../worldMap';
import type { WorldEntity } from './npcs';
import type { FigureSpeciesId } from './pokemonFigures';

/**
 * Kanto's four legends - Articuno, Zapdos, Moltres and Mewtwo - each standing
 * at the far end of a map, behind the keeper who holds that map's deepest door.
 *
 * **A legend is a boss you can keep.** It is fought as a wild Pokemon, at
 * FireRed's own level with the moves FireRed's own rule gives it at that level
 * (`Pokemon.initializeMoves`, the game's `GiveBoxMonInitialMoveset`), but no
 * ball can be thrown while it can still fight. Beat it and there is time for
 * one throw, and the throw is FireRed's catch (`catchOdds`) with nothing left of
 * its HP: catch rate 3, so a Poke Ball is about one in eighty and a sleeping or
 * frozen legend twice that. Miss, and it flees. That is the rarity: a
 * level-50 fight won for a roll most raids lose.
 *
 * **Once one is caught it never stands again on that save.** Caught means
 * *owned* - in the Pokedex, which registers a kind once a Pokemon of it has
 * been in the vault (`pokedexOwned`, written on every save) - so a legend caught
 * and then lost with the pack on a wipe is back at its post next raid, as a lost
 * gift is offered again (`gifts.ts`). Nothing is stored for it: whether a legend
 * stands is a pure function of the Pokedex, and within a raid a legend met once
 * is gone for the rest of it (`ActiveRunSession.pokemonMet`), beaten, caught or
 * fled from.
 *
 * Each stands on a dead-end tile of ground only its keeper's doors open, so it
 * never stands in anybody's way (`mapStructure.testkit.ts` holds every figure
 * to that), and where the place is the one FireRed put it in, as near as these
 * maps have: the ice bird on the sea beside Pallet's beacon (Seafoam Islands
 * lie south of Pallet), the storm bird on Route 1's Overlook, the fire bird on
 * the crag the burnt wood's ridge runs up to (Mt. Ember), and Mewtwo in the
 * Floodplain's vault, behind the hardest keeper in the game.
 *
 * **A map the game draws as a file may stand a legend too** - a placed Pokemon
 * marked `legendary` (`MapFilePokemon`), of one of `LEGENDARY_KINDS`, and only
 * on a built-in map (`BUILT_IN_MAP_FILE_LIMITS.maxLegends`; a player's map may
 * hold none). Greystone Vale's is Mew on Stormcrown's summit, the bottom of a
 * six-floor cave and a climb away from any landing: the place is its keeper.
 * It fights, is caught and stands again exactly as the four do, because
 * everything that decides that is read off the figure (`legendary`) and the
 * Pokedex (`legendCaught`), never off this list.
 */
export interface Legend {
  readonly speciesId: FigureSpeciesId;
  /** FireRed's own level for it. */
  readonly level: number;
  /** Where FireRed has it - the reason it stands where it does here. */
  readonly fireRedHome: string;
  readonly mapId: BuiltInMapId;
  readonly position: GridPosition;
  /** The keeper whose doors open the ground it stands on. */
  readonly behindBossId: string;
  /** What it says when walked up to: FireRed's own line for it. */
  readonly cry: string;
}

export const LEGENDS: readonly Legend[] = [
  {
    speciesId: 'articuno',
    level: 50,
    fireRedHome: 'Seafoam Islands B4F',
    mapId: 'pallet-town',
    position: { x: 55, y: 74 },
    behindBossId: 'pallet-salt-keeper',
    cry: 'Gyaoo!',
  },
  {
    speciesId: 'zapdos',
    level: 50,
    fireRedHome: 'Power Plant',
    mapId: 'route-1',
    position: { x: 36, y: 6 },
    behindBossId: 'overlook-warden',
    cry: 'Gyaoo!',
  },
  {
    speciesId: 'moltres',
    level: 50,
    fireRedHome: 'Mt. Ember summit',
    mapId: 'viridian-forest',
    position: { x: 53, y: 3 },
    behindBossId: 'forest-ridge-keeper',
    cry: 'Gyaoo!',
  },
  {
    speciesId: 'mewtwo',
    level: 70,
    fireRedHome: 'Cerulean Cave B1F',
    mapId: 'floodplain-relay',
    position: { x: 46, y: 53 },
    behindBossId: 'floodplain-orchard-warden',
    cry: 'Mew!',
  },
];

/** The id a legend stands in the world under. */
export const legendEntityId = (legend: Legend): string => `legend-${legend.speciesId}`;

/** The legend standing in the world as this entity, if it is one. */
export function legendStandingAs(entityId: string): Legend | undefined {
  return LEGENDS.find((legend) => legendEntityId(legend) === entityId);
}

/**
 * Every legend as a figure on its map: a Pokemon standing on its tile that
 * fights when spoken to, the way a map maker's placed Pokemon does.
 */
export const LEGEND_ENTITIES: readonly WorldEntity[] = LEGENDS.map((legend) => ({
  id: legendEntityId(legend),
  mapId: legend.mapId,
  kind: 'npc',
  position: legend.position,
  facing: 'down',
  dialogLines: [legend.cry],
  pokemon: legend.speciesId,
  wildLevel: legend.level,
  legendary: true,
}));

/**
 * The kinds that stand as legends: Kanto's four, and Mew, the one Pokemon of
 * the 151 none of the shipped maps has, which a map the game draws as a file
 * stands as its own legend (`MapFilePokemon.legendary`, Greystone Vale's
 * Stormcrown). A file may mark only these legendary, so "caught" can be read
 * off the Pokedex for every legend alike.
 */
export const LEGENDARY_KINDS: readonly FigureSpeciesId[] = [
  'articuno',
  'zapdos',
  'moltres',
  'mewtwo',
  'mew',
];

/** Whether a kind is one a legend may be. */
export function isLegendaryKind(species: string): boolean {
  return (LEGENDARY_KINDS as readonly string[]).includes(species);
}

/**
 * The legends this save has caught, by kind: every legendary kind the Pokedex
 * owns. A raid reads this once, as it deploys (`RunPlan.caughtLegends`), and a
 * figure marked `legendary` of one of these kinds does not stand
 * (`legendCaught`), whether a shipped map or a map file put it there.
 */
export function caughtLegends(pokedexOwned: readonly number[]): readonly FigureSpeciesId[] {
  return LEGENDARY_KINDS.filter((species) => {
    const dexId = getSpeciesById(species)?.dexId;
    return dexId !== undefined && pokedexOwned.includes(dexId);
  });
}

/** Whether a figure is a legend of a kind this save has caught: it stands nowhere this raid. */
export function legendCaught(
  entity: Pick<WorldEntity, 'legendary' | 'pokemon'>,
  caught: readonly string[],
): boolean {
  return entity.legendary === true && entity.pokemon !== undefined && caught.includes(entity.pokemon);
}

/** The refusal for a ball thrown while a legend can still fight. Nothing is spent. */
export const legendTooStrongLine = (name: string): string =>
  `${name.toUpperCase()} is too strong to catch while it can still fight!`;

/** The line that opens the one throw, once the legend is beaten. */
export const legendOneThrowLine = (name: string): string =>
  `${name.toUpperCase()} is too weak to get away! There is time for one throw.`;

/** What a missed throw ends with - FireRed's own words for a Pokemon that left. */
export const legendFledLine = (name: string): string => `Wild ${name.toUpperCase()} fled!`;
