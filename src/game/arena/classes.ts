import { Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { EVOLUTIONS, evolvesInto } from '../pokemon/evolution';
import { SPECIES_BY_ID } from '../pokemon/species';
import { payGame, today, type GameCornerRecord } from '../minigames/tickets';
import { DOJO_LEVEL, DOJO_TEAM_SIZE } from './boutRules';
import { DOJO_REGULARS, type DojoRegular } from './dojoCounter';
import { afterDojoBout, classOf, DOJO_CLASS_IDS, type DojoClassId, type DojoRecord } from './dojoRecord';

/**
 * THE BATTLE ARENA's classes (the harbour arenas plan, section 2.5, H2b):
 * POKé BALL, GREAT BALL, ULTRA BALL and MASTER BALL, climbed one at a time.
 * Phaser-free, and the whole rule.
 *
 * - **Everybody starts in POKé BALL class, and nobody ever drops one.** Losing
 *   only breaks the run.
 * - **Three in a row, then the Black Belt.** Win three bouts in a row against
 *   three different regulars of your class and its Black Belt will see you;
 *   beat him and you are in the next class. FireRed's own dojo four stand at
 *   the heads of the four classes - HIDEKI, MIKE, HITOSHI and AARON (pret
 *   `SaffronCity_Dojo`), fielding the dojo's own Fighting lines (Machop and
 *   Mankey's, as FireRed's four do, then Poliwrath and Hitmonchan at the top)
 *   - and beating AARON tops the ladder.
 * - **A class is who you meet.** The regulars bring their own teams at the
 *   class's stage of evolution: first stages in POKé BALL, second in GREAT,
 *   the end of every line in ULTRA and MASTER. Everybody is still at
 *   `DOJO_LEVEL`, so a class is harder because of what is on the mat and never
 *   because of hours played. `arenaLadder.test.ts` holds each class harder than
 *   the last, measured over the real engine.
 * - **Tickets for wins** (section 2.10): the day's first five wins pay ten
 *   each, under the Game Corner's daily ceiling (`minigames/tickets.ts`), and
 *   each step up the ladder pays once - 100, 200, 400 and 800 for AARON - apart
 *   from the day, because it can only ever happen once.
 *
 * The class shows as a ball on the player's name plate in the shared harbour
 * (`harbour/harbourProtocol.ts`, `c`) and on the class board on the dojo's wall.
 */

/** Wins in a row, against different regulars, before the class's Black Belt will fight. */
export const STREAK_TO_CHALLENGE = 3;

/** One of FireRed's dojo Black Belts, at the head of a class. */
export interface BlackBelt {
  readonly id: string;
  readonly name: string;
  /** Species ids, his lead first: FireRed's own for him, and a friend to make three. */
  readonly team: readonly string[];
  readonly greeting: string;
  readonly beaten: string;
}

export interface DojoClass {
  readonly id: DojoClassId;
  /** The class's name, as the board and the counter say it. */
  readonly name: string;
  /** The stage of evolution its regulars bring: 1 a first stage, 3 the end of a line. */
  readonly stage: 1 | 2 | 3;
  /** The Black Belt at its head. */
  readonly head: BlackBelt;
  /** Tickets for beating him, once ever: moving up, or, at the top, topping the ladder. */
  readonly reward: number;
}

/**
 * The four Black Belts, measured (`tools/arena/ladder.mts`) to stand a step
 * above the regulars of their own class and below the next: against the
 * reference teams (`arenaReferences.ts`) the regulars of POKé BALL class are
 * won about 89% of the time, HIDEKI 68%, GREAT BALL's regulars 62%, MIKE 53%,
 * ULTRA BALL's 45%, HITOSHI 29% and AARON 20%. MASTER BALL's regulars are the
 * end of every line, as ULTRA's are: what is harder there is AARON.
 */
export const BLACK_BELTS: readonly BlackBelt[] = [
  {
    id: 'belt:hideki',
    name: 'HIDEKI',
    team: ['machop', 'mankey', 'primeape'],
    greeting: 'Three wins in a row? Then show me. Hiyah!',
    beaten: 'Ugh! You are ready for GREAT BALL class.',
  },
  {
    id: 'belt:mike',
    name: 'MIKE',
    team: ['mankey', 'machoke', 'primeape'],
    greeting: 'GREAT BALL class is mine to guard. Come on!',
    beaten: 'Whew! Go on up to ULTRA BALL.',
  },
  {
    id: 'belt:hitoshi',
    name: 'HITOSHI',
    team: ['primeape', 'machoke', 'poliwrath'],
    greeting: 'Only MASTER BALL class is above me. Not you. Not yet.',
    beaten: 'Hmph. MASTER BALL class it is.',
  },
  {
    id: 'belt:aaron',
    name: 'AARON',
    team: ['primeape', 'machamp', 'hitmonchan'],
    greeting: 'Nobody here is above AARON. Prove me wrong.',
    beaten: 'I bow to you. There is nobody left in this dojo to beat.',
  },
];

const belt = (index: number): BlackBelt => BLACK_BELTS[index];

/** The ladder, lowest first. */
export const DOJO_CLASSES: readonly DojoClass[] = [
  { id: 'poke-ball', name: 'POKé BALL', stage: 1, head: belt(0), reward: 100 },
  { id: 'great-ball', name: 'GREAT BALL', stage: 2, head: belt(1), reward: 200 },
  { id: 'ultra-ball', name: 'ULTRA BALL', stage: 3, head: belt(2), reward: 400 },
  { id: 'master-ball', name: 'MASTER BALL', stage: 3, head: belt(3), reward: 800 },
];

export function dojoClass(id: DojoClassId): DojoClass {
  return DOJO_CLASSES.find((one) => one.id === id)!;
}

/** The class after this one, or null at the top. */
export function nextClass(id: DojoClassId): DojoClass | null {
  const at = DOJO_CLASS_IDS.indexOf(id);
  return at >= 0 && at < DOJO_CLASS_IDS.length - 1 ? dojoClass(DOJO_CLASS_IDS[at + 1]) : null;
}

// --- who you meet ---------------------------------------------------------------

/** The first stage of a species' line. */
function rootOf(id: string): string {
  let at = id;
  for (;;) {
    const back = EVOLUTIONS.find((rule) => rule.to === at);
    if (!back) {
      return at;
    }
    at = back.from;
  }
}

/**
 * A species' whole line, first stage first, walking the branch `toward` is on
 * (an Eevee line walks to the Eeveelution it was given) or else the first.
 */
function lineOf(id: string): readonly string[] {
  const line = [rootOf(id)];
  for (;;) {
    const from = line[line.length - 1];
    const rules = EVOLUTIONS.filter((rule) => rule.from === from);
    if (rules.length === 0) {
      return line;
    }
    const on = rules.find((rule) => rule.to === id || evolvesInto(rule.to, id)) ?? rules[0];
    line.push(on.to);
  }
}

/** A species at a stage of its line, or as far along as the line goes. */
export function atStage(id: string, stage: number): string {
  const line = lineOf(id);
  return line[Math.min(stage, line.length) - 1];
}

/** Whether a kind at `level`, on the moves it knows by then, has a move that does damage. */
function attacksAt(id: string, level: number): boolean {
  const base = SPECIES_BY_ID[id];
  return base !== undefined && new Pokemon(base, level).moves.some((move) => move.base.power > 0);
}

/**
 * A team at a class's stage, one of each kind: a member whose line would
 * repeat one already in (KARPKING's Magikarp and Gyarados) keeps its own kind.
 * A stage that knows no attack at `level` - Kakuna and Metapod, which know only
 * Harden - is passed over for the next one up its line: BEEBEE22 brought two
 * free knockouts to the GREAT BALL class, and a rental run's sixth bout handed
 * them on as swap-ins that could not fight (the arenas hunt, finding 5).
 */
export function stagedTeam(team: readonly string[], stage: number, level: number = DOJO_LEVEL): readonly string[] {
  const out: string[] = [];
  for (const id of team) {
    const line = lineOf(id);
    const staged = atStage(id, stage);
    const candidates = [staged, ...line.slice(line.indexOf(staged) + 1), id, ...line].filter((candidate) => !out.includes(candidate));
    const pick = candidates.find((candidate) => attacksAt(candidate, level)) ?? candidates[0];
    if (pick) {
      out.push(pick);
    }
  }
  return out;
}

/** Somebody the counter can put on the mat: a regular at the player's class, or a Black Belt. */
export interface DojoFoe {
  readonly id: string;
  readonly name: string;
  readonly team: readonly string[];
  readonly greeting: string;
  readonly beaten: string;
  readonly belt: boolean;
}

/** A regular as they fight in a class: their own team, at its stage. */
export function regularFoe(regular: DojoRegular, classId: DojoClassId): DojoFoe {
  return {
    id: regular.bot.id,
    name: regular.bot.name,
    team: stagedTeam(regular.team, dojoClass(classId).stage),
    greeting: regular.greeting,
    beaten: regular.beaten,
    belt: false,
  };
}

export function beltFoe(head: BlackBelt): DojoFoe {
  return { id: head.id, name: `BLACK BELT ${head.name}`, team: head.team, greeting: head.greeting, beaten: head.beaten, belt: true };
}

/** Anybody the dojo knows, as they would fight a player in `classId`. */
export function dojoFoe(id: string, classId: DojoClassId): DojoFoe | undefined {
  const head = BLACK_BELTS.find((one) => one.id === id);
  if (head) {
    return beltFoe(head);
  }
  const regular = DOJO_REGULARS.find((one) => one.bot.id === id);
  return regular ? regularFoe(regular, classId) : undefined;
}

/** A foe's team at the bout's level, as many as the player brings, the lead first. */
export function foeParty(foe: DojoFoe, size: number = DOJO_TEAM_SIZE): Pokemon[] {
  return foe.team.slice(0, Math.max(1, Math.min(DOJO_TEAM_SIZE, size))).map((id) => {
    const base = SPECIES_BY_ID[id];
    if (!base) {
      throw new Error(`the dojo knows no ${id}`);
    }
    return new Pokemon(base, DOJO_LEVEL);
  });
}

/** The bout, as the battle screen takes it: the foe's team on FireRed's trainer AI. */
export function foeTrainer(foe: DojoFoe, size: number): TrainerBattle {
  return {
    id: `dojo-${foe.id.replace(/^(bot|belt):/, '')}`,
    name: foe.name,
    party: foeParty(foe, size),
    defeatText: foe.beaten,
    ai: 'gym',
  };
}

/** What a row says of a foe's team: the kinds, in the order they come out. */
export function foeTeamLine(foe: DojoFoe): string {
  return foe.team.map((id) => SPECIES_BY_ID[id]?.name.toUpperCase() ?? id).join(', ');
}

// --- the run, and the Black Belt -----------------------------------------------------

/** The regulars beaten in a row in this class. */
export function streakOf(record: DojoRecord | undefined): readonly string[] {
  return record?.streak ?? [];
}

/** Whether the head of the player's class will fight them now: after three in a row, or at the top for sport. */
export function headWillFight(record: DojoRecord | undefined): boolean {
  return streakOf(record).length >= STREAK_TO_CHALLENGE || (classOf(record) === 'master-ball' && record?.topped === true);
}

/** Why the head of the class will not fight yet, or null if he will. */
export function headRefusal(record: DojoRecord | undefined): string | null {
  if (headWillFight(record)) {
    return null;
  }
  const head = dojoClass(classOf(record)).head;
  const won = streakOf(record).length;
  return `${head.name} only fights a run of ${STREAK_TO_CHALLENGE} wins in a row. You have ${won}.`;
}

/** A record with its run gone: lost, or spent on the step up. */
function withoutRun(record: DojoRecord): DojoRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'streak')) as unknown as DojoRecord;
}

