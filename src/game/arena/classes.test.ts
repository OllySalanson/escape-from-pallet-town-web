import { describe, expect, it } from 'vitest';
import { NO_GAME_CORNER } from '../minigames/tickets';
import {
  atStage,
  BLACK_BELTS,
  DOJO_CLASSES,
  DOJO_PRIZE_LEVEL,
  dojoFoe,
  foeParty,
  foeTrainer,
  headRefusal,
  headWillFight,
  regularFoe,
  settleDojoBout,
  settlementLine,
  stagedTeam,
  STREAK_TO_CHALLENGE,
  type DojoSettlement,
} from './classes';
import { DOJO_REGULARS } from './dojoCounter';
import { rentalFoe, rentalTrainer } from './rentals';
import { RUN_BOUTS } from './runRecords';
import { DOJO_PRIZE_SPECIES, readDojoRecord, type DojoRecord } from './dojoRecord';

const NOW = new Date(2026, 10, 7, 12);

/** Bouts in order, from a fresh record: each `[opponent, won]`. */
function play(bouts: readonly (readonly [string, boolean])[], start?: DojoRecord, now = NOW): DojoSettlement {
  let record = start;
  let corner = NO_GAME_CORNER;
  let last: DojoSettlement | undefined;
  for (const [opponent, won] of bouts) {
    last = settleDojoBout(record, corner, opponent, won, now);
    record = last.record;
    corner = last.gameCorner;
  }
  return last!;
}

describe('the classes', () => {
  it('are FireRed’s dojo four at the heads of four classes, three a side and one of each kind', () => {
    expect(DOJO_CLASSES.map((cls) => cls.name)).toEqual(['POKé BALL', 'GREAT BALL', 'ULTRA BALL', 'MASTER BALL']);
    expect(DOJO_CLASSES.map((cls) => cls.head.name)).toEqual(['HIDEKI', 'MIKE', 'HITOSHI', 'AARON']);
    for (const belt of BLACK_BELTS) {
      expect(new Set(belt.team).size).toBe(3);
      expect(foeParty(dojoFoe(belt.id, 'poke-ball')!).every((pokemon) => pokemon.moves.some((move) => move.base.power > 0))).toBe(true);
    }
  });

  it('brings each regular’s own team at the class’s stage, one of each kind', () => {
    expect(atStage('venusaur', 1)).toBe('bulbasaur');
    expect(atStage('bulbasaur', 3)).toBe('venusaur');
    expect(atStage('flareon', 2)).toBe('flareon');
    expect(['vaporeon', 'jolteon', 'flareon']).toContain(atStage('eevee', 2));
    expect(atStage('tauros', 3)).toBe('tauros');
    expect(stagedTeam(['magikarp', 'gyarados', 'slowpoke'], 1)).toEqual(['magikarp', 'gyarados', 'slowpoke']);
    for (const cls of DOJO_CLASSES) {
      for (const regular of DOJO_REGULARS) {
        const foe = regularFoe(regular, cls.id);
        expect(foe.team, `${regular.bot.name} in ${cls.name}`).toHaveLength(3);
        expect(new Set(foe.team).size).toBe(3);
        expect(foeTrainer(foe, 3).ai).toBe('gym');
      }
    }
  });
});

describe('every regular brings Pokémon that can attack (the arenas hunt, finding 5)', () => {
  const attacks = (pokemon: { moves: readonly { base: { power: number } }[] }): boolean => pokemon.moves.some((move) => move.base.power > 0);

  it('in every class: no Kakuna or Metapod that knows only Harden', () => {
    for (const cls of DOJO_CLASSES) {
      for (const regular of DOJO_REGULARS) {
        for (const pokemon of foeParty(regularFoe(regular, cls.id))) {
          expect(attacks(pokemon), `${regular.bot.name}'s ${pokemon.base.name} in ${cls.name}`).toBe(true);
        }
      }
    }
  });

  it('in every bout of the rental run, every day of a year, so nothing swapped in is a dud', () => {
    for (let day = 0; day < 366; day += 1) {
      const now = new Date(2026, 10, 11 + day, 12);
      for (let bout = 1; bout <= RUN_BOUTS; bout += 1) {
        for (const pokemon of rentalTrainer(rentalFoe(bout, now), 3).party) {
          expect(attacks(pokemon), `bout ${bout} on ${now.toDateString()}: ${pokemon.base.name}`).toBe(true);
        }
      }
    }
  });
});

