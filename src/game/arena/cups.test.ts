import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { MoveCategory, MoveFlag } from '../pokemon/MoveBase';
import { SPECIES_BY_ID } from '../pokemon/species';
import { NO_GAME_CORNER } from '../minigames/tickets';
import { readDojoRecord } from './dojoRecord';
import { readDojoRun, runBout, runFoe, settleRunBout, stampRun } from './arenaRuns';
import {
  CUP_RUN_BOUTS,
  CUPS,
  cupCopy,
  cupFoe,
  cupFoeParty,
  cupOfTheWeek,
  cupRefusal,
  cupSideProblem,
  isoWeekKey,
  settleCupBout,
} from './cups';

const at = (date: string): Date => new Date(`${date}T12:00:00`);
const of = (id: string, level = 20): Pokemon => new Pokemon(SPECIES_BY_ID[id], level);
const cup = (id: string) => CUPS.find((one) => one.id === id)!;

describe('the cup of the week', () => {
  it('is the same for everybody all week and turns over the next', () => {
    expect(isoWeekKey(at('2026-11-02'))).toBe('2026-W45');
    expect(isoWeekKey(at('2026-11-08'))).toBe('2026-W45');
    expect(isoWeekKey(at('2026-11-09'))).toBe('2026-W46');
    expect(cupOfTheWeek(at('2026-11-02')).id).toBe(cupOfTheWeek(at('2026-11-08')).id);
    expect(cupOfTheWeek(at('2026-11-09')).id).not.toBe(cupOfTheWeek(at('2026-11-08')).id);
    const seen = new Set(Array.from({ length: CUPS.length }, (_week, index) => cupOfTheWeek(new Date(2026, 0, 5 + index * 7)).id));
    expect(seen.size).toBe(CUPS.length);
  });
});

describe('each rule is enforced', () => {
  it('WATER takes only Water types and LITTLE only first stages', () => {
    expect(cupRefusal(of('squirtle'), [], cup('water'))).toBeNull();
    expect(cupRefusal(of('charmander'), [], cup('water'))).toMatch(/Water types/);
    expect(cupRefusal(of('rattata'), [], cup('little'))).toBeNull();
    expect(cupRefusal(of('raticate'), [], cup('little'))).toMatch(/First stages/);
  });

  it('TOUCH leaves every contact move off, and refuses a Pokémon with no attack left', () => {
    const copy = cupCopy(of('pikachu', 40), cup('touch'));
    expect(copy.moves.length).toBeGreaterThan(0);
    expect(copy.moves.every((move) => !move.base.flags.includes(MoveFlag.Contact))).toBe(true);
    const tackler = of('rattata', 5);
    expect(cupRefusal(tackler, [], cup('touch'))).toMatch(/no attack left/);
  });

  it('GROUND wants a Ground type on the side and MONO one shared type', () => {
    expect(cupSideProblem([of('pidgey'), of('rattata')], cup('ground'))).toMatch(/Ground type/);
    expect(cupSideProblem([of('pidgey'), of('diglett')], cup('ground'))).toBeNull();
    expect(cupSideProblem([of('bulbasaur'), of('oddish')], cup('mono'))).toBeNull();
    expect(cupSideProblem([of('bulbasaur'), of('charmander')], cup('mono'))).toMatch(/one type/);
  });

  it('LITTLE fights at Lv 15 and RAIN and SUN under their weather', () => {
    expect(cupCopy(of('rattata', 40), cup('little')).level).toBe(15);
    expect(cup('rain').weather).toBe('rain');
    expect(cup('sun').weather).toBe('harsh-sunlight');
  });

  it('every regular in every bout of every cup keeps its rule and has an attack to throw', () => {
    for (const one of CUPS) {
      for (let bout = 1; bout <= CUP_RUN_BOUTS; bout += 1) {
        const foe = cupFoe(one, bout, at('2026-11-02'));
        expect(foe.team.length, `${one.id} bout ${bout}`).toBe(3);
        expect(new Set(foe.team).size).toBe(3);
        const party = cupFoeParty(foe, one);
        expect(cupSideProblem(party, one), `${one.id} bout ${bout}`).toBeNull();
        for (const pokemon of party) {
          expect(one.refuses?.(pokemon.base) ?? null, `${one.id} ${pokemon.base.id}`).toBeNull();
          expect(pokemon.level).toBe(one.level);
          expect(
            pokemon.moves.some((move) => move.base.category !== MoveCategory.Status && move.base.power > 0),
            `${one.id} bout ${bout}: ${pokemon.base.id} has nothing to throw`,
          ).toBe(true);
          if (one.keeps) {
            expect(pokemon.moves.every((move) => one.keeps!(move.base))).toBe(true);
          }
        }
      }
    }
  });
});

