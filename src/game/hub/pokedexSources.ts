import { BLACK_BELTS } from '../arena/classes';
import { getItemById } from '../items/items';
import { TICKET_PRIZES } from '../minigames/tickets';
import { EVOLUTIONS, type EvolutionTrigger } from '../pokemon/evolution';
import { getSpeciesById } from '../pokemon/species';
import { STARTER_SPECIES } from '../stash';
import { withArticle } from '../ui/article';
import { districtAt } from '../world/districts';
import {
  fishingTable,
  fishingWaterAt,
  isFishingWater,
  ROD_ITEM_IDS,
  type FishingWater,
  type RodItemId,
} from '../world/fishing';
import { POKEMON_GIFTS } from '../world/gifts';
import { stepRolls } from '../world/localEncounters';
import { isMapOffered } from '../world/mapRoster';
import { districtTableFor } from '../world/nightRaids';
import { entitiesForMap } from '../world/npcs';
import { SECRETS } from '../world/secrets';
import { CHEST_POKEMON, TREASURE_SECRET_ID } from '../treasure/treasureMap';
import { BUILT_IN_MAP_IDS, getWorldMap, worldMapName, type BuiltInMapId } from '../worldMap';
import type { WildEncounterTable } from '../pokemon/encounters';
import { ERRANDS } from './errands';
import { FOSSIL_KINDS, FOSSIL_MACHINE } from './fossils';
import { IN_GAME_TRADES, tradeEvolution, TRADER_NAME } from './trades';

/**
 * Where every kind of Pokémon comes from, asked of the game itself: the grass
 * and floors of each map a player is offered by day and by night, its fishing,
 * the Pokémon standing on it, its secrets, and everything at base that hands
 * one over - then evolution and THE TRADER's deals.
 *
 * Two readers. The Pokédex screen (`ui/pokedexView.ts`) prints a kind's
 * `sourcesOf` as the places it can be found, so the page can only ever name a
 * place the game's own data holds; and `pokedexComplete.test.ts` asks
 * `waysToOwn` for every one of the 151, so a map change that takes a kind's
 * last source away fails a test rather than leaving a page with nothing on it.
 *
 * It reads the authored tables, not a raid's: a raid varies each place's table
 * as it deploys (`RunPlan.districtEncounters`), which shifts weights and never
 * adds a kind.
 */
export type KindSource =
  /** Met on a step: tall grass, or a floor that rolls. `share` is its part of that place's table, 0 to 1. */
  | {
      readonly kind: 'wild';
      readonly mapId: BuiltInMapId;
      readonly place: string;
      readonly when: 'always' | 'day' | 'night';
      readonly share: number;
    }
  | { readonly kind: 'fishing'; readonly mapId: BuiltInMapId; readonly water: FishingWater; readonly rods: readonly RodItemId[] }
  /** A Pokémon standing on the map that fights when spoken to; a legend among them. */
  | { readonly kind: 'standing'; readonly mapId: BuiltInMapId; readonly place: string; readonly legendary: boolean }
  | { readonly kind: 'secret'; readonly secretId: string }
  | { readonly kind: 'fossil'; readonly itemId: string }
  | { readonly kind: 'gift'; readonly giftId: string; readonly mapId: BuiltInMapId; readonly place: string }
  | { readonly kind: 'prize' }
  | { readonly kind: 'errand'; readonly errandId: string; readonly giver: string }
  | { readonly kind: 'starter' }
  | { readonly kind: 'dojo'; readonly master: string }
  | { readonly kind: 'evolution'; readonly from: string; readonly trigger: EvolutionTrigger }
  | { readonly kind: 'trade'; readonly nickname: string; readonly wants: string };

/** The maps asked: the game's own that a player is offered (`world/mapRoster.ts`). */
function offeredMaps(): readonly BuiltInMapId[] {
  return BUILT_IN_MAP_IDS.filter((mapId) => isMapOffered(mapId));
}

interface RollingPlace {
  readonly name: string;
  readonly day: WildEncounterTable | undefined;
  readonly night: WildEncounterTable | undefined;
}

interface MapSurvey {
  /** Every place with a tile that rolls for wildlife, by the table it rolls on. */
  readonly places: readonly RollingPlace[];
  /** The waters a rod can be cast into here. */
  readonly waters: readonly FishingWater[];
}

/**
 * Which places of a map a step can meet anything in, and which waters it has:
 * every tile is asked once, because a place with a table and no grass holds
 * nothing and a table alone cannot say so. A map's ground is fixed for the
 * life of the page, so the walk is remembered by the map's own object - a
 * player's redrawn draft would be a new one.
 */
