import type { BattleEvent } from './battleEngine';
import { WEATHER_CONDITIONS, type WeatherId } from './weather';

/**
 * What beat you: one line, said after a fight is lost, built from nothing but the
 * fight's own events (firstmate's `eptw-gyms-loadouts-plan`, section 4.7: "Rain and
 * Swift Swim: Horsea moved first 6 times").
 *
 * It names the one thing the other side did to the player most, as a fact and a
 * count - the weather racing their swimmers, hits that landed for double, turns
 * lost to sleep or paralysis, attacks that missed after a Smokescreen - and never
 * the answer. Every count is read off lines the player has already been shown in
 * the battle log, so the line is a summary and never news. A fight with nothing
 * worth saying (the other side simply hit harder) says nothing.
 *
 * Phaser-free, and asked by the battle scene with every turn's events in order.
 */

/** A fact needs to have happened this often before it is the thing that beat you. */
export const WHAT_BEAT_YOU_LEAST = 2;

interface Mover {
  readonly user: 'player' | 'enemy';
  readonly move?: string;
}

interface Fact {
  readonly line: string;
  /** How much it cost the player, to choose between facts: turns lost, roughly. */
  readonly weight: number;
}

/**
 * The line, or null. `turns` is every batch of events the fight resolved, in
 * order (the opening send-out first); `weather` is the weather the fight began in.
 */
