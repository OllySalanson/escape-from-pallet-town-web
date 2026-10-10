import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { playtestRaidProgress, withEverythingCurrent } from '../dev/playtestSave';
import {
  availableInsertionIds,
  generateRunPlan,
  insertionsOn,
  requireInsertion,
  runInsertion,
} from '../run/runGeneration';
import {
  getWorldMap,
  isWorldMapId,
  WORLD_MAPS,
  worldMapIds,
  worldMapMaker,
  worldMapName,
} from '../worldMap';
import { extractionPointsOn } from './extractionPoints';
import { districtAt } from './districts';
import { districtEncounterTables } from './localEncounters';
import {
  buildPlayerMap,
  freeMapFileId,
  MAP_FILE_TRAINER_TEAMS,
  plainText,
  readMapFile,
  RESERVED_MAP_FILE_IDS,
  trainerTemplate,
  type MapFile,
} from './mapFile';
import { trainersOn } from './mapTrainers';
import { entitiesForMap } from './npcs';
import { poisForMap } from './pois';
import { checkMapFile, type MapCheckId } from './mapFileChecks';
import {
  isPublishedMap,
  loadBundledMaps,
  playerMapProblems,
  playerMaps,
  registerPlayerMap,
  unregisterPlayerMap,
} from './playerMaps';
import { TRY_IT_MAP_ID } from '../maker/tryIt';
import { PUBLISHED_FIXTURE_MAP_ID } from './publishedMapFixture.testkit';

const SAMPLE = sampleLane as MapFile;

/** The sample with some of it changed, as a maker's next save would be. */
const edited = (changes: Partial<Record<keyof MapFile, unknown>>): Record<string, unknown> => ({
  ...SAMPLE,
  ...changes,
});

const problemsOf = (value: unknown): readonly string[] => {
  const reading = readMapFile(value);
  return reading.ok ? [] : reading.problems;
};

const failing = (value: unknown): readonly MapCheckId[] =>
  checkMapFile(value)
    .filter((check) => !check.passed)
    .map((check) => check.id);

/** A row of the sample with one tile written over. */
const withTile = (x: number, y: number, letter: string): string[] =>
  SAMPLE.ground.map((row, rowY) =>
    rowY === y ? `${row.slice(0, x)}${letter}${row.slice(x + 1)}` : row,
  );

describe('reading a map file', () => {
  it('reads the sample', () => {
    expect(problemsOf(SAMPLE)).toEqual([]);
  });

  it('refuses a file from a format it does not know, and says which', () => {
    expect(problemsOf(edited({ format: 2 }))).toEqual([
      'The file is format 2; this game reads format 1.',
    ]);
    expect(problemsOf('a map')).toEqual(['The file is not a map.']);
  });

  it('refuses a map too small or too large, and ground that does not match its size', () => {
    expect(problemsOf(edited({ width: 8 }))).toContain('A map is 20x16 to 128x128 tiles.');
    expect(problemsOf(edited({ height: 400 }))).toContain('A map is 20x16 to 128x128 tiles.');
    expect(problemsOf(edited({ ground: SAMPLE.ground.slice(1) }))).toContain(
      "'ground' has 23 rows; the map is 24 tall.",
    );
    expect(problemsOf(edited({ ground: withTile(4, 4, '..') }))).toContain(
      'Ground row 4 is 33 letters; the map is 32 wide.',
    );
  });

  it('refuses a letter, a building or a habitat the game cannot draw', () => {
    expect(problemsOf(edited({ ground: withTile(4, 4, 'Z') }))).toContain(
      'Ground row 4 uses letters the game does not draw: Z',
    );
    expect(problemsOf(edited({ buildings: [{ x: 1, y: 1, kind: 'castle' }] }))).toContain(
      'Building 1 is not a building the game has: castle.',
    );
    expect(problemsOf(edited({ wildlife: 'volcano' }))[0]).toMatch(
      /^'wildlife' must be one of: meadow/,
    );
  });

  // Playtest 23 C1: a gym planted at 28,10 on a 30-wide map passed this check,
  // then threw out of the layer builder in `checkMapFile`, which bricked the
  // map maker for its maker, a reviewer and every publish run.
  it('refuses a building that hangs off the edge, as a draft too', () => {
    const offEdge = edited({ buildings: [{ x: SAMPLE.width - 2, y: 2, kind: 'gym' }] });
    expect(problemsOf(offEdge)).toContain('Building 1 runs off the edge of the map.');
    expect(readMapFile(offEdge, { draft: true }).ok).toBe(false);
    expect(() => checkMapFile(offEdge)).not.toThrow();
    expect(failing(offEdge)).toContain('loads');
  });

  it('refuses a map with no way in or no way out', () => {
    expect(problemsOf(edited({ dropIns: [] }))).toContain('A map needs at least 1 drop-in.');
    expect(problemsOf(edited({ exits: [] }))).toContain('A map needs at least 1 exit.');
  });

  it('refuses two places with one name, a place off the map, and an exit that never opens', () => {
    expect(
      problemsOf(
        edited({ exits: [...SAMPLE.exits, { ...SAMPLE.exits[0], x: 17, name: 'north stile' }] }),
      ),
    ).toContain("Two exits are called 'north stile'.");
    expect(problemsOf(edited({ itemSpots: [{ x: 40, y: 2 }] }))).toContain(
      'itemSpots 1 is not on the map.',
    );
    expect(
      problemsOf(
        edited({ exits: [{ ...SAMPLE.exits[0], opens: { when: 'after', seconds: 900 } }] }),
      ),
    ).toContain("Exit 'North Stile' must open always, or after 1 to 240 seconds.");
  });

  it('only takes an id that can be part of another id', () => {
    expect(problemsOf(edited({ id: 'Sample Lane' }))).toContain(
      "'id' may only hold lower-case letters, digits and single dashes.",
    );
  });
});

