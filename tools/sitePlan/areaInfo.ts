/**
 * What a site plan says about each place on it, read off the game's own rules
 * rather than written down beside them: what its grass and floors roll and how
 * often, what changes at night, what a rod pulls out of its water, what may
 * glitter there, which legend flies for it, who and what stands in it, what its
 * caches pay, which finds only it holds and on what odds, the weather every
 * fight there is fought in, and what its floor does to a step.
 *
 * Everything here is asked of the same functions a raid asks (`districtAt`,
 * `stepRolls`, `districtTableFor`, `fishingTable`, `rarestOf`, the secrets'
 * own conditions), so the plan says what the game does. Nothing a raid rolls
 * afresh - which spots are laid, what is in an ordinary spot - is said as if it
 * were fixed: those are said as the rule they are.
 */
import type { WorldMapDefinition, WorldMapId } from '../../src/game/worldMap';
import type { GridPosition } from '../../src/game/movement/gridMovement';
import type { WildEncounterTable } from '../../src/game/pokemon/encounters';
import { districtAt, districtsForMap, type MapDistrict } from '../../src/game/world/districts';
import { stepRolls } from '../../src/game/world/localEncounters';
import { districtTableFor, forTheHour } from '../../src/game/world/nightRaids';
import {
  ROD_ITEM_IDS,
  fishingTable,
  fishingWaterAt,
  isFishingWater,
  type FishingWater,
} from '../../src/game/world/fishing';
import { hasShimmer, rarestOf, SHIMMER_SHINY_ODDS } from '../../src/game/world/shimmer';
import { hasOmens, OMEN_BIRDS, OMEN_ROOSTS, OMEN_EVERY } from '../../src/game/world/omens';
import { SECRETS, type SecretCondition, type SecretReward } from '../../src/game/world/secrets';
import { BUILT_IN_FILE_PRIZES, BUILT_IN_FILE_HOARDS } from '../../src/game/world/filePrizes';
import { MAP_FILE_PRIZES, type MapFile, type MapFileSpot } from '../../src/game/world/mapFile';
import { slides, spinsOn } from '../../src/game/world/slidingFloor';
import { switchesOn } from '../../src/game/world/switches';
import { FIELD_MOVES } from '../../src/game/world/fieldMoves';
import { gymOf } from '../../src/game/world/valeQuarters';
import { weatherCondition } from '../../src/game/pokemon/battle/weather';
import { getSpeciesById } from '../../src/game/pokemon/species';
import { getItemById, itemNameFor } from '../../src/game/items/items';
import type { PlacedArea } from '../../src/game/world/mapAreas';

/** One kind of Pokemon a place's ground or water gives, with its share of what comes up. */
export interface AreaWild {
  readonly species: string;
  readonly minLevel: number;
  readonly maxLevel: number;
  /** Its share of the table, 0 to 1. */
  readonly share: number;
}

/** What one stretch of rolling ground holds: a table, the place it belongs to, and how it rolls. */
export interface AreaGround {
  /** The places whose table it is, as the map names them, the most ground first. */
  readonly places: readonly string[];
  /** Tall grass, or every step of a floor (a cave, a hideout, the crater's ash). */
  readonly how: 'grass' | 'floor';
  /** The chance a step rolls, 0 to 1. */
  readonly rate: number;
  /** Tiles of it inside the area. */
  readonly tiles: number;
  readonly day: readonly AreaWild[];
  /** What it holds on a night raid, only where that is different. */
  readonly night?: readonly AreaWild[];
  /** What a shimmering patch here would hold, where a raid can lay one in this grass. */
  readonly shimmer?: { readonly species: readonly string[]; readonly level: number };
}

export interface AreaFishing {
  readonly water: FishingWater;
  readonly tiles: number;
  /** The places whose water it is, as the map names them, the most water first. */
  readonly places: readonly string[];
  readonly rods: readonly { readonly rod: string; readonly wild: readonly AreaWild[] }[];
}

export interface AreaStanding {
  readonly species: string;
  readonly level: number;
  readonly legendary: boolean;
  /** The secret it stands for, by name, and only while that secret is open. */
  readonly secret?: string;
}

