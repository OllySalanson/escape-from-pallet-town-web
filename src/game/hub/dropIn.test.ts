import { describe, expect, it } from 'vitest';
import { buildDropInBriefing, gradeLine, placePicture, type DropInContext } from './dropIn';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { getWorldMap } from '../worldMap';
import { RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { HUNTER_TIERS } from '../world/hunter';
import { encodeSurvey } from '../world/survey';
import { districtAt, districtsForMap } from '../world/districts';

function contextFor(
  insertionId: RunInsertionId,
  over: Partial<DropInContext> = {},
): DropInContext {
  const defeatedBosses = over.defeatedBosses ?? [];
  return {
    map: getWorldMap(RUN_INSERTIONS[insertionId].mapId, defeatedBosses),
    defeatedBosses,
    completedContracts: [],
    raidRecord: undefined,
    surveyed: undefined,
    insertionIds: [insertionId],
    partyLevels: [],
    contract: undefined,
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
  const mapId = RUN_INSERTIONS[insertionId].mapId;
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
  it('grades a place on the hunter ladder rather than on a number typed in', () => {
    const briefing = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay'));

    expect(briefing.grade.rungs).toBe(HUNTER_TIERS.length);
    expect(briefing.grade.rung).toBeGreaterThanOrEqual(1);
    expect(briefing.grade.rung).toBeLessThanOrEqual(HUNTER_TIERS.length);
    // The grade is the highest level anything still standing here can field.
    expect(briefing.grade.opposition).toBe(
      Math.max(briefing.grade.wild.max, briefing.grade.trainer),
    );
  });

  it('drops a beaten boss out of what the place can field', () => {
    const before = buildDropInBriefing('town-square', contextFor('town-square'));
    const after = buildDropInBriefing(
      'town-square',
      contextFor('town-square', { defeatedBosses: ['pallet-mill-keeper'] }),
    );

    expect(before.grade.bossesHeld).toBe(1);
    expect(after.grade.bossesHeld).toBe(0);
    expect(after.grade.bossesBeaten).toBe(1);
    expect(after.grade.trainers).toBeLessThan(before.grade.trainers);
    expect(after.doors.every((door) => door.open)).toBe(true);
    expect(before.doors.every((door) => !door.open)).toBe(true);
  });

  /**
   * The grade is derived, so a retuned party moves it - which is the point, and
   * also the thing that can move without anyone noticing. Pinned as a
   * relationship rather than as numbers: what the ladder says about a map has
   * to keep answering to what is actually standing on it.
   */
  it('falls when a map is cleared, because what is left is what it can field', () => {
    const keepers = [
      'floodplain-toll-keeper',
      'floodplain-sluice-keeper',
      'floodplain-orchard-warden',
    ];
    const held = buildDropInBriefing('floodplain-relay', contextFor('floodplain-relay'));
    const cleared = buildDropInBriefing(
      'floodplain-relay',
      contextFor('floodplain-relay', { defeatedBosses: keepers }),
    );

    expect(cleared.grade.trainer).toBeLessThan(held.grade.trainer);
    expect(cleared.grade.rung).toBeLessThan(held.grade.rung);
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
