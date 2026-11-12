import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ERRANDS } from '../hub/errands';
import { FOSSIL_KINDS } from '../hub/fossils';
import { KANTO_POKEDEX_SIZE, POKEDEX_MILESTONES } from '../hub/pokedex';
import { TICKET_PRIZES } from '../minigames/tickets';
import type { WildEncounterTable } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { GENERATED_SPECIES } from '../pokemon/generated/speciesCatalogue';
import { STARTER_SPECIES } from '../stash/Stash';
import { FISHING_WATER_SLOTS } from './generated/fishingWaters';
import { POKEMON_GIFTS } from './gifts';
import { floorHabitat, MAP_FILE_HABITATS, MAP_FILE_NIGHT_HABITATS, type MapFileHabitat } from './mapFile';
import { isMapOffered, retireMapsForTests, RETIRED_MAPS } from './mapRoster';
import { atNight, districtTableFor } from './nightRaids';
import { builtInFileMap } from './playerMaps';
import { SECRETS } from './secrets';

/**
 * Whether the whole Pokedex can be had, worked out from what the game holds
 * rather than typed: Oak pays his last milestone at all 151 kinds
 * (`hub/pokedex.ts`), and until 12 Nov 2026 nobody had asked whether a save
 * could ever get there. It could not - sixteen kinds lived, were fought and
 * were given nowhere on Greystone Vale, the one map in play, and two of
 * Eevee's three evolutions wanted Eevees nobody hands out.
 *
 * A kind can be had when a save can come to own it: met in the wild (by day or
 * by night, in grass, on a floor that rolls, or on a line), standing somewhere
 * at a level to be fought and caught, a legend, a secret's Pokemon met or
 * given, a gift, an errand's thanks, a prize, a fossil woken, a starter (the
 * PC swaps a save's last Pokemon for another starter, and the Pokedex keeps
 * every kind a save has owned) - or by raising one of those: a level or a
 * stone. A trade evolution never happens here (`pokemon/evolution.ts`), so a
 * kind only a trade makes has to be somewhere itself.
 *
 * `NOT_YET` is the list of what still cannot, and it is meant to shrink: a
 * change that puts one of them on the vale takes it off the list in the same
 * change, and one that strands a kind fails here by name.
 */

const VALE = 'greystone-vale';

/** How many of a kind a save can come to hold, as far as evolving two ways out of one goes. */
type Supply = 'one' | 'many';

/**
 * The kinds nobody can have yet, and why. Each is waiting on something the
 * game has to learn first, or on a place of its own.
 */
const NOT_YET: Readonly<Record<string, string>> = {
  ekans: 'lives nowhere on the vale',
  arbok: 'needs an Ekans',
  abra: 'knows only Teleport, which the engine cannot play, so it is in no table',
  kadabra: 'needs an Abra',
  alakazam: 'a trade evolution, and needs a Kadabra',
  hitmonlee: 'FireRed gives it at the Fighting Dojo; nobody here does',
  hitmonchan: 'FireRed gives it at the Fighting Dojo; nobody here does',
  ditto: 'knows only Transform, which the engine cannot play, so it is in no table',
  aerodactyl: 'the Old Amber goes to Bill’s cabinet, not to Oak’s machine',
  growlithe: 'three stand about the vale, and none at a level to be fought',
  arcanine: 'needs a Growlithe',
};

/**
 * Eevee's three: Bill gives one Eevee for the Old Amber and no more are to be
 * had, so a save can own one of these and never the other two.
 */
const ONE_EEVEE = ['vaporeon', 'jolteon', 'flareon'] as const;

