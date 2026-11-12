import type { GridPosition } from '../movement/gridMovement';
import type { RestoredGame } from '../save/SaveManager';
import { openedDoors } from '../world/gates';
import { builtInFileMap } from '../world/playerMaps';
import { MISTY_BOSS_ID } from '../world/valeQuarters';
import type { WorldMapId } from '../worldMap';
import {
  CHEST_ITEM_ID,
  chartWhole,
  COAST_SHUT_LINE,
  NO_TREASURE_HUNT,
  TREASURE_GOAL,
  TREASURE_PLACE,
  TREASURE_SECRET_ID,
} from './treasureMap';

/**
 * The treasure map's X where a raid is planned: on THE RAID ARENA's telescope
 * (`base/valeOverviewView.ts`), in red over the very tile.
 *
 * A rumour is chalked as a ring over a whole district, because a rumour never
 * says the tile (`base/rumourRings.ts`). A whole chart does: that is what the
 * four pieces were for. So from the moment the last piece is pinned until the
 * chest is home, the glass carries the chart's own X on the spot, and the card
 * beside it says the goal in the hunt's own words (`TREASURE_GOAL`). Like a
 * ring it is on the glass, never the map: it lifts no cloud.
 *
 * Nothing is stored: it is the hunt, the vault and the doors. Phaser-free.
 */
export interface TreasureMark {
  /** The tile the chest is dug up at, in the map's own tiles. */
  readonly tile: GridPosition;
  readonly title: string;
  readonly lines: readonly string[];
}

/** The X a save's telescope carries on a map, if its chart is whole and the chest still under it. */
export function treasureMark(mapId: WorldMapId, game: Pick<RestoredGame, 'raidProgress' | 'stash'>): TreasureMark | undefined {
  const hunt = game.raidProgress.treasureHunt ?? NO_TREASURE_HUNT;
  if (!chartWhole(hunt) || hunt.chestOpened || game.stash.itemCount(CHEST_ITEM_ID) > 0) {
    return undefined;
  }
  const tile = builtInFileMap(mapId)?.loot.find((piece) => piece.secret === TREASURE_SECRET_ID)?.position;
  if (!tile) {
    return undefined;
  }
  const coastOpen = openedDoors(game.raidProgress).includes(MISTY_BOSS_ID);
  return {
    tile,
    title: TREASURE_GOAL.title,
    lines: [
      `${TREASURE_PLACE}: ${TREASURE_GOAL.spot}. Dig up the ${TREASURE_GOAL.prize}.`,
      ...(coastOpen ? [] : [COAST_SHUT_LINE]),
    ],
  };
}

/**
 * The X itself, as squares to fill relative to its tile's middle: two strokes
 * and a pixel of shade under each, as a ring's chalk has, so it reads on
 * bright ground as on cloud.
 */
export function treasureCross(): readonly { readonly x: number; readonly y: number; readonly ink: 'cross' | 'shade' }[] {
  const squares: { x: number; y: number; ink: 'cross' | 'shade' }[] = [];
  for (let d = -3; d <= 3; d += 1) {
    for (const [x, y] of [[d, d], [d, -d]] as const) {
      squares.push({ x, y: y + 1, ink: 'shade' }, { x: x + 1, y: y + 1, ink: 'shade' });
    }
  }
  for (let d = -3; d <= 3; d += 1) {
    for (const [x, y] of [[d, d], [d, -d]] as const) {
      squares.push({ x, y, ink: 'cross' }, { x: x + 1, y, ink: 'cross' });
    }
  }
  return squares;
}
