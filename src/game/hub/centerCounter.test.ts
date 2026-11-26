import { describe, expect, it } from 'vitest';
import { baseGame } from '../base/baseGames.testkit';
import { centerOffer, HEAL_RULE_LINE, healedLine, joyRailLine, joyTurnsHurtAway, nobodyCanRaid, recoveryTermsFor } from './centerCounter';
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
    expect(centerOffer(game).lines[0]).toContain('Healing would take');
  });

  it('names the price before anything is spent, and it is the price the Center charges', () => {
    const { game, stored } = hurtGame();
    const offer = centerOffer(game);
    const quote = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0));

    expect(offer.question).toBe(`Shall I heal ${stored.pokemon.name}?`);
    expect(offer.spendsForGood).toBe(true);
    expect(offer.lines[0]).toContain(`${stored.pokemon.name} fainted`);
    expect(offer.lines[0]).toContain(`Healing would take ${formatRecoveryClock(quote)} off your next raid`);
    // Saying it spends nothing.
    expect(stored.pokemon.currentHp).toBe(0);
    expect(game.pendingRecoveryMs).toBe(0);
  });

  it('holds a treatment back while the debt is already at the cap, and asks for a raid first', () => {
    const { game, stored } = hurtGame();
    const offer = centerOffer({ ...game, pendingRecoveryMs: MAX_PENDING_RECOVERY_MS });

    expect(offer.question).toBeUndefined();
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
    expect(centerOffer(capped).question).toBeUndefined();
    expect(joyTurnsHurtAway(game)).toBe(false);
    expect(centerOffer(game).question).toBeDefined();
    // The explorer run's clock cannot be shortened, so she never turns it away.
    expect(joyTurnsHurtAway(capped, true)).toBe(false);
  });

  it('charges the workshop-built Center as the workshop-built Center', () => {
    const { game, stored } = hurtGame();
    const built = { ...game, raidProgress: { workshopUpgrades: ['recovery-bay-1'] } };
    const standard = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor([], 0));
    const cheaper = quoteRecovery(game.stash, 0, [stored.id], recoveryTermsFor(['recovery-bay-1'], 0));

    expect(cheaper).toBeLessThan(standard);
    expect(centerOffer(built).lines[0]).toContain(`Healing would take ${formatRecoveryClock(cheaper)} off`);
  });

  it('says who THE WARD takes, and when the bed is used', () => {
    const { game, stored } = hurtGame();
    const ward = { ...game, raidProgress: { workshopUpgrades: ['quarantine-ward'] } };
    const name = stored.pokemon.name;
    // Fainted: the bed brings it round, and the bill is nothing.
    expect(centerOffer(ward).lines).toContain(`THE WARD takes ${name}, so bringing it round is free.`);
    expect(centerOffer(ward).lines[0]).toContain("Healing won't cost your next raid a second.");
    // The bed used this raid: she says so, rather than nothing.
    expect(centerOffer({ ...ward, wardTreatmentsUsed: 3 }).lines).toContain('THE WARD’s beds are used until your next raid.');
    // Without the ward, not a word about it.
    expect(centerOffer(game).lines.join(' ')).not.toContain('WARD');
  });

  it("heals free the first time each day, and says so and what healing ever costs", () => {
    const { game, stored } = hurtGame();
    stored.pokemon.takeDamage(stored.pokemon.currentHp);
    const today = new Date(2026, 10, 22, 18);
    const fresh = { ...game, freeHealDay: undefined };
    const offer = centerOffer(fresh, false, today);
    expect(offer.lines[0]).toContain("Your first heal today is free: it won't cost your next raid a second.");
    // Said once: the free line, and not the rule beside it (retest, 22 Nov 2026).
    expect(offer.lines).not.toContain(HEAL_RULE_LINE);
    expect(offer.lines.join(' ').match(/free/g)).toHaveLength(1);
    expect(HEAL_RULE_LINE).toBe('Healing is free. Bringing a Pokémon round from a faint costs at most 1:00 of a raid, and the first each day is free.');
    // A free heal opens on YES, as FireRed's does.
    expect(offer.spendsForGood).toBe(false);
    // Taken today, she charges, and still says the rule; tomorrow it is free again.
    const taken = { ...game, freeHealDay: healDayOf(today) };
    expect(centerOffer(taken, false, today).lines[0]).toContain('Healing would take');
    expect(centerOffer(taken, false, today).lines).toContain(HEAL_RULE_LINE);
    expect(centerOffer(taken, false, new Date(2026, 10, 23, 9)).lines[0]).toContain('first heal today is free');
  });

  it('charges an explorer run nothing, whose clock nothing can shorten', () => {
    const { game } = hurtGame();
    expect(centerOffer(game, true).lines[0]).toContain("Healing won't cost your next raid a second.");
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
    expect(offer.lines[0]).toContain("Healing won't cost your next raid a second.");
  });
});
