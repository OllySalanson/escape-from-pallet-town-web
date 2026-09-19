import type { BattleEvent } from '../pokemon/battle/battleEngine';
import { MoveCategory, type MoveBase } from '../pokemon/MoveBase';
import type { PokemonType } from '../pokemon/PokemonType';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { STAB_MULTIPLIER } from '../pokemon/battle/damage';
import { WeatherId, weatherLabel } from '../pokemon/battle/weather';

export const BATTLE_SCREEN_WIDTH = 320;
export const MOVE_COLUMN_WIDTH = 148;
/**
 * The one panel at the bottom of the battle screen. Dialogue, the command menu,
 * the move and item lists and the party list are all drawn in this rectangle,
 * in the same cream `pixelWindow`. They used to be two: a cream dialogue box
 * and a navy, blue-bordered menu fifteen pixels wider, so the box changed
 * colour, border and size every turn - and the party list was a third, tall
 * enough to cover the player's own HP plate while they chose who to heal.
 */
export const BATTLE_PANEL = { x: 8, y: 174, width: 304, height: 64 } as const;
/** Text starts this far inside the panel's left edge. */
const PANEL_INSET_X = 10;
export const MOVE_COMMAND_ROWS = 2;
export const MOVE_COMMAND_HEIGHT = 64;
/** Move rows are single-line so the two guidance lines share the same panel. */
export const MOVE_GUIDANCE_ROWS = 2;

export interface MoveCommandLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CombatPresentationStep {
  readonly event: BattleEvent;
  readonly actor: 'player' | 'enemy' | null;
  readonly target: 'player' | 'enemy' | null;
  readonly hpDelta: number;
}

export const formatMoveCommand = (move: {
  readonly base: { readonly name: string };
  readonly pp: number;
}): string => (move.pp > 0 ? move.base.name.toUpperCase() : `${move.base.name.toUpperCase()} --`);

export const moveCommandLayout = (index: number): MoveCommandLayout => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 18 + column * MOVE_COLUMN_WIDTH,
    y: 2 + row * 17,
    width: MOVE_COLUMN_WIDTH - 12,
    height: 16,
  };
};

/**
 * The main command set is a grid with two rows, always. A wild fight has five
 * commands, and as a third row its last entry sat six pixels off the border;
 * as a third column every command keeps the pitch the four-command set has.
 */
export const mainCommandColumns = (count: number): number => (count > 4 ? 3 : 2);

export const mainCommandLayout = (index: number, count: number): { x: number; y: number } => {
  const columns = mainCommandColumns(count);
  const pitch = Math.floor((BATTLE_PANEL.width - PANEL_INSET_X * 2) / columns);
  return {
    x: BATTLE_PANEL.x + PANEL_INSET_X + (index % columns) * pitch,
    y: 11 + Math.floor(index / columns) * 25,
  };
};

/** The party list: a prompt line, then the party two abreast - six fit the panel. */
export const PARTY_COLUMNS = 2;
export const partyPromptLayout = { x: BATTLE_PANEL.x + PANEL_INSET_X, y: 4 } as const;
export const partyRowLayout = (index: number): { x: number; y: number } => ({
  x: BATTLE_PANEL.x + PANEL_INSET_X + (index % PARTY_COLUMNS) * MOVE_COLUMN_WIDTH,
  y: 19 + Math.floor(index / PARTY_COLUMNS) * 14,
});

/** One party member as the list names them. A fainted one has no HP worth a column. */
export const formatPartyRow = (pokemon: {
  readonly base: { readonly name: string };
  readonly level: number;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly isFainted: boolean;
}): string =>
  `${pokemon.base.name.toUpperCase()} ${levelLabel(pokemon.level)} ${
    pokemon.isFainted ? 'FNT' : `HP ${pokemon.currentHp}/${pokemon.maxHp}`
  }`;

/** Names the key. It said `BACK: cancel`, and BACK is not written on any keyboard. */
export const CANCEL_HINT = 'ESC: cancel';

/**
 * The party list's top line. A refusal takes the line over rather than being
 * added under the list: it is the answer to the row the cursor is on, so it is
 * said beside that row and not at the far end of the panel.
 */
export const partyPrompt = (state: {
  readonly item?: { readonly displayName: string };
  readonly forced: boolean;
  readonly refusal: string;
}): string =>
  state.refusal ||
  (state.item
    ? `${itemTargetPrompt(state.item)}  ${CANCEL_HINT}`
    : state.forced
      ? 'Choose a POKéMON!'
      : `Choose a POKéMON  ${CANCEL_HINT}`);