describe('a run and the Black Belt', () => {
  it('pays ten tickets for each of the day’s first five wins, and nothing more that day', () => {
    const wins = ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes', 'bot:karpking', 'bot:xkitx', 'bot:oz-hikes'].map(
      (id) => [id, true] as const,
    );
    const fifth = play(wins.slice(0, 5));
    expect(fifth.gameCorner.tickets).toBe(50);
    expect(play(wins).gameCorner.tickets).toBe(50);
    expect(play(wins).tickets).toBe(0);
  });

  it('counts a run of different regulars, and only the class’s head may be fought after three', () => {
    expect(headRefusal(undefined)).toMatch(/HIDEKI only fights a run of 3/);
    const two = play([
      ['bot:karpking', true],
      ['bot:karpking', true],
      ['bot:xkitx', true],
    ]);
    expect(two.record.streak).toEqual(['bot:karpking', 'bot:xkitx']);
    expect(headWillFight(two.record)).toBe(false);
    const three = play([['bot:oz-hikes', true]], two.record);
    expect(three.record.streak).toHaveLength(STREAK_TO_CHALLENGE);
    expect(headWillFight(three.record)).toBe(true);
    expect(settlementLine(dojoFoe('bot:oz-hikes', 'poke-ball'), true, three)).toMatch(/BLACK BELT HIDEKI will see you now/);
  });

  it('loses the run on a loss and never the class', () => {
    const run = play([
      ['bot:karpking', true],
      ['bot:xkitx', true],
      ['bot:oz-hikes', false],
    ]);
    expect(run.record.streak).toBeUndefined();
    expect(run.runLost).toBe(2);
    const great: DojoRecord = { wins: 4, losses: 0, beaten: [], classId: 'great-ball', streak: ['bot:xkitx'] };
    expect(play([['bot:karpking', false]], great).record.classId).toBe('great-ball');
  });

  it('moves up a class for beating the head after three in a row, and pays the step once', () => {
    const ready: DojoRecord = { wins: 3, losses: 0, beaten: [], streak: ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes'] };
    const up = play([['belt:hideki', true]], ready);
    expect(up.promotedTo).toBe('great-ball');
    expect(up.record.classId).toBe('great-ball');
    expect(up.record.streak).toBeUndefined();
    expect(up.tickets).toBe(10 + 100);
    expect(settlementLine(dojoFoe('belt:hideki', 'poke-ball'), true, up)).toMatch(/GREAT BALL class now. 110 tickets/);
    // Beaten without the run - nothing the counter offers - he is only a win.
    expect(play([['belt:hideki', true]]).promotedTo).toBeNull();
    // Losing to him is losing the run.
    expect(play([['belt:hideki', false]], ready).record.streak).toBeUndefined();
  });

  it('tops the ladder for beating AARON once, and fights him for sport after', () => {
    const ready: DojoRecord = {
      wins: 9,
      losses: 0,
      beaten: [],
      classId: 'master-ball',
      streak: ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes'],
    };
    const top = play([['belt:aaron', true]], ready);
    expect(top.topped).toBe(true);
    expect(top.record.topped).toBe(true);
    expect(top.record.classId).toBe('master-ball');
    expect(top.tickets).toBe(10 + 800);
    expect(headWillFight(top.record)).toBe(true);
    const again = play([['belt:aaron', true]], top.record);
    expect(again.topped).toBe(false);
    expect(again.tickets).toBe(10);
  });

  /**
   * The endgame bug hunt (12 Nov 2026), finding 1: nothing in the game gave a
   * Hitmonlee or a Hitmonchan. FireRed's Fighting Dojo gives its master's
   * beater one of the two; here HITOSHI and AARON each hand over one.
   */
  it('hands over the dojo’s prize Pokémon the first time each of its two masters is beaten, and never twice', () => {
    const ready: DojoRecord = {
      wins: 9,
      losses: 0,
      beaten: [],
      classId: 'ultra-ball',
      streak: ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes'],
    };
    const hitoshi = play([['belt:hitoshi', true]], ready);
    expect(hitoshi.prizes).toEqual(['hitmonlee']);
    expect(hitoshi.record.prizes).toEqual(['hitmonlee']);
    expect(settlementLine(dojoFoe('belt:hitoshi', 'ultra-ball'), true, hitoshi)).toContain(
      "BLACK BELT HITOSHI gives you the dojo's HITMONLEE. It went into your boxes.",
    );
    const aaron = play([['belt:aaron', true]], { ...hitoshi.record, streak: ['bot:karpking', 'bot:xkitx', 'bot:oz-hikes'] });
    expect(aaron.prizes).toEqual(['hitmonchan']);
    expect(aaron.record.prizes).toEqual(['hitmonlee', 'hitmonchan']);
    expect(play([['belt:aaron', true]], aaron.record).prizes).toEqual([]);
    // Lost to, he gives nothing.
    expect(play([['belt:hitoshi', false]], ready).prizes).toEqual([]);
    // FireRed's own two, at FireRed's level.
    expect(BLACK_BELTS.flatMap((head) => (head.prize ? [head.prize] : []))).toEqual([...DOJO_PRIZE_SPECIES]);
    expect(DOJO_PRIZE_LEVEL).toBe(25);
  });

  it('hands a save that beat both masters before they had prizes theirs with its next bout, won or lost', () => {
    const veteran: DojoRecord = {
      wins: 40,
      losses: 3,
      beaten: ['belt:hideki', 'belt:mike', 'belt:hitoshi', 'belt:aaron'],
      classId: 'master-ball',
      topped: true,
    };
    const next = play([['bot:karpking', false]], veteran);
    expect(next.prizes).toEqual(['hitmonlee', 'hitmonchan']);
    expect(readDojoRecord(next.record)?.prizes).toEqual(['hitmonlee', 'hitmonchan']);
  });

  it('reads a record back, keeping only a run of regulars and a class it knows', () => {
    expect(
      readDojoRecord({ wins: 2, losses: 1, beaten: ['belt:mike', 'x'], classId: 'great-ball', streak: ['bot:xkitx', 'belt:mike'], topped: true }),
    ).toEqual({ wins: 2, losses: 1, beaten: ['belt:mike'], classId: 'great-ball', streak: ['bot:xkitx'], topped: true });
    expect(readDojoRecord({ wins: 1, classId: 'gold-ball' })).toEqual({ wins: 1, losses: 0, beaten: [] });
  });
});

describe('the class ball and board', () => {
  it('draws four different balls, and a board that lights the classes reached and the run', async () => {
    const { classBallPixels } = await import('./classBall');
    const { classBoardPoster } = await import('./classBoard');
    const keys = (['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'] as const).map((id) =>
      classBallPixels(id).map((p) => p.ink).join(),
    );
    expect(new Set(keys).size).toBe(4);
    const fresh = classBoardPoster(undefined, { width: 3, height: 2 });
    expect(fresh.width).toBe(48);
    const great = classBoardPoster({ wins: 4, losses: 0, beaten: [], classId: 'great-ball', streak: ['bot:xkitx'] }, { width: 3, height: 2 });
    expect(Buffer.from(great.data).equals(Buffer.from(fresh.data))).toBe(false);
  });
});