describe('the whole Pokédex, on the one map in play', () => {
  const file = builtInFileMap(VALE)!;
  // Asked of the roster a player is offered: the suite runs with nothing
  // retired, and a kind that lives only on a map put away cannot be had.
  beforeEach(() => retireMapsForTests(RETIRED_MAPS));
  afterEach(() => retireMapsForTests([]));

  /** Every kind a save can come to own without evolving anything, and how. */
  const sources = (): Map<string, { how: string; supply: Supply }> => {
    const found = new Map<string, { how: string; supply: Supply }>();
    const add = (speciesId: string, how: string, supply: Supply = 'many') => {
      const held = found.get(speciesId);
      if (!held || (held.supply === 'one' && supply === 'many')) {
        found.set(speciesId, { how, supply });
      }
    };
    const table = (rolls: WildEncounterTable | undefined, how: string) => {
      for (const entry of rolls?.entries ?? []) add(entry.speciesId, how);
    };

    // The wild: every named place by day and by night, the map's own grass,
    // and every floor that rolls on each step (a cave, the hideout, the hall).
    for (const district of file.districts) {
      table(districtTableFor(district, false), `wild in ${district.name}`);
      table(districtTableFor(district, true), `wild in ${district.name} at night`);
    }
    table(file.encounters, 'wild in the vale');
    table(atNight(file.encounters), 'wild in the vale at night');
    for (const area of file.file.areas ?? []) {
      const habitat: MapFileHabitat | undefined = floorHabitat(area.kind, area.style);
      if (habitat === undefined) continue;
      table(MAP_FILE_HABITATS[habitat], `wild in ${area.name}`);
      table(MAP_FILE_NIGHT_HABITATS[habitat] ?? atNight(MAP_FILE_HABITATS[habitat]), `wild in ${area.name} at night`);
    }
    // The water, with either rod.
    for (const [water, rods] of Object.entries(FISHING_WATER_SLOTS)) {
      for (const slots of Object.values(rods)) {
        for (const slot of slots) add(slot.speciesId, `on a line in the ${water}`);
      }
    }
    // Standing somewhere at a level, to be fought and caught: a legend among
    // them. One with no level only says its name; a secret's is counted below.
    for (const standing of file.file.pokemon ?? []) {
      if (standing.level !== undefined && standing.secret === undefined) {
        add(standing.species, `standing at ${standing.x},${standing.y}`, standing.legendary ? 'one' : 'many');
      }
    }
    for (const secret of SECRETS) {
      for (const reward of secret.rewards) {
        if (reward.kind === 'meet') add(reward.speciesId, secret.name, 'one');
        if (reward.kind === 'gift') add(reward.gift.speciesId, secret.name, 'one');
      }
    }
    for (const gift of POKEMON_GIFTS.filter((one) => isMapOffered(one.mapId))) add(gift.speciesId, `the gift ${gift.id}`, 'one');
    for (const errand of ERRANDS.filter((one) => isMapOffered(one.mapId))) {
      for (const thanks of errand.reward.pokemon ?? []) add(thanks.speciesId, `${errand.name}'s thanks`, 'one');
    }
    for (const prize of TICKET_PRIZES) {
      if (prize.gives.kind === 'pokemon') add(prize.gives.speciesId, 'THE GAME CORNER’s prize window', prize.once ? 'one' : 'many');
    }
    for (const speciesId of Object.values(FOSSIL_KINDS)) add(speciesId, 'a fossil on Oak’s machine', 'one');
    for (const starter of STARTER_SPECIES) add(starter.id, 'a starter', 'many');
    return found;
  };

  /** Every kind a save can come to own: the sources, and whatever raising them makes. */
  const reach = (): Map<string, { how: string; supply: Supply }> => {
    const had = sources();
    for (let grown = true; grown; ) {
      grown = false;
      for (const rule of EVOLUTIONS) {
        const from = had.get(rule.from);
        if (!from || rule.trigger.kind === 'trade' || had.has(rule.to)) continue;
        had.set(rule.to, { how: `raised from ${rule.from}`, supply: from.supply });
        grown = true;
      }
    }
    return had;
  };

  /** The kinds a save can never own all of, because one Pokemon would have to be raised two ways. */
  const splitOverOne = (had: ReadonlyMap<string, { supply: Supply }>): string[] =>
    [...had.entries()]
      .filter(([, { supply }]) => supply === 'one')
      .flatMap(([speciesId]) => {
        const ways = EVOLUTIONS.filter((rule) => rule.from === speciesId && rule.trigger.kind !== 'trade').map((rule) => rule.to);
        return ways.length > 1 ? ways : [];
      });

  it('is asked of the roster a player is offered, where only the vale is in play', () => {
    expect(isMapOffered(VALE)).toBe(true);
    expect(POKEMON_GIFTS.filter((gift) => isMapOffered(gift.mapId))).toEqual([]);
  });

  it('can be had, all but the kinds listed as not yet', () => {
    const had = reach();
    const missing = GENERATED_SPECIES.filter((species) => !had.has(species.id)).map((species) => species.id);
    expect(missing.sort()).toEqual(Object.keys(NOT_YET).sort());
    expect(splitOverOne(had).sort()).toEqual([...ONE_EEVEE].sort());
  });

  it('holds what the third wave of secrets brought, each nowhere else', () => {
    const had = sources();
    expect(had.get('hypno')?.how).toBe('THE LOST PICNIC');
    expect(had.get('lickitung')?.how).toBe('THE STICKY TONGUE');
    expect(had.get('mr-mime')?.how).toBe('THE SILENT PICKET');
    expect(had.get('gengar')?.how).toBe('THE SHADOW IN THE CRYPT');
    expect(had.get('drowzee')?.how).toMatch(/^standing at /);
  });

  it('says how far Oak’s last milestone is from being paid', () => {
    const last = POKEDEX_MILESTONES.at(-1)!;
    expect(last.kinds).toBe(KANTO_POKEDEX_SIZE);
    expect(GENERATED_SPECIES).toHaveLength(KANTO_POKEDEX_SIZE);
    // Every kind not yet to be had, and all but one of each kind split over one Pokemon.
    const short = Object.keys(NOT_YET).length + (ONE_EEVEE.length - 1);
    expect(KANTO_POKEDEX_SIZE - short).toBe(138);
  });
});