/**
 * The beat before a trainer's next Pokemon lands.
 *
 * A knockout in a trainer fight used to be a cutscene: the next one arrived and
 * the player read about it. Named first, it is a decision - the Pokemon that
 * just won is often the wrong answer to what is coming next, and the switch is
 * free because nothing has moved yet.
 *
 * Two lines and two options, in the same panel every other battle menu is drawn
 * in. The options are written in the order the question is asked, and the cursor
 * starts on the one that changes nothing: this prompt opens on the key that
 * finished the previous line, exactly as `trainerChallengePrompt` does, so the
 * committing answer may never be the one under the finger already.
 */
export const ABOUT_TO_USE_QUESTION = 'Will you switch POKéMON?';
export const ABOUT_TO_USE_OPTIONS = ['YES', 'NO'] as const;
export const ABOUT_TO_USE_DECLINE = ABOUT_TO_USE_OPTIONS.indexOf('NO');

export const aboutToUseLine = (trainerName: string, pokemonName: string): string =>
  `${trainerName} is about to use ${pokemonName.toUpperCase()}.`;

export const aboutToUsePromptLayout = (line: number): { x: number; y: number } => ({
  x: BATTLE_PANEL.x + PANEL_INSET_X,
  y: 4 + line * 14,
});

export const aboutToUseOptionLayout = (index: number): { x: number; y: number } => ({
  x: BATTLE_PANEL.x + PANEL_INSET_X + index * MOVE_COLUMN_WIDTH,
  y: 38,
});

/** The guidance lines sit under the two move rows, inside the same panel. */
export const moveGuidanceLayout = (line: number): MoveCommandLayout => ({
  x: 18,
  y: 37 + line * 12,
  width: BATTLE_SCREEN_WIDTH - 36,
  height: 11,
});

export type MatchupTone = 'good' | 'bad' | 'neutral' | 'none';

export interface MoveGuidance {
  /** Type, category, power and PP: what the move is. */
  readonly summary: string;
  /** How the move lands on the Pokemon currently facing the player. */
  readonly matchup: string;
  readonly tone: MatchupTone;
  readonly effectiveness: number;
}

export const formatMultiplier = (multiplier: number): string =>
  `x${Number.isInteger(multiplier) ? multiplier : multiplier.toFixed(2).replace(/0+$/, '')}`;

export const effectivenessLabel = (multiplier: number): string => {
  if (multiplier === 0) {
    return 'NO EFFECT';
  }
  if (multiplier > 1) {
    return 'SUPER EFFECTIVE';
  }
  return multiplier < 1 ? 'RESISTED' : 'NORMAL DAMAGE';
};

export const matchupTone = (multiplier: number): MatchupTone => {
  if (multiplier === 0) {
    return 'none';
  }
  return multiplier > 1 ? 'good' : multiplier < 1 ? 'bad' : 'neutral';
};

export const formatTypeList = (types: readonly PokemonType[]): string =>
  types.map((type) => type.toUpperCase()).join('/');

/**
 * Everything the player needs before committing to a move: what it does, and
 * how it lands on the Pokemon in front of them. Derived rather than authored so
 * the panel can never drift from `calculateDamage`.
 */
export const describeMoveGuidance = (
  move: { readonly base: MoveBase; readonly pp: number },
  attackerTypes: readonly PokemonType[],
  defender: { readonly name: string; readonly types: readonly PokemonType[] },
): MoveGuidance => {
  const isStab = attackerTypes.includes(move.base.type);
  const stabSuffix = isStab ? ` · SAME-TYPE ${formatMultiplier(STAB_MULTIPLIER)}` : '';
  const pp = `PP ${move.pp}/${move.base.pp}`;

  if (move.base.category === MoveCategory.Status || move.base.power <= 0) {
    return {
      summary: `${move.base.type.toUpperCase()} · STATUS · ${pp}`,
      matchup: move.base.description || 'No direct damage.',
      tone: 'neutral',
      effectiveness: 1,
    };
  }

  const effectiveness = getTypeEffectiveness(move.base.type, defender.types);
  return {
    summary: `${move.base.type.toUpperCase()} · ${move.base.category.toUpperCase()} · POWER ${move.base.power} · ${pp}${stabSuffix}`,
    matchup: `vs ${defender.name.toUpperCase()}: ${effectivenessLabel(effectiveness)} ${formatMultiplier(effectiveness)}`,
    tone: matchupTone(effectiveness),
    effectiveness,
  };
};