// --- what a bout comes to --------------------------------------------------------------

export interface DojoSettlement {
  readonly record: DojoRecord;
  readonly gameCorner: GameCornerRecord;
  /** Tickets this bout paid, the day's win and any step up together. */
  readonly tickets: number;
  /** The class just moved into, if the bout was the step up. */
  readonly promotedTo: DojoClassId | null;
  /** Whether the bout was AARON beaten for the first time. */
  readonly topped: boolean;
  /** The run lost by losing this bout, if there was one. */
  readonly runLost: number;
}

/**
 * A bout's result, written down: the tally, the run, the class, and the
 * tickets. The fight writes nothing (`boutRules.ts`); the dojo writes this as
 * the player comes back to its counter, in one write with the tickets.
 */
export function settleDojoBout(
  record: DojoRecord | undefined,
  gameCorner: GameCornerRecord,
  opponent: string,
  won: boolean,
  now: Date,
): DojoSettlement {
  const tally = afterDojoBout(record, opponent, won);
  const held = streakOf(record);
  if (!won) {
    return { record: withoutRun(tally), gameCorner, tickets: 0, promotedTo: null, topped: false, runLost: held.length };
  }
  const winsToday = (today(gameCorner, now).best['battle-arena'] ?? 0) + 1;
  const day = payGame(gameCorner, 'battle-arena', winsToday, now);
  const current = dojoClass(classOf(record));
  if (opponent === current.head.id && headWillFight(record)) {
    const next = nextClass(current.id);
    const firstTop = next === null && record?.topped !== true;
    const reward = next !== null || firstTop ? current.reward : 0;
    return {
      record: { ...withoutRun(tally), ...(next ? { classId: next.id } : {}), ...(next === null ? { topped: true } : {}) },
      gameCorner: { ...day.record, tickets: day.record.tickets + reward },
      tickets: day.tickets + reward,
      promotedTo: next?.id ?? null,
      topped: firstTop,
      runLost: 0,
    };
  }
  const isRegular = opponent.startsWith('bot:');
  const streak = isRegular && !held.includes(opponent) ? [...held, opponent] : held;
  return {
    record: { ...tally, ...(streak.length > 0 ? { streak } : {}) },
    gameCorner: day.record,
    tickets: day.tickets,
    promotedTo: null,
    topped: false,
    runLost: 0,
  };
}