const surveys = new WeakMap<object, MapSurvey>();

function surveyOf(mapId: BuiltInMapId): MapSurvey {
  const map = getWorldMap(mapId);
  const known = surveys.get(map);
  if (known) {
    return known;
  }
  const places = new Map<string, RollingPlace>();
  const waters = new Set<FishingWater>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = { x, y };
      if (stepRolls(map, tile)) {
        const district = districtAt(mapId, tile);
        const own = district?.encounters !== undefined;
        const key = own ? `district:${district.id}` : `fallback:${district?.name ?? ''}`;
        if (!places.has(key)) {
          places.set(key, {
            name: district?.name ?? worldMapName(mapId).toUpperCase(),
            // A place with no table of its own rolls on the map's, by day and by night alike (`encounterTableAt`).
            day: own ? districtTableFor(district, false) : map.encounters,
            night: own ? districtTableFor(district, true) : map.encounters,
          });
        }
      }
      if (isFishingWater(map, tile)) {
        waters.add(fishingWaterAt(mapId, tile));
      }
    }
  }
  const survey = { places: [...places.values()], waters: [...waters] };
  surveys.set(map, survey);
  return survey;
}

/** A kind's part of a table, 0 when it is not on it. */
function shareOf(table: WildEncounterTable | undefined, speciesId: string): number {
  const total = table?.entries.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;
  const own = table?.entries.filter((entry) => entry.speciesId === speciesId).reduce((sum, entry) => sum + entry.weight, 0) ?? 0;
  return total > 0 ? own / total : 0;
}

const kindsOn = (table: WildEncounterTable | undefined): readonly string[] => [
  ...new Set(table?.entries.map((entry) => entry.speciesId) ?? []),
];

/**
 * Every way a raid or the base puts a kind in the vault without it having been
 * another kind first, each kind's ways in the order a page lists them: the
 * grass first, commonest place first, then the water, the ones standing, and
 * what is handed over. `withSecrets` false leaves the vale's secrets out
 * (`world/secrets.ts`), the Pokémon they stand on the map among them: a secret
 * is a second, rarer way to a kind, open only under its condition.
 */