/**
 * The ITEM command carries what the player packed, the way BALL carries the
 * balls: the count is on the command, so the loadout decision is legible from
 * inside the fight it was made for rather than only from the bag screen.
 */
export const formatBallCommand = (count: number): string => `BALL x${count}`;

/** What the highlighted ball does, on the line a move's numbers take. */
export const describeBallGuidance = (ball: {
  readonly effect: { readonly type: string; readonly multiplier?: number };
}): string => {
  const multiplier = ball.effect.type === 'capture-modifier' ? (ball.effect.multiplier ?? 1) : 1;
  return multiplier === 1 ? 'Standard catch rate.' : `${multiplier}x catch rate.`;
};

export const formatItemCommand = (count: number): string => `ITEM x${count}`;

/** One medicine row in the item submenu, counted the way the pocket counts it. */
export const formatItemRow = (
  item: { readonly displayName: string },
  count: number,
): string => `${item.displayName.toUpperCase()} x${count}`;

/** The party screen's heading while it is choosing who to give an item to. */
export const itemTargetPrompt = (item: { readonly displayName: string }): string =>
  `Use ${item.displayName.toUpperCase()} on whom?`;

/**
 * What the highlighted medicine would do, on the same line the move submenu
 * puts a move's numbers - and it ends with the turn, because that is the price
 * and it has to be read before the item is spent, not after.
 */
export const describeItemGuidance = (item: { readonly description: string }): string =>
  `${item.description} Using it costs your turn.`;

/** Said when the ITEM command is chosen with nothing in the medicine pocket. */
export const NO_BATTLE_ITEMS_MESSAGE = 'No medicine in your pack!';

/** Whole seconds, so a cost printed on a command reads the same as the raid timer. */
export const formatSeconds = (ms: number): string => `${Math.round(ms / 1_000)}s`;

/**
 * Escape commands state their price before the player commits. The hunter's escape
 * costs raid time and always works; a wild escape is a roll, so it shows its odds.
 *
 * A price means nothing without the purse beside it: `FLEE -60s` with 1:24 on
 * the clock was honest and still ended a raid eight steps from the exit, because
 * nothing on the command related the two numbers. So once the price is a large
 * share of what is left the label carries what is left, and once it is all of it
 * the label says what buying it does instead of what it costs.
 */
export const HUNTER_FLEE_WARNING_SHARE = 0.5;

export const formatHunterFleeCommand = (
  penaltyMs: number,
  remainingMs: number = Number.POSITIVE_INFINITY,
): string => {
  if (penaltyMs >= remainingMs) {
    return 'FLEE: CLOCK OUT';
  }
  return penaltyMs >= remainingMs * HUNTER_FLEE_WARNING_SHARE
    ? `FLEE -${formatSeconds(penaltyMs)} OF ${formatSeconds(remainingMs)}`
    : `FLEE -${formatSeconds(penaltyMs)}`;
};

export const formatWildEscapeCommand = (chance: number): string =>
  `RUN ${Math.round(chance * 100)}%`;

/** What the player is told after breaking contact, so the cost is never silent. */
export const hunterFleeMessages = (penaltyMs: number, searchMs: number): readonly string[] => [
  'You broke away from the RIVAL HUNTER!',
  `It lost your trail and holds off for ${formatSeconds(searchMs)}.`,
  `Breaking contact cost ${formatSeconds(penaltyMs)} of raid time.`,
];

export const WILD_ESCAPE_SUCCESS_MESSAGE = 'Got away safely!';

export const wildEscapeFailureMessage = (enemyName: string): string =>
  `Couldn't get away from ${enemyName.toUpperCase()}!`;

export const combatPresentationSteps = (
  events: readonly BattleEvent[],
): readonly CombatPresentationStep[] =>
  events.map((event) => {
    if (event.type === 'used-move') {
      return {
        event,
        actor: event.user,
        target: event.target ?? null,
        hpDelta: event.damage ?? 0,
      };
    }
    if (
      event.type === 'confusion-self-hit' ||
      event.type === 'status-damage' ||
      event.type === 'gear-recoil'
    ) {
      return { event, actor: event.user, target: event.user, hpDelta: event.damage };
    }
    // Gear that gives HP back moves the bar the other way, so the delta is
    // negative damage: the bar animation is the same code either direction.
    if (event.type === 'gear-heal') {
      return { event, actor: event.user, target: event.user, hpDelta: -event.amount };
    }
    return { event, actor: null, target: null, hpDelta: 0 };
  });

