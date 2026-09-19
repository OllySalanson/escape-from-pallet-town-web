import { describe, expect, it } from 'vitest';
import { Move } from '../pokemon/Move';
import { EMBER, GROWL, Pokemon, SCRATCH, TACKLE, WATER_GUN, CHARMANDER } from '../pokemon';
import { moveChoiceMessage, moveChooserMarkup, moveFacts } from './moveChooser';

const crowded = (): Pokemon => {
  const pokemon = new Pokemon(CHARMANDER, 7);
  pokemon.moves.push(new Move(TACKLE));
  return pokemon;
};

describe('the move chooser', () => {
  it('names every current move with its type and power, and the new one beside them', () => {
    const pokemon = crowded();
    const markup = moveChooserMarkup({ pokemon, incoming: WATER_GUN, canDefer: false });
    for (const move of pokemon.moves) {
      expect(markup).toContain(move.base.name.toUpperCase());
    }
    expect(markup).toContain('WATER GUN');
    expect(markup).toContain('px-type-water');
    expect(markup).toContain(`POW ${WATER_GUN.power}`);
    expect(markup.match(/data-forget="/g)).toHaveLength(4);
  });

  it('always offers a way to keep all four, and says what it does', () => {
    const markup = moveChooserMarkup({ pokemon: crowded(), incoming: WATER_GUN, canDefer: false });
    expect(markup).toContain('data-decline');
    expect(markup).toContain('Do not learn WATER GUN');
    expect(markup).not.toContain('data-later');
  });

  it('offers "decide later" only where nobody is mid-fight', () => {
    const at = (canDefer: boolean) =>
      moveChooserMarkup({ pokemon: crowded(), incoming: WATER_GUN, canDefer });
    expect(at(true)).toContain('data-later');
    expect(at(false)).not.toContain('data-later');
  });

  it('draws no typed arrows or ticks, which the face does not have', () => {
    const markup = moveChooserMarkup({ pokemon: crowded(), incoming: WATER_GUN, canDefer: true });
    expect(markup).not.toMatch(/[→←↑↓▶✓✔]/);
  });

  it('says the loss out loud', () => {
    expect(moveChoiceMessage('Charmander', WATER_GUN, SCRATCH)).toBe(
      'CHARMANDER forgot SCRATCH and learned WATER GUN!',
    );
    expect(moveChoiceMessage('Charmander', WATER_GUN, null)).toBe(
      'CHARMANDER did not learn WATER GUN.',
    );
  });

  it('prints a status move without a made-up power', () => {
    expect(moveFacts(GROWL)).toContain('POW -');
    expect(moveFacts(EMBER)).toContain(`POW ${EMBER.power}`);
    expect(moveFacts(TACKLE, 3)).toContain(`PP 3/${TACKLE.pp}`);
  });
});
