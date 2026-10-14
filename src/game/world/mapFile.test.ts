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
  BUILT_IN_MAP_FILE_LIMITS,
  buildPlayerMap,
  freeMapFileId,
  keepPublishedIds,
  MAP_FILE_LIMITS,
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

  it("holds a player's map to a player's limits, and the game's own to its own", () => {
    // One way out past a player's limit, each with a name of its own.
    const exits = Array.from({ length: MAP_FILE_LIMITS.maxExits + 1 }, (_, index) => ({
      ...SAMPLE.exits[0],
      name: `Way ${index + 1}`,
    }));
    const crowded = edited({ exits });
    expect(problemsOf(crowded).join(' ')).toContain(`${MAP_FILE_LIMITS.maxExits}`);
    expect(readMapFile(crowded, { limits: BUILT_IN_MAP_FILE_LIMITS }).ok).toBe(true);
  });

  it("only ever lets the game's own maps hold more and be bigger, never smaller", () => {
    for (const key of Object.keys(MAP_FILE_LIMITS) as (keyof typeof MAP_FILE_LIMITS)[]) {
      if (key.startsWith('min')) {
        expect(`${key} ${BUILT_IN_MAP_FILE_LIMITS[key]}`).toBe(`${key} ${MAP_FILE_LIMITS[key]}`);
      } else {
        expect(BUILT_IN_MAP_FILE_LIMITS[key]).toBeGreaterThanOrEqual(MAP_FILE_LIMITS[key]);
      }
    }
    // Greystone Vale is six 64-tile districts square, measured before it grew
    // (docs/screens/greystone-vale/README.md); a player's map stays at 256.
    expect([BUILT_IN_MAP_FILE_LIMITS.maxWidth, BUILT_IN_MAP_FILE_LIMITS.maxHeight]).toEqual([384, 384]);
    expect([MAP_FILE_LIMITS.maxWidth, MAP_FILE_LIMITS.maxHeight]).toEqual([256, 256]);
    // ...and every room and cave inside one is the size a player's may be.
    for (const key of ['maxInsideWidth', 'maxInsideHeight', 'maxCaveWidth', 'maxCaveHeight'] as const)
      expect(BUILT_IN_MAP_FILE_LIMITS[key]).toBe(MAP_FILE_LIMITS[key]);
  });

  it('refuses a file from a format it does not know, and says which', () => {
    expect(problemsOf(edited({ format: 2 }))).toEqual([
      'The file is format 2; this game reads format 1.',
    ]);
    expect(problemsOf('a map')).toEqual(['The file is not a map.']);
  });

  it('refuses a map too small or too large, and ground that does not match its size', () => {
    expect(problemsOf(edited({ width: 8 }))).toContain('A map is 20x16 to 256x256 tiles.');
    expect(problemsOf(edited({ height: 400 }))).toContain('A map is 20x16 to 256x256 tiles.');
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
    expect(problemsOf(edited({ wildlife: 'moon' }))[0]).toMatch(
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
    ).toContain(
      "Exit 'North Stile' must open always, after 1 to 240 seconds, when dug out, or to the Card Key.",
    );
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
    // Said as what it stands on, not "something solid", which sent a maker
    // looking through the map for what it was.
    expect(checkMapFile(inTheTrees).find((check) => check.id === 'standing')?.problems).toEqual([
      'Drop-in South Road at 0,23 stands in the trees.',
    ]);
  });

  it('names a thing whose name already says its kind once (playtest 39 A1)', () => {
    // The maker names a new drop-in "Drop-in 1"; "Drop-in Drop-in 1" said the
    // kind twice in every check that named it.
    const inTheTrees = edited({
      dropIns: [{ ...SAMPLE.dropIns[0], name: 'Drop-in 1', x: 0, y: 23 }],
    });
    const problems = checkMapFile(inTheTrees).flatMap((check) => check.problems);
    expect(problems).toContain('Drop-in 1 at 0,23 stands in the trees.');
    expect(problems.join(' ')).not.toMatch(/Drop-in Drop-in/);
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

  it('says how long a raid lasts and what to do when a drop-in is too far from every exit (playtest 39 B12)', () => {
    // A lane that winds back and forth across 80 tiles for 64 rows: the only
    // exit is at its far end, about 2,600 steps from the drop-in at its start.
    const width = 80;
    const height = 64;
    const ground = Array.from({ length: height }, (_, y) => {
      if (y % 2 === 0) {
        return '.'.repeat(width);
      }
      // A wall with one gap, at the east end and then the west in turn.
      const gap = y % 4 === 1 ? width - 1 : 0;
      return Array.from({ length: width }, (__, x) => (x === gap ? '.' : 'C')).join('');
    });
    const winding = edited({
      width,
      height,
      ground,
      buildings: [],
      people: [],
      signs: [],
      landmarks: [],
      districts: [],
      trainers: [],
      itemSpots: [],
      dropIns: [{ ...SAMPLE.dropIns[0], name: 'Lane End', x: 0, y: 0 }],
      exits: [{ x: width - 1, y: height - 2, name: 'Far Stile', opens: { when: 'always' } }],
    });
    expect(checkMapFile(winding).find((check) => check.id === 'way-out')?.problems).toEqual([
      'Drop-in Lane End cannot reach an exit before the 5-minute raid clock runs out. Move an exit closer to it.',
    ]);
  });

  it('says why a boxed-in drop-in leaves the hunter nowhere to arrive, and what to do (playtest 39 B9)', () => {
    // A three-tile pocket with its exit beside the drop-in: it can leave, but
    // nothing stands five steps out for the hunter.
    const ground = Array.from({ length: 16 }, (_, y) => (y === 1 ? `C...${'C'.repeat(16)}` : 'C'.repeat(20)));
    const pocket = edited({
      width: 20,
      height: 16,
      ground,
      buildings: [],
      people: [],
      signs: [],
      landmarks: [],
      districts: [],
      trainers: [],
      itemSpots: [],
      dropIns: [{ ...SAMPLE.dropIns[0], name: 'Drop-in 1', x: 1, y: 1 }],
      exits: [{ x: 3, y: 1, name: 'Stile', opens: { when: 'always' } }],
    });
    const room = checkMapFile(pocket).find((check) => check.id === 'hunter-room');
    expect(room?.problems).toEqual([
      'Drop-in 1 is too boxed in: the hunter arrives 5 steps away and has nowhere to stand. Open up more ground around it.',
    ]);
    expect(room?.faults?.[0]?.says).toBe('are too boxed in: the hunter arrives 5 steps away and has nowhere to stand');
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

  it('names landmarks in the heading of the check that fails a landmark nobody can reach (playtest 39 B11)', () => {
    // The same walled-off tile behind the two exits, holding a landmark.
    const behind = edited({
      exits: [
        { x: 16, y: 1, name: 'North Stile', opens: { when: 'always' } },
        { x: 17, y: 1, name: 'North Gap', opens: { when: 'always' } },
      ],
      landmarks: [{ x: 16, y: 0, name: 'Pond Hide', kind: 'hide' }],
    });
    const reachable = checkMapFile(behind).find((check) => check.id === 'reachable');
    expect(reachable?.problems).toEqual(['Landmark Pond Hide at 16,0 cannot be walked to from any drop-in.']);
    expect(reachable?.label).toBe('Every exit, item spot and landmark can be walked to');
  });
});

describe('a map from a file is a map like any other', () => {
  const sample = playerMaps().find((map) => map.file.id === 'sample-lane')!;

  it('is in the list of maps after the shipped ones', () => {
    expect(sample.id).toBe('player-sample-lane');
    expect(worldMapIds().slice(0, Object.keys(WORLD_MAPS).length)).toEqual(Object.keys(WORLD_MAPS));
    expect(worldMapIds()).toContain(sample.id);
    expect(isWorldMapId(sample.id)).toBe(true);
    expect(isWorldMapId('player-nowhere')).toBe(false);
    expect(worldMapName(sample.id)).toBe('Sample Lane');
    expect(worldMapMaker(sample.id)).toBe('Escape from Pallet Town');
    expect(worldMapMaker('route-1')).toBeUndefined();
  });

  it('is drawn on the Kanto sheets, plus the base, Overworld, town, ice, mountain and tower pieces, at the size its file says', () => {
    const map = getWorldMap(sample.id);
    expect([map.width, map.height]).toEqual([32, 24]);
    expect(map.tileset.sources.map((source) => source.imagePath)).toEqual([
      ...WORLD_MAPS['viridian-city'].tileset.sources.map((source) => source.imagePath),
      'assets/Overworld.png',
      'assets/frlg-base.png',
      'assets/frlg-towns.png',
      'assets/frlg-ice.png',
      'assets/frlg-ember.png',
      // The Pokemon Tower's graves stand out of doors too.
      'assets/frlg-areas.png',
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

  it('names the field a refused word is in, and never repeats a refused name (playtest 39 B7)', () => {
    const problems = (file: MapFile) => checkMapFile(file).find((check) => check.id === 'words')?.problems;
    const trainer = full.trainers![0];
    expect(problems({ ...full, trainers: [{ ...trainer, name: 'Dick' }] })).toEqual([
      'Trainer 1: their name uses a word the game does not show. Change it.',
    ]);
    expect(problems({ ...full, trainers: [{ ...trainer, lines: ['Hello there', 'what the fuck'] }] })).toEqual([
      'Trainer Bug Kid: line 2 uses a word the game does not show. Change it.',
    ]);
    expect(problems({ ...full, signs: [{ x: 13, y: 19, lines: ['you bitch', 'shit'] }] })).toEqual([
      'Sign 1: line 1 and line 2 use words the game does not show. Change them.',
    ]);
  });

  it('names the drop-in a trainer can see, so the maker knows which one to clear (playtest 39 B10)', () => {
    const watching = { ...full, trainers: [{ ...full.trainers![0], x: 15, y: 17, facing: 'down', sight: 4 }] } as MapFile;
    const watch = checkMapFile(watching).find((check) => check.id === 'watch');
    expect(watch?.problems).toEqual(['Trainer Bug Kid can see Drop-in South Road. Turn them, or watch less far.']);
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

  it('takes accented letters and common punctuation, and refuses emoji, other scripts and what draws nothing', () => {
    expect(problemsOf(edited({ name: 'Café Élan', maker: 'Zoë' }))).toEqual([]);
    expect(
      problemsOf(edited({ people: [{ x: 12, y: 7, name: 'Søren', look: 'old-man', facing: 'down', lines: ['“Ça va?” – ¡sí!'] }] })),
    ).toEqual([]);
    const refused = [
      'Names and words in a map use letters (accents too), digits and common punctuation - no emoji or other scripts yet.',
    ];
    expect(problemsOf(edited({ name: 'Bug 🐛 Lane' }))).toEqual(refused);
    expect(problemsOf(edited({ name: 'שלום' }))).toEqual(refused);
    expect(problemsOf(edited({ name: 'Odd \u202Etext' }))).toEqual(refused);
    expect(problemsOf(edited({ maker: '\u200B' }))).toEqual(refused);
    expect(
      problemsOf(edited({ signs: [{ x: 12, y: 7, lines: ['One\rTwo'] }] })),
    ).toEqual(refused);
    expect(plainText('Bug 🐛 Café\nLane')).toBe('Bug  Café\nLane');
  });
});

describe('a drop-in keeps its id', () => {
  const reading = (value: unknown): MapFile => {
    const read = readMapFile(value);
    if (!read.ok) {
      throw new Error(read.problems.join(' '));
    }
    return read.file;
  };
  const renamed = (file: MapFile, index: number, change: Partial<MapFile['dropIns'][number]>): MapFile => ({
    ...file,
    dropIns: file.dropIns.map((dropIn, at) => (at === index ? { ...dropIn, ...change } : dropIn)),
  });
  const insertionIds = (file: MapFile): readonly string[] =>
    buildPlayerMap(file).insertions.map((insertion) => insertion.id);

  it('as the slug of its name, accents and all', () => {
    const file = reading(renamed(SAMPLE, 1, { name: 'Étang Côté' }));
    expect(insertionIds(file)).toEqual(['player-sample-lane/south-road', 'player-sample-lane/etang-cote']);
  });

  it('as the id it was published under, whatever it is called now', () => {
    const file = reading(renamed(SAMPLE, 1, { name: 'Brook Path', id: 'pond-side' }));
    expect(insertionIds(file)).toEqual(['player-sample-lane/south-road', 'player-sample-lane/pond-side']);
  });

  it('never as one another drop-in already is', () => {
    expect(problemsOf(renamed(SAMPLE, 1, { id: 'south-road' }))).toEqual([
      'Two drop-ins would be the same landing: give one another name.',
    ]);
    expect(problemsOf(renamed(SAMPLE, 1, { id: 'Not An Id' }))).toEqual([
      "The id kept for 'Pond Side' is not one the game can use.",
    ]);
  });

  describe('when a fix replaces the published map', () => {
    const published = reading({ ...SAMPLE, id: 'sample-lane-2' });

    it('goes in under the published map id, and a drop-in renamed keeps its landing', () => {
      const fix = reading(renamed(SAMPLE, 1, { name: 'Brook Path' }));
      const replaced = keepPublishedIds(published, fix);
      expect(replaced.id).toBe('sample-lane-2');
      expect(replaced.dropIns.map((dropIn) => [dropIn.name, dropIn.id])).toEqual([
        ['South Road', undefined],
        ['Brook Path', 'pond-side'],
      ]);
      expect(insertionIds(reading(replaced))).toEqual(insertionIds(published));
    });

    it('keeps the landing of one renamed and moved, and of one moved to the end of the list', () => {
      const fix = reading({
        ...SAMPLE,
        dropIns: [
          { ...SAMPLE.dropIns[1], x: 4, name: 'Brook Path' },
          { ...SAMPLE.dropIns[0], name: 'Sand Road' },
        ],
      });
      const replaced = reading(keepPublishedIds(published, fix));
      expect(new Set(insertionIds(replaced))).toEqual(new Set(insertionIds(published)));
      expect(replaced.dropIns.map((dropIn) => dropIn.id)).toEqual(['pond-side', 'south-road']);
    });

    it('gives a drop-in the fix added its own id, and keeps an id it kept before', () => {
      const once = reading(keepPublishedIds(published, reading(renamed(SAMPLE, 1, { name: 'Brook Path' }))));
      const fix = reading({
        ...once,
        dropIns: [...once.dropIns.map((dropIn) => ({ ...dropIn, id: undefined })), { x: 10, y: 20, name: 'Mill Gate' }],
      });
      const twice = reading(keepPublishedIds(once, fix));
      expect(insertionIds(twice)).toEqual([...insertionIds(published), 'player-sample-lane-2/mill-gate']);
    });
  });
});
