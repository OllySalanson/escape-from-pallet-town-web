import { describe, expect, it } from 'vitest';
import {
  buildDropInBriefing,
  doorHolder,
  doorPromise,
  entryGround,
  gradeLine,
  shutDoorLine,
  stillToFind,
  PLACE_GRADE_LEVELS,
  placePicture,
  type DropInContext,
} from './dropIn';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { getWorldMap } from '../worldMap';
import { frontDoorFor, type RunInsertionId, requireInsertion } from '../run/runGeneration';
import { extractionPointsOn } from '../world/extractionPoints';
import { gatesForMap } from '../world/gates';
import { BUILT_IN_MAP_IDS, isMapInProgress } from '../worldMap';
import { encodeSurvey } from '../world/survey';
import { districtAt, districtsForMap } from '../world/districts';

function contextFor(
  insertionId: RunInsertionId,
  over: Partial<DropInContext> = {},
): DropInContext {
  const defeatedBosses = over.defeatedBosses ?? [];
  const openedGates = over.openedGates ?? [];
  return {
    map: getWorldMap(requireInsertion(insertionId).mapId, [...defeatedBosses, ...openedGates]),
    defeatedBosses,
    completedContracts: [],
    openedGates,
    raidRecord: undefined,
    surveyed: undefined,
    insertionIds: [insertionId],
    partyLevels: [],
    contract: undefined,
    night: false,
    ...over,
    // The map has to answer to the gate state, whatever else was overridden.
    ...(over.map ? { map: over.map } : {}),
  };
}

/**
 * Every tile that belongs to one district, as the survey stores them. Asked
 * through `districtAt` because districts overlap and the first listed wins, so
 * a rectangle is not the same thing as a place.
 */
function walked(insertionId: RunInsertionId, districtId: string): DropInContext['surveyed'] {
  const mapId = requireInsertion(insertionId).mapId;
  const map = getWorldMap(mapId);
  const tiles = new Set<number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (districtAt(mapId, { x, y })?.id === districtId) {
        tiles.add(y * map.width + x);
      }
    }
  }
  return { [mapId]: encodeSurvey(map.width, tiles) };
}

