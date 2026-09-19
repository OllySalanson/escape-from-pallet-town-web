import { describeGroup, type ExtractionReport, type ReportItem } from './extractionReport';

/**
 * The three beats a lost raid opens on, before the result screen's accounting.
 *
 * A defeat is the only moment in the loop where the secure-slot decision is
 * finally paid, so the sequence is built to answer that decision rather than to
 * announce a death: who was standing when the party ran out, what was taken off
 * the body, and what the slot held anyway. Every word is here rather than in the
 * scene, so the tone is one file to re-read and one file to change, and so it is
 * testable without Phaser.
 *
 * Nothing in it advances by itself. The player is being shown what a raid cost,
 * and a screen that moves on while they are still reading takes that away at the
 * moment they most want to sit with it, so each beat holds until a key or a
 * click moves it on and each beat carries the prompt that says so. It stays as
 * skippable as it ever was - every key advances, from the first frame - because
 * skipping ahead and being pushed ahead are different things.
 *
 * Tone: the player is knocked out and stripped, not killed. That is what an
 * extraction raid does to you, it is what the rest of this game's wipe copy
 * already says ("You went down", "You blacked out"), and it is the reading that
 * survives a Pokemon game aimed at anyone. The darker version is a rewrite of
 * the strings below and nothing else.
 */

/** What the raid did with a figure standing on the field when it ended. */
export type DefeatFate = 'taken' | 'held';

export interface DefeatFigure {
  readonly kind: 'pokemon' | 'item';
  readonly label: string;
  /** Present for Pokemon, and how their sprite is found. */
  readonly dexId?: number;
  /**
   * Present for Pokemon. The level is what makes a line-up personal: it is the
   * difference between "a Charmander" and the one carried through six raids.
   */
  readonly level?: number;
  /** Present for items, which stack rather than stand alone. */
  readonly quantity?: number;
  /** Present for items, and how their icon is found. */
  readonly itemId?: string;
  readonly fate: DefeatFate;
  /** The Pokemon that was out when the party ran out, drawn front and centre. */
  readonly lastStand: boolean;
}

export type DefeatBeatId = 'fall' | 'taken' | 'held';

export interface DefeatBeat {
  readonly id: DefeatBeatId;
  /** Shouted in the battle font. Kept to a few words at chunky sizes. */
  readonly headline: string;
  /** The sentence under it, which is where the specifics live. */
  readonly detail: string;
  /**
   * How the player is told to move this beat on. Nothing here advances by
   * itself, so a beat without a prompt on screen would be a dead end.
   */
  readonly prompt: string;
}

export interface DefeatSequence {
  /** The party and the supplies at stake, in the order they are drawn. */
  readonly figures: readonly DefeatFigure[];
  readonly beats: readonly DefeatBeat[];
  /**
   * A held instant on the line-up still standing, before the first beat drops
   * it. Without it the party is already on the ground when the screen opens and
   * there is nothing to recognise as having fallen.
   *
   * It is the screen arriving rather than the screen proceeding: it carries no
   * words, and a key pressed inside it is swallowed - see `holdMs`.
   */
  readonly leadInMs: number;
  /**
   * How long a beat stands before a key can move it on, and before it says
   * PRESS SPACE. The player arrives here pressing SPACE: it is how they read
   * "Squirtle fainted!" off the battle screen a moment ago, and two ordinary
   * presses of that same rhythm used to carry them from the faint to the final
   * beat without having seen one. A beat that answers a press it was never
   * shown for is not waiting for the player, so each one holds for a breath
   * first, and the prompt appears when it has started listening - never before.
   */
  readonly holdMs: number;
  /**
   * The blinking glyph drawn after every prompt. It is the battle dialogue's own
   * continue indicator, kept separate from the words because only the glyph
   * blinks - a prompt that blinks out entirely is unreadable half the time.
   */
  readonly promptIndicator: string;
}

/**
 * The prompt under every beat, and the only way out of one.
 *
 * A defeat is where the secure-slot gamble is finally paid, so the screen waits
 * for the player rather than reading itself out at them; the price of waiting is
 * that it must say so, unmistakably, in the same words the rest of the game uses
 * for the same key. The battle dialogue's continue indicator is `SPACE \u25bc`, so
 * this is that indicator said out loud, with the same glyph blinking after it.
 *
 * The key is advertised rather than enforced: any key and any click advance,
 * because a player on their tenth defeat must never have to find the right one.
 */
const ADVANCE_PROMPT = 'PRESS SPACE';

/** The last beat says where it is going, because it leaves the sequence. */
const FINAL_PROMPT = 'PRESS SPACE FOR THE RESULT';