export interface AreaSecret {
  readonly name: string;
  /** Every one of these, said plainly. */
  readonly when: readonly string[];
  /** What it gives, in order: the next is the first not yet found. */
  readonly rewards: readonly string[];
  /** Species it brings, for the filter. */
  readonly species: readonly string[];
}

export interface AreaInfo {
  readonly ground: readonly AreaGround[];
  readonly fishing: readonly AreaFishing[];
  readonly standing: readonly AreaStanding[];
  readonly secrets: readonly AreaSecret[];
  /** The legend that crosses the sky for this place, one raid in `OMEN_EVERY` while it is uncaught. */
  readonly omen?: string;
  readonly caches: readonly {
    readonly name: string;
    readonly pays: readonly string[];
    readonly locked: boolean;
  }[];
  /** Item spots, laid or not each raid. */
  readonly spots?: { readonly count: number; readonly hidden: number; readonly keys: number };
  /** Finds only this place holds, on their odds a raid. */
  readonly prizes: readonly { readonly item: string; readonly chance: number }[];
  /** What this place's own spots hold, in place of the rotation. */
  readonly hoard?: readonly string[];
  readonly berries: readonly { readonly berry: string; readonly count: number }[];
  readonly weather?: { readonly name: string; readonly lines: readonly string[] };
  /** What its floor or its things do that ordinary ground does not, a line each. */
  readonly mechanics: readonly string[];
}

/** What the plan says of a species: enough to draw and filter it. */
export interface PlanSpecies {
  readonly name: string;
  readonly dex: number;
  readonly types: readonly string[];
}

/** A place to describe: a feature of the plan, and the tiles of the map it covers. */
export interface AreaTarget {
  readonly id: string;
  /** Its name as the map's file names it (capitals for a district). */
  readonly name: string;
  /** Other names a secret, a prize or a legend may give it: the places inside a room, the caves' own. */
  readonly alsoNames?: readonly string[];
  readonly rects: readonly { x: number; y: number; width: number; height: number }[];
}

const titleWord = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A table as shares of kinds, a kind written on two rows counted once. */
export function sharesOf(table: WildEncounterTable): AreaWild[] {
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  const bySpecies = new Map<string, { min: number; max: number; weight: number }>();
  for (const entry of table.entries) {
    const known = bySpecies.get(entry.speciesId);
    bySpecies.set(entry.speciesId, {
      min: Math.min(known?.min ?? Infinity, entry.minLevel),
      max: Math.max(known?.max ?? -Infinity, entry.maxLevel),
      weight: (known?.weight ?? 0) + entry.weight,
    });
  }
  return [...bySpecies.entries()]
    .map(([species, { min, max, weight }]) => ({
      species,
      minLevel: min,
      maxLevel: max,
      share: total > 0 ? weight / total : 0,
    }))
    .sort((a, b) => b.share - a.share || a.species.localeCompare(b.species));
}

const sameKinds = (a: readonly AreaWild[], b: readonly AreaWild[]) =>
  a.length === b.length &&
  a.every((wild, index) => wild.species === b[index].species && wild.share === b[index].share);

const speciesName = (id: string) => getSpeciesById(id)?.name ?? titleWord(id);

/** A secret's condition as a sentence fragment a reader can act on. */
export function conditionWords(condition: SecretCondition): string {
  switch (condition.kind) {
    case 'hour':
      return condition.hour === 'night'
        ? 'a night raid (9pm to 5am on your clock)'
        : condition.hour === 'dusk'
          ? 'a raid at dusk (5 to 7 in the morning or 6 to 9 in the evening, on your clock)'
          : 'a raid by day (7am to 6pm on your clock)';
    case 'weekday':
      return `a raid on a ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][condition.day]}`;
    case 'lead-type':
      return `a ${condition.type} type leading the party`;
    case 'field-move':
      return `someone in the party who knows ${FIELD_MOVES[condition.move].label}`;
    case 'carried':
      return `${condition.items.map((item) => getItemById(item)?.displayName ?? item).join(' or ')} in the pack`;
    case 'whole-chart':
      return 'the treasure map whole on the Chart Room wall';
    case 'badge':
      return `${gymOf(condition.bossId)?.leader ?? 'its gym leader'} beaten before you set off`;
    case 'raid-clock':
      return `between ${seconds(condition.fromMs)} and ${seconds(condition.untilMs)} into the raid`;
    case 'alone':
      return 'only one Pokémon in the party';
    case 'lead-shiny':
      return 'a shiny leading the party';
    case 'stood-still':
      return `standing still for ${seconds(condition.forMs)}`;
    case 'dry-boots':
      return 'not one step in tall grass all raid';
    case 'either':
      return condition.of.map(conditionWords).join(', or ');
  }
}