/** What the receptionist says as the player comes back to the counter from a bout. */
export function settlementLine(foe: DojoFoe | undefined, won: boolean, settled: DojoSettlement | null): string {
  const who = foe?.name ?? 'them';
  if (!settled) {
    return won ? `You beat ${who}!` : `${who} took that one.`;
  }
  const paid = settled.tickets > 0 ? ` ${settled.tickets} tickets.` : '';
  if (!won) {
    return settled.runLost > 0
      ? `${who} took that one. Your run of ${settled.runLost} is over: start again.`
      : `${who} took that one. Win three in a row to meet your Black Belt.`;
  }
  if (settled.promotedTo) {
    return `You beat ${who}! You are ${dojoClass(settled.promotedTo).name} class now.${paid}`;
  }
  if (settled.topped) {
    return `You beat ${who}! Nobody in this dojo is above you now.${paid}`;
  }
  const run = streakOf(settled.record).length;
  if (foe?.belt) {
    return `You beat ${who}!${paid}`;
  }
  if (run >= STREAK_TO_CHALLENGE) {
    const head = dojoClass(classOf(settled.record)).head;
    return `You beat ${who}! That is ${run} in a row: BLACK BELT ${head.name} will see you now.${paid}`;
  }
  return `You beat ${who}! That is ${run} in a row.${paid}`;
}

