import { describe, expect, it } from 'vitest';
import { getItemById } from '../items/items';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { generateRunPlan } from '../run/runGeneration';
import { RAID_DURATION_MS } from '../run/raidClock';
import { MAX_PENDING_RECOVERY_MS } from '../hub/recovery';
import { getWorldMap } from '../worldMap';
import { districtsForMap } from './districts';
import { winRateAgainst } from './encounterMeasure';
import { stepDistances } from './mapStructure';
import { readMapFile, MAP_FILE_LIMITS, type MapFile } from './mapFile';
import { entitiesForMap } from './npcs';
import { builtInFileMap } from './playerMaps';
import { dayNumber, RUMOURS, rumourFrom, type RumourFact } from './rumours';
import {
  BERRY_ITEM_IDS,
  conditionHolds,
  nextReward,
  openSecrets,
  raidConditions,
  SECRETS,
  secretOpenAt,
  secretsHeldBy,
  sleepingSecrets,
  type RaidConditions,
  type Secret,
  type SecretCondition,
} from './secrets';
import { partyOf, trainerWinRate } from './trainerMeasure';
import { createRunTrainerEncounters } from './trainers';
import { gymOf, MISTY_BOSS_ID, valeGyms, type ValeGym } from './valeQuarters';
import { weatherAt } from './districts';
import type { GridPosition } from '../movement/gridMovement';

/**
 * The vale's secrets (`secrets.ts`) and the rumours about them (`rumours.ts`),
 * held to the plan's rules: every nook is drawn where its secret says and can
 * be walked to, every clue stands within ten steps of its nook and hints at
 * what the nook waits for, every rumour is true and gives two facts of three,
 * every condition can be met, and a secret is laid only while it holds -
 * on a stream of its own, so nothing else in a raid moves.
 */

const VALE = 'greystone-vale';
const CLUE_STEPS = 10;