describe('what the drop-in screen says about a place', () => {
  it('grades a place on four rungs of level rather than on a number typed in', () => {
    const briefing = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay'));

    expect(briefing.grade.rungs).toBe(PLACE_GRADE_LEVELS.length);
    expect(briefing.grade.rung).toBeGreaterThanOrEqual(1);
    expect(briefing.grade.rung).toBeLessThanOrEqual(PLACE_GRADE_LEVELS.length);
    // The facts are the highest level anything still standing here can field;
    // the grade is read off the ground before the first door.
    expect(briefing.grade.opposition).toBe(
      Math.max(briefing.grade.wild.max, briefing.grade.trainer),
    );
    expect(briefing.grade.entry).toBe(entryGround('floodplain-relay').opposition);
    expect(briefing.grade.entry).toBeLessThanOrEqual(briefing.grade.opposition);
  });

  /**
   * Playtest 6, D3: graded on the whole map, the Floodplain - where every new
   * player starts - read a rung above Viridian City, a map it unlocks. Its far
   * reaches are behind three keepers, so the captain had a place graded only
   * on what a raid reaches from its front door before the first door.
   */
  it('grades the starting map no harder than any map it unlocks', () => {
    const start = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay')).grade;
    for (const mapId of BUILT_IN_MAP_IDS) {
      const door = frontDoorFor(mapId)!;
      const grade = buildDropInBriefing(door.id, contextFor(door.id)).grade;
      expect(start.rung, mapId).toBeLessThanOrEqual(grade.rung);
    }
  });

  it('grades a place before its first door, never on a keeper or what a keeper holds', () => {
    // A map still being drawn has no keeper and no door yet, so all of it is before the first.
    for (const mapId of BUILT_IN_MAP_IDS.filter((id) => !isMapInProgress(id))) {
      const door = frontDoorFor(mapId)!;
      const grade = buildDropInBriefing(door.id, contextFor(door.id)).grade;
      const ground = entryGround(mapId);
      // Something is met before the first door on every map, and it is a
      // share of what the map holds, not the whole of it.
      expect(ground.reached, mapId).toBeGreaterThan(0);
      expect(ground.reached, mapId).toBeLessThan(
        getWorldMap(mapId).collision.flat().filter((blocked) => !blocked).length,
      );
      expect(grade.entry, mapId).toBeGreaterThan(0);
      expect(grade.entry, mapId).toBeLessThanOrEqual(grade.opposition);
    }
    // The Floodplain's keepers field more than anything before their doors.
    const floodplain = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay')).grade;
    expect(floodplain.entry).toBeLessThan(floodplain.trainer);
  });

  it('drops a beaten boss out of what the place can field', () => {
    const before = buildDropInBriefing('town-square', contextFor('town-square'));
    const after = buildDropInBriefing(
      'town-square',
      contextFor('town-square', { defeatedBosses: ['pallet-mill-keeper'] }),
    );

    // Two keepers on this map now: the miller at the millpond and the salter
    // at the other end of the valley, so beating one leaves one standing.
    expect(before.grade.bossesHeld).toBe(2);
    expect(after.grade.bossesHeld).toBe(1);
    expect(after.grade.bossesBeaten).toBe(1);
    expect(after.grade.trainers).toBeLessThan(before.grade.trainers);
    expect(after.doors.filter((door) => door.open)).toHaveLength(2);
    expect(before.doors.every((door) => !door.open)).toBe(true);
  });

  /**
   * The grade is derived, so a retuned party moves it - which is the point, and
   * also the thing that can move without anyone noticing. Pinned as a
   * relationship rather than as numbers: what the ladder says about a map has
   * to keep answering to what is actually standing on it.
   */
  it('keeps its grade when a map is cleared, and its facts fall with the keepers', () => {
    const keepers = [
      'floodplain-toll-keeper',
      'floodplain-sluice-keeper',
      'floodplain-orchard-warden',
      'floodplain-quarry-foreman',
      'floodplain-sea-wall-keeper',
    ];
    const held = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay'));
    const cleared = buildDropInBriefing(
      'floodplain-relay',
      contextFor('floodplain-relay', { defeatedBosses: keepers }),
    );

    expect(cleared.grade.trainer).toBeLessThan(held.grade.trainer);
    // The grade is the ground before the first door, which a keeper never was.
    expect(cleared.grade.rung).toBe(held.grade.rung);
    expect(cleared.grade.entry).toBe(held.grade.entry);
    // The wildlife is untouched by a fight, so a cleared map is graded by its
    // ground and whoever is still standing on it - the checkpoint, not a boss.
    expect(cleared.grade.wild).toEqual(held.grade.wild);
    expect(cleared.grade.opposition).toBe(
      Math.max(cleared.grade.wild.max, cleared.grade.trainer),
    );
  });

  it('grades the forest above the three early maps on its ground alone', () => {
    const forest = buildDropInBriefing('viridian-forest', contextFor('viridian-forest')).grade;
    for (const id of ['floodplain-relay', 'town-square', 'route-1'] as const) {
      const early = buildDropInBriefing(id, contextFor(id)).grade;
      expect(forest.wild.min).toBeGreaterThan(early.wild.min);
      expect(forest.wild.max).toBeGreaterThan(early.wild.max);
    }
  });

  it('names every door with the keeper holding it', () => {
    const briefing = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay'));

    expect(briefing.doors.length).toBeGreaterThan(0);
    expect(briefing.doors.every((door) => door.bossName !== 'SOMEBODY')).toBe(true);
  });

  it('says a field-move door needs its move, never that the move holds it', () => {
    const shut = buildDropInBriefing('route-1', contextFor('route-1')).doors
      .find((door) => door.label === 'THORN GATE')!;
    expect(doorHolder(shut)).toBe('needs CUT');
    expect(shutDoorLine(shut)).toBe('THORN GATE needs CUT.');
    expect(doorPromise(shut)).toContain('a Pokémon that knows CUT');
    expect(doorPromise(shut)).not.toContain('Beat them');

    const opened = buildDropInBriefing('route-1', contextFor('route-1', { openedGates: ['route-1-thorn-gate'] })).doors
      .find((door) => door.label === 'THORN GATE')!;
    expect(doorPromise(opened)).toBe('THORN GATE stands open on every raid from now on, because you opened it with CUT.');

    // A keeper's door still says who holds it.
    const keeper = buildDropInBriefing('route-1', contextFor('route-1')).doors
      .find((door) => door.label === 'OVERLOOK GATE')!;
    expect(doorHolder(keeper)).toBe('held by WARDEN WREN');
    expect(shutDoorLine(keeper)).toBe('OVERLOOK GATE is held by WARDEN WREN.');
  });

  /**
   * Playtest 6, D2: a fresh save's map is dark, and the list beside it named
   * all twenty-one of the Floodplain's ways out and every door with its
   * keeper. The captain had it name only what has been found, and count the
   * rest.
   */
  it('names only the ways out and doors you have found, and counts the rest', () => {
    const fresh = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay'));
    expect(fresh.exits.length).toBeGreaterThan(1);
    expect(fresh.exits.every((exit) => !exit.known)).toBe(true);
    expect(fresh.doors.every((door) => !door.known)).toBe(true);

    // Walk onto one way out and one door, and exactly those two are found.
    const map = getWorldMap('floodplain-relay');
    const exit = extractionPointsOn('floodplain-relay')[0];
    const gate = gatesForMap('floodplain-relay')[0];
    const tiles = new Set([exit.position.y * map.width + exit.position.x, gate.tiles[0].y * map.width + gate.tiles[0].x]);
    const walkedTo = buildDropInBriefing(
      'floodplain-relay',
      contextFor('floodplain-relay', { surveyed: { 'floodplain-relay': encodeSurvey(map.width, tiles) } }),
    );
    expect(walkedTo.exits.filter((line) => line.known).map((line) => line.label)).toEqual([exit.label]);
    expect(walkedTo.doors.filter((line) => line.known).map((line) => line.label)).toEqual([gate.label]);

    // A door you opened is yours, walked to or not.
    const opened = buildDropInBriefing('route-1', contextFor('route-1', { openedGates: ['route-1-thorn-gate'] }));
    expect(opened.doors.filter((line) => line.known).map((line) => line.label)).toEqual(['THORN GATE']);
  });

  it('says how many are left to find, and only that', () => {
    expect(stillToFind(0, 3, 'way out')).toBe('');
    expect(stillToFind(17, 4, 'way out')).toBe('And 17 more to find.');
    expect(stillToFind(21, 0, 'way out')).toBe('21 ways out to find. Each is named here once you have walked to it.');
    expect(stillToFind(1, 0, 'door')).toBe('1 door to find. Each is named here once you have walked to it.');
  });

  it('names every way out and what opens it, in the map\'s own words', () => {
    const briefing = buildDropInBriefing('viridian-forest', contextFor('viridian-forest'));

    expect(briefing.exits.map((exit) => exit.label)).toContain('TOWER STEPS');
    expect(briefing.exits.find((exit) => exit.label === 'TOWER STEPS')?.opens).toBe(
      'ACTIVATE FIRE TOWER',
    );
  });

  it('tells you what lives only in the places you have walked', () => {
    const dark = buildDropInBriefing('viridian-forest', contextFor('viridian-forest'));
    expect(dark.wildlife.every((place) => !place.known)).toBe(true);

    const seen = buildDropInBriefing(
      'viridian-forest',
      contextFor('viridian-forest', { surveyed: walked('viridian-forest', 'forest-clearing') }),
    );
    const clearing = seen.wildlife.find((place) => place.place === 'THE CLEARING')!;
    expect(clearing.known).toBe(true);
    expect(clearing.species.length).toBeGreaterThan(0);
    // And nowhere else has given itself away.
    expect(seen.wildlife.filter((place) => place.known)).toHaveLength(1);
  });

  it('names what is out at night when a raid leaving now would be a night raid', () => {
    const wood = districtsForMap('pallet-town').find((district) => district.id === 'pallet-high-wood')!;
    const living = (night: boolean) => {
      const briefing = buildDropInBriefing(
        'town-square',
        contextFor('town-square', { surveyed: walked('town-square', wood.id), night }),
      );
      return {
        briefing,
        names: briefing.wildlife.find((place) => place.place === wood.name)!.species.map((entry) => entry.name),
      };
    };
    const day = living(false);
    const night = living(true);

    expect(day.briefing.night).toBe(false);
    expect(night.briefing.night).toBe(true);
    expect(day.names).toContain('Caterpie');
    expect(night.names).not.toContain('Caterpie');
    expect(night.names).toContain('Oddish');
    // Only the species: a slot keeps its levels, so the place keeps its grade.
    expect(night.briefing.grade).toEqual(day.briefing.grade);
  });

  it('counts the raids the record holds, and says nothing of a place never visited', () => {
    const none = buildDropInBriefing('route-1', contextFor('route-1'));
    expect(none.record).toMatchObject({ deployed: 0, extracted: 0, wiped: 0, districtsKnown: 0 });
    expect(none.record.surveyed).toBe(0);

    const some = buildDropInBriefing(
      'route-1',
      contextFor('route-1', { raidRecord: { 'route-1': { deployed: 5, extracted: 3, wiped: 2 } } }),
    );
    expect(some.record).toMatchObject({ deployed: 5, extracted: 3, wiped: 2 });
  });

  it('counts a district as found the moment one of its tiles has been walked', () => {
    const briefing = buildDropInBriefing(
      'town-square',
      contextFor('town-square', { surveyed: walked('town-square', 'pallet-market-square') }),
    );

    expect(briefing.record.districtsKnown).toBe(1);
    expect(briefing.record.districts).toBe(districtsForMap('pallet-town').length);
    expect(briefing.record.surveyed).toBeGreaterThan(0);
    expect(briefing.record.surveyed).toBeLessThan(1);
  });

  it('compares the place to the party rather than calling it hard', () => {
    const grade = buildDropInBriefing(
      'floodplain-relay',
      contextFor('floodplain-relay', { partyLevels: [5, 4] }),
    ).grade;

    expect(grade.yourBest).toBe(5);
    expect(gradeLine(grade)).toContain('Lv 5');
    expect(gradeLine({ ...grade, yourBest: 0 })).toContain('pick a party');
    expect(gradeLine({ ...grade, yourBest: 40 })).toContain('under your Lv 40');
  });
});

