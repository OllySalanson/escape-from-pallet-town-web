import type { GridPosition } from '../movement/gridMovement';
import type { BaseKeeper } from './doors';
import type { PracticeLeader } from './gymPractice';
import type { RoomPerson } from './rooms';

/** Somebody standing in a room, as the test description lists them (`describeForTest`). */
export interface RoomPersonSeen {
  readonly kind: 'keeper' | 'person' | 'rival' | 'leader';
  readonly name: string;
  readonly tile: GridPosition;
}

/** Who stands in the room the player is in: its keeper, its other people, and THE RAID ARENA hall's rival and gym leaders. */
export interface RoomCast {
  readonly keeper: BaseKeeper | null;
  readonly people: readonly RoomPerson[];
  readonly rival: { readonly name: string; readonly tile: GridPosition } | null;
  readonly leaders: readonly PracticeLeader[];
}

/**
 * Everybody in a room that the screen shows. The hall's far floor holds the
 * next hunter and every gym leader met, there to spar, and the AI playtester
 * could not see one of them, so it never found MISTY to practise against
 * (gyms playtest, 26 Nov 2026).
 */
export function roomPeopleSeen(cast: RoomCast, onScreen: (tile: GridPosition) => boolean): RoomPersonSeen[] {
  const seen: RoomPersonSeen[] = [
    ...(cast.keeper ? [{ kind: 'keeper' as const, name: cast.keeper.name, tile: cast.keeper.position }] : []),
    ...cast.people.map((person) => ({ kind: 'person' as const, name: person.id, tile: person.tile })),
    ...(cast.rival ? [{ kind: 'rival' as const, name: cast.rival.name, tile: cast.rival.tile }] : []),
    ...cast.leaders.map((leader) => ({ kind: 'leader' as const, name: leader.gym.leader, tile: leader.tile })),
  ];
  return seen.filter((each) => onScreen(each.tile)).map((each) => ({ ...each, tile: { x: each.tile.x, y: each.tile.y } }));
}
