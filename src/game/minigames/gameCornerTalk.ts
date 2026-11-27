import type { RaidProgress } from '../save/SaveManager';
import {
  DAILY_TICKET_CEILING,
  BERRY_TICKET_TIERS,
  JUMP_TICKET_TIERS,
  today,
  NO_GAME_CORNER,
} from './tickets';

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

/**
 * The second line on a cabinet's caption: what its game has paid today, and
 * the best it has seen from this save, today first. Paid is what the three
 * lamps on its front say in pictures (`arcade.ts`).
 */
function cabinetNote(progress: Pick<RaidProgress, 'gameCorner'>, now: Date, source: 'pokemon-jump' | 'berry-picking', unplayed: string): string {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  const best = record.best[source] ?? 0;
  const day = today(record, now);
  const todays = day.best[source] ?? 0;
  const paid = day.paid[source] ?? 0;
  if (best === 0) return unplayed;
  if (todays === 0) return `Your best ${number(best)}`;
  const tiers = source === 'pokemon-jump' ? JUMP_TICKET_TIERS : BERRY_TICKET_TIERS;
  const top = tiers[tiers.length - 1].tickets;
  const paidWords = paid >= top ? `paid all ${paid} today` : paid > 0 ? `paid ${paid} today` : 'nothing paid yet';
  return `Today ${number(todays)} · ${paidWords}`;
}

/** The second line on the POKéMON JUMP cabinet's caption. */
export function jumpCabinetNote(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): string {
  return cabinetNote(progress, now, 'pokemon-jump', 'Jump the vine for TICKETS');
}

/** What the cabinet says when it is read rather than played (the scene plays it). */
export function jumpCabinetLines(): readonly string[] {
  return ['POKéMON JUMP! Up to three of your POKéMON jump the VENUSAUR’s vine.'];
}

/** The second line on the BERRY PICKING cabinet's caption. */
export function berryCabinetNote(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): string {
  // The house lends a DODUO, so nobody needs to bring one (`houseLoans.ts`).
  return cabinetNote(progress, now, 'berry-picking', 'The house lends a DODUO');
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

/**
 * What the TIME BOARD says: today's best and the best ever. What a time pays
 * is on the course's result card, the one place it is shown (the harbour
 * audit, 27 Nov 2026, fault 3).
 */
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
    'KRABBY is chalked in the corner.',
  ];
}

/** What the attendant says from behind the counter: how the place works, as she would put it. */
export function attendantLines(progress: Pick<RaidProgress, 'gameCorner'>): readonly string[] {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  // Two boxes, where six were read on every visit (the harbour critic tour,
  // 26 Nov 2026): what a cabinet pays is on its result card, and its lamps.
  const lines = [
    // Not "once a day a cabinet": a game pays once a day for its best score,
    // and a better score later pays the difference (`tickets.ts`, `payGame`; the re-critic).
    "Welcome to the GAME CORNER! Your best score each day wins TICKETS, to spend at the PRIZE WINDOW next door.",
    "POKéMON JUMP's down the left, BERRY PICKING's down the right. Nobody to jump or pick? I'll lend you one of ours.",
  ];
  if (record.tickets > 0) {
    lines.push(`You've got ${number(record.tickets)} tickets. They're kept at home, so a raid can't lose them.`);
  }
  return lines;
}

/** What the prize clerk says before the window opens. */
export function prizeClerkLines(progress: Pick<RaidProgress, 'gameCorner'>): readonly string[] {
  const tickets = (progress.gameCorner ?? NO_GAME_CORNER).tickets;
  // Every way to tickets named, and the day's cap: she named two of eleven
  // (the harbour critic tour, 26 Nov 2026).
  return tickets === 0
    ? [
        'Welcome to the PRIZE WINDOW! No tickets yet? Have a look anyway.',
        `The cabinets next door pay them. So does every game out on the front, up to ${number(DAILY_TICKET_CEILING)} a day.`,
      ]
    : [`Welcome to the PRIZE WINDOW! You have ${number(tickets)} tickets. What will it be?`];
}