export const combatantLabel = (user: 'player' | 'enemy'): string =>
  user === 'player' ? 'Your' : 'Foe';

/**
 * How a combatant is named in a line of battle text: always by side, always in
 * capitals. One battle used to say "Foe PIDGEY used GUST!" and then "Pidgey
 * fainted!", which reads as two different Pokemon.
 */
export const combatantName = (who: { readonly user: 'player' | 'enemy'; readonly name: string }): string =>
  `${combatantLabel(who.user)} ${who.name.toUpperCase()}`;

/**
 * What the player's own plate says about the gear its Pokemon is carrying, or
 * nothing at all when the slot is empty.
 *
 * A raid is fought with whatever was given out at base, and a fight is the one
 * place that choice pays off or does not - so the item is named on screen for
 * the whole fight rather than only in the line where it acts.
 *
 * The name and nothing else, because of where it has to go. The plate's bottom
 * row has 65 pixels clear to the left of the HP numbers; the longest gear name
 * is 51 of them at the caption size and `HOLDS FOCUS BAND` is 77. Under the
 * plate there is no room at all - the band between it and the dialogue panel is
 * twelve pixels, and a twelve-pixel line with its outline is fifteen, which is
 * how the first attempt came out with its feet under the panel.
 */
export const heldGearLabel = (heldItemName: string | undefined): string =>
  heldItemName === undefined ? '' : heldItemName.toUpperCase();

/**
 * A level as every plate and list writes it. It was `:L6`, which Orange Kid
 * draws as a dotted stroke against the number, so a level-6 PIDGEY read as 16.
 */
export const levelLabel = (level: number): string => `Lv ${level}`;

/**
 * The HUD banner names the side and its typing, so incoming damage is readable.
 * The player's side is YOURS and no longer: the banner starts at the plate's left
 * edge, and YOUR POKeMON with two long types ran past the plate and, for the
 * longest pair, past the screen.
 */
export type BannerRole = 'WILD' | 'FOE' | 'RIVAL' | 'YOURS';

/**
 * Whose Pokemon the enemy plate belongs to. RIVAL is the hunter's word - "A
 * RIVAL HUNTER is on your trail" - and every trainer once fought under it, so
 * the toll keeper's Pidgey read as the hunter's. An authored trainer is a FOE,
 * short enough that two long types still end inside the plate.
 */
export const enemyBannerRole = (battle: {
  readonly trainer: boolean;
  readonly hunter: boolean;
}): BannerRole => (battle.hunter ? 'RIVAL' : battle.trainer ? 'FOE' : 'WILD');

export const combatantBanner = (
  role: BannerRole,
  types: readonly PokemonType[],
): string => `${role}  ${formatTypeList(types)}`;

/**
 * One line of battle log per event. Damaging hits carry the HP they took, so a
 * defeat can be read back from the log without replaying the HP bar.
 */