const PROMPT_INDICATOR = '\u25bc';

const LEAD_IN_MS = 260;

const BEAT_HOLD_MS = 650;

/** Past this many, the line-up stops reading as a line-up and starts as a list. */
const MAX_FIGURES = 8;

/**
 * Builds the sequence for a report, or null when the report is not a defeat.
 *
 * A raid lost to the clock is a different failure with no line-up on the ground,
 * and an extraction is not a failure at all; both go straight to the accounting.
 */
export function buildDefeatSequence(report: ExtractionReport): DefeatSequence | null {
  const fallen = report.fallen ?? [];
  if (report.outcome !== 'WIPED' || report.cause !== 'defeated' || fallen.length === 0) {
    return null;
  }

  const figures = buildFigures(report);
  const takenNames = describeGroup(report.ledger);
  const heldNames = describeGroup(report.secured);
  const standing = fallen.find((member) => member.lastStand) ?? fallen[fallen.length - 1];

  const beats: DefeatBeat[] = [
    {
      id: 'fall',
      headline: `${standing.name.toUpperCase()} FAINTED.`,
      // Where you fell is not said: it was "in the grass", read by someone lying
      // on the paving of a market square.
      detail:
        fallen.length === 1
          ? 'The only one you brought. You went down beside it.'
          : `The last of ${fallen.length} still standing. You went down beside it.`,
      prompt: ADVANCE_PROMPT,
    },
    {
      id: 'taken',
      headline: takenNames === null ? 'NOTHING LEFT TO TAKE.' : 'THEY STRIPPED YOU.',
      detail:
        takenNames === null
          ? 'Everything you carried out was already protected. They went through your bag for nothing.'
          : `${capitalise(takenNames)} lifted off you and gone from your stash.`,
      prompt: ADVANCE_PROMPT,
    },
    {
      id: 'held',
      headline: heldNames === null ? 'THE SECURE SLOT WAS EMPTY.' : 'THE SECURE SLOT HELD.',
      detail:
        heldNames === null
          ? 'You deployed with nothing protected, so nothing came back with you.'
          : `${capitalise(heldNames)} came home with you. That was the call you made before you deployed.`,
      prompt: FINAL_PROMPT,
    },
  ];

  return { figures, beats, leadInMs: LEAD_IN_MS, holdMs: BEAT_HOLD_MS, promptIndicator: PROMPT_INDICATOR };
}

/**
 * The cast on the ground: the party as deployed, then the supplies at stake.
 *
 * Pokemon come first and are never dropped, because the party is the personal
 * half of the moment; a bag deep enough to overflow the line-up loses its tail
 * to the ledger below, which lists every last Potion anyway.
 */
function buildFigures(report: ExtractionReport): DefeatFigure[] {
  const pokemon: DefeatFigure[] = (report.fallen ?? []).map((member) => ({
    kind: 'pokemon',
    label: member.name,
    dexId: member.dexId,
    level: member.level,
    fate: member.secured ? 'held' : 'taken',
    lastStand: member.lastStand,
  }));
  const items: DefeatFigure[] = [
    ...report.ledger.items.map((item) => toItemFigure(item, 'taken')),
    ...report.secured.items.map((item) => toItemFigure(item, 'held')),
  ];
  return [...pokemon, ...items].slice(0, Math.max(pokemon.length, MAX_FIGURES));
}

function toItemFigure(item: ReportItem, fate: DefeatFate): DefeatFigure {
  return {
    kind: 'item',
    label: item.label,
    quantity: item.quantity,
    itemId: item.itemId,
    fate,
    lastStand: false,
  };
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Decides whether a press moves the sequence on. Phaser-free, so the rule that
 * a carried-over press skips nothing is a test rather than a playtest.
 *
 * Two kinds of press are not the player answering the beat in front of them: a
 * key still held down from the battle, which the browser repeats, and a press
 * that lands before the beat has stood for `holdMs`.
 */
export interface BeatGate {
  /** Call when a beat lands. */
  beatEntered(nowMs: number): void;
  /** True once the beat on screen is listening, which is when its prompt shows. */
  isListening(nowMs: number): boolean;
  accepts(press: { readonly nowMs: number; readonly repeat: boolean }): boolean;
}

export function createBeatGate(holdMs: number): BeatGate {
  let listeningFrom = Number.POSITIVE_INFINITY;
  const isListening = (nowMs: number): boolean => nowMs >= listeningFrom;
  return {
    beatEntered(nowMs) {
      listeningFrom = nowMs + holdMs;
    },
    isListening,
    accepts: ({ nowMs, repeat }) => !repeat && isListening(nowMs),
  };
}
