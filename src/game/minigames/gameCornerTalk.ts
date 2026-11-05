import type { RaidProgress } from '../save/SaveManager';
import { BERRIES_A_DAY, DAILY_TICKET_CEILING, JUMP_TICKET_TIERS, today, NO_GAME_CORNER } from './tickets';
import { POKEMON_JUMP_PRIZES } from './generated/pokemonJump';

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

/** What the attendant says from behind the counter: how the place works, in four boxes. */
export function attendantLines(progress: Pick<RaidProgress, 'gameCorner'>): readonly string[] {
  const record = progress.gameCorner ?? NO_GAME_CORNER;
  const [first, second, third] = JUMP_TICKET_TIERS;
  const lines = [
    'Welcome to the GAME CORNER! No coins here - the cabinets pay TICKETS.',
    `POKéMON JUMP: SPACE jumps everyone on the ground. Small, quick jumpers do best.`,
    `${number(first.score)} points pays ${first.tickets} tickets, ${number(second.score)} pays ${second.tickets}, ${number(third.score)} pays ${third.tickets}. Once a day.`,
    `Past ${number(POKEMON_JUMP_PRIZES[0].score)} it pays BERRIES too. Spend tickets at the PRIZE WINDOW next door.`,
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
    ? ['Welcome to the PRIZE WINDOW! You have no tickets yet.', 'Play POKéMON JUMP next door, then come back and choose.']
    : [`Welcome to the PRIZE WINDOW! You have ${number(tickets)} tickets. What will it be?`];
}

/** The window's own small print, under its list. */
export const PRIZE_WINDOW_NOTE = `BERRIES: ${BERRIES_A_DAY} a day. Furniture goes home to THE BOLTHOLE. The cabinets pay at most ${DAILY_TICKET_CEILING} tickets a day.`;
