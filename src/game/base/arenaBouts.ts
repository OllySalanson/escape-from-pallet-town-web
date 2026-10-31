import { Bag } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon } from '../pokemon';
import { copyPokemon } from '../save/SaveManager';
import { HUNTER_TIERS, hunterTeamFor } from '../world/hunter';
import { HUNTER_RIVALS, hunterRival, rivalForRaid, type HunterRival } from '../world/hunters';
import { ARENA_CENTRE, ARENA_MAT } from './arenaHall';
import type { BoutRecord } from './boutLadder';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { PaintedPicture } from '../world/minimap';

/**
 * Bouts for show in THE RAID ARENA, which until these was a colosseum with no
 * fights in it. Whichever hunter is due next stands on the far floor under the
 * banner, in character, and will take a bout on the sand: the real battle screen,
 * against the team that rival would field against the player's bench.
 *
 * **A bout can never write to the save, and that is by construction.** It is
 * fought by deep copies of the bench (`boutParty`, through the save's own
 * serialiser, so a copy shares nothing with what the vault holds) out of a copy of
 * the rack, on a battle scene handed no run session - and the only code in
 * `BattleScene` that touches a save stands behind one. A copy earns nothing, keeps
 * nothing and is thrown away with the fight. `arenaBouts.test.ts` and
 * `scenes/exhibitionBout.test.ts` hold all of that.
 *
 * All that comes home is which way it went, and the hall - not the fight - writes
 * one thing about it: who has been beaten in a row (`raidProgress.bouts`). Beat all
 * five in a row and the player's own banner hangs in the hall. There is no prize,
 * no experience and no risk, so this costs a raid nothing and buys it nothing but
 * a look at the face and team that are coming for it. Phaser-free.
 */

/** Where the rival waits: on the far floor, under the hall's own banner. */
export const RIVAL_TILE: GridPosition = { x: ARENA_MAT.x, y: 6 };

/**
 * Stood right up to them, the view leaves the pit and comes up to the wall, the
 * banners and the people watching. Not for walking past: a lap of the outer floor
 * is no reason to swing the camera up and back (`BaseScene.settleHallCamera`).
 */
export function nearTheRival(tile: GridPosition): boolean {
  return Math.abs(tile.x - RIVAL_TILE.x) <= 2 && tile.y <= RIVAL_TILE.y + 2;
}

/** The box's question, short enough to leave its answers a line of their own. */
export const BOUT_QUESTION = 'A BOUT FOR SHOW?';

/** Who is up: whoever hunts the next raid, unless they have been beaten this run, and then the next along. */
export function rivalUp(record: BoutRecord | undefined, raidsDeployed: number): HunterRival {
  const first = rivalForRaid(raidsDeployed);
  const start = HUNTER_RIVALS.findIndex((rival) => rival.id === first);
  for (let along = 0; along < HUNTER_RIVALS.length; along += 1) {
    const rival = HUNTER_RIVALS[(start + along) % HUNTER_RIVALS.length];
    if (!record?.beaten.includes(rival.id)) {
      return rival;
    }
  }
  return hunterRival(first);
}

/** What the board says after a bout. */
export function ladderLine(record: BoutRecord, ladderDone: boolean, won: boolean): string {
  if (ladderDone) {
    return 'ALL FIVE IN A ROW! YOUR BANNER HANGS';
  }
  return won ? `${record.beaten.length} OF ${HUNTER_RIVALS.length} IN A ROW` : 'BACK TO THE START';
}

/**
 * The fighters: deep copies of the bench, whole and rested, because nobody stays
 * hurt from a bout and nobody comes to one hurt either. They go out of the fight
 * with it, so nothing that happens to them is anybody's.
 */
export function boutParty(bench: readonly Pokemon[]): Pokemon[] {
  return bench.map((pokemon) => {
    const copy = copyPokemon(pokemon);
    copy.heal();
    copy.primaryStatus = null;
    copy.pendingMoves = [];
    return copy;
  });
}

/** What is on the rack, in a bag nobody will see again. */
export function boutBag(packed: Readonly<Record<string, number>>): Bag {
  return new Bag({ ...packed }, null);
}

/** The rival's team: what they field at the top of an ordinary raid, against this bench. */
export function boutTrainer(rival: HunterRival, party: readonly Pokemon[]): TrainerBattle {
  const top = HUNTER_TIERS[HUNTER_TIERS.length - 1];
  return {
    id: `exhibition-${rival.id}`,
    name: rival.name,
    party: hunterTeamFor(top, party, rival.id).map((member) => new Pokemon(member.species, member.level)),
    defeatText: rival.hall.beaten,
  };
}


/** What a rival has to say about how the last raid went, before they ask. */
export function rivalGreeting(rival: HunterRival, lastRaid: 'fell' | 'out' | undefined): string {
  return lastRaid === 'fell' ? rival.hall.afterLoss : lastRaid === 'out' ? rival.hall.afterOut : rival.hall.first;
}

// --- the banner -----------------------------------------------------------------

/** Where the player's banner hangs on the far wall, between a wall torch and the pillar in front of the hall's own. */
export const PLAYER_BANNER_AT = { x: ARENA_CENTRE.x - 88, y: 30 } as const;

const BANNER_WIDTH = 15;
const BANNER_HEIGHT = 38;
const BANNER_RED: readonly [number, number, number] = [120, 24, 32];
const BANNER_LIGHT: readonly [number, number, number] = [160, 40, 40];
const BANNER_DARK: readonly [number, number, number] = [80, 16, 24];
const BANNER_GOLD: readonly [number, number, number] = [240, 196, 84];
const BANNER_IRON: readonly [number, number, number] = [24, 24, 36];

/** A banner of the hall's own cloth, swallow-tailed, with a gold star for every time through all five. */
export function paintPlayerBanner(ladders: number): PaintedPicture {
  const data = new Uint8ClampedArray(BANNER_WIDTH * BANNER_HEIGHT * 4);
  const put = (x: number, y: number, ink: readonly [number, number, number]): void => {
    const at = (y * BANNER_WIDTH + x) * 4;
    data[at] = ink[0];
    data[at + 1] = ink[1];
    data[at + 2] = ink[2];
    data[at + 3] = 255;
  };
  for (let x = 0; x < BANNER_WIDTH; x += 1) {
    put(x, 0, BANNER_IRON);
  }
  for (let y = 1; y < BANNER_HEIGHT; y += 1) {
    const tail = BANNER_HEIGHT - y;
    for (let x = 0; x < BANNER_WIDTH; x += 1) {
      const off = Math.abs(x - 7);
      if (tail < 7 && off < 7 - tail) {
        continue;
      }
      put(x, y, x === 0 || x === BANNER_WIDTH - 1 ? BANNER_DARK : x < 3 ? BANNER_LIGHT : x === 3 || x === BANNER_WIDTH - 4 ? BANNER_GOLD : BANNER_RED);
    }
  }
  // As many stars as the cloth has room for: anybody past five has made the point.
  for (let star = 0; star < Math.min(5, Math.max(1, ladders)); star += 1) {
    const y = 6 + star * 5;
    put(7, y - 1, BANNER_GOLD);
    put(6, y, BANNER_GOLD);
    put(7, y, BANNER_GOLD);
    put(8, y, BANNER_GOLD);
    put(7, y + 1, BANNER_GOLD);
  }
  return { width: BANNER_WIDTH, height: BANNER_HEIGHT, data };
}
export const PLAYER_BANNER_SIZE = { width: BANNER_WIDTH, height: BANNER_HEIGHT } as const;