describe('whether a map works', () => {
  it('passes the sample on every check', () => {
    expect(checkMapFile(SAMPLE).filter((check) => !check.passed)).toEqual([]);
  });

  it('fails a map that does not load on every check, and says why only once', () => {
    const checks = checkMapFile(edited({ format: 9 }));
    expect(checks.every((check) => !check.passed)).toBe(true);
    expect(checks.flatMap((check) => check.problems)).toEqual([
      'The file is format 9; this game reads format 1.',
    ]);
  });

  it('fails a drop-in or an item spot standing on something solid', () => {
    const inTheTrees = edited({ dropIns: [{ ...SAMPLE.dropIns[0], x: 0, y: 23 }] });
    expect(failing(inTheTrees)).toContain('standing');
    expect(checkMapFile(inTheTrees).find((check) => check.id === 'standing')?.problems).toEqual([
      'Drop-in South Road at 0,23 is on something solid.',
    ]);
  });

  it('fails two things on one tile', () => {
    const shared = edited({ itemSpots: [{ x: SAMPLE.exits[0].x, y: SAMPLE.exits[0].y }] });
    expect(failing(shared)).toEqual(['apart']);
  });

  it('fails a drop-in walled in with no way out, and an exit nobody can walk to', () => {
    // A ring of rock round the pond-side drop-in.
    const ground = [
      [2, 11],
      [3, 11],
      [4, 11],
      [2, 12],
      [4, 12],
    ].reduce<string[]>(
      (rows, [x, y]) =>
        rows.map((row, rowY) => (rowY === y ? `${row.slice(0, x)}C${row.slice(x + 1)}` : row)),
      [...SAMPLE.ground],
    );
    // The ledge under it is already solid, so the drop-in is shut in.
    expect(failing(edited({ ground }))).toEqual(['way-out', 'hunter-room']);
    expect(failing(edited({ ground, dropIns: [SAMPLE.dropIns[1]] }))).toEqual([
      'way-out',
      'reachable',
      'hunter-room',
    ]);
  });

  it('counts an exit that opens late as a way out, so long as it opens inside the clock', () => {
    const slow = edited({
      exits: [{ ...SAMPLE.exits[0], opens: { when: 'after', seconds: 240 } }],
    });
    expect(failing(slow)).toEqual([]);
  });

  it('does not count a walk across one exit as a walk to anything beyond it', () => {
    // Two exits side by side across the north gap, and something to find
    // behind them: an open exit takes whoever steps on it, so nobody reaches it.
    const behind = edited({
      exits: [
        { x: 16, y: 1, name: 'North Stile', opens: { when: 'always' } },
        { x: 17, y: 1, name: 'North Gap', opens: { when: 'always' } },
      ],
      itemSpots: [{ x: 16, y: 0 }],
    });
    expect(checkMapFile(behind).find((check) => check.id === 'reachable')?.problems).toEqual([
      'Item spot 1 at 16,0 cannot be walked to from any drop-in.',
    ]);
  });
});