export const eventToMessage = (event: BattleEvent): string => {
  switch (event.type) {
    case 'used-move': {
      // The HP figure is the whole point: a loss has to be explicable from the
      // log alone, not inferred from a bar that has already finished animating.
      // The same-type bonus is named because it is otherwise the largest
      // invisible term in the damage calculation.
      const opening = `${combatantName(event)} used ${event.move.toUpperCase()}!`;
      if (!event.damage) {
        return opening;
      }
      const stab = event.isStab ? ` · SAME-TYPE ${formatMultiplier(STAB_MULTIPLIER)}` : '';
      return `${opening} -${event.damage} HP${stab}`;
    }
    case 'missed':
      return 'The attack missed!';
    case 'critical-hit':
      return 'A critical hit!';
    case 'effectiveness':
      if (event.multiplier === 0) {
        return 'It does not affect the target...';
      }
      return event.multiplier > 1 ? "It's super effective!" : "It's not very effective...";
    case 'fainted':
      return `${combatantName(event)} fainted!`;
    case 'no-pp':
      return `No PP left for ${event.move}!`;
    case 'status-applied':
      return `${combatantName(event)} ${statusApplied(event.status)}!`;
    case 'status-already':
      return `${combatantName(event)} already has a status condition!`;
    case 'status-prevented':
      return `${combatantName(event)} ${statusHolds(event.status)}!`;
    case 'status-damage':
      return `${combatantName(event)} is hurt by ${statusLabel(event.status)}!`;
    case 'status-cured':
      return event.status === 'sleep'
        ? `${combatantName(event)} woke up!`
        : event.status === 'freeze'
          ? `${combatantName(event)} thawed out!`
          : `${combatantName(event)} snapped out of confusion!`;
    case 'confusion-self-hit':
      return `${combatantName(event)} hurt itself in confusion!`;
    case 'stat-stage-changed':
      return `${combatantName(event)}'s ${statLabel(event.stat)} ${event.stages > 0 ? 'rose' : 'fell'}!`;
    case 'ball-thrown':
      return `Threw a POKé BALL at ${event.name.toUpperCase()}!`;
    case 'catch-shake':
      return `${event.count}...`;
    case 'caught':
      return `Gotcha! ${event.name.toUpperCase()} was caught!`;
    case 'broke-free':
      return `${event.name.toUpperCase()} broke free!`;
    case 'catch-disabled':
      return "You can't catch a trainer's POKéMON!";
    case 'enemy-sent-out':
      return `Go, ${event.name.toUpperCase()}!`;
    // Gear says what it did, in the words of the thing it did it to. A player who
    // reads one of these lines once knows the whole rule, which is the bar every
    // piece of gear in the catalogue is held to.
    case 'gear-first-strike':
      return `${combatantName(event)}'s ${event.item} let it move first!`;
    case 'gear-endured':
      return `${combatantName(event)} hung on with its ${event.item}!`;
    case 'gear-recoil':
      return `${combatantName(event)} paid ${event.damage} HP to its ${event.item}.`;
    case 'gear-heal':
      return `${combatantName(event)} took +${event.amount} HP from its ${event.item}.`;
    // What a move does beyond its damage, in the same voice as everything else:
    // the line says who it happened to and what it cost, so a turn can be read
    // back from the log without watching the HP bar.
    case 'flinched':
      return `${combatantName(event)} flinched and couldn't move!`;
    case 'multi-hit':
      return `Hit ${event.hits} times!`;
    case 'drained':
      return `${combatantName(event)} drained +${event.amount} HP.`;
    case 'recoil':
      return `${combatantName(event)} was hurt by the recoil! -${event.damage} HP`;
    case 'healed':
      return `${combatantName(event)} restored +${event.amount} HP.`;
    case 'heal-failed':
      return `${combatantName(event)} is already at full HP.`;
    case 'charging':
      return `${combatantName(event)} is gathering itself...`;
    case 'recharging':
      return `${combatantName(event)} must recharge!`;
    // Weather speaks about the field rather than about either side, so these
    // lines name no one - except the chip, which is the weather taking HP off
    // somebody and is worded exactly as a burn or a poison is.
    case 'weather-set':
      return weatherSetMessage(event.weather, event.byMove);
    case 'weather-ended':
      return weatherEndedMessage(event.weather);
    case 'weather-damage':
      return `${combatantName(event)} is buffeted by the ${weatherLabel(event.weather).toLowerCase()}!`;
    // An ability is never shown in a menu, so every one of these lines is the
    // only teacher the player gets. Each says whose ability it was and what it
    // just did, in the same voice the gear lines use - and the four that change
    // a number every turn say it once a battle rather than once a turn.
    case 'ability':
      return abilityLine(event);
  }
};

/**
 * The two abilities that settle a wild escape outright.
 *
 * They are worded here rather than raised as a `BattleEvent` because an escape
 * is not resolved by `resolveTurn` at all - it is its own roll, and these two
 * replace the roll rather than adjust it.
 */
export const escapeAbilityMessage = (
  who: { readonly user: 'player' | 'enemy'; readonly name: string },
  ability: string,
  escaped: boolean,
): string =>
  escaped
    ? `${combatantName(who)}'s ${ability} took it clear away!`
    : `${combatantName(who)}'s ${ability} will not let it go!`;

