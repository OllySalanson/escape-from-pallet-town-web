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
 * the battle log, so the line is a summary and never news. A foe that healed
 * itself over and over is named, and so is one that simply hit much harder -
 * which was once left unsaid, and the Speed line said in its place. A fight
 * with nothing lopsided in it says nothing.
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
  /** The player's hits the other side resisted, and by which move. */
  let resistedHits = 0;
  const resistedMoves = new Map<string, number>();
  const statusLost = new Map<string, number>();
  /** HP a status took off the player's side between moves (poison, a burn), by status: ticks and total. */
  const statusChip = new Map<string, { ticks: number; total: number }>();
  let accuracyDropped: string | null = null;
  let missesAfterDrop = 0;
  let confusionHits = 0;
  /** A foe healing itself with a move (Recover), by name: the HP it undid. */
  const foeHeals = new Map<string, { count: number; move: string }>();
  /** Damage dealt by each side's hits, to say how lopsided the trade was. */
  const dealt = { player: { total: 0, hits: 0 }, enemy: { total: 0, hits: 0 } };
  const foeHitters = new Map<string, number>();

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
          if (event.damage) {
            dealt[event.user].total += event.damage;
            dealt[event.user].hits += 1;
            if (event.user === 'enemy') {
              foeHitters.set(event.name, (foeHitters.get(event.name) ?? 0) + event.damage);
            }
          }
          break;
        case 'healed':
          if (event.user === 'enemy' && lastMover?.user === 'enemy') {
            const before = foeHeals.get(event.name);
            foeHeals.set(event.name, { count: (before?.count ?? 0) + 1, move: before?.move ?? lastMover.move ?? '' });
          }
          break;
        case 'effectiveness':
          if (lastMover?.user === 'enemy' && event.multiplier > 1 && event.name === undefined) {
            superHits += 1;
            superMoves.set(lastMover.move ?? '', (superMoves.get(lastMover.move ?? '') ?? 0) + 1);
          }
          if (lastMover?.user === 'player' && event.multiplier > 0 && event.multiplier < 1) {
            resistedHits += 1;
            resistedMoves.set(lastMover.move ?? '', (resistedMoves.get(lastMover.move ?? '') ?? 0) + 1);
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
        case 'status-damage':
          if (event.user === 'player') {
            const before = statusChip.get(event.status) ?? { ticks: 0, total: 0 };
            statusChip.set(event.status, { ticks: before.ticks + 1, total: before.total + event.damage });
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
    // Only a turn both sides moved in was a race: a turn spent on a Potion, a
    // ball or a switch is the foe's alone, and counted as theirs it blamed
    // Speed for a fight the player outsped (veteran playtest, 22 Nov 2026:
    // 'RATTATA moved first 3 times' where it had once).
    const raced = turn.some((event) => (event.type === 'used-move' || event.type === 'missed') && event.user === 'player');
    if (first && first.user === 'enemy' && raced) {
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
  // Poison or a burn wearing a Pokémon down between moves. Said as 'Speed:
  // WEEDLE moved first 4 times' over a Charmander poisoned at 13/22, which told
  // the friend nothing to do (AI playtest, 23 Nov 2026): the cure is the answer.
  const [chip] = [...statusChip.entries()].sort((a, b) => b[1].total - a[1].total);
  if (chip && chip[1].ticks >= WHAT_BEAT_YOU_LEAST) {
    const cure = STATUS_CURES[chip[0]];
    facts.push({
      line: `${capitalise(chip[0])}: it took ${chip[1].total} HP off yours over ${chip[1].ticks} turns.${cure ? ` ${cure} cures it.` : ''}`,
      weight: chip[1].ticks * 1.2,
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
  if (resistedHits >= WHAT_BEAT_YOU_LEAST) {
    // The type matchup, which is the lesson a lone Fire starter walking into a
    // Water gym most needs - and was told only who moved first (wave 1's playtest).
    const [move] = [...resistedMoves.entries()].sort((a, b) => b[1] - a[1]);
    facts.push({
      line:
        move && move[1] === resistedHits
          ? `Not very effective: your ${move[0].toUpperCase()} was resisted ${times(resistedHits)}.`
          : `Not very effective: ${resistedHits} of your hits were resisted.`,
      weight: resistedHits,
    });
  }
  if (confusionHits >= WHAT_BEAT_YOU_LEAST) {
    facts.push({ line: `Confusion: your Pokémon hurt itself ${times(confusionHits)}.`, weight: confusionHits * 1.25 });
  }
  const [healer] = [...foeHeals.entries()].sort((a, b) => b[1].count - a[1].count);
  if (healer && healer[1].count >= WHAT_BEAT_YOU_LEAST) {
    // Starmie's Recover undid fight after fight while the line blamed a
    // Smokescreen (AI playtest, 22 Nov 2026): every heal is a turn of the
    // player's damage handed back.
    facts.push({
      line: `${title(healer[1].move)}: ${healer[0].toUpperCase()} healed itself ${times(healer[1].count)}.`,
      weight: healer[1].count * 1.5,
    });
  }
  const turnsPlayed = turns.filter((turn) =>
    turn.some((event) => (event.type === 'used-move' || event.type === 'missed') && event.user === 'player') &&
    turn.some((event) => (event.type === 'used-move' || event.type === 'missed') && event.user === 'enemy'),
  ).length;
  // The other side simply hitting much harder is the commonest loss there is,
  // and it was said as 'Speed: STARYU moved first 8 times', which sent a
  // newcomer looking for speed when they were four levels short (AI playtest,
  // 22 Nov 2026). Said when their hits did at least twice what the player's did.
  const average = (side: { total: number; hits: number }): number => (side.hits === 0 ? 0 : side.total / side.hits);
  const theirs = Math.round(average(dealt.enemy));
  const yours = Math.round(average(dealt.player));
  // It competes with every other fact rather than waiting for none: 'Rain and
  // Swift Swim: HORSEA moved first twice' was said over a fight Staryu's
  // Tackles won by 8 to 2, with Horsea long since knocked out (AI playtest,
  // 22 Nov 2026). A hit is a turn's damage, so it weighs a little over a turn.
  if (dealt.enemy.hits >= WHAT_BEAT_YOU_LEAST && theirs >= Math.max(2, yours * 2)) {
    const [hitter] = [...foeHitters.entries()].sort((a, b) => b[1] - a[1]);
    facts.push({
      line: `Damage: ${foeHitters.size === 1 ? hitter[0].toUpperCase() : 'they'} hit for about ${theirs} a turn, you for about ${yours}.`,
      weight: dealt.enemy.hits * (theirs >= yours * 3 ? 1.5 : 1.1),
    });
  }
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

/** What cures a status that wears a Pokémon down, in the pack's own words. */
const STATUS_CURES: Readonly<Record<string, string>> = {
  poison: 'An Antidote or a Pecha Berry',
  burn: 'A Rawst Berry',
};

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
