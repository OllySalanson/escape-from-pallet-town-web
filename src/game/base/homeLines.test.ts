import { describe, expect, it } from 'vitest';
import { raidsDeployed, type MapRaidRecord } from '../save/SaveManager';
import { HUNTER_RIVALS, hunterRival, rivalForRaid } from '../world/hunters';
import { baseGame } from './baseGames.testkit';
import {
  bedLines,
  calendarDay,
  calendarLines,
  consoleLine,
  nextRival,
  partnerRug,
  pcLines,
  tellyLines,
} from './homeLines';

const raids = (record: Record<string, MapRaidRecord>) => baseGame({ progress: { raidRecord: record } });

describe("what the things in THE BOLTHOLE say", () => {
  /**
   * The telly is the hunter forecast, so it has to name the rival the next raid
   * is actually hunted by - the same rotation `HubScene` hands the raid.
   */
  it('forecasts the rival who will hunt the next raid, raid after raid', () => {
    for (let deployed = 0; deployed < HUNTER_RIVALS.length * 2; deployed += 1) {
      const game = raids({ 'route-1': { deployed, extracted: 0, wiped: deployed } });
      const rival = hunterRival(rivalForRaid(raidsDeployed(game.raidProgress)));
      expect(nextRival(game)).toBe(rival.id);
      const lines = tellyLines(game);
      expect(lines[0].startsWith('KANTO TONIGHT')).toBe(true);
      expect(lines.join(' ')).toContain(rival.name);
    }
  });

  it('gives every rival a report of their own on the telly', () => {
    const reports = HUNTER_RIVALS.map(
      (_rival, index) => tellyLines(raids({ 'route-1': { deployed: index, extracted: 0, wiped: index } }))[0],
    );
    expect(new Set(reports).size).toBe(HUNTER_RIVALS.length);
  });

  it('keeps the raid log on the PC, from the save\'s own record', () => {
    expect(pcLines(baseGame())[0]).toContain('No raids yet');
    const game = raids({
      'floodplain-relay': { deployed: 7, extracted: 5, wiped: 2 },
      'route-1': { deployed: 2, extracted: 1, wiped: 1 },
    });
    const lines = pcLines(game);
    expect(lines[0]).toBe('RAID LOG. 9 raids: 6 came home, 3 lost.');
    expect(lines[1]).toBe('Raided most: FLOODPLAIN RELAY, 7 times.');
    expect(lines[2]).toContain('Pokémon for you');
  });

  it('names only what Bill is keeping, never a purse of nothing', () => {
    const broke = baseGame();
    expect(broke.stash.itemCount('money')).toBe(0);
    const count = broke.stash.listPokemon().length;
    expect(pcLines(broke).at(-1)).toBe(`Bill is keeping ${count} Pokémon for you.`);
    broke.stash.addItem('money', 40);
    expect(pcLines(broke).at(-1)).toBe(`Bill is keeping ₽40 and ${count} Pokémon for you.`);
  });

  it('turns the calendar a day for every raid', () => {
    expect(calendarDay(baseGame())).toBe(1);
    expect(calendarLines(baseGame())[0]).toContain('DAY 1');
    const game = raids({ 'route-1': { deployed: 3, extracted: 2, wiped: 1 } });
    expect(calendarDay(game)).toBe(4);
    expect(calendarLines(game)).toEqual([
      'DAY 4. Every raid is a day on this calendar, and 3 are crossed off.',
      '2 of them have a tick for coming home.',
    ]);
  });

  it('says the ticks as a sentence, whatever the count', () => {
    const tick = (deployed: number, extracted: number) =>
      calendarLines(raids({ 'route-1': { deployed, extracted, wiped: deployed - extracted } }))[1];
    expect(tick(1, 1)).toBe('It has a tick for coming home.');
    expect(tick(1, 0)).toBe('It has no tick for coming home.');
    expect(tick(3, 1)).toBe('1 of them has a tick for coming home.');
    expect(tick(3, 0)).toBe('None of them has a tick for coming home.');
    expect(tick(3, 3)).toBe('Every one of them has a tick for coming home.');
  });

  /**
   * The bed is somewhere to lie down, never a heal: healing is Joy's and is
   * priced in raid time, and the bed has to say so rather than leave a player
   * thinking their team is fit.
   */
  it('dreams of where the player keeps going, and sends them to Joy for healing', () => {
    const lines = bedLines(raids({ 'viridian-forest': { deployed: 4, extracted: 3, wiped: 1 } }));
    expect(lines.join(' ')).toContain('VIRIDIAN FOREST');
    expect(lines.at(-1)).toContain('NURSE JOY');
    expect(bedLines(baseGame()).join(' ')).toContain('drop-in');
  });

  it('lets the player win at the console on the fourth go, and only then', () => {
    expect(consoleLine(0)).toContain('lose');
    expect(consoleLine(2)).toContain('lose');
    expect(consoleLine(3)).toContain('finally beat');
    expect(consoleLine(4)).not.toContain('finally');
  });

  it("colours the upstairs rug after the player's partner", () => {
    const game = baseGame();
    expect(partnerRug({ ...game, starterSpeciesId: 'charmander' })).toBe('red');
    expect(partnerRug({ ...game, starterSpeciesId: 'squirtle' })).toBe('blue');
    expect(partnerRug({ ...game, starterSpeciesId: 'bulbasaur' })).toBe('green');
    expect(partnerRug({ ...game, starterSpeciesId: null })).toBe('green');
  });
});
