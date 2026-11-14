import { describe, expect, it } from 'vitest';
import { BREATH_LISTENS_AFTER_MS, MOST_WORDS, RAIDS_NAMED_IN_FULL, RAIL_STAMP_EDGE, betOf, breathMs, climbAt, fitRailStamps, railStampRoom, railStamps, stakeWords, wordsUpAt, type AtRisk } from './heldBreath';
import { tabOverGame } from '../feedback/feedbackTabCover';
import { BASE_STAGE_WIDTH, computeStage } from '../display/stage';

const team: AtRisk = {
  pokemon: [
    { name: 'Pidgeotto', level: 17 },
    { name: 'Charmeleon', level: 19 },
  ],
  pack: 'Ranger pack',
  packIsBetter: true,
  items: ['Potion ×2', 'Super Potion ×2'],
};

describe('the held breath', () => {
  it('names everything at risk on a team\'s first raids, whoever is most at stake first', () => {
    for (let raids = 1; raids <= RAIDS_NAMED_IN_FULL; raids += 1) {
      expect(stakeWords(team, raids)).toEqual(['AT RISK', 'CHARMELEON', 'PIDGEOTTO', 'RANGER PACK', 'POTION ×2', 'SUPER POTION ×2']);
    }
  });

  it('after that says only what would hurt, so it never drags at raid two hundred', () => {
    expect(stakeWords(team, RAIDS_NAMED_IN_FULL + 1)).toEqual(['AT RISK', 'CHARMELEON']);
    expect(stakeWords(team, 200)).toEqual(['AT RISK', 'CHARMELEON']);
    expect(stakeWords({ ...team, pokemon: [] }, 200)).toEqual(['AT RISK', 'RANGER PACK']);
  });

  it('after that has nothing to say of the pack everybody is issued, or of a stack of Potions', () => {
    const everyday: AtRisk = { pokemon: [], pack: 'Raid pack', packIsBetter: false, items: ['Potion ×3'] };
    expect(stakeWords(everyday, RAIDS_NAMED_IN_FULL)).toEqual(['AT RISK', 'RAID PACK', 'POTION ×3']);
    expect(stakeWords(everyday, RAIDS_NAMED_IN_FULL + 1)).toEqual([]);
    expect(stakeWords(everyday, 200)).toEqual([]);
  });

  it('says so when there is nothing to lose, only on a team\'s first raids', () => {
    const nothing: AtRisk = { pokemon: [], pack: null, packIsBetter: false, items: [] };
    expect(stakeWords(nothing, 1)).toEqual(['NOTHING TO LOSE']);
    expect(stakeWords(nothing, 200)).toEqual([]);
  });

  it('never asks the screen to hold more than it can', () => {
    const items = Array.from({ length: 12 }, (_each, index) => `Thing ${index}`);
    expect(stakeWords({ ...team, items }, 1)).toHaveLength(MOST_WORDS);
  });

  it('says what the words are: AT RISK over them, and what is SAFE under them', () => {
    expect(railStamps({ ...team, safe: ['Pidgey', 'Rattata', 'Oddish'] }, 1)).toEqual([
      { text: 'AT RISK', kind: 'risk' },
      { text: 'CHARMELEON', kind: 'risk' },
      { text: 'PIDGEOTTO', kind: 'risk' },
      { text: 'RANGER PACK', kind: 'risk' },
      { text: 'POTION ×2', kind: 'risk' },
      { text: 'SAFE: PIDGEY, RATTATA', kind: 'safe' },
    ]);
    expect(railStamps({ pokemon: [], pack: null, packIsBetter: false, items: [], safe: ['Pidgey'] }, 1)).toEqual([
      { text: 'NOTHING TO LOSE', kind: 'risk' },
      { text: 'SAFE: PIDGEY', kind: 'safe' },
    ]);
  });

  it('never asks more of the screen with a heading and a SAFE line than it did without', () => {
    const items = Array.from({ length: 12 }, (_each, index) => `Thing ${index}`);
    expect(railStamps({ ...team, items, safe: ['Pidgey'] }, 1)).toHaveLength(MOST_WORDS);
  });

  it("puts a SAFE line too wide for the screen on to a second line, between two things, as a new save's first jump needs", () => {
    // A stand-in for the stamped width: so many letters across the screen.
    const fits = (text: string) => text.length <= 32;
    const firstJump = railStamps(
      { pokemon: [], pack: 'Raid pack', packIsBetter: false, items: ['Poké Ball ×4'], safe: ['Charmander (your partner)', 'Potion ×3'] },
      1,
    );
    expect(firstJump.some((stamp) => !fits(stamp.text))).toBe(true);
    const fitted = fitRailStamps(firstJump, fits);
    expect(fitted).toEqual([
      { text: 'AT RISK', kind: 'risk' },
      { text: 'RAID PACK', kind: 'risk' },
      { text: 'POKÉ BALL ×4', kind: 'risk' },
      { text: 'SAFE: CHARMANDER (YOUR PARTNER)', kind: 'safe' },
      { text: 'POTION ×3', kind: 'safe' },
    ]);
    expect(fitted.every((stamp) => fits(stamp.text))).toBe(true);
    // A line that already fits is left as it is.
    expect(fitRailStamps(firstJump, () => true)).toEqual(firstJump);
  });

  it('names fewer safe things rather than stamp more lines than the screen holds', () => {
    const items = Array.from({ length: 12 }, (_each, index) => `Thing ${index}`);
    const full = railStamps({ ...team, items, safe: ['Bulbasaur (your partner)', 'Potion ×3'] }, 1);
    const fitted = fitRailStamps(full, (text) => text.length <= 30);
    expect(fitted).toHaveLength(MOST_WORDS);
    expect(fitted[MOST_WORDS - 1]).toEqual({ text: 'SAFE: BULBASAUR (YOUR PARTNER)', kind: 'safe' });
  });

  it("breaks a thing too wide for a line of its own before its bracket, so a new save's partner never runs under the FEEDBACK tab", () => {
    const fits = (text: string) => text.length <= 28;
    const firstJump = railStamps(
      { pokemon: [], pack: 'Raid pack', packIsBetter: false, items: ['Poké Ball ×4'], safe: ['Charmander (your partner)', 'Potion ×3'] },
      1,
    );
    const fitted = fitRailStamps(firstJump, fits);
    expect(fitted).toEqual([
      { text: 'AT RISK', kind: 'risk' },
      { text: 'RAID PACK', kind: 'risk' },
      { text: 'POKÉ BALL ×4', kind: 'risk' },
      { text: 'SAFE: CHARMANDER', kind: 'safe' },
      { text: '(YOUR PARTNER), POTION ×3', kind: 'safe' },
    ]);
    expect(fitted.every((stamp) => fits(stamp.text))).toBe(true);
    // With one line left for it, the thing goes without what it says in brackets rather than run off the edge.
    const items = Array.from({ length: 12 }, (_each, index) => `Thing ${index}`);
    const full = fitRailStamps(railStamps({ ...team, items, safe: ['Charmander (your partner)', 'Potion ×3'] }, 1), fits);
    expect(full).toHaveLength(MOST_WORDS);
    expect(full[MOST_WORDS - 1]).toEqual({ text: 'SAFE: CHARMANDER, POTION ×3', kind: 'safe' });
  });

  describe('the room a line has, beside the FEEDBACK tab', () => {
    // A window, the canvas `computeStage` fits into it, centred, and the tab as
    // `style.css` sizes it on a game screen (no pixel-ui menu up): 30x112 CSS
    // pixels half way down the right edge, and 50x14 in the corner at 480x360.
    const onWindow = (width: number, height: number) => {
      const stage = computeStage(width, height);
      const canvas = {
        left: (width - stage.width * stage.zoom) / 2,
        top: (height - stage.height * stage.zoom) / 2,
        width: stage.width * stage.zoom,
        height: stage.height * stage.zoom,
      };
      const tab =
        width <= 480 && height <= 360
          ? { left: width - 50, top: height - 14, width: 50, height: 14 }
          : { left: width - 30, top: height / 2 - 56, width: 30, height: 112 };
      return { stage, tab: tabOverGame(tab, canvas, stage) };
    };
    // The lowest the stamp can reach: six lines of the small lettering, from the top.
    const stampsBottom = 12 + MOST_WORDS * 25;

    it('keeps every line, centred, clear of the tab at 640x480 and 960x720', () => {
      for (const [width, height] of [
        [640, 480],
        [960, 720],
      ]) {
        const { stage, tab } = onWindow(width, height);
        expect(tab!.y).toBeLessThan(stampsBottom);
        const room = railStampRoom(stage.width, tab, stampsBottom);
        expect((stage.width + room) / 2).toBeLessThanOrEqual(tab!.x - 1);
        expect((stage.width - room) / 2).toBeGreaterThanOrEqual(RAIL_STAMP_EDGE);
      }
    });

    it('asks nothing more of the stamp on the smallest window, where the tab is off the game, nor with no tab at all', () => {
      const { stage, tab } = onWindow(480, 360);
      expect(tab).toBeNull();
      expect(railStampRoom(stage.width, tab, stampsBottom)).toBe(stage.width - RAIL_STAMP_EDGE * 2);
      expect(railStampRoom(BASE_STAGE_WIDTH, { x: 300, y: 200, width: 20, height: 14 }, stampsBottom)).toBe(
        BASE_STAGE_WIDTH - RAIL_STAMP_EDGE * 2,
      );
    });
  });

  it('stops for nothing when nothing is worth stopping for, heading and all', () => {
    expect(railStamps({ pokemon: [], pack: 'Raid pack', packIsBetter: false, items: ['Potion ×3'], safe: ['Pidgey'] }, 200)).toEqual([]);
  });

  it('names whoever is most at stake first, by level', () => {
    const risked: AtRisk = {
      pokemon: [
        { name: 'Charmander', level: 9 },
        { name: 'Pidgeotto', level: 30 },
      ],
      pack: null,
      packIsBetter: false,
      items: [],
    };
    expect(stakeWords(risked, 1)[1]).toBe('PIDGEOTTO');
    expect(stakeWords(risked, 200)).toEqual(['AT RISK', 'PIDGEOTTO']);
  });

  it('tells the house how big a bet it is', () => {
    const none: AtRisk = { pokemon: [], pack: null, packIsBetter: false, items: [] };
    expect(betOf(none)).toBe('nothing');
    expect(betOf({ ...none, pack: 'Raid pack', items: ['Potion ×3'] })).toBe('some');
    expect(betOf({ ...none, pokemon: [{ name: 'Pidgey', level: 3 }] })).toBe('some');
    expect(betOf({ ...none, pack: 'Ranger pack', packIsBetter: true })).toBe('big');
    expect(betOf({ ...none, pokemon: [{ name: 'Pidgey', level: 3 }, { name: 'Rattata', level: 3 }] })).toBe('big');
  });

  it('holds about a beat at raid two hundred, a little more for a new team, and every word gets its time', () => {
    expect(breathMs(1)).toBeLessThan(1000);
    expect(breathMs(MOST_WORDS)).toBeLessThan(2000);
    expect(BREATH_LISTENS_AFTER_MS).toBeLessThan(breathMs(1));
    for (const words of [1, 3, MOST_WORDS]) {
      expect(wordsUpAt(0, words).count).toBe(0);
      expect(wordsUpAt(breathMs(words) - 1, words).count).toBe(words);
      let last = 0;
      for (let ms = 0; ms < breathMs(words); ms += 10) {
        const { count, newestMs } = wordsUpAt(ms, words);
        expect(count - last).toBeLessThanOrEqual(1);
        expect(newestMs).toBeGreaterThanOrEqual(0);
        last = count;
      }
    }
  });

  it('climbs towards the fence and up, whichever way the fence is, in whole pixels', () => {
    expect(climbAt(0, { x: 0, y: -1 }).y === 0 && climbAt(0, { x: 0, y: -1 }).x === 0).toBe(true);
    expect(climbAt(1000, { x: 0, y: -1 }).y).toBeLessThan(-8);
    expect(climbAt(1000, { x: 1, y: 0 }).x).toBeGreaterThan(8);
    expect(climbAt(1000, { x: 1, y: 0 }).y).toBeLessThan(0);
    for (let ms = 0; ms < 200; ms += 7) {
      const at = climbAt(ms, { x: 0, y: 1 });
      expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
    }
  });
});