describe('a cup run', () => {
  it('pays 50, then 100 in all, then 200 and the cup, once a week', () => {
    const now = at('2026-11-04');
    let record = undefined as ReturnType<typeof settleCupBout>['record'] | undefined;
    const paid: number[] = [];
    let won = false;
    for (let bout = 1; bout <= CUP_RUN_BOUTS; bout += 1) {
      const settled = settleCupBout(record, true, now);
      record = settled.record;
      paid.push(settled.tickets);
      won = settled.cupWon;
    }
    expect(paid).toEqual([0, 0, 50, 0, 50, 0, 100]);
    expect(won).toBe(true);
    expect(record!.run).toBe(0);
    expect(record!.won).toEqual([`${cupOfTheWeek(now).id}@2026-W45`]);
    // Seven more the same week pay nothing.
    for (let bout = 1; bout <= CUP_RUN_BOUTS; bout += 1) {
      expect(settleCupBout(record, true, now).tickets).toBe(0);
      record = settleCupBout(record, true, now).record;
    }
  });

  it('a loss ends the run, and a new week starts fresh but keeps the cups won', () => {
    const now = at('2026-11-04');
    let record = settleCupBout(undefined, true, now).record;
    record = settleCupBout(record, true, now).record;
    const lost = settleCupBout(record, false, now);
    expect(lost.runLost).toBe(2);
    expect(lost.record.run).toBe(0);
    expect(lost.record.best).toBe(2);
    const next = settleCupBout({ ...lost.record, won: ['rain@2026-W40'] }, true, at('2026-11-10'));
    expect(next.record).toMatchObject({ week: '2026-W46', run: 1, best: 1, won: ['rain@2026-W40'] });
  });

  it('settles through the dojo record, which a save reads back', () => {
    const now = at('2026-11-04');
    const foe = cupFoe(cupOfTheWeek(now), 1, now);
    const settled = settleRunBout(undefined, NO_GAME_CORNER, { mode: 'cup' }, foe.id, true, now);
    expect(settled.carriesOn).toBe(true);
    expect(settled.line).toMatch(/1 of 7/);
    const read = readDojoRecord(JSON.parse(JSON.stringify(settled.dojo)));
    expect(read?.cup).toEqual(settled.dojo.cup);
    expect(read?.classId).toBeUndefined();
    expect(read?.streak).toBeUndefined();
  });

  it('a bout begun on Sunday night is that week’s bout, and the run ends with the week (arenas hunt, finding 4)', () => {
    const sunday = new Date(2026, 10, 8, 23, 58);
    const monday = new Date(2026, 10, 9, 0, 1);
    let dojo = undefined as ReturnType<typeof settleRunBout>['dojo'] | undefined;
    for (let bout = 1; bout <= 4; bout += 1) {
      dojo = settleRunBout(dojo, NO_GAME_CORNER, stampRun({ mode: 'cup' }, dojo, sunday), 'x', true, sunday).dojo;
    }
    const run = stampRun({ mode: 'cup' }, dojo, sunday);
    const foe = cupFoe(cupOfTheWeek(sunday), 5, sunday);
    expect(runFoe(run, dojo, monday)).toEqual(foe);
    const won = settleRunBout(dojo, NO_GAME_CORNER, run, foe.id, true, monday);
    expect(won.line).toBe(`You beat ${foe.name}! 5 of 7, but the week ended during the bout, so the run ends there. 50 tickets.`);
    expect(won.carriesOn).toBe(false);
    expect(won.dojo.cup).toMatchObject({ week: '2026-W45', run: 5 });
    const lost = settleRunBout(dojo, NO_GAME_CORNER, run, foe.id, false, monday);
    expect(lost.line).toBe(`${foe.name} took that one. Your ${cupOfTheWeek(sunday).name} run of 4 is over.`);
    // The new week's cup starts at bout one.
    expect(runFoe({ mode: 'cup' }, won.dojo, monday)).toEqual(cupFoe(cupOfTheWeek(monday), 1, monday));
  });

  it('puts copies on the mat at the cup level, under its weather', () => {
    const now = at('2026-11-04');
    const bout = runBout({ mode: 'cup' }, [of('squirtle', 50)], undefined, now)!;
    const current = cupOfTheWeek(now);
    expect(bout.party[0].level).toBe(current.level);
    expect(bout.trainer.party).toHaveLength(1);
    expect(bout.weather).toBe(current.weather ?? null);
    expect(readDojoRun({ mode: 'cup' })).toEqual({ mode: 'cup' });
    expect(readDojoRun({ mode: 'nope' })).toBeUndefined();
  });
});
