import { describe, expect, it } from 'vitest';
import { restoreBase } from '../base/baseGames.testkit';
import { SQUIRTLE } from '../pokemon/species';
import { createStartingStash, Stash } from '../stash';
import { hunterLineupFor } from '../world/hunter';
import { HUNTER_RIVALS, rivalForRaid } from '../world/hunters';
import {
  ARENA_INTRO_BEATS,
  ARENA_INTRO_ENDS_ON,
  ARENA_INTRO_HOST,
  ARENA_INTRO_NAMELESS,
  arenaIntroCast,
  arenaIntroOffersSkip,
  arenaIntroViewing,
  arenaIntroWords,
} from './arenaIntro';

describe('THE RAID ARENA trailer', () => {
  it('plays unasked the first time, and an older save that never knew it has not seen it', () => {
    expect(arenaIntroViewing({})).toBe('first');
    expect(arenaIntroViewing({ arenaIntroSeen: false })).toBe('first');
    expect(arenaIntroViewing({ arenaIntroSeen: true })).toBe('again');
  });

  it('offers SKIP on every viewing after the first, and not on the first', () => {
    expect(arenaIntroOffersSkip('first')).toBe(false);
    expect(arenaIntroOffersSkip('again')).toBe(true);
  });

  it('ends on the loadout, where the Arena door went before there was a trailer', () => {
    expect(ARENA_INTRO_ENDS_ON).toBe('deploy');
  });

  it('runs its beats in order, the closing card last, inside a minute', () => {
    const starts = ARENA_INTRO_BEATS.map((beat) => beat.at);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(new Set(starts).size).toBe(starts.length);
    expect(ARENA_INTRO_BEATS.at(-1)?.id).toBe('loadout');
    expect(ARENA_INTRO_BEATS.at(-1)!.at).toBeLessThan(60_000);
    // The story the captain asked for, in his order.
    expect(ARENA_INTRO_BEATS.map((beat) => beat.id)).toEqual([
      'sneak',
      'rustle',
      'battle',
      'swarm',
      'hero',
      'rescue',
      'escape',
      'extracted',
      'arena',
      'loadout',
    ]);
  });

  it("is the player's own: their partner fights, and their next raid's hunter swarms in with their team", () => {
    const game = restoreBase(createStartingStash(SQUIRTLE));
    const cast = arenaIntroCast(game, 'olly');
    expect(cast.playerName).toBe('OLLY');
    expect(cast.partner.id).toBe('squirtle');
    expect(cast.partner.move).toBe('WATER GUN');
    expect(cast.rival.id).toBe(rivalForRaid(0));
    expect(cast.swarm[0].id).toBe(hunterLineupFor(cast.rival.id)[0].id);
    expect(cast.hero.id).toBe('charizard');
    expect(cast.finds.map((find) => find.name)).toEqual(['RADIO VALVE', 'CARD KEY', 'FIRE STONE']);
  });

  it('calls a player with no name yet TRAINER, and fields Charmander for a save with no partner', () => {
    const cast = arenaIntroCast(restoreBase(new Stash()), null);
    expect(cast.playerName).toBe(ARENA_INTRO_NAMELESS);
    expect(cast.partner.id).toBe('charmander');
  });

  it('names every rival right, whoever is up next', () => {
    for (const rival of HUNTER_RIVALS) {
      const raids = HUNTER_RIVALS.indexOf(rival);
      const game = restoreBase(createStartingStash(SQUIRTLE), {
        raidRecord: { 'greystone-vale': { deployed: raids, extracted: 0, wiped: 0 } },
      });
      const words = arenaIntroWords(arenaIntroCast(game, 'ash'));
      expect(words.shout.startsWith(`${rival.name}: "`)).toBe(true);
      expect(words.shout).toBe(rival.caught[0]);
      expect(words.getaway).toBe(rival.getaway);
    }
  });

  it('closes with the host asking, then the card that leads into the loadout', () => {
    const words = arenaIntroWords(arenaIntroCast(restoreBase(createStartingStash(SQUIRTLE)), 'ash'));
    expect(words.host.every((line) => line.startsWith(`${ARENA_INTRO_HOST}: `))).toBe(true);
    expect(words.host.join(' ')).toContain('ASH');
    expect(words.host.at(-1)).toContain('ready to take on the challenge?');
    expect(words.loadout).toBe('BOOK YOUR LOADOUT TO START THE RAID');
  });
});