export function directSources(withSecrets = true): ReadonlyMap<string, readonly KindSource[]> {
  const key = `${offeredMaps().join(',')}|${withSecrets}`;
  const known = directCache.get(key);
  if (known) {
    return known;
  }
  const from = new Map<string, KindSource[]>();
  const add = (speciesId: string, source: KindSource): void => {
    from.set(speciesId, [...(from.get(speciesId) ?? []), source]);
  };
  const maps = offeredMaps();
  for (const mapId of maps) {
    const wild: (KindSource & { kind: 'wild'; speciesId: string })[] = [];
    for (const place of surveyOf(mapId).places) {
      for (const speciesId of new Set([...kindsOn(place.day), ...kindsOn(place.night)])) {
        const day = shareOf(place.day, speciesId);
        const night = shareOf(place.night, speciesId);
        wild.push({
          kind: 'wild',
          speciesId,
          mapId,
          place: place.name,
          when: day > 0 && night > 0 ? 'always' : day > 0 ? 'day' : 'night',
          share: Math.max(day, night),
        });
      }
    }
    // By day before only by night, and within each the place it is commonest in first.
    const order = (source: { readonly when: string; readonly share: number }): number =>
      (source.when === 'night' ? 1 : 0) * 2 - source.share;
    for (const { speciesId, ...source } of [...wild].sort((a, b) => order(a) - order(b))) {
      add(speciesId, source);
    }
  }
  for (const mapId of maps) {
    for (const water of surveyOf(mapId).waters) {
      const rodsFor = new Map<string, RodItemId[]>();
      for (const rod of ROD_ITEM_IDS) {
        for (const speciesId of kindsOn(fishingTable(water, rod))) {
          rodsFor.set(speciesId, [...(rodsFor.get(speciesId) ?? []), rod]);
        }
      }
      for (const [speciesId, rods] of rodsFor) {
        add(speciesId, { kind: 'fishing', mapId, water, rods });
      }
    }
  }
  for (const mapId of maps) {
    for (const entity of entitiesForMap(mapId)) {
      // A secret's figure stands only while its secret is open: it is the secret's, below.
      if (entity.pokemon && entity.secret === undefined && (entity.wildLevel !== undefined || entity.legendary)) {
        add(entity.pokemon, {
          kind: 'standing',
          mapId,
          place: districtAt(mapId, entity.position)?.name ?? worldMapName(mapId).toUpperCase(),
          legendary: entity.legendary === true,
        });
      }
    }
  }
  for (const secret of withSecrets ? SECRETS : []) {
    for (const reward of secret.rewards) {
      if (reward.kind === 'meet') add(reward.speciesId, { kind: 'secret', secretId: secret.id });
      if (reward.kind === 'gift') add(reward.gift.speciesId, { kind: 'secret', secretId: secret.id });
    }
  }
  // The treasure map's chest (`treasure/treasureMap.ts`): the secret gives the
  // chest, and MARLOW opening it gives what is packed in it.
  if (withSecrets) add(CHEST_POKEMON.speciesId, { kind: 'secret', secretId: TREASURE_SECRET_ID });
  // A fossil is laid by a secret, or by an errand that goes on laying its
  // thing once it is done (Bill's amber, `errands.ts`).
  const fossilsFound = new Set<string>([
    ...(withSecrets ? SECRETS : []).flatMap((secret) =>
      secret.rewards.flatMap((reward) => (reward.kind === 'item' ? [reward.itemId] : [])),
    ),
    ...ERRANDS.filter((errand) => errand.afterwards && isMapOffered(errand.mapId)).map((errand) => errand.itemId),
  ]);
  for (const [itemId, speciesId] of Object.entries(FOSSIL_KINDS)) {
    if (fossilsFound.has(itemId)) add(speciesId, { kind: 'fossil', itemId });
  }
  for (const gift of POKEMON_GIFTS) {
    if (!isMapOffered(gift.mapId)) continue;
    const mapId = gift.mapId as BuiltInMapId;
    const giver = entitiesForMap(mapId).find((entity) => entity.id === gift.giverId);
    add(gift.speciesId, {
      kind: 'gift',
      giftId: gift.id,
      mapId,
      place: (giver ? districtAt(mapId, giver.position)?.name : undefined) ?? worldMapName(mapId).toUpperCase(),
    });
  }
  for (const prize of TICKET_PRIZES) {
    if (prize.gives.kind === 'pokemon') add(prize.gives.speciesId, { kind: 'prize' });
  }
  for (const errand of ERRANDS.filter((each) => isMapOffered(each.mapId))) {
    for (const pokemon of errand.reward.pokemon ?? []) {
      add(pokemon.speciesId, { kind: 'errand', errandId: errand.id, giver: errand.name });
    }
  }
  for (const starter of STARTER_SPECIES) add(starter.id, { kind: 'starter' });
  for (const head of BLACK_BELTS) {
    if (head.prize) add(head.prize, { kind: 'dojo', master: head.name });
  }
  directCache.set(key, from);
  return from;
}

const directCache = new Map<string, ReadonlyMap<string, readonly KindSource[]>>();

/**
 * Whether the walk has been done for the maps on offer, so asking where a kind
 * lives costs nothing. A screen that answers the cursor as it moves asks this
 * first (`ui/pokedexView.ts`'s card) and leaves the places out until it is.
 */
export function sourcesReady(): boolean {
  return directCache.has(`${offeredMaps().join(',')}|true`);
}

/** Whether a rule can be walked: a trade line only where THE TRADER's trade and back does it. */
const ruleReached = (rule: (typeof EVOLUTIONS)[number]): boolean =>
  rule.trigger.kind !== 'trade' || tradeEvolution(rule.from)?.id === rule.to;

/**
 * One way to own every kind that can be owned, closed over evolution - a
 * level, a stone (Bill barters every stone, and Oak hands a set out at 50 and
 * 125 kinds) or THE TRADER's trade and back - and over his trades, each for a
 * kind already in reach, until nothing more is. A kind with a way of its own
 * keeps it; evolution and a trade are named only for a kind with no other.
 */
export function waysToOwn(withSecrets = true): ReadonlyMap<string, KindSource> {
  const from = new Map<string, KindSource>();
  for (const [speciesId, sources] of directSources(withSecrets)) {
    from.set(speciesId, sources[0]);
  }
  for (let grew = true; grew; ) {
    grew = false;
    for (const rule of EVOLUTIONS) {
      if (from.has(rule.from) && !from.has(rule.to) && ruleReached(rule)) {
        from.set(rule.to, { kind: 'evolution', from: rule.from, trigger: rule.trigger });
        grew = true;
      }
    }
    for (const trade of IN_GAME_TRADES) {
      if (from.has(trade.wants) && !from.has(trade.gives)) {
        from.set(trade.gives, { kind: 'trade', nickname: trade.nickname, wants: trade.wants });
        grew = true;
      }
    }
  }
  return from;
}

/**
 * Everywhere one kind comes from, for its page in the Pokédex: its own ways,
 * then what it evolves from and what THE TRADER takes for one - each only if
 * the kind it starts from can itself be had.
 */