const abilityLine = (event: {
  readonly user: 'player' | 'enemy';
  readonly name: string;
  readonly ability: string;
  readonly effect: string;
  readonly status?: string;
  readonly stat?: string;
  readonly amount?: number;
}): string => {
  const who = `${combatantName(event)}'s ${event.ability}`;
  switch (event.effect) {
    case 'powered-up':
      return `${who} is driving it harder!`;
    case 'sharpened':
      return `${who} has it in its sights!`;
    case 'shrugged-off':
      return `${who} is soaking that up!`;
    case 'hardened':
      return `${who} turned the critical hit aside!`;
    case 'absorbed':
      return event.amount
        ? `${who} drank it in. +${event.amount} HP`
        : `${who} let it straight past!`;
    case 'blocked-status':
      return event.status
        ? `${who} kept ${statusLabel(event.status)} off it!`
        : `${who} would not let it flinch!`;
    case 'blocked-boost':
      return `${who} would not let its ${statLabel(event.stat ?? '')} drop!`;
    case 'blocked-secondaries':
      return `${who} blocked the extra effect!`;
    case 'no-recoil':
      return `${who} took no recoil.`;
    case 'shed':
      return `${who} shed ${statusLabel(event.status ?? '')} with its skin!`;
    case 'cured-on-switch':
      return `${who} cleared up ${statusLabel(event.status ?? '')}!`;
    case 'reflected':
      return `${who} passed ${statusLabel(event.status ?? '')} straight back!`;
    case 'contact':
      return event.amount
        ? `${who} tasted foul! -${event.amount} HP`
        : `${who} answered the touch!`;
    case 'sent-out':
      return `${who} sized up the other side!`;
    case 'quickened':
      return `${who} is racing the weather!`;
    case 'hidden':
      return `${who} is hard to make out in this!`;
    case 'weathered-out':
      return `${who} is holding the weather off!`;
    default:
      return `${who} did something.`;
  }
};

/**
 * What the field is doing, in two voices: what a move just did to it, and what
 * the place has been doing since before the fight started.
 *
 * The second is also the battle's opening line when the fight is in a district
 * with weather of its own, which is why it is one function - the sandstorm the
 * raid walked into and the sandstorm a move brought on are the same sandstorm,
 * and a player who has read one line knows what the other means.
 */
export const weatherSetMessage = (weather: WeatherId, byMove: boolean): string => {
  const started: Readonly<Record<WeatherId, string>> = {
    [WeatherId.Sandstorm]: 'A sandstorm brewed!',
    [WeatherId.Hail]: 'It started to hail!',
    [WeatherId.Rain]: 'It started to rain!',
    [WeatherId.HarshSunlight]: 'The sunlight turned harsh!',
  };
  const standing: Readonly<Record<WeatherId, string>> = {
    [WeatherId.Sandstorm]: 'A sandstorm is raging.',
    [WeatherId.Hail]: 'It is hailing.',
    [WeatherId.Rain]: 'It is raining.',
    [WeatherId.HarshSunlight]: 'The sunlight is harsh.',
  };
  return byMove ? started[weather] : standing[weather];
};

export const weatherEndedMessage = (weather: WeatherId): string =>
  ({
    [WeatherId.Sandstorm]: 'The sandstorm subsided.',
    [WeatherId.Hail]: 'The hail stopped.',
    [WeatherId.Rain]: 'The rain stopped.',
    [WeatherId.HarshSunlight]: 'The sunlight faded.',
  })[weather];

/**
 * Three phrasings, because one noun cannot do all three jobs. The status lines
 * used to read them all off a single label, which gave "is poison!" and "is
 * paralysis and can't move!" - fine for sleep, wrong English for the other two.
 * A burn or a paralysis now arrives on almost any Fire or Electric move rather
 * than only on the two moves that spelled it out, so these are read often.
 */
const statusApplied = (status: string): string =>
  ({
    poison: 'was poisoned',
    burn: 'was burned',
    paralysis: 'was paralysed',
    sleep: 'fell asleep',
    freeze: 'was frozen solid',
    confusion: 'became confused',
  })[status] ?? `is ${status}`;

/** What it says when the status is the reason a turn was lost. */
const statusHolds = (status: string): string =>
  ({
    poison: "is hurt and can't move",
    burn: "is burned and can't move",
    paralysis: "is fully paralysed and can't move",
    sleep: 'is fast asleep',
    freeze: 'is frozen solid',
    confusion: "is too confused to move",
  })[status] ?? `is ${status} and can't move`;

/** The adjectival one, for the lines that name the condition in passing. */
const statusLabel = (status: string): string =>
  ({
    poison: 'poison',
    burn: 'a burn',
    paralysis: 'paralysis',
    sleep: 'asleep',
    freeze: 'frozen',
    confusion: 'confused',
  })[status] ?? status;

const statLabel = (stat: string): string =>
  ({
    attack: 'Attack',
    defense: 'Defense',
    spAttack: 'Sp. Attack',
    spDefense: 'Sp. Defense',
    speed: 'Speed',
    // Neither of these is a number on a Pokemon - they exist only as stages -
    // but they are named on the same line as the five that are.
    accuracy: 'accuracy',
    evasion: 'evasion',
  })[stat] ?? stat;