function seconds(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s % 60 === 0) return s === 60 ? 'a minute' : `${s / 60} minutes`;
  return `${s} seconds`;
}

function rewardWords(reward: SecretReward): string {
  switch (reward.kind) {
    case 'item':
      return itemNameFor(reward.itemId, 1);
    case 'meet':
      return `${reward.shiny ? 'a shiny ' : 'a wild '}${speciesName(reward.speciesId)} at Lv ${reward.level}`;
    case 'gift':
      return `${speciesName(reward.gift.speciesId)} at Lv ${reward.gift.level}, given to you`;
  }
}

const rewardSpecies = (reward: SecretReward): string[] =>
  reward.kind === 'meet'
    ? [reward.speciesId]
    : reward.kind === 'gift'
      ? [reward.gift.speciesId]
      : [];

/** Everything the plan says about each of `targets`, and every species it names. */
export function buildAreaInfo(
  mapId: WorldMapId,
  map: WorldMapDefinition,
  file: MapFile | undefined,
  areas: readonly PlacedArea[],
  targets: readonly AreaTarget[],
  /** How a name written in the map's capitals is said on the plan. */
  say: (name: string) => string = (name) => name,
): { info: Record<string, AreaInfo>; species: Record<string, PlanSpecies> } {
  const districts = districtsForMap(mapId);
  const width = map.width;
  // One pass over every tile: whose table it rolls on, whether it rolls, what water it is.
  const districtIndex = new Map<MapDistrict, number>(districts.map((d, i) => [d, i]));
  const tileDistrict = new Int16Array(width * map.height).fill(-1);
  const tileRoll = new Uint8Array(width * map.height); // 0 none, 1 grass, 2 floor
  const tileFish = new Uint8Array(width * map.height); // 0 none, 1 fresh, 2 sea
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = { x, y };
      const i = y * width + x;
      const district = districtAt(mapId, tile);
      if (district) tileDistrict[i] = districtIndex.get(district) ?? -1;
      if (stepRolls(map, tile)) tileRoll[i] = map.tallGrass[y]?.[x] ? 1 : 2;
      if (isFishingWater(map, tile)) tileFish[i] = fishingWaterAt(mapId, tile) === 'sea' ? 2 : 1;
    }
  }

  const offsetOf = (spot: MapFileSpot): GridPosition => {
    if (!spot.area) return { x: spot.x, y: spot.y };
    const placed = areas.find((candidate) => candidate.id === spot.area);
    return placed
      ? { x: spot.x + placed.rect.x, y: spot.y + placed.rect.y }
      : { x: spot.x, y: spot.y };
  };
  const switches = switchesOn(mapId);
  const species: Record<string, PlanSpecies> = {};
  const note = (id: string) => {
    if (species[id]) return;
    const base = getSpeciesById(id);
    if (!base) return;
    species[id] = {
      name: base.name,
      dex: base.dexId,
      types: [base.primaryType, ...(base.secondaryType ? [base.secondaryType] : [])],
    };
  };
  const noteAll = (list: readonly AreaWild[]) => list.forEach((wild) => note(wild.species));

  const info: Record<string, AreaInfo> = {};
  for (const target of targets) {
    const within = (p: GridPosition) =>
      target.rects.some(
        (r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height,
      );
    // Count what its tiles roll, fish and do.
    const ground = new Map<number, { grass: number; floor: number }>();
    const fish = new Map<FishingWater, Map<number, number>>();
    let ice = 0;
    let spin = 0;
    const seen = new Set<number>();
    for (const r of target.rects) {
      for (let y = r.y; y < r.y + r.height; y += 1) {
        for (let x = r.x; x < r.x + r.width; x += 1) {
          const i = y * width + x;
          if (x < 0 || y < 0 || x >= width || y >= map.height || seen.has(i)) continue;
          seen.add(i);
          if (tileRoll[i]) {
            const entry = ground.get(tileDistrict[i]) ?? { grass: 0, floor: 0 };
            if (tileRoll[i] === 1) entry.grass += 1;
            else entry.floor += 1;
            ground.set(tileDistrict[i], entry);
          }
          if (tileFish[i]) {
            const water = tileFish[i] === 2 ? 'sea' : 'fresh';
            const byPlace = fish.get(water) ?? new Map<number, number>();
            byPlace.set(tileDistrict[i], (byPlace.get(tileDistrict[i]) ?? 0) + 1);
            fish.set(water, byPlace);
          }
          const material = map.terrain[y]?.[x];
          if (slides(material)) ice += 1;
          if (spinsOn(material)) spin += 1;
        }
      }
    }

    const grounds: (Omit<AreaGround, 'places' | 'tiles'> & {
      key: string;
      places: string[];
      tiles: number;
    })[] = [];
    for (const [index, count] of [...ground.entries()].sort(
      (a, b) => b[1].grass + b[1].floor - (a[1].grass + a[1].floor),
    )) {
      const district = index >= 0 ? districts[index] : undefined;
      const dayTable = (district && districtTableFor(district, false)) ?? map.encounters;
      const nightTable =
        (district && districtTableFor(district, true)) ??
        (map.encounters ? forTheHour(map.encounters, true) : undefined);
      if (!dayTable) continue;
      const day = sharesOf(dayTable);
      const night = nightTable ? sharesOf(nightTable) : day;
      noteAll(day);
      noteAll(night);
      const rare =
        count.grass > 0 && hasShimmer(mapId) ? rarestOf(dayTable, district?.encounters) : undefined;
      rare?.speciesIds.forEach(note);
      const next = {
        how: count.grass >= count.floor ? ('grass' as const) : ('floor' as const),
        rate: dayTable.stepEncounterRate,
        day,
        ...(sameKinds(day, night) ? {} : { night }),
        ...(rare ? { shimmer: { species: rare.speciesIds, level: rare.level } } : {}),
      };
      // Places that roll the very same table read as one list, naming each.
      const key = JSON.stringify(next);
      const same = grounds.find((each) => each.key === key);
      const place = district ? say(district.name) : 'the open map';
      if (same) {
        same.places.push(place);
        same.tiles += count.grass + count.floor;
      } else grounds.push({ ...next, key, places: [place], tiles: count.grass + count.floor });
    }

    const fishing: AreaFishing[] = [...fish.entries()].map(([water, byPlace]) => ({
      water,
      tiles: [...byPlace.values()].reduce((sum, n) => sum + n, 0),
      places: [...byPlace.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([index]) => (index >= 0 ? say(districts[index].name) : 'the open map')),
      rods: ROD_ITEM_IDS.map((rod) => {
        const wild = sharesOf(fishingTable(water, rod));
        noteAll(wild);
        return { rod: getItemById(rod)?.displayName ?? rod, wild };
      }),
    }));

    const standing: AreaStanding[] = [];
    for (const figure of file?.pokemon ?? []) {
      if (figure.level === undefined || !within(offsetOf(figure))) continue;
      note(figure.species);
      const secret = figure.secret ? SECRETS.find((s) => s.id === figure.secret) : undefined;
      standing.push({
        species: figure.species,
        level: figure.level,
        legendary: figure.legendary === true,
        ...(secret ? { secret: say(secret.name) } : {}),
      });
    }

    const names = new Set(
      [target.name, ...(target.alsoNames ?? [])].map((name) => name.toUpperCase()),
    );
    const isHere = (name: string) => names.has(name.toUpperCase());
    const secrets: AreaSecret[] = SECRETS.filter((secret) => isHere(secret.place)).map((secret) => {
      const brings = secret.rewards.flatMap(rewardSpecies);
      brings.forEach(note);
      return {
        name: say(secret.name),
        when: secret.when.map(conditionWords),
        rewards: secret.rewards.map(rewardWords),
        species: brings,
      };
    });

    const omenBird = hasOmens(mapId)
      ? OMEN_BIRDS.find((bird) => isHere(OMEN_ROOSTS[bird].district))
      : undefined;
    if (omenBird) note(omenBird);

    const caches = map.pois
      .filter((poi) => within(poi.position) && poi.reward.length > 0)
      .map((poi) => ({
        name: say(poi.label),
        pays: poi.reward.map((reward) =>
          reward.itemId === 'money'
            ? `₽${reward.quantity}`
            : `${reward.quantity > 1 ? reward.quantity + ' ' : ''}${itemNameFor(reward.itemId, reward.quantity)}`,
        ),
        locked: poi.locked === true,
      }));

    let count = 0;
    let hidden = 0;
    let keys = 0;
    const prizes: { item: string; chance: number }[] = [];
    for (const spot of file?.itemSpots ?? []) {
      if (!within(offsetOf(spot)) || spot.secret) continue;
      if (spot.prize) {
        prizes.push({ item: itemNameFor(spot.prize, 1), chance: MAP_FILE_PRIZES[spot.prize] });
        continue;
      }
      count += 1;
      if (spot.hidden) hidden += 1;
      if (spot.key) keys += 1;
    }
    for (const prize of BUILT_IN_FILE_PRIZES[mapId] ?? []) {
      if (isHere(prize.place))
        prizes.push({ item: itemNameFor(prize.itemId, prize.quantity), chance: prize.chance });
    }
    const hoard = (BUILT_IN_FILE_HOARDS[mapId] ?? []).find((h) => isHere(h.place));

    const berries = new Map<string, number>();
    for (const tree of file?.berryTrees ?? []) {
      if (!within(offsetOf(tree))) continue;
      const name =
        getItemById(`${tree.berry}-berry`)?.displayName ?? `${titleWord(tree.berry)} Berry`;
      berries.set(name, (berries.get(name) ?? 0) + 1);
    }

    const own = districts.find((district) => isHere(district.name));
    const weather = own?.weather ? weatherCondition(own.weather) : undefined;
    const mechanics: string[] = [];
    if (own?.floorRolls)
      mechanics.push('Every step here can meet a wild Pokémon, not only steps in tall grass.');
    if (ice > 0)
      mechanics.push(
        'Ice: a step on it slides on until something stops it. Only you slide; the hunter walks it.',
      );
    if (spin > 0)
      mechanics.push(
        'Spinner arrows: each turns you the way it points, until you land on a stop plate.',
      );
    const here = switches.filter((each) => within(each.position));
    const plates = here.filter((each) => each.kind === 'plate').length;
    const levers = here.length - plates;
    if (plates > 0)
      mechanics.push(
        `${plates} floor plate${plates > 1 ? 's' : ''}: push a Strength boulder onto each to open its rock barrier for the rest of the raid.`,
      );
    if (levers > 0)
      mechanics.push(
        `${levers} lever${levers > 1 ? 's' : ''}: face and work it to open its rock barrier for the rest of the raid.`,
      );
    const boulders = (file?.boulders ?? []).filter((boulder) => within(offsetOf(boulder))).length;
    if (boulders > 0)
      mechanics.push(`${boulders} Strength boulder${boulders > 1 ? 's' : ''} to push.`);

    info[target.id] = {
      ground: grounds.map(({ key: _key, ...ground }) => ground),
      fishing,
      standing,
      secrets,
      ...(omenBird ? { omen: omenBird } : {}),
      caches,
      ...(count > 0 ? { spots: { count, hidden, keys } } : {}),
      prizes,
      ...(hoard
        ? {
            hoard: hoard.contents.map((piece) =>
              piece.itemId === 'money'
                ? `₽${piece.quantity}`
                : itemNameFor(piece.itemId, piece.quantity),
            ),
          }
        : {}),
      berries: [...berries.entries()].map(([berry, n]) => ({ berry, count: n })),
      ...(weather
        ? {
            weather: {
              name: weather.label,
              lines: [
                ...Object.entries(weather.damage).map(
                  ([type, by]) =>
                    `${type} moves do ${by > 1 ? 'half as much again' : 'half'} damage.`,
                ),
                ...(weather.chipFraction > 0
                  ? [
                      `Every turn it takes a sixteenth of each Pokémon's HP${weather.sheltered.length ? `, but not from ${weather.sheltered.join(', ')} types` : ''}.`,
                    ]
                  : []),
              ],
            },
          }
        : {}),
      mechanics,
    };
  }
  return { info, species };
}

/** Rules that hold everywhere on the map, for the panel's legend. */
export { SHIMMER_SHINY_ODDS, OMEN_EVERY };
