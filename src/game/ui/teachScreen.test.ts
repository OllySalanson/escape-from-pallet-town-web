import { describe, expect, it } from 'vitest';
import { getItemById, type ItemDefinition } from '../items';
import { machineForItem } from '../items/teaching';
import { BULBASAUR, CHARMANDER, PIKACHU, Pokemon, SQUIRTLE } from '../pokemon';
import { canChoosePupil, pupilOutcome, pupilVerdict, teachBody } from './teachScreen';

const disc = (id: string): ItemDefinition => getItemById(id)!;
const AERIAL_ACE = disc('tm40-aerial-ace');
const ROCK_SMASH = disc('hm06-rock-smash');
const machineOf = (item: ItemDefinition) => machineForItem(item)!;

/** Four Pokemon who answer Aerial Ace four different ways. */
function party(): Pokemon[] {
  const knows = new Pokemon(CHARMANDER, 5);
  knows.learnMove(machineOf(AERIAL_ACE).move);
  return [
    new Pokemon(CHARMANDER, 5), // a free slot
    new Pokemon(CHARMANDER, 20), // four moves already
    new Pokemon(SQUIRTLE, 5), // canon says no
    knows,
  ];
}

const view = (chosen: number | null, item = AERIAL_ACE, members = party()) => ({
  item,
  machine: machineOf(item),
  party: members,
  carried: 1,
  chosen,
});

describe('who can read a disc', () => {
  it('says what the disc would do to each Pokemon, in words', () => {
    const machine = machineOf(AERIAL_ACE);
    const [free, full, refused, knows] = party();
    expect(pupilVerdict(machine, free)).toBe('learns');
    expect(pupilVerdict(machine, full)).toBe('replaces');
    expect(pupilVerdict(machine, refused)).toBe('cannot');
    expect(pupilVerdict(machine, knows)).toBe('knows');
    expect(pupilOutcome(machine, free)).toBe('Has a free slot: learns AERIAL ACE and forgets nothing.');
    expect(pupilOutcome(machine, full)).toBe('Knows four moves: you pick which one AERIAL ACE replaces.');
    expect(pupilOutcome(machine, refused)).toBe('Cannot learn AERIAL ACE.');
    expect(pupilOutcome(machine, knows)).toBe('Already knows AERIAL ACE.');
  });

  it('only lets a Pokemon that would learn it be chosen', () => {
    expect(canChoosePupil('learns')).toBe(true);
    expect(canChoosePupil('replaces')).toBe(true);
    expect(canChoosePupil('knows')).toBe(false);
    expect(canChoosePupil('cannot')).toBe(false);
  });
});

describe('the teaching screen', () => {
  it('names the disc, the move and what becomes of the disc before anything is chosen', () => {
    const markup = teachBody(view(null));
    expect(markup).toContain('TM40 Aerial Ace');
    expect(markup).toContain('px-type-flying');
    expect(markup).toContain('A TM is used up once a Pokémon learns it.');
    expect(teachBody(view(null, ROCK_SMASH, [new Pokemon(BULBASAUR, 5)]))).toContain('An HM is never used up');
  });

  it('shows every party member as a card with the moves it knows and its free slots', () => {
    const markup = teachBody(view(null));
    expect(markup.match(/data-pupil="/g)).toHaveLength(4);
    // The Charmander at level 5 knows two moves: two named, two free.
    for (const move of new Pokemon(CHARMANDER, 5).moves) {
      expect(markup).toContain(move.base.name);
    }
    expect(markup).toContain('Free slot');
    expect(markup).toContain('pokemon/front/4.png');
  });

  it('lets a refused card be pointed at but not chosen', () => {
    const markup = teachBody(view(null));
    expect(markup).toMatch(/is-cannot"[^>]*data-pupil="2" aria-disabled="true"/);
    expect(markup).toMatch(/is-knows"[^>]*data-pupil="3" aria-disabled="true"/);
    expect(markup).not.toMatch(/data-pupil="0" aria-disabled/);
    expect(markup).toContain('2 of 4 can');
  });

  it('teaches nothing until a Pokemon is chosen', () => {
    const markup = teachBody(view(null));
    expect(markup).not.toContain('is-selected');
    expect(markup).toMatch(/data-teach aria-disabled="true"/);
    expect(markup).toContain('Who should learn AERIAL ACE?');
  });

  it('marks the chosen card and asks, naming who and what', () => {
    const free = teachBody(view(0));
    expect(free).toMatch(/is-selected" data-pupil="0"/);
    expect(free).toContain('Teach AERIAL ACE to CHARMANDER?');
    expect(free).toContain('learns AERIAL ACE in a free slot and forgets nothing');
    expect(free).not.toMatch(/data-teach aria-disabled/);
    expect(free).toContain('data-teach-cancel');

    const full = teachBody(view(1));
    expect(full).toContain('Pick a move to forget');
    expect(full).toContain('Nothing is forgotten until you confirm');
  });

  it('says so when nobody can learn it', () => {
    const markup = teachBody(view(null, AERIAL_ACE, [new Pokemon(SQUIRTLE, 5), new Pokemon(PIKACHU, 5)]));
    expect(markup).toContain('Nobody in the party can learn AERIAL ACE');
  });

  it('draws no typed arrows or ticks, which the face does not have', () => {
    expect(teachBody(view(1))).not.toMatch(/[→←↑↓▶✓✔]/);
  });
});