// --- the receptionist ---------------------------------------------------------------

/** What the receptionist says before the list opens: how a bout works the first time, then the class and the run. */
export function receptionLines(record: DojoRecord | undefined): readonly string[] {
  const held = record ?? { wins: 0, losses: 0, beaten: [] };
  const cls = dojoClass(classOf(held));
  if (held.wins + held.losses === 0) {
    return [
      'Welcome to THE BATTLE ARENA! Bouts here are for sport.',
      `Everybody fights at Lv ${DOJO_LEVEL}, yours and theirs. Up to three a side, no bag.`,
      'Nothing you bring can be hurt or lost. Pick who to fight, then your team.',
      `You start in ${cls.name} class. Win ${STREAK_TO_CHALLENGE} in a row and BLACK BELT ${cls.head.name} will fight you for the next.`,
    ];
  }
  const run = streakOf(held).length;
  const where =
    classOf(held) === 'master-ball' && held.topped
      ? `${cls.name} class, top of the ladder.`
      : headWillFight(held)
        ? `${cls.name} class, and ${cls.head.name} is waiting for you.`
        : `${cls.name} class, ${run} of ${STREAK_TO_CHALLENGE} in a row.`;
  return [`${held.wins} won, ${held.losses} lost. ${where}`];
}

/** The line a fighter says when faced: who they are, what they bring in this class, and how to fight them. */
export function fighterLine(foe: DojoFoe, record: DojoRecord | undefined): string {
  const beaten = record?.beaten.includes(foe.id) ? ' You have beaten them before.' : '';
  if (foe.belt) {
    const refusal = headRefusal(record);
    return `${foe.name}: ${foeTeamLine(foe)}.${beaten} ${refusal ?? 'He will fight you now. Ask at the counter.'}`;
  }
  return `${foe.name} trains here: ${foeTeamLine(foe)}.${beaten} Ask at the counter for a bout.`;
}

/** What the class board says when faced: the class, the run, and what is next. */
export function classBoardLines(record: DojoRecord | undefined): readonly string[] {
  const cls = dojoClass(classOf(record));
  const ladder = DOJO_CLASSES.map((one) => one.name).join(', ');
  if (classOf(record) === 'master-ball' && record?.topped) {
    return [`${cls.name} class, and AARON beaten: the top of the ladder.`, `The classes: ${ladder}.`];
  }
  const run = streakOf(record).length;
  const next = nextClass(cls.id);
  return [
    `${cls.name} class. ${Math.min(run, STREAK_TO_CHALLENGE)} of ${STREAK_TO_CHALLENGE} wins in a row, against different regulars.`,
    headWillFight(record)
      ? `BLACK BELT ${cls.head.name} will fight you now${next ? ` for ${next.name} class` : ''}.`
      : `Then BLACK BELT ${cls.head.name}${next ? `, and ${next.name} class` : ''}. A loss only ends the run.`,
  ];
}
