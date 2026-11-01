import { describe, expect, it } from 'vitest';
import { baseGame } from '../base/baseGames.testkit';
import { centerOffer, healedLine, nobodyCanRaid, recoveryTermsFor } from './centerCounter';
import { formatRecoveryClock, quoteRecovery } from './recovery';

function hurtGame() {
  const game = baseGame();
  const [stored] = game.stash.listPokemon();
  stored.pokemon.takeDamage(stored.pokemon.maxHp - 1);
  return { game, stored };
}

describe('Nurse Joy at her counter', () => {
  it('has nothing to ask of a fit team, and says so', () => {
    const offer = centerOffer(baseGame());
    expect(offer.question).toBeUndefined();
    expect(offer.lines).toEqual(['Your Pokémon are all fit to raid.']);
  });

  it('says what the clock already lost, when a fit team has a bill', () => {
    const game = { ...baseGame(), pendingRecoveryMs: 30_000 };
    expect(centerOffer(game).lines[1]).toBe('Your next raid runs 4:30: 0:30 went on recovery.');
  });

  it('opens on YES when everybody has fainted, because no other answer helps', () => {
    const { game } = hurtGame();
    for (const { pokemon } of game.stash.listPokemon()) {
      pokemon.takeDamage(pokemon.currentHp);
    }
    expect(nobodyCanRaid(game)).toBe(true);
    expect(centerOffer(game).spendsForGood).toBe(false);
    expect(centerOffer(game).lines[0]).toContain('It takes');
  });

  it('names the price before anything is spent, and it is the price the Center charges', () => {
    const { game, stored } = hurtGame();
    const offer = centerOffer(game);
    const quote = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0));

    expect(offer.question).toBe(`Shall I heal ${stored.pokemon.name}?`);
    expect(offer.spendsForGood).toBe(true);
    expect(offer.lines[0]).toContain(`${stored.pokemon.name} came home hurt`);
    expect(offer.lines[0]).toContain(`It takes ${formatRecoveryClock(quote)} off your next raid`);
    // Saying it spends nothing.
    expect(stored.pokemon.currentHp).toBe(1);
    expect(game.pendingRecoveryMs).toBe(0);
  });

  it('charges the workshop-built Center as the workshop-built Center', () => {
    const { game, stored } = hurtGame();
    const built = { ...game, raidProgress: { workshopUpgrades: ['recovery-bay-1'] } };
    const standard = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0));
    const cheaper = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor(['recovery-bay-1'], 0));

    expect(cheaper).toBeLessThan(standard);
    expect(centerOffer(built).lines[0]).toContain(`It takes ${formatRecoveryClock(cheaper)} off`);
  });

  it('charges an explorer run nothing, whose clock nothing can shorten', () => {
    const { game } = hurtGame();
    expect(centerOffer(game, true).lines[0]).toContain('It will not cost your next raid a second.');
    expect(centerOffer(game, true).spendsForGood).toBe(false);
  });

  it('says the clock it left, only when it charged one', () => {
    expect(healedLine(30_000, 30_000)).toContain('Your next raid runs 4:30.');
    expect(healedLine(0, 0)).toBe('Your Pokémon are fit to raid. We hope to see you again!');
  });
});