describe('a map from a file is a map like any other', () => {
  const sample = playerMaps().find((map) => map.file.id === 'sample-lane')!;

  it('is in the list of maps after the shipped five', () => {
    expect(sample.id).toBe('player-sample-lane');
    expect(worldMapIds().slice(0, 5)).toEqual(Object.keys(WORLD_MAPS));
    expect(worldMapIds()).toContain(sample.id);
    expect(isWorldMapId(sample.id)).toBe(true);
    expect(isWorldMapId('player-nowhere')).toBe(false);
    expect(worldMapName(sample.id)).toBe('Sample Lane');
    expect(worldMapMaker(sample.id)).toBe('Escape from Pallet Town');
    expect(worldMapMaker('route-1')).toBeUndefined();
  });

  it('is drawn on the Kanto sheets, plus the base and Overworld objects, at the size its file says', () => {
    const map = getWorldMap(sample.id);
    expect([map.width, map.height]).toEqual([32, 24]);
    expect(map.tileset.sources.map((source) => source.imagePath)).toEqual([
      ...WORLD_MAPS['viridian-city'].tileset.sources.map((source) => source.imagePath),
      'assets/Overworld.png',
      'assets/frlg-base.png',
    ]);
    // Tall grass is the file's `g`, so it costs encounters exactly where it is drawn.
    expect(map.tallGrass[4][6]).toBe(true);
    expect(map.tallGrass[2][4]).toBe(false);
    expect(map.encounters).toBeDefined();
  });

  it('lands where its drop-ins are and leaves where its exits are', () => {
    expect(insertionsOn(sample.id).map((insertion) => insertion.id)).toEqual([
      'player-sample-lane/south-road',
      'player-sample-lane/pond-side',
    ]);
    expect(runInsertion('player-sample-lane/pond-side')?.position).toEqual({ x: 3, y: 12 });
    expect(runInsertion('player-sample-lane/nowhere')).toBeUndefined();
    // The front door is named for the map, as every shipped one is.
    expect(insertionsOn(sample.id).map((insertion) => insertion.label)).toEqual([
      'Sample Lane',
      'Pond Side',
    ]);
    expect(requireInsertion('player-sample-lane/south-road').description).toBe(
      'South Road. The bottom of the lane, where the sand road comes in from the south. Drawn by Escape from Pallet Town.',
    );
    expect(extractionPointsOn(sample.id).map((point) => [point.label, point.requirement])).toEqual([
      ['NORTH STILE', { kind: 'always' }],
      ['EAST GAP', { kind: 'elapsed', unlockAtMs: 60_000 }],
    ]);
  });

  it('deploys: a raid starts on it, with its loot laid on it and a way out open', () => {
    for (const seed of [1, 2, 3, 42, 9_999]) {
      const plan = generateRunPlan(seed, undefined, 'player-sample-lane/south-road');
      expect(plan.insertion.mapId).toBe(sample.id);
      expect(plan.encounters[sample.id]).toBeDefined();
      const loot = plan.loot[sample.id];
      expect(loot.length).toBeGreaterThanOrEqual(Math.ceil(sample.loot.length / 2));
      const map = getWorldMap(sample.id);
      expect(loot.every((piece) => !map.collision[piece.position.y][piece.position.x])).toBe(true);
      const exits = plan.extractionPoints.filter((point) => point.mapId === sample.id);
      expect(exits.map((point) => point.label)).toEqual(['NORTH STILE', 'EAST GAP']);
    }
  });

  it('is offered in an explorer run, which unlocks every landing there is', () => {
    expect(playtestRaidProgress().unlockedInsertions).toContain('player-sample-lane/south-road');
  });

  it('never moves a roll of a raid on a shipped map, however many maps are added', () => {
    const before = JSON.stringify(generateRunPlan(7, undefined, 'route-1'));
    const extra = buildPlayerMap({ ...SAMPLE, id: 'another-lane', name: 'Another Lane' });
    registerPlayerMap(extra);
    try {
      expect(JSON.stringify(generateRunPlan(7, undefined, 'route-1'))).toBe(before);
    } finally {
      unregisterPlayerMap(extra.id);
    }
  });

  it('is built again when a newer copy of it is registered, as a draft is after an edit', () => {
    const draft = buildPlayerMap({ ...SAMPLE, id: 'draft-lane' });
    registerPlayerMap(draft);
    try {
      expect(getWorldMap(draft.id).collision[12][16]).toBe(false);
      registerPlayerMap(
        buildPlayerMap({ ...SAMPLE, id: 'draft-lane', ground: withTile(16, 12, 'C') }),
      );
      expect(getWorldMap(draft.id).collision[12][16]).toBe(true);
    } finally {
      unregisterPlayerMap(draft.id);
    }
    expect(isWorldMapId(draft.id)).toBe(false);
  });
});