export function whatBeatYou(turns: readonly (readonly BattleEvent[])[], weather: WeatherId | null = null): string | null {
  let current: WeatherId | null = weather;
  /** Foes whose ability speeds them in the weather, by name, and the ability. */
  const quickened = new Map<string, string>();
  /** Turns a foe moved first, by name, while it was quickened by the weather. */
  const racedInWeather = new Map<string, { count: number; weather: WeatherId }>();
  let foeFirst = 0;
  const foeFirstNames = new Map<string, number>();
  let superHits = 0;
  const superMoves = new Map<string, number>();
  const statusLost = new Map<string, number>();
  let accuracyDropped: string | null = null;
  let missesAfterDrop = 0;
  let confusionHits = 0;

  for (const turn of turns) {
    const weatherThisTurn = current;
    const first = turn.find((event) => event.type === 'used-move' || event.type === 'missed');
    let lastMover = null as Mover | null;
    for (const event of turn) {
      switch (event.type) {
        case 'ability':
          if (event.user === 'enemy' && event.effect === 'quickened') {
            quickened.set(event.name, title(event.ability));
          }
          break;
        case 'used-move':
          lastMover = { user: event.user, move: event.move };
          break;
        case 'effectiveness':
          if (lastMover?.user === 'enemy' && event.multiplier > 1 && event.name === undefined) {
            superHits += 1;
            superMoves.set(lastMover.move ?? '', (superMoves.get(lastMover.move ?? '') ?? 0) + 1);
          }
          break;
        case 'spread-damage':
          // Each target of a spread move is its own line, under the one that named the move.
          lastMover = { user: event.user, move: sameSide(lastMover, event.user)?.move };
          break;
        case 'status-prevented':
          if (event.user === 'player') {
            statusLost.set(event.status, (statusLost.get(event.status) ?? 0) + 1);
          }
          break;
        case 'confusion-self-hit':
          if (event.user === 'player') {
            confusionHits += 1;
          }
          break;
        case 'stat-stage-changed':
          if (event.user === 'player' && event.stat === 'accuracy' && event.stages < 0) {
            accuracyDropped ??= lastMover?.user === 'enemy' ? (lastMover.move ?? null) : null;
          }
          break;
        case 'missed':
          if (event.user === 'player' && accuracyDropped !== null) {
            missesAfterDrop += 1;
          }
          break;
        case 'weather-set':
          current = event.weather;
          break;
        case 'weather-ended':
          current = null;
          break;
        default:
          break;
      }
    }
    if (first && first.user === 'enemy') {
      foeFirst += 1;
      const name = first.name;
      foeFirstNames.set(name, (foeFirstNames.get(name) ?? 0) + 1);
      if (weatherThisTurn !== null && quickened.has(name)) {
        const raced = racedInWeather.get(name) ?? { count: 0, weather: weatherThisTurn };
        racedInWeather.set(name, { count: raced.count + 1, weather: weatherThisTurn });
      }
    }
  }

  const facts: Fact[] = [];
  const [racer] = [...racedInWeather.entries()].sort((a, b) => b[1].count - a[1].count);
  if (racer && racer[1].count >= WHAT_BEAT_YOU_LEAST) {
    const [name, { count, weather: raced }] = racer;
    facts.push({
      line: `${weatherWord(raced)} and ${quickened.get(name)}: ${name.toUpperCase()} moved first ${times(count)}.`,
      // A combo is the lesson a gym is built on, so it outranks a plain count.
      weight: count * 1.5,
    });
  }
  const statuses = [...statusLost.entries()].sort((a, b) => b[1] - a[1]);
  const lostTurns = statuses.reduce((sum, [, count]) => sum + count, 0);
  if (lostTurns >= WHAT_BEAT_YOU_LEAST) {
    const named = statuses.map(([status]) => statusWord(status));
    facts.push({
      line: `${capitalise(joinWords(named))}: your Pokémon lost ${lostTurns} turns.`,
      weight: lostTurns * 1.25,
    });
  }
  if (accuracyDropped !== null && missesAfterDrop >= WHAT_BEAT_YOU_LEAST) {
    facts.push({ line: `${title(accuracyDropped)}: your attacks missed ${times(missesAfterDrop)}.`, weight: missesAfterDrop * 1.25 });
  }
  if (superHits >= WHAT_BEAT_YOU_LEAST) {
    const [move] = [...superMoves.entries()].sort((a, b) => b[1] - a[1]);
    facts.push({
      line:
        move && move[1] === superHits
          ? `Super effective: ${move[0].toUpperCase()} hit you ${times(superHits)}.`
          : `Super effective: ${superHits} of their hits.`,
      weight: superHits,
    });
  }
  if (confusionHits >= WHAT_BEAT_YOU_LEAST) {
    facts.push({ line: `Confusion: your Pokémon hurt itself ${times(confusionHits)}.`, weight: confusionHits * 1.25 });
  }
  const turnsPlayed = turns.filter((turn) => turn.some((event) => event.type === 'used-move' || event.type === 'missed')).length;
  if (facts.length === 0 && foeFirst >= Math.max(3, Math.ceil(turnsPlayed * 0.75))) {
    const [name] = [...foeFirstNames.entries()].sort((a, b) => b[1] - a[1]);
    facts.push({
      line:
        foeFirstNames.size === 1
          ? `Speed: ${name[0].toUpperCase()} moved first ${times(foeFirst)}.`
          : `Speed: they moved first ${times(foeFirst)}, ${name[0].toUpperCase()} most.`,
      weight: foeFirst,
    });
  }
  const [best] = facts.sort((a, b) => b.weight - a.weight);
  return best?.line ?? null;
}

/** The last mover, if it was on this side. */
function sameSide<T extends { readonly user: 'player' | 'enemy' }>(mover: T | null, side: 'player' | 'enemy'): T | null {
  return mover !== null && mover.user === side ? mover : null;
}

function times(count: number): string {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;
}

/** SWIFT SWIM as Swift Swim, or a move's name as a sentence starts it. */
function title(words: string): string {
  return words
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function capitalise(words: string): string {
  return words ? words[0].toUpperCase() + words.slice(1) : words;
}

function joinWords(words: readonly string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function weatherWord(weather: WeatherId): string {
  return capitalise(WEATHER_CONDITIONS[weather].label.toLowerCase());
}

function statusWord(status: string): string {
  switch (status) {
    case 'sleep':
      return 'asleep';
    case 'paralysis':
      return 'paralysed';
    case 'freeze':
      return 'frozen';
    default:
      return status;
  }
}