/** Words that say each condition, for a clue's hint and a rumour's fact. */
function hintsOf(condition: SecretCondition): readonly string[] {
  switch (condition.kind) {
    case 'hour':
      return condition.hour === 'dusk' ? ['DUSK', 'SUN IS LOW'] : condition.hour === 'night' ? ['DARK', 'NIGHT'] : ['DAY'];
    case 'weekday':
      return [['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][condition.day]];
    case 'lead-type':
      return condition.type === 'Fighting' ? ['FIGHT', 'FISTS'] : [condition.type.toUpperCase()];
    case 'field-move':
      return [condition.move.replace('-', ' ').toUpperCase()];
    case 'carried':
      return condition.items.flatMap((item) =>
        item.endsWith('rod')
          ? ['ROD', 'LINE']
          : item === 'poke-flute'
            ? ['FLUTE', 'TUNE']
            : item.endsWith('-berry')
              ? ['BERRY']
              : [item.toUpperCase()],
      );
    case 'whole-chart':
      return ['CHART'];
    case 'badge':
      return [gymOf(condition.bossId)!.badge, gymOf(condition.bossId)!.leader.toUpperCase()];
    case 'alone':
      return ['ALONE'];
    case 'raid-clock':
      return ['LOW WATER'];
    case 'either':
      return condition.of.flatMap(hintsOf);
  }
}

const isWhen = (condition: SecretCondition): boolean =>
  condition.kind === 'hour' || condition.kind === 'weekday' || condition.kind === 'raid-clock';
const plain = (text: string): string => text.toUpperCase().replace(/[’']/g, "'");
const says = (text: string, words: readonly string[]): boolean => words.some((word) => plain(text).includes(word));

describe("the vale's secrets", () => {
  const file = builtInFileMap(VALE)!;
  const map = getWorldMap(VALE);
  const districts = districtsForMap(VALE);
  const entities = entitiesForMap(VALE);

  /** Every tile of the named place: a district, or a whole area (a cave floor). */
  const placeTiles = (place: string): ((tile: GridPosition) => boolean) => {
    const district = districts.find((one) => one.name === place);
    if (district) {
      return (tile) =>
        district.areas.some(
          (area) => tile.x >= area.x && tile.x < area.x + area.width && tile.y >= area.y && tile.y < area.y + area.height,
        );
    }
    const area = map.areas?.find((one) => one.name === place);
    expect(area, `${place} is no place on the vale`).toBeDefined();
    return (tile) => tile.x >= area!.rect.x && tile.x < area!.rect.x + area!.rect.width && tile.y >= area!.rect.y && tile.y < area!.rect.y + area!.rect.height;
  };

  /** Where a secret's nook is worked from: the spot itself, or the ground beside its figure or its water. */
  const nookTiles = (secret: Secret): readonly GridPosition[] => {
    const beside = (tile: GridPosition): GridPosition[] =>
      [
        { x: tile.x + 1, y: tile.y },
        { x: tile.x - 1, y: tile.y },
        { x: tile.x, y: tile.y + 1 },
        { x: tile.x, y: tile.y - 1 },
      ].filter((one) => map.collision[one.y]?.[one.x] === false);
    switch (secret.nook) {
      case 'spot':
        return file.loot.filter((piece) => piece.secret === secret.id).map((piece) => piece.position);
      case 'figure':
      case 'giver':
        return entities
          .filter((entity) => entity.secret === secret.id && (secret.nook === 'figure') === (entity.pokemon !== undefined))
          .flatMap((entity) => beside(entity.position));
      case 'summons':
        return entities
          .filter((entity) => entity.secret === secret.id && entity.kind === 'sign')
          .flatMap((entity) => beside(entity.position));
      case 'line': {
        const inPlace = placeTiles(secret.place);
        const water: GridPosition[] = [];
        map.terrain.forEach((row, y) =>
          row.forEach((material, x) => {
            if (material === 'water' && map.collision[y][x] && inPlace({ x, y })) water.push({ x, y });
          }),
        );
        return water.flatMap(beside);
      }
    }
  };

  const clues = (secret: Secret) =>
    entities.filter((entity) => entity.secret === secret.id && entity.pokemon === undefined);

  it.each(SECRETS.map((secret) => [secret.name, secret] as const))('%s has a nook in its place, walked to', (_name, secret) => {
    const tiles = nookTiles(secret);
    expect(tiles.length, `${secret.name} has no nook drawn`).toBeGreaterThan(0);
    const inPlace = placeTiles(secret.place);
    expect(tiles.some(inPlace), `${secret.name}'s nook is not in ${secret.place}`).toBe(true);
    for (const tile of tiles.filter(() => secret.nook === 'spot')) {
      expect(map.collision[tile.y][tile.x], `${secret.name}'s spot is solid`).toBe(false);
    }
  });

  /**
   * Walked up to with everybody standing where they stand. A figure is a
   * wall, so a nook whose only way in has somebody standing in it is a nook
   * nobody reaches: THE LOST PICNIC's Hypno stood behind the one tile its own
   * Drowzee dozed on, which the collision alone called open ground and a raid
   * called unreachable (12 Nov 2026). The ground beside a nook has to be part
   * of somewhere - a room, a glade and the lane to it - never a pocket of a
   * few tiles shut in by the people of the place.
   */
  it.each(SECRETS.filter((secret) => secret.nook !== 'line').map((secret) => [secret.name, secret] as const))(
    '%s can be walked up to past everybody who stands near it',
    (_name, secret) => {
      const standing = new Set(entities.map((entity) => `${entity.position.x},${entity.position.y}`));
      const open = nookTiles(secret).filter((tile) => !standing.has(`${tile.x},${tile.y}`));
      const roomiest = Math.max(
        0,
        ...open.map((tile) => stepDistances(map.collision, tile, standing).reduce((sum, row) => sum + row.filter((steps) => steps >= 0).length, 0)),
      );
      expect(roomiest, `${secret.name}'s nook is shut in: ${roomiest} tiles of ground beside it`).toBeGreaterThanOrEqual(40);
    },
  );

  /**
   * And a figure shuts nothing in by standing there. THE ELEVENTH STONE's
   * Alakazam first sat in the one gap of the stone ring: it could still be
   * walked up to from outside, so the rule above passed, and the four tiles
   * inside the ring were ground nobody could reach - collision that does not
   * match the art. Every tile of ground beside a secret's figure is part of
   * somewhere, with the figure standing.
   */
  it.each(
    SECRETS.filter((secret) => secret.nook === 'figure' && secret.wave >= 3).map((secret) => [secret.name, secret] as const),
  )('%s shuts no ground in by standing where it stands', (_name, secret) => {
    const standing = new Set(entities.map((entity) => `${entity.position.x},${entity.position.y}`));
    for (const tile of nookTiles(secret).filter((each) => !standing.has(`${each.x},${each.y}`))) {
      const room = stepDistances(map.collision, tile, standing).reduce((sum, row) => sum + row.filter((steps) => steps >= 0).length, 0);
      expect(room, `${secret.name} shuts in the ground at ${tile.x},${tile.y}: ${room} tiles`).toBeGreaterThanOrEqual(40);
    }
  });

  it.each(SECRETS.map((secret) => [secret.name, secret] as const))(
    '%s has a clue within ten steps that hints at what it waits for',
    (_name, secret) => {
      const nooks = nookTiles(secret);
      const near = clues(secret).filter((clue) =>
        [
          { x: clue.position.x + 1, y: clue.position.y },
          { x: clue.position.x - 1, y: clue.position.y },
          { x: clue.position.x, y: clue.position.y + 1 },
          { x: clue.position.x, y: clue.position.y - 1 },
        ]
          .filter((tile) => map.collision[tile.y]?.[tile.x] === false)
          .some((tile) => {
            const field = stepDistances(map.collision, tile, new Set(), map.links);
            return nooks.some((nook) => field[nook.y][nook.x] >= 0 && field[nook.y][nook.x] <= CLUE_STEPS);
          }),
      );
      expect(near.length, `${secret.name} has no clue within ${CLUE_STEPS} steps`).toBeGreaterThan(0);
      const words = near.flatMap((clue) => clue.dialogLines).join(' ');
      expect(
        secret.when.some((condition) => says(words, hintsOf(condition))),
        `${secret.name}'s clue says nothing of when or what to bring: ${words}`,
      ).toBe(true);
      for (const line of near.flatMap((clue) => clue.dialogLines)) {
        expect(line.length, `a clue line is two lines of the box at most: ${line}`).toBeLessThanOrEqual(140);
      }
    },
  );

  it('can each be opened by some raid, and only by one meeting all its conditions', () => {
    const base: RaidConditions = { hour: 'day', weekday: 3, month: 5, leadTypes: ['Normal'], fieldMoves: [], carried: [], badges: [], chartWhole: false, partySize: 2 };
    expect(openSecrets(base)).toEqual([]);
    const everything: RaidConditions = {
      ...base,
      leadTypes: ['Fighting', 'Ground', 'Psychic', 'Ghost', 'Bug'],
      fieldMoves: ['rock-smash'],
      partySize: 1,
      carried: ['old-rod', 'pickaxe', 'poke-flute', 'pecha-berry'],
      badges: [MISTY_BOSS_ID],
      chartWhole: true,
    };
    for (const secret of SECRETS) {
      const hour = secret.when.find((condition) => condition.kind === 'hour');
      const day = secret.when.find((condition) => condition.kind === 'weekday');
      const raid: RaidConditions = {
        ...everything,
        ...(hour?.kind === 'hour' ? { hour: hour.hour } : {}),
        ...(day?.kind === 'weekday' ? { weekday: day.day } : {}),
      };
      expect(openSecrets(raid), secret.name).toContain(secret.id);
      const clock = secret.when.find((condition) => condition.kind === 'raid-clock');
      expect(secretOpenAt(secret, raid, clock?.kind === 'raid-clock' ? clock.fromMs : 0), secret.name).toBe(true);
      for (const condition of secret.when) {
        // Read at the start of the raid, which no stretch of the clock opens on.
        expect(conditionHolds(condition, base, 0), `${secret.name} is open on an ordinary raid`).toBe(false);
      }
    }
  });

  it('reads the conditions off the party, the pack and the clock as the raid deploys', () => {
    const machop = new Pokemon(getSpeciesById('machop')!, 12);
    const raid = raidConditions(
      new Date(2026, 10, 8, 19, 30),
      [machop],
      [
        { itemId: 'old-rod', quantity: 1 },
        { itemId: 'potion', quantity: 0 },
      ],
      true,
      [MISTY_BOSS_ID],
    );
    expect(raid).toMatchObject({
      hour: 'dusk',
      weekday: 0,
      month: 10,
      leadTypes: ['Fighting'],
      carried: ['old-rod'],
      badges: [MISTY_BOSS_ID],
      chartWhole: true,
    });
    expect(raidConditions(new Date(2026, 10, 8, 23), [], [], false, []).leadTypes).toEqual([]);
  });

  it('gives the next reward until all are found, and counts what the vault holds as found', () => {
    const shells = SECRETS.find((secret) => secret.id === 'the-old-shells')!;
    expect(nextReward(shells, { secretsFound: [], giftsReceived: [] })).toEqual({ kind: 'item', itemId: 'helix-fossil' });
    expect(nextReward(shells, { secretsFound: ['helix-fossil'], giftsReceived: [] })).toEqual({ kind: 'item', itemId: 'dome-fossil' });
    expect(nextReward(shells, { secretsFound: ['helix-fossil', 'dome-fossil'], giftsReceived: [] })).toBeUndefined();
    const held = secretsHeldBy({
      itemCount: (itemId) => (itemId === 'chart-piece-1' ? 1 : 0),
      pokemon: [
        { speciesId: 'gyarados', shiny: false },
        { speciesId: 'golem', shiny: false },
      ],
    });
    // An ordinary Gyarados is not the red one.
    expect(held).toEqual(['chart-piece-1', 'the-cracked-crag/golem']);
  });

  it('rewards are things worth finding: found-only finds and Pokemon the vale has nowhere else', () => {
    for (const secret of SECRETS) {
      for (const reward of secret.rewards) {
        if (reward.kind === 'item') {
          expect(getItemById(reward.itemId)?.effect.type, reward.itemId).toBe('relic');
        }
      }
    }
    const species = SECRETS.flatMap((secret) =>
      secret.rewards.flatMap((reward) =>
        reward.kind === 'meet' ? [reward.speciesId] : reward.kind === 'gift' ? [reward.gift.speciesId] : [],
      ),
    );
    expect(species.sort()).toEqual(['alakazam', 'butterfree', 'gengar', 'golem', 'gyarados', 'hypno', 'kabutops', 'lickitung', 'machamp', 'mr-mime', 'snorlax']);
  });

  describe('against the gyms', () => {
    const encounters = createRunTrainerEncounters();
    const leaderOf = (gym: ValeGym) => encounters.find((encounter) => encounter.bossId === gym.bossId)!.trainer;
    const misty = leaderOf(gymOf(MISTY_BOSS_ID)!);

    /**
     * The gym a secret comes before: the first in the order whose badge it
     * does not ask for. One behind the last gym there is is measured at that
     * gym, which is the last a player will have beaten to reach it.
     */
    const gymBefore = (secret: Secret): ValeGym => {
      const asks = (gym: ValeGym) => secret.when.some((condition) => condition.kind === 'badge' && condition.bossId === gym.bossId);
      return valeGyms().find((gym) => !asks(gym)) ?? valeGyms().filter(asks).at(-1)!;
    };
    /** The level a gym is fought at: its leader's highest. */
    const levelOf = (gym: ValeGym) => Math.max(...leaderOf(gym).party.map((pokemon) => pokemon.level));

    it('measures each secret against the gym it comes before', () => {
      expect(gymBefore(SECRETS.find((secret) => secret.id === 'the-sleeper-in-the-pines')!).bossId).toBe(MISTY_BOSS_ID);
      // Past Misty, before whoever is next; Misty's own while she is the last.
      expect(gymBefore(SECRETS.find((secret) => secret.id === 'the-drowned-bell')!).bossId).toBe(
        (valeGyms()[1] ?? valeGyms()[0]).bossId,
      );
    });

    /**
     * A gift costs no fight, so it is held under the gym's own bar: led into
     * Misty alone it wins less often than her best team must (three in four,
     * `quarterPuzzle.test.ts`). It is a strong partner, never the answer on its
     * own. Measured: the Machamp wins 72% alone at Lv 16, 94% at 18.
     */
    it('a Pokemon handed over with no fight is a partner against Misty, never the answer alone', () => {
      for (const reward of SECRETS.flatMap((secret) => secret.rewards)) {
        if (reward.kind !== 'gift') continue;
        const party = partyOf(`${reward.gift.speciesId} alone`, [reward.gift.speciesId, reward.gift.level]);
        expect(trainerWinRate(party, misty, 200, 0x51ede, null, 3), reward.gift.speciesId).toBeLessThan(0.75);
      }
    });

    /**
     * A Pokemon met has to be beaten or worn down to be had, so it is held to
     * the gym it comes before the other way round: a starter at that gym's
     * level, in the weather of the place it is met, loses to it more often than
     * not. A player who can take it has outgrown the gym already, so it makes
     * no gym trivial. Measured: Snorlax Lv 25 against starters at Misty's 15
     * wins 94% of fights; Kabutops Lv 28 in the Coast's rain at Koga's 20, 51%
     * - the Charmeleon almost never, the Ivysaur's Grass, four times over, nine
     * fights in ten.
     */
    it.each(SECRETS.filter((secret) => secret.rewards.some((reward) => reward.kind === 'meet')).map((secret) => [secret.name, secret] as const))(
      '%s is a fight that has to be earned at the level of the gym it comes before',
      (_name, secret) => {
        const level = levelOf(gymBefore(secret));
        const weather = secret.nook === 'line' ? null : weatherAt(VALE, nookTiles(secret)[0]);
        for (const reward of secret.rewards) {
          if (reward.kind !== 'meet') continue;
          const rates = ['charmeleon', 'wartortle', 'ivysaur'].map((starter) =>
            winRateAgainst(starter, level, reward.speciesId, reward.level, 100, 0x5eed, weather),
          );
          const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
          expect(mean, reward.speciesId).toBeLessThan(0.5);
        }
      },
    );
  });

  describe('rumours', () => {
    it.each(RUMOURS.map((rumour) => [rumour.id, rumour] as const))('%s is true and gives two facts of three', (_id, rumour) => {
      const secret = SECRETS.find((one) => one.id === rumour.secret)!;
      expect(secret).toBeDefined();
      expect(rumour.names).toBe(secret.place);
      expect(new Set(rumour.gives).size).toBe(2);
      const facts: Record<RumourFact, boolean> = {
        where: plain(secret.place)
          .split(/\s+/)
          .every((word) => plain(rumour.line).includes(word)),
        when: secret.when.filter(isWhen).some((condition) => says(rumour.line, hintsOf(condition))),
        bring: secret.when.filter((condition) => !isWhen(condition)).some((condition) => says(rumour.line, hintsOf(condition))),
      };
      for (const fact of rumour.gives) {
        expect(facts[fact], `${rumour.id} does not give ${fact}`).toBe(true);
      }
      for (const fact of (['where', 'when', 'bring'] as const).filter((each) => !rumour.gives.includes(each))) {
        expect(facts[fact], `${rumour.id} gives ${fact} as well, which leaves nothing to find`).toBe(false);
      }
    });

    it('every secret is heard of somewhere', () => {
      for (const secret of SECRETS) {
        expect(RUMOURS.some((rumour) => rumour.secret === secret.id), secret.name).toBe(true);
      }
    });

    it('a source tells a rumour only while its secret still holds something', () => {
      const day = dayNumber(new Date(2026, 10, 7));
      expect(rumourFrom('angler', { secretsFound: [], giftsReceived: [] }, day)?.id).toBe('angler-red-one');
      expect(rumourFrom('angler', { secretsFound: ['the-red-one/gyarados'], giftsReceived: [] }, day)).toBeUndefined();
      const boards = new Set([0, 1, 2, 3].map((offset) => rumourFrom('board', { secretsFound: [], giftsReceived: [] }, day + offset)?.id));
      expect(boards.size).toBeGreaterThan(1);
    });
  });

  describe('in a raid', () => {
    const insertion = 'greystone-vale-moor-top';
    const dusk: RaidConditions = { hour: 'dusk', weekday: 3, month: 5, leadTypes: ['Normal'], fieldMoves: [], carried: [], badges: [], chartWhole: false, partySize: 2 };
    const afternoon: RaidConditions = { ...dusk, hour: 'day' };
    const known = { secretsFound: [], giftsReceived: [] };
    const plan = (seed: number, conditions?: RaidConditions, found: readonly string[] = []) =>
      generateRunPlan(
        seed,
        undefined,
        insertion,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        conditions ? { conditions, known: { ...known, secretsFound: found } } : undefined,
      );
    const secretLoot = (run: ReturnType<typeof plan>) => (run.loot[VALE] ?? []).filter((piece) => piece.secret !== undefined);
    const otherLoot = (run: ReturnType<typeof plan>) => (run.loot[VALE] ?? []).filter((piece) => piece.secret === undefined);

    it('lays a secret only while its condition holds', () => {
      expect(secretLoot(plan(7, dusk)).map((piece) => piece.itemId)).toEqual(['chart-piece-1']);
      expect(secretLoot(plan(7, afternoon))).toEqual([]);
      expect(secretLoot(plan(7))).toEqual([]);
      expect(plan(7, dusk).secrets.map((secret) => secret.id)).toEqual(['the-long-shadow']);
    });

    it('lays the sleeper across his glade every raid until he is had, and wakes him only for the flute', () => {
      const sleeper = 'the-sleeper-in-the-pines';
      expect(plan(7, dusk).sleeping).toContain(sleeper);
      expect(plan(7, dusk).secrets.map((secret) => secret.id)).not.toContain(sleeper);
      const flute = plan(7, { ...dusk, carried: ['poke-flute'] });
      expect(flute.sleeping ?? []).not.toContain(sleeper);
      expect(flute.secrets.find((secret) => secret.id === sleeper)?.reward).toEqual({ kind: 'meet', speciesId: 'snorlax', level: 25 });
      // Had, he is gone: nothing sleeps there and the flute wakes nobody.
      expect(plan(7, dusk, [`${sleeper}/snorlax`]).sleeping ?? []).not.toContain(sleeper);
      expect(sleepingSecrets({ ...dusk, carried: [] }, { secretsFound: [], giftsReceived: [] })).toContain(sleeper);
    });

    /**
     * The third wave's two that are seen before they are had: the picket who
     * has not moved in nine years, and the shadow on the crypt wall. Each
     * stands every raid, as the sleeper lies, and answers only its own kind
     * walking in front.
     */
    it.each([
      ['the-silent-picket', 'Psychic', 'mr-mime', 22],
      ['the-shadow-in-the-crypt', 'Ghost', 'gengar', 25],
    ] as const)('stands %s every raid until it is had, and stirs it only for a %s type in front', (id, type, speciesId, level) => {
      expect(plan(7, dusk).sleeping).toContain(id);
      expect(plan(7, dusk).secrets.map((secret) => secret.id)).not.toContain(id);
      const led = plan(7, { ...dusk, leadTypes: ['Water', type] });
      expect(led.sleeping ?? []).not.toContain(id);
      expect(led.secrets.find((secret) => secret.id === id)?.reward).toEqual({ kind: 'meet', speciesId, level });
      // Had, it is gone for good, whoever leads.
      const had = plan(7, { ...dusk, leadTypes: [type] }, [`${id}/${speciesId}`]);
      expect(had.sleeping ?? []).not.toContain(id);
      expect(had.secrets.find((secret) => secret.id === id)?.reward).toBeUndefined();
    });

    it('sits the eleventh stone among the stones every raid until it is had, and opens its eyes only for a raid gone on alone', () => {
      const stone = 'the-eleventh-stone';
      expect(plan(7, dusk).sleeping).toContain(stone);
      expect(plan(7, dusk).secrets.map((secret) => secret.id)).not.toContain(stone);
      const alone = plan(7, { ...dusk, partySize: 1 });
      expect(alone.sleeping ?? []).not.toContain(stone);
      expect(alone.secrets.find((secret) => secret.id === stone)?.reward).toEqual({ kind: 'meet', speciesId: 'alakazam', level: 22 });
      expect(plan(7, { ...dusk, partySize: 3 }).secrets.map((secret) => secret.id)).not.toContain(stone);
      expect(plan(7, { ...dusk, partySize: 1 }, [`${stone}/alakazam`]).sleeping ?? []).not.toContain(stone);
    });

    it('brings the pink one down the ride only for a Bug in front, in its other colours', () => {
      const pink = 'the-pink-one';
      expect(plan(7, afternoon).secrets.map((secret) => secret.id)).not.toContain(pink);
      expect(plan(7, { ...afternoon, leadTypes: ['Bug', 'Flying'] }).secrets.find((secret) => secret.id === pink)?.reward).toEqual({
        kind: 'meet',
        speciesId: 'butterfree',
        level: 28,
        shiny: true,
      });
      // An ordinary Butterfree in the vault is not the pink one found.
      expect(secretsHeldBy({ itemCount: () => 0, pokemon: [{ speciesId: 'butterfree', shiny: false }] })).not.toContain(`${pink}/butterfree`);
      expect(secretsHeldBy({ itemCount: () => 0, pokemon: [{ speciesId: 'butterfree', shiny: true }] })).toContain(`${pink}/butterfree`);
    });

    it('brings the sticky tongue out only for a berry packed as the raid set out, and the dream eater only after dark', () => {
      const tongue = 'the-sticky-tongue';
      expect(plan(7, afternoon).secrets.map((secret) => secret.id)).not.toContain(tongue);
      for (const berry of BERRY_ITEM_IDS) {
        expect(getItemById(berry)?.category, berry).toBe(getItemById('oran-berry')?.category);
        expect(plan(7, { ...afternoon, carried: [berry] }).secrets.find((secret) => secret.id === tongue)?.reward).toEqual({ kind: 'meet', speciesId: 'lickitung', level: 24 });
      }
      const picnic = 'the-lost-picnic';
      expect(plan(7, afternoon).secrets.map((secret) => secret.id)).not.toContain(picnic);
      expect(plan(7, dusk).secrets.map((secret) => secret.id)).not.toContain(picnic);
      expect(plan(7, { ...dusk, hour: 'night' }).secrets.find((secret) => secret.id === picnic)?.reward).toEqual({ kind: 'meet', speciesId: 'hypno', level: 26 });
    });

    it('rings the drowned bell only for the badge, and only at low water', () => {
      const bell = SECRETS.find((secret) => secret.id === 'the-drowned-bell')!;
      const badge = { ...dusk, badges: [MISTY_BOSS_ID] };
      expect(plan(7, dusk).secrets.map((secret) => secret.id)).not.toContain(bell.id);
      expect(plan(7, badge).secrets.find((secret) => secret.id === bell.id)?.reward).toEqual({ kind: 'meet', speciesId: 'kabutops', level: 28 });
      expect([0, 59_999, 60_000, 119_999, 120_000].map((elapsedMs) => secretOpenAt(bell, badge, elapsedMs))).toEqual([false, false, true, true, false]);
      expect(secretOpenAt(bell, dusk, 90_000)).toBe(false);
    });

    it('ends every stretch of the clock before the shortest raid a heal leaves does', () => {
      // A stretch is read against the time gone by, as its clue says, so it
      // must end inside a raid the Pokemon Center cut by as much as it may.
      const shortest = RAID_DURATION_MS - MAX_PENDING_RECOVERY_MS;
      const stretches = (condition: SecretCondition): SecretCondition[] =>
        condition.kind === 'either' ? condition.of.flatMap(stretches) : condition.kind === 'raid-clock' ? [condition] : [];
      const timed = SECRETS.flatMap((secret) => secret.when.flatMap(stretches).map((stretch) => [secret.name, stretch] as const));
      expect(timed.length).toBeGreaterThan(0);
      for (const [name, stretch] of timed) {
        expect(stretch.kind === 'raid-clock' && stretch.untilMs <= shortest, name).toBe(true);
      }
    });

    it('lays a berry in a nook once everything in it has been found', () => {
      const spent = secretLoot(plan(7, dusk, ['chart-piece-1']));
      expect(spent).toHaveLength(1);
      expect(getItemById(spent[0].itemId)?.category).toBe(getItemById('oran-berry')?.category);
    });

    it('moves no other roll of the raid', () => {
      for (const seed of [1, 2, 3, 99]) {
        const without = plan(seed);
        const withSecrets = plan(seed, dusk);
        expect(otherLoot(withSecrets)).toEqual(otherLoot(without));
        expect(withSecrets.trainers.map((trainer) => trainer.trainer.id)).toEqual(without.trainers.map((trainer) => trainer.trainer.id));
        expect(withSecrets.hunter).toEqual(without.hunter);
      }
    });
  });

  it('cannot be drawn on a player map', () => {
    const tiny: MapFile = { ...builtInFileMap(VALE)!.file };
    const reading = readMapFile(tiny, { limits: MAP_FILE_LIMITS, draft: true });
    expect(reading.ok ? [] : reading.problems).toContain("Nothing on a map can belong to a secret: secrets are the game's own.");
  });
});