describe('every map file the game is built with', () => {
  it('loads, with none left out', () => {
    expect(playerMapProblems()).toEqual([]);
  });

  it.each(playerMaps().map((map) => [map.id, map.file] as const))('%s works', (_id, file) => {
    expect(checkMapFile(file).filter((check) => !check.passed)).toEqual([]);
  });
});

describe('an explorer run kept from before a map was added', () => {
  it('is brought up to date when resumed, keeping everything it had', () => {
    const fresh = playtestRaidProgress();
    const old = {
      ...fresh,
      unlockedInsertions: fresh.unlockedInsertions.filter((id) => !id.startsWith('player-')),
      reachedInsertions: ['floodplain-relay'],
      surveyed: { 'route-1': fresh.surveyed!['route-1'] },
    };
    const current = withEverythingCurrent(old);
    expect(current.unlockedInsertions).toContain('player-sample-lane/south-road');
    expect(current.reachedInsertions[0]).toBe('floodplain-relay');
    expect(current.surveyed?.['player-sample-lane']).toBeDefined();
    expect(current.surveyed?.['route-1']).toBe(old.surveyed['route-1']);
    expect(withEverythingCurrent(current)).toBe(current);
  });
});

describe('people, signs, landmarks, districts and trainers in a file', () => {
  const full: MapFile = {
    ...SAMPLE,
    id: 'full-lane',
    people: [{ x: 12, y: 7, name: 'Old Tam', look: 'old-man', facing: 'down', lines: ['The pond was dug by my grandad.'] }],
    signs: [{ x: 13, y: 19, lines: ['SAMPLE LANE'] }],
    landmarks: [{ x: 9, y: 12, name: 'Pond Hide', kind: 'hide' }],
    districts: [{ name: 'The Pond', x: 2, y: 2, width: 12, height: 8, wildlife: 'wetland' }],
    trainers: [{ x: 24, y: 10, name: 'Bug Kid', team: 'scout', look: 'bug-catcher', facing: 'left', sight: 3, lines: [] }],
  };

  it('reads and passes every check', () => {
    expect(readMapFile(full)).toMatchObject({ ok: true });
    expect(checkMapFile(full).filter((check) => !check.passed)).toEqual([]);
  });

  it('refuses a look, a team or a kind the game does not have, and a district off the map', () => {
    const problems = problemsOf({
      ...full,
      people: [{ ...full.people![0], look: 'prof-oak' }],
      trainers: [{ ...full.trainers![0], team: 'champion', sight: 9 }],
      landmarks: [{ ...full.landmarks![0], kind: 'castle' }],
      districts: [{ ...full.districts![0], width: 99 }],
    });
    expect(problems.some((problem) => problem.startsWith("Person 1's look must be one of"))).toBe(true);
    expect(problems.some((problem) => problem.startsWith("Trainer 1's team must be one of"))).toBe(true);
    expect(problems).toContain('Trainer 1 watches 0 to 4 tiles ahead.');
    expect(problems.some((problem) => problem.startsWith("Landmark 1's kind must be one of"))).toBe(true);
    expect(problems).toContain('District 1 is not on the map.');
  });

  it('counts a person as a wall: one standing in the only way out is a map that does not work', () => {
    // Shut the pond-side drop-in into its corner but for one tile, then stand someone in it.
    const ground = [[2, 11], [3, 11], [4, 11], [2, 12]].reduce<string[]>(
      (rows, [x, y]) => rows.map((row, rowY) => (rowY === y ? `${row.slice(0, x)}C${row.slice(x + 1)}` : row)),
      [...SAMPLE.ground],
    );
    const shut = { ...SAMPLE, ground, people: [{ x: 4, y: 12, name: 'Gatekeeper', look: 'boy', facing: 'down', lines: [] }] } as MapFile;
    expect(failing({ ...shut, people: [] })).toEqual([]);
    expect(failing(shut)).toEqual(['way-out', 'hunter-room']);
  });

  it('refuses a trainer who watches a drop-in or an exit, and words the game will not show', () => {
    const watching = { ...full, trainers: [{ ...full.trainers![0], x: 15, y: 17, facing: 'down', sight: 4 }] } as MapFile;
    expect(failing(watching)).toEqual(['watch']);
    expect(failing({ ...full, signs: [{ x: 13, y: 19, lines: ['what the fuck'] }] })).toEqual(['words']);
  });

  it('puts them in the game: townsfolk, a landmark, a named place with its own wildlife, and a trainer', () => {
    const map = buildPlayerMap(full);
    registerPlayerMap(map);
    try {
      expect(entitiesForMap(map.id).map((entity) => [entity.kind, entity.design ?? null])).toEqual([
        ['npc', 'old-man'],
        ['sign', null],
      ]);
      expect(poisForMap(map.id)[0]).toMatchObject({ label: 'POND HIDE', reward: [{ itemId: 'poke-ball', quantity: 2 }] });
      expect(districtAt(map.id, { x: 5, y: 5 })?.name).toBe('THE POND');
      expect(districtEncounterTables(map.id)[`${map.id}/district-1`]).toBeDefined();
      expect(districtEncounterTables('route-1')[`${map.id}/district-1`]).toBeUndefined();
      const [trainer] = trainersOn(map.id);
      expect(trainer).toMatchObject({ sightRange: 3, facing: 'left', design: 'bug-catcher' });
      expect(trainer.trainer.party.map((pokemon) => `${pokemon.base.name} ${pokemon.level}`)).toEqual(['Pidgey 5', 'Squirtle 6']);
      // Fresh Pokemon every time, as the shipped trainers are, so a fight never leaks into the next raid.
      expect(trainersOn(map.id)[0].trainer.party[0]).not.toBe(trainer.trainer.party[0]);
      const plan = generateRunPlan(3, undefined, `${map.id}/south-road` as never);
      expect(plan.trainers.filter((encounter) => encounter.mapId === map.id).map((encounter) => encounter.trainer.name)).toEqual(['BUG KID']);
      expect(getWorldMap(map.id).entities).toHaveLength(2);
    } finally {
      unregisterPlayerMap(map.id);
    }
  });

  it('only ever fields a measured toll trainer\'s team, never a boss\'s', () => {
    for (const team of Object.keys(MAP_FILE_TRAINER_TEAMS) as (keyof typeof MAP_FILE_TRAINER_TEAMS)[]) {
      expect(trainerTemplate(team).bossId).toBeUndefined();
    }
  });
});

