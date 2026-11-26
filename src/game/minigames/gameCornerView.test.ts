import { describe, expect, it } from 'vitest';
import { JUMPERS_ARE, jumpTeamMarkup, type JumpCandidate } from './gameCornerView';
import { jumpTypeOf } from './pokemonJump';

const candidate = (id: string, name: string, speciesId: string): JumpCandidate => ({
  id,
  name,
  dexId: 1,
  shiny: false,
  level: 9,
  box: 'Box 1',
  find: name,
  jumpType: jumpTypeOf(speciesId),
});

describe("POKéMON JUMP's team", () => {
  it('says which kinds can jump, in names a player can go and catch, rather than "not on FireRed\'s list"', () => {
    const markup = jumpTeamMarkup({
      candidates: [candidate('a', 'Rattata', 'rattata'), candidate('b', 'Pidgey', 'pidgey')],
      chosen: [],
      tickets: 0,
      best: 0,
    });
    expect(markup).not.toContain('FireRed’s list');
    expect(markup).not.toContain('has no PIDGEY on its list');
    expect(markup).toContain(JUMPERS_ARE);
    expect(markup).toContain('PIDGEY cannot play.');
  });

  it('names only kinds that really can jump', () => {
    for (const name of ['RATTATA', 'ODDISH', 'PSYDUCK', 'PIKACHU']) {
      expect(JUMPERS_ARE).toContain(name);
      expect(jumpTypeOf(name.toLowerCase())).toBeDefined();
    }
  });
});