describe('the picture of a place', () => {
  it('lights every landing the player holds, and nothing else, on a fresh save', () => {
    const picture = placePicture(
      'floodplain-relay',
      contextFor('floodplain-relay', { insertionIds: DEFAULT_RAID_PROGRESS.unlockedInsertions as RunInsertionId[] }),
    );

    expect(picture.knownWalkable).toBeGreaterThan(0);
    // A fresh save has walked none of it: what is lit is a landing, not a map.
    expect(picture.knownWalkable).toBeLessThan(picture.walkable / 8);
    expect(picture.rows.join('')).toContain('i');
  });

  it('opens up the ground round a door the moment its keeper is beaten', () => {
    const shut = placePicture('town-square', contextFor('town-square'));
    const open = placePicture(
      'town-square',
      contextFor('town-square', { defeatedBosses: ['pallet-mill-keeper'] }),
    );

    // Beating a boss is the world getting bigger, and the record of it at base
    // has to show that: the door reads as yours and the ground round it is lit.
    expect(open.knownWalkable).toBeGreaterThan(shut.knownWalkable);
    expect(open.rows.join('')).toContain('O');
    expect(open.rows.join('')).not.toContain('H');
    // A door nobody has been to is not on the picture at all - the dark is the
    // whole point - so a shut one is drawn once its ground has been walked.
    expect(shut.rows.join('')).not.toContain('H');
    const found = placePicture(
      'town-square',
      contextFor('town-square', { surveyed: walked('town-square', 'pallet-far-bank') }),
    );
    expect(found.rows.join('')).toContain('H');
  });
});
