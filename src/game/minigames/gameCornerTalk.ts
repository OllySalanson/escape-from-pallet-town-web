import type { RaidProgress } from '../save/SaveManager';
import {
  BERRIES_A_DAY,
  BERRY_TICKET_TIERS,
  COURSE_TICKET_TIERS,
  DAILY_TICKET_CEILING,
  JUMP_TICKET_TIERS,
  today,
  NO_GAME_CORNER,
} from './tickets';
import { POKEMON_JUMP_PRIZES } from './generated/pokemonJump';
import { BERRY_PICKING_PRIZE_SCORE } from './generated/berryPicking';

/**
 * What THE GAME CORNER says: its attendant, its prize clerk and the POKéMON
 * JUMP cabinet's caption. Phaser-free, so the words are held by the tests in
 * the manner of `base/gymGuide.ts`. Every line fits the dialogue box's one
 * line of 68 characters or is said in two.
 */

/** The berries POKéMON JUMP pays in, this game's seven: FireRed's own are berries it does not have. */
export const JUMP_PRIZE_BERRIES = [
  'oran-berry',
  'sitrus-berry',
  'pecha-berry',
  'cheri-berry',
  'rawst-berry',
  'chesto-berry',
  'aspear-berry',
] as const;

const number = (value: number): string => value.toLocaleString('en-GB');

/** The second line on the cabinet's caption: the best it has seen from this save, today first. */
export function jumpCabinetNote(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): string {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  const best = record.best['pokemon-jump'] ?? 0;
  const todays = today(record, now).best['pokemon-jump'] ?? 0;
  if (best === 0) return 'Jump the vine for TICKETS';
  return todays > 0 ? `Today ${number(todays)} · best ${number(best)}` : `Your best ${number(best)}`;
}

/** What the cabinet says when it is read rather than played (the scene plays it). */
export function jumpCabinetLines(): readonly string[] {
  return ['POKéMON JUMP! Up to three of your POKéMON jump the VENUSAUR’s vine.'];
}

/** The second line on BERRY PICKING's caption: the best it has seen from this save, today first. */
export function berryCabinetNote(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): string {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  const best = record.best['berry-picking'] ?? 0;
  const todays = today(record, now).best['berry-picking'] ?? 0;
  if (best === 0) return 'Bring a DODRIO';
  return todays > 0 ? `Today ${number(todays)} · best ${number(best)}` : `Your best ${number(best)}`;
}

/** What BERRY PICKING says when it is read rather than played. */
export function berryCabinetLines(): readonly string[] {
  return ['BERRY PICKING! A DODRIO reaches left, up and right for the berries as they fall.'];
}

/** A time round the course as a stopwatch shows it: `0:14.25`. */
export function courseTime(ms: number): string {
  const hundredths = Math.round(ms / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}

/** What the course keeper says at his gate, before the course opens. */
export function courseKeeperLines(progress: Pick<RaidProgress, 'gameCorner'>): readonly string[] {
  const best = (progress.gameCorner ?? NO_GAME_CORNER).best['field-course'] ?? 0;
  const [first, second, third] = COURSE_TICKET_TIERS;
  return best === 0
    ? [
        'The FIELD-MOVE COURSE! Start to finish past a tree, a rock, a boulder and a pond.',
        'I lend the HMs. A POKéMON that could learn CUT cuts; one that could learn SURF swims.',
        `Under ${courseTime(first.ms)} pays ${first.tickets} tickets, ${courseTime(second.ms)} ${second.tickets}, ${courseTime(third.ms)} ${third.tickets}. Once a day.`,
      ]
    : [`Back for another go? Your best round is ${courseTime(best)}. The HMs are in the box.`];
}

/** What the TIME BOARD says: today's best and the best ever, and what each ticket line asks. */
export function timeBoardLines(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): readonly string[] {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  const best = record.best['field-course'] ?? 0;
  const todays = today(record, now).best['field-course'] ?? 0;
  // Each time on a box of its own and to the hundredth: run on after the
  // heading, the box broke the line inside "0:14.27" and today's time read
  // "0:14" beside the best's "0:14.27" (the wave 2 playtest).
  const chalked =
    best === 0
      ? ['No time of yours chalked up yet.']
      : todays === best
        ? [`Your best: ${courseTime(best)}, run today.`]
        : [`Your best: ${courseTime(best)}.`, ...(todays > 0 ? [`Today's best: ${courseTime(todays)}.`] : [])];
  return [
    `TIME BOARD - FIELD-MOVE COURSE. ${chalked[0]}`,
    ...chalked.slice(1),
    `TICKETS: ${COURSE_TICKET_TIERS.map((tier) => `${courseTime(tier.ms)} ${tier.tickets}`).join(' · ')}. KRABBY is chalked in the corner.`,
  ];
}

/** What the attendant says from behind the counter: how the place works, a box at a time. */
export function attendantLines(progress: Pick<RaidProgress, 'gameCorner'>): readonly string[] {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  const [first, second, third] = JUMP_TICKET_TIERS;
  const [berryFirst, berrySecond, berryThird] = BERRY_TICKET_TIERS;
  const lines = [
    'Welcome to the GAME CORNER! No coins here - the cabinets pay TICKETS.',
    `POKéMON JUMP: SPACE jumps everyone on the ground. Small, quick jumpers do best.`,
    `${number(first.score)} points pays ${first.tickets} tickets, ${number(second.score)} pays ${second.tickets}, ${number(third.score)} pays ${third.tickets}. Once a day.`,
    `Past ${number(POKEMON_JUMP_PRIZES[0].score)} it pays BERRIES too. Spend tickets at the PRIZE WINDOW next door.`,
    'BERRY PICKING wants a DODRIO, one head a column. A DODUO tries with two.',
    `${number(berryFirst.score)} pays ${berryFirst.tickets}, ${number(berrySecond.score)} ${berrySecond.tickets}, ${number(berryThird.score)} ${berryThird.tickets}. From ${number(BERRY_PICKING_PRIZE_SCORE)}, a BERRY.`,
  ];
  if (record.tickets > 0) {
    lines.push(`You have ${number(record.tickets)} tickets. They are kept at home - a raid cannot lose them.`);
  }
  return lines;
}

/** What the prize clerk says before the window opens. */
export function prizeClerkLines(progress: Pick<RaidProgress, 'gameCorner'>): readonly string[] {
  const tickets = (progress.gameCorner ?? NO_GAME_CORNER).tickets;
  return tickets === 0
    ? ['Welcome to the PRIZE WINDOW! You have no tickets yet.', 'Play the cabinets next door or run the COURSE, then come back and choose.']
    : [`Welcome to the PRIZE WINDOW! You have ${number(tickets)} tickets. What will it be?`];
}

/** The window's own small print, under its list. */
export const PRIZE_WINDOW_NOTE = `BERRIES: ${BERRIES_A_DAY} a day. Furniture goes home to THE BOLTHOLE. The cabinets pay at most ${DAILY_TICKET_CEILING} tickets a day.`;
