import { describe, expect, it } from 'vitest';
import { MISTY_BOSS_ID } from '../world/valeQuarters';
import { RIVAL_TILE } from './arenaBouts';
import { practiceLeaders } from './gymPractice';
import { roomPeopleSeen } from './roomPeople';
import { roomNamed } from './rooms';

const everywhere = (): boolean => true;

describe('who the test description lists in a room', () => {
  it('lists the gym leader met and the rival on the Raid Arena hall floor', () => {
    // The gyms playtest of 26 Nov 2026: MISTY waits on the far floor to spar,
    // and the AI playtester was shown nobody in any room, so it could not find her.
    const leaders = practiceLeaders({ defeatedBosses: [], gymsMet: [MISTY_BOSS_ID] });
    const seen = roomPeopleSeen({ keeper: null, people: [], rival: { name: 'BLUE', tile: RIVAL_TILE }, leaders }, everywhere);
    expect(seen).toEqual([
      { kind: 'rival', name: 'BLUE', tile: RIVAL_TILE },
      { kind: 'leader', name: 'Misty', tile: leaders[0].tile },
    ]);
  });

  it("lists a room's keeper and the people standing in it", () => {
    const room = roomNamed('pokemon-centre');
    expect(room?.keeper).toBeTruthy();
    const seen = roomPeopleSeen(
      { keeper: room!.keeper, people: [{ id: 'librarian', design: 'old-woman', tile: { x: 7, y: 2 }, facing: 'down' }], rival: null, leaders: [] },
      everywhere,
    );
    expect(seen).toEqual([
      { kind: 'keeper', name: room!.keeper!.name, tile: room!.keeper!.position },
      { kind: 'person', name: 'librarian', tile: { x: 7, y: 2 } },
    ]);
  });

  it('leaves out whoever is off the screen', () => {
    const leaders = practiceLeaders({ defeatedBosses: [], gymsMet: [MISTY_BOSS_ID] });
    const seen = roomPeopleSeen({ keeper: null, people: [], rival: { name: 'BLUE', tile: RIVAL_TILE }, leaders }, (tile) => tile.x === RIVAL_TILE.x);
    expect(seen.map((each) => each.name)).toEqual(['BLUE']);
  });
});