describe('publishing', () => {
  it('offers an approved map to every save that has banked its first contract, and the sample to none', () => {
    const approved = buildPlayerMap({ ...SAMPLE, id: 'pond-lane', name: 'Pond Lane', maker: 'Tester' });
    registerPlayerMap(approved, { published: true });
    try {
      const fresh = { unlockedInsertions: ['floodplain-relay'], reachedInsertions: [], completedContracts: [] };
      const banked = { ...fresh, completedContracts: ['recover-lost-field-kit'] };
      expect(availableInsertionIds(fresh)).not.toContain('player-pond-lane/south-road');
      expect(availableInsertionIds(banked)).toContain('player-pond-lane/south-road');
      // Only its front door: a drop-in point is reached on foot, as on any map.
      expect(availableInsertionIds(banked)).not.toContain('player-pond-lane/pond-side');
      expect(availableInsertionIds(banked).some((id) => id.startsWith('player-sample-lane'))).toBe(false);
      expect(isPublishedMap('player-sample-lane')).toBe(false);
      expect(isPublishedMap(approved.id)).toBe(true);
    } finally {
      unregisterPlayerMap(approved.id);
    }
    expect(isPublishedMap('player-pond-lane')).toBe(false);
  });

  it('never gives a map an id the game keeps for itself, or one another map already has', () => {
    expect(RESERVED_MAP_FILE_IDS).toContain(TRY_IT_MAP_ID);
    expect(PUBLISHED_FIXTURE_MAP_ID).toBe(`player-${RESERVED_MAP_FILE_IDS[1]}`);
    const taken = new Set(['sample-lane', 'pond-lane']);
    expect(freeMapFileId('try-it', taken)).toBe('try-it-2');
    expect(freeMapFileId('suite-fixture', taken)).toBe('suite-fixture-2');
    expect(freeMapFileId('sample-lane', taken)).toBe('sample-lane-2');
    expect(freeMapFileId('pond-lane', new Set([...taken, 'pond-lane-2']))).toBe('pond-lane-3');
    expect(freeMapFileId('meadow', taken)).toBe('meadow');
  });

  it('keeps a long id one the game can load when it is published twice', () => {
    const long = 'the-very-long-and-winding-road-to-viridi';
    expect(long).toHaveLength(40);
    const second = freeMapFileId(long, new Set([long]));
    expect(second).toBe('the-very-long-and-winding-road-to-viri-2');
    expect(problemsOf(edited({ id: second }))).toEqual([]);
    // A stem cut on a dash keeps the id to single dashes.
    const dashed = freeMapFileId('a'.repeat(37) + '-bc', new Set(['a'.repeat(37) + '-bc']));
    expect(dashed).toBe(`${'a'.repeat(37)}-2`);
    expect(problemsOf(edited({ id: dashed }))).toEqual([]);
  });

  it('leaves out one map file that cannot load, and loads every other', () => {
    const file = (id: string): MapFile => ({ ...SAMPLE, id, name: 'Pond Lane', maker: 'Tester' });
    const loaded = loadBundledMaps([
      { path: 'sample/sample-lane.json', value: SAMPLE, isPublished: false },
      { path: 'player/old-format.json', value: { ...SAMPLE, id: 'old-format', format: 0 }, isPublished: true },
      { path: 'player/sample-lane.json', value: file('sample-lane'), isPublished: true },
      { path: 'player/try-it.json', value: file('try-it'), isPublished: true },
      { path: 'player/pond-lane.json', value: file('pond-lane'), isPublished: true },
      { path: 'player/pond-lane-copy.json', value: file('pond-lane'), isPublished: true },
    ]);
    expect(loaded.maps.map(({ map, isPublished }) => [map.id, map.file.name, isPublished])).toEqual([
      ['player-sample-lane', 'Sample Lane', false],
      ['player-pond-lane', 'Pond Lane', true],
    ]);
    expect(loaded.problems).toHaveLength(4);
    expect(loaded.problems[0]).toMatch(/^player\/old-format\.json is not a map the game can load/);
    expect(loaded.problems[1]).toBe('player/sample-lane.json has the same id as another map: player-sample-lane');
    expect(loaded.problems[2]).toBe('player/try-it.json has an id the game keeps for itself: try-it');
    expect(loaded.problems[3]).toBe('player/pond-lane-copy.json has the same id as another map: player-pond-lane');
  });

  it('refuses any name or line that could carry markup onto a screen', () => {
    expect(problemsOf(edited({ name: 'Pond <b>Lane</b>' }))).toEqual(['Names and words in a map may not use < > & or ".']);
    expect(
      problemsOf(edited({ people: [{ x: 12, y: 7, name: 'Tam', look: 'old-man', facing: 'down', lines: ['Fish & chips'] }] })),
    ).toEqual(['Names and words in a map may not use < > & or ".']);
    expect(plainText('Fish & "chips" <here>')).toBe('Fish  chips here');
  });
});
