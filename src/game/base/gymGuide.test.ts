import { afterEach, describe, expect, it } from 'vitest';
import { buildContractBoard } from '../hub/contractBoard';
import { FIRST_WORDS } from '../hub/firstWords';
import { errandOf, harbourGiver, withErrandAsked } from '../hub/errands';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { GYM_HONOURS } from '../look/gymHonours';
import { gymAdvice, gymGuideHasStakesNews, gymGuideHonourNews, gymGuideLines, HONOUR_NOTICED } from './gymGuide';
import { KOGA_BOSS_ID, MISTY_BOSS_ID, VALE_QUARTERS } from '../world/valeQuarters';

/** A save with a raid behind it: the board has nothing for anybody yet to go on one. */
const BEEN_OUT = { ...DEFAULT_RAID_PROGRESS, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } };
/** The same save once the Gym Guide has said what a survey stake is. */
const TOLD = { ...BEEN_OUT, firstWordsHeard: ['stakes'] };

/**
 * The Gym Guide at the Raid Arena's door says the day's work in the dialogue
 * box: what the board has, what it pays, and whose favours are in hand - the
 * quest said by a person, a box a line, rather than read off a list.
 */
describe("the Gym Guide's word on the day's work", () => {
  afterEach(() => retireMapsForTests([]));

  it("says the board's job and its pay in one line, then the gym, and nothing else (the harbour critic tour: seventeen boxes)", () => {
    // The roster as shipped: the standing board deals on Greystone Vale.
    retireMapsForTests(RETIRED_MAPS);
    const lines = gymGuideLines(TOLD);
    const rows = buildContractBoard(TOLD).rows;
    const named = rows.find((row) => lines[0].includes(row.name.toUpperCase()));
    expect(named).toBeDefined();
    expect(lines[0]).toBe(`Yo, champ! Today's job: ${named!.name.toUpperCase()}. It pays ${named!.reward.replace(/[.!?]$/, '')}.`);
    expect(lines.slice(1)).toEqual(gymAdvice(TOLD));
  });

  it('says what a survey stake is the first time after a raid, then names the job as the board now deals it', () => {
    retireMapsForTests(RETIRED_MAPS);
    // Nothing to explain before a raid, and nothing once said.
    expect(gymGuideHasStakesNews(DEFAULT_RAID_PROGRESS)).toBe(false);
    expect(gymGuideHasStakesNews(BEEN_OUT)).toBe(true);
    expect(gymGuideHasStakesNews(TOLD)).toBe(false);
    // Before he has said it the board holds no survey (`standingBoard.ts`).
    expect(buildContractBoard(BEEN_OUT).rows.map((row) => row.description).join(' ')).not.toMatch(/survey stake/i);

    const lines = gymGuideLines(BEEN_OUT);
    const stakes = FIRST_WORDS.stakes.lines;
    expect(lines.slice(0, stakes.length)).toEqual(stakes);
    expect(stakes.join(' ')).toMatch(/Stand on one/);
    // The job he names next is the board's once the stakes are known.
    const [job] = buildContractBoard(TOLD).rows;
    expect(lines[stakes.length]).toMatch(/^Today's job: [A-Z' ]+\. It pays |^Nothing on the board fits one raid today/);
    void job;
    expect(gymGuideLines(TOLD).join(' ')).not.toContain(stakes[0]);
    for (const line of stakes) {
      expect(line.length, line).toBeLessThanOrEqual(68);
    }
  });

  it("leaves a favour to its giver to remind", () => {
    const errands = withErrandAsked(withErrandAsked(undefined, 'old-amber'), 'gold-teeth');
    expect(gymGuideLines({ ...DEFAULT_RAID_PROGRESS, errands }).join(' ')).not.toContain('waiting on');
    expect(errandOf(harbourGiver('safari-warden'))?.id).toBe('gold-teeth');
  });
});

describe("the Gym Guide's word on the next gym", () => {
  it('says nothing about gyms before the first raid, which has nothing on its way but the fall', () => {
    expect(gymAdvice(DEFAULT_RAID_PROGRESS)).toEqual([]);
  });

  it('names the next gym and what does well there, then says the leader spars once met', () => {
    const coast = VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === MISTY_BOSS_ID)!.gym!;
    const unmet = gymAdvice(BEEN_OUT);
    expect(unmet.slice(0, coast.advice.length)).toEqual(coast.advice);
    expect(unmet.at(-1)).toContain('Meet MISTY once');
    expect(gymAdvice({ ...BEEN_OUT, gymsMet: [MISTY_BOSS_ID] }).at(-1)).toContain("You've met MISTY");
    expect(gymGuideLines({ ...BEEN_OUT, gymsMet: [MISTY_BOSS_ID] })).toContain(coast.advice[0]);
    // A box a line: every line fits the box's two rows.
    for (const line of [...unmet, ...gymAdvice({ ...BEEN_OUT, gymsMet: [MISTY_BOSS_ID] })]) {
      expect(line.length, line).toBeLessThanOrEqual(68);
    }
  });

  it('names Koga next once Misty is beaten, in lines that fit the box', () => {
    const marsh = VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === KOGA_BOSS_ID)!.gym!;
    const next = gymAdvice({ ...BEEN_OUT, defeatedBosses: [MISTY_BOSS_ID] });
    expect(next.slice(0, marsh.advice.length)).toEqual(marsh.advice);
    expect(next.at(-1)).toContain('Meet KOGA once');
    for (const line of [...next, ...gymAdvice({ ...BEEN_OUT, defeatedBosses: [MISTY_BOSS_ID], gymsMet: [KOGA_BOSS_ID] })]) {
      expect(line.length, line).toBeLessThanOrEqual(68);
    }
  });

  it('has nothing more to say once every gym is beaten', () => {
    expect(gymAdvice({ ...BEEN_OUT, defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID] })).toEqual([]);
  });
});

describe('the Gym Guide noticing a gym honour', () => {
  const both = { ...TOLD, defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID] };

  it('has words for every honour, his own', () => {
    for (const honour of GYM_HONOURS) {
      const words = FIRST_WORDS[HONOUR_NOTICED[honour.id]];
      expect(words.speaker).toBe('gym-guide');
      expect(words.lines.join(' ')).toContain(honour.name);
    }
  });

  it('says it first, once for each honour, in the order they were won, and greets nobody over it', () => {
    expect(gymGuideHonourNews(TOLD)).toBeUndefined();
    expect(gymGuideHonourNews(both)).toBe('cascadeWorn');
    const lines = gymGuideLines(both);
    expect(lines.slice(0, FIRST_WORDS.cascadeWorn.lines.length)).toEqual(FIRST_WORDS.cascadeWorn.lines);
    expect(lines.join(' ')).not.toContain('Yo, champ!');
    const seen = { ...both, firstWordsHeard: [...both.firstWordsHeard, 'cascadeWorn'] };
    expect(gymGuideHonourNews(seen)).toBe('soulWorn');
    expect(gymGuideHonourNews({ ...seen, firstWordsHeard: [...seen.firstWordsHeard, 'soulWorn'] })).toBeUndefined();
  });

  it('does not see an honour taken off', () => {
    expect(gymGuideHonourNews({ ...both, honoursHidden: ['cascade'] })).toBe('soulWorn');
    expect(gymGuideHonourNews({ ...both, honoursHidden: ['cascade', 'soul'] })).toBeUndefined();
  });
});
