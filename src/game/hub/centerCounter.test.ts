import { describe, expect, it } from 'vitest';
import { baseGame } from '../base/baseGames.testkit';
import { centerOffer, healedLine, joyRailLine, joyTurnsHurtAway, nobodyCanRaid, PLAIN_HEAL_QUESTION, recoveryTermsFor } from './centerCounter';
import { formatRecoveryClock, healDayOf, MAX_PENDING_RECOVERY_MS, quoteRecovery } from './recovery';

/**
 * A save that has had today's free heal, and whose first Pokémon came home
 * fainted: bringing it round is the one thing she charges for.
 */
function hurtGame() {
  const game = { ...baseGame(), freeHealDay: healDayOf(new Date()) };
  const [stored] = game.stash.listPokemon();
  stored.pokemon.takeDamage(stored.pokemon.maxHp);
  return { game, stored };
}

/**
 * She greets and asks, as FireRed's nurse does, and the price is in the
 * question: two to four boxes of rules stood in front of it (the harbour
 * audit, 27 Nov 2026).
 */
describe('Nurse Joy at her counter', () => {
  it("asks a fit team too, as FireRed's nurse does, and says so on YES", () => {
    const offer = centerOffer(baseGame());
    expect(offer.question).toBe(PLAIN_HEAL_QUESTION);
    expect(offer.heals).toBe(false);
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
    expect(centerOffer(game).question).toContain('It takes');
  });

  it('names the price in the question, before anything is spent, and it is the price the Center charges', () => {
    const { game, stored } = hurtGame();
    const offer = centerOffer(game);
    const quote = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0));

    expect(offer.question).toBe(`Shall I heal ${stored.pokemon.name}? It takes ${formatRecoveryClock(quote)} off your next raid.`);
    expect(offer.heals).toBe(true);
    expect(offer.spendsForGood).toBe(true);
    expect(offer.lines).toEqual([]);
    // Asking spends nothing.
    expect(stored.pokemon.currentHp).toBe(0);
    expect(game.pendingRecoveryMs).toBe(0);
  });

  it('holds a treatment back while the debt is already at the cap, and says so to YES', () => {
    const { game, stored } = hurtGame();
    const offer = centerOffer({ ...game, pendingRecoveryMs: MAX_PENDING_RECOVERY_MS });

    expect(offer.question).toBe(PLAIN_HEAL_QUESTION);
    expect(offer.heals).toBe(false);
    expect(offer.lines[0]).toContain('as short as I will make it');
    expect(offer.lines[1]).toBe('Raid first, then come and see me.');
    expect(stored.pokemon.currentHp).toBe(0);
  });

  it('says she turns the hurt away exactly when her offer does, so the rim never sends the player to her', () => {
    // The rim's card said "Nurse Joy can help" straight after she had said
    // "Raid first, then come and see me" (first-time-friend retest, 23 Nov 2026).
    const { game } = hurtGame();
    const capped = { ...game, pendingRecoveryMs: MAX_PENDING_RECOVERY_MS };
    expect(joyTurnsHurtAway(capped)).toBe(true);
    expect(centerOffer(capped).heals).toBe(false);
    expect(joyTurnsHurtAway(game)).toBe(false);
    expect(centerOffer(game).heals).toBe(true);
    // The explorer run's clock cannot be shortened, so she never turns it away.
    expect(joyTurnsHurtAway(capped, true)).toBe(false);
  });

  it('charges the workshop-built Center as the workshop-built Center', () => {
    const { game, stored } = hurtGame();
    const built = { ...game, raidProgress: { workshopUpgrades: ['recovery-bay-1'] } };
    const standard = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0));
    const cheaper = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor(['recovery-bay-1'], 0));

    expect(cheaper).toBeLessThan(standard);
    expect(centerOffer(built).question).toContain(`It takes ${formatRecoveryClock(cheaper)} off`);
  });

  it('counts THE WARD in the price, and says nothing else about it', () => {
    const { game } = hurtGame();
    const ward = { ...game, raidProgress: { workshopUpgrades: ['quarantine-ward'] } };
    // Fainted: the bed brings it round, and the price is nothing.
    expect(centerOffer(ward).question).toContain("It won't cost your next raid a second.");
    expect(centerOffer(ward).spendsForGood).toBe(false);
    expect([centerOffer(ward).question, ...centerOffer(ward).lines].join(' ')).not.toContain('WARD');
  });

  it('heals free the first time each day, and the question is the only place it says so', () => {
    const { game, stored } = hurtGame();
    stored.pokemon.takeDamage(stored.pokemon.currentHp);
    const today = new Date(2026, 10, 22, 18);
    const offer = centerOffer({ ...game, freeHealDay: undefined }, false, today);
    expect(offer.question).toBe(`Shall I heal ${stored.pokemon.name}? It won't cost your next raid a second.`);
    // A free heal opens on YES, as FireRed's does.
    expect(offer.spendsForGood).toBe(false);
    // Taken today, she charges; tomorrow it is free again.
    const taken = { ...game, freeHealDay: healDayOf(today) };
    expect(centerOffer(taken, false, today).question).toContain('It takes');
    expect(centerOffer(taken, false, new Date(2026, 10, 23, 9)).question).toContain("It won't cost");
  });

  it('never explains a rule: no line or question says what healing ever costs', () => {
    const { game } = hurtGame();
    const today = new Date(2026, 10, 22, 18);
    for (const one of [game, { ...game, freeHealDay: undefined }, { ...game, pendingRecoveryMs: MAX_PENDING_RECOVERY_MS }, baseGame()]) {
      const offer = centerOffer(one, false, today);
      expect([offer.question, ...offer.lines].join(' ')).not.toMatch(/Only a faint|free heal today|each day|tomorrow/);
    }
  });

  it('charges an explorer run nothing, whose clock nothing can shorten', () => {
    const { game } = hurtGame();
    expect(centerOffer(game, true).question).toContain("It won't cost your next raid a second.");
    expect(centerOffer(game, true).spendsForGood).toBe(false);
  });

  it('says the clock it left, only when it charged one', () => {
    expect(healedLine(30_000, 30_000)).toContain('Your next raid runs 4:30.');
    expect(healedLine(0, 0)).toBe('Your Pokémon are fit to raid. We hope to see you again!');
  });
});

describe("the rim's word on Nurse Joy", () => {
  /**
   * "Nurse Joy can help" with no price was where an impatient player chose to
   * go out hurt (the overnight retest, 23 Nov 2026): the card says her price,
   * in the words of her own quote.
   */
  it('says her price, the free heal, or that she heals again after this raid', () => {
    const { game, stored } = hurtGame();
    const quote = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0, game.freeHealDay));
    expect(joyRailLine(game)).toBe(`Nurse Joy can heal them for ${formatRecoveryClock(quote)} of your next raid.`);
    expect(joyRailLine({ ...game, freeHealDay: undefined })).toBe("Nurse Joy's first heal today is free.");
    expect(joyRailLine({ ...game, pendingRecoveryMs: MAX_PENDING_RECOVERY_MS })).toBe('Nurse Joy heals again after this raid.');
    expect(joyRailLine(baseGame())).toBe('Nurse Joy can help.');
  });

  it('says nothing of the free heal over a scratch, which is free any day', () => {
    const { game } = hurtGame();
    const scratched = { ...game, freeHealDay: undefined };
    const [first] = scratched.stash.listPokemon();
    first.pokemon.currentHp = first.pokemon.maxHp - 2;
    const offer = centerOffer(scratched);
    expect(offer.lines.join(' ')).not.toContain('first heal today');
    expect(offer.question).toContain("It won't cost your next raid a second.");
  });
});
