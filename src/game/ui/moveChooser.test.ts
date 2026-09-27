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

  it('forgets nothing on the first press: picking a move marks it and asks', () => {
    const pokemon = crowded();
    const open = moveChooserMarkup({ pokemon, incoming: WATER_GUN, canDefer: false });
    expect(open).not.toContain('data-forget-confirm');
    expect(open).toContain('Nothing is lost until you confirm');

    const marked = moveChooserMarkup({ pokemon, incoming: WATER_GUN, canDefer: false }, 1);
    const second = pokemon.moves[1].base.name.toUpperCase();
    expect(marked).toContain(`Forget ${second} and learn WATER GUN?`);
    expect(marked).toMatch(/is-forgetting" data-forget="1" aria-pressed="true"/);
    expect(marked).toContain(`>Forget ${second}</button>`);
    // Keeping all four is still one press away while a move is marked.
    expect(marked).toContain('data-decline');
  });

  it('shows who is learning and says whether the disc is spent', () => {
    const pokemon = crowded();
    const tm = moveChooserMarkup(
      { pokemon, incoming: WATER_GUN, canDefer: false, source: 'TM03 Water Gun', spendsSource: true },
      0,
    );
    expect(tm).toContain('pokemon/front/4.png');
    expect(tm).toContain('from TM03 Water Gun');
    expect(tm).toContain('TM03 Water Gun is used up once it is learned.');
    const hm = moveChooserMarkup(
      { pokemon, incoming: WATER_GUN, canDefer: false, source: 'HM03 Surf', spendsSource: false },
      0,
    );
    expect(hm).toContain('HM03 Surf is not used up.');
  });

  it('describes every move it offers to forget, on the card and on the help bar', () => {
    const pokemon = crowded();
    const markup = moveChooserMarkup({ pokemon, incoming: WATER_GUN, canDefer: false });
    for (const move of pokemon.moves) {
      if (move.base.description) {
        expect(markup).toContain(move.base.description);
      }
    }
    expect(markup).toContain(`Mark ${pokemon.moves[0].base.name.toUpperCase()} to forget.`);
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