export function sourcesOf(speciesId: string): readonly KindSource[] {
  const reach = waysToOwn();
  return [
    ...(directSources().get(speciesId) ?? []),
    ...EVOLUTIONS.filter((rule) => rule.to === speciesId && ruleReached(rule) && reach.has(rule.from)).map(
      (rule): KindSource => ({ kind: 'evolution', from: rule.from, trigger: rule.trigger }),
    ),
    ...IN_GAME_TRADES.filter((trade) => trade.gives === speciesId && reach.has(trade.wants)).map(
      (trade): KindSource => ({ kind: 'trade', nickname: trade.nickname, wants: trade.wants }),
    ),
  ];
}

/** How many places a line of the page names before it counts the rest. */
export const PLACES_NAMED = 3;

const kindName = (speciesId: string): string => (getSpeciesById(speciesId)?.name ?? speciesId).toUpperCase();
const itemName = (itemId: string): string => getItemById(itemId)?.displayName ?? itemId;

/** "A, B and C", and past `PLACES_NAMED` "A, B, C and 4 more places". */
function placeList(places: readonly string[]): string {
  const named = places.slice(0, PLACES_NAMED);
  const more = places.length - named.length;
  const tail = more > 0 ? [`${more} more place${more === 1 ? '' : 's'}`] : [];
  const all = [...named, ...tail];
  return all.length <= 1 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}

function evolutionWords(from: string, trigger: EvolutionTrigger): string {
  switch (trigger.kind) {
    case 'level':
      return `Evolves from ${kindName(from)} at Lv ${trigger.level}`;
    case 'stone':
      return `Evolves from ${kindName(from)} with ${withArticle(itemName(trigger.itemId))}`;
    case 'trade':
      return `Evolves from ${kindName(from)}, traded to the ${TRADER_NAME} and back`;
  }
}

const WATER_WORDS: Readonly<Record<FishingWater, string>> = {
  sea: 'the sea',
  fresh: 'rivers and ponds',
};

/**
 * A kind's sources as the lines its page prints, in the order `sourcesOf`
 * lists them. The places a kind is wild in are gathered into one line a time
 * of day - commonest first, `PLACES_NAMED` of them named and the rest counted -
 * because a Pidgey is in forty places and a page is not a gazetteer.
 */
export function sourceLines(sources: readonly KindSource[]): readonly string[] {
  const lines: string[] = [];
  const wild = sources.filter((source): source is KindSource & { kind: 'wild' } => source.kind === 'wild');
  const places = (when: readonly string[]): string[] => [
    ...new Set(wild.filter((source) => when.includes(source.when)).map((source) => source.place)),
  ];
  const anyTime = places(['always']);
  const byDay = places(['day']).filter((place) => !anyTime.includes(place));
  const atNight = places(['night']).filter((place) => !anyTime.includes(place));
  if (anyTime.length > 0) lines.push(`Wild in ${placeList(anyTime)}`);
  if (byDay.length > 0) lines.push(`Wild by day in ${placeList(byDay)}`);
  if (atNight.length > 0) lines.push(`Wild at night in ${placeList(atNight)}`);
  for (const source of sources) {
    switch (source.kind) {
      case 'wild':
        break;
      case 'fishing':
        lines.push(
          `Fished from ${WATER_WORDS[source.water]} with ${
            source.rods.length === ROD_ITEM_IDS.length ? 'any rod' : withArticle(itemName(source.rods[0]))
          }`,
        );
        break;
      case 'standing':
        lines.push(source.legendary ? `A legend, standing in ${source.place}` : `One stands in ${source.place}`);
        break;
      case 'secret':
        lines.push('One of the vale’s secrets');
        break;
      case 'fossil':
        lines.push(`Woken from ${withArticle(itemName(source.itemId))} on the ${FOSSIL_MACHINE}`);
        break;
      case 'gift':
        lines.push(`Handed over in ${source.place}`);
        break;
      case 'prize':
        lines.push('A prize at THE GAME CORNER');
        break;
      case 'errand':
        lines.push(`For a favour done for ${source.giver}`);
        break;
      case 'starter':
        lines.push('One of the three on Professor Oak’s table');
        break;
      case 'dojo':
        lines.push(`${source.master}’s prize at THE BATTLE ARENA`);
        break;
      case 'evolution':
        lines.push(evolutionWords(source.from, source.trigger));
        break;
      case 'trade':
        lines.push(`The ${TRADER_NAME} gives one for ${withArticle(kindName(source.wants))}`);
        break;
    }
  }
  return [...new Set(lines)];
}
