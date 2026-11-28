import { describe, expect, it } from 'vitest';
import { JUMPERS_ARE, jumpTeamMarkup, type JumpCandidate } from './gameCornerView';
import { jumpTypeOf } from './pokemonJump';

const candidate = (id: string, name: string, speciesId: string): JumpCandidate => ({
  id,
  name,
  dexId: 1,
  shiny: false,
  level: 9,
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
    expect(markup).toContain('Pidgey cannot play.');
  });

  it('stands the ones chosen over the list, in the order they were chosen, and heads every row with its icon', () => {
    const rattata = { ...candidate('a', 'Rattata', 'rattata'), dexId: 19 };
    const pikachu = { ...candidate('b', 'Pikachu', 'pikachu'), dexId: 25 };
    const markup = jumpTeamMarkup({ candidates: [rattata, pikachu, candidate('c', 'Pidgey', 'pidgey')], chosen: ['b', 'a'], tickets: 0, best: 0 });

    // One window: its heading and count, the line-up, the list.
    expect(markup).toContain('<section class="px-window has-lineup"><header class="px-heading"><h2>Who jumps?</h2><small>2 of 3</small></header><div class="lineup-places"');
    // Pikachu was chosen first, so it stands first.
    expect(markup.indexOf('/assets/pokemon/front/25.png')).toBeLessThan(markup.indexOf('/assets/pokemon/front/19.png'));
    expect(markup.match(/class="lineup-place is-free"/g)).toHaveLength(1);
    expect(markup.match(/class="px-row has-icon/g)).toHaveLength(3);
    expect(markup.match(/px-mon-icon/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('names only kinds that really can jump', () => {
    for (const name of ['RATTATA', 'ODDISH', 'PSYDUCK', 'PIKACHU']) {
      expect(JUMPERS_ARE).toContain(name);
      expect(jumpTypeOf(name.toLowerCase())).toBeDefined();
    }
  });
});
