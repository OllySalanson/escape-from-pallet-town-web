/**
 * THE RAID ARENA's jump-in card, as pictures and numbers.
 *
 * It was seven labelled sentences - TEAM, AT RISK, SAFE, JOB, SKY, HUNTERS,
 * CLOCK - and after thirty raids nobody read it (the captain, 25 Nov 2026:
 * "far too many words"). So the card is two halves now. On the left, the three
 * things a player chooses before a jump, each a `< VALUE >` row (where to land,
 * which job, which sky), the clock those choices leave, and the two buttons. On
 * the right, four tiles that answer "what am I walking into" at a glance: who
 * comes and who is locked safe, what a wipe takes, who hunts and how hard, and
 * what the job pays against the walk. Every sentence the card used to print is
 * still there, whole, as the help line under whatever is pointed at or
 * highlighted, so nothing is lost; it is only no longer the first thing seen.
 *
 * And one key does one thing (the same day: "sometimes they move the map
 * pointer, other times the highlighted button"). Up and Down move between the
 * rows; Left and Right change the value of the row the highlight is on, or step
 * between the buttons on the bottom row. A click on a light in the pit still
 * chooses that landing.
 *
 * Phaser-free and a pure string, so the card's rules are tested without a browser.
 */
import { BRIEFING_ICONS, iconMarkup, itemIcon } from '../ui/icons';
import { pixelMonIcon } from '../ui/monIcon';
import { escapeAttribute, pixelFigure, pixelHpBar } from '../ui/pixelUi';
import type { CharacterDesignId } from '../world/characterDesigns';

/** A row of the card that holds a value: Left and Right change it. */
export type RimRowId = 'landing' | 'job' | 'sky';

/** Where the card's highlight is. */
export type RimCursor = { readonly row: RimRowId } | { readonly button: number } | null;

/** What an arrow key does on the card. */
export type RimKeyMove =
  | { readonly kind: 'row'; readonly row: RimRowId }
  | { readonly kind: 'button'; readonly index: number }
  | { readonly kind: 'step'; readonly row: RimRowId; readonly by: -1 | 1 }
  | { readonly kind: 'bump' };

const UP = new Set(['ArrowUp', 'w', 'W']);
const DOWN = new Set(['ArrowDown', 's', 'S']);
const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);

/** Whether a key is one of the card's four directions (the arrows, or W, A, S, D). */
export function isRimArrow(key: string): boolean {
  return UP.has(key) || DOWN.has(key) || LEFT.has(key) || RIGHT.has(key);
}

/**
 * The card's one rule for the arrows. `rows` are the value rows on show, top to
 * bottom; the buttons are the row under them, `buttons` long, entered at
 * `startButton`. A row with one value has nothing to change, so Left or Right
 * on it is a bump, never a move somewhere else.
 */
export function rimKeyMove(
  key: string,
  rows: readonly { readonly id: RimRowId; readonly choices: number }[],
  cursor: RimCursor,
  buttons: number,
  startButton: number,
): RimKeyMove {
  const rowIndex = cursor && 'row' in cursor ? rows.findIndex((row) => row.id === cursor.row) : -1;
  const onButtons = cursor !== null && 'button' in cursor;
  if (cursor === null || (rowIndex < 0 && !onButtons)) {
    // Nothing highlighted, or a row that is gone: any arrow puts it on the buttons.
    return { kind: 'button', index: startButton };
  }
  if (UP.has(key)) {
    if (onButtons) {
      return rows.length > 0 ? { kind: 'row', row: rows[rows.length - 1].id } : { kind: 'bump' };
    }
    return rowIndex > 0 ? { kind: 'row', row: rows[rowIndex - 1].id } : { kind: 'bump' };
  }
  if (DOWN.has(key)) {
    if (onButtons) {
      return { kind: 'bump' };
    }
    return rowIndex < rows.length - 1 ? { kind: 'row', row: rows[rowIndex + 1].id } : { kind: 'button', index: startButton };
  }
  const by = LEFT.has(key) ? -1 : RIGHT.has(key) ? 1 : 0;
  if (by === 0) {
    return { kind: 'bump' };
  }
  if (onButtons) {
    const next = ('button' in cursor ? cursor.button : 0) + by;
    return next >= 0 && next < buttons ? { kind: 'button', index: next } : { kind: 'bump' };
  }
  const row = rows[rowIndex];
  return row.choices > 1 ? { kind: 'step', row: row.id, by } : { kind: 'bump' };
}

/** The next of `choices` from `current`, `by` along, round from the end to the start. */
export function cycleChoice<T>(choices: readonly T[], current: T, by: -1 | 1): T {
  if (choices.length === 0) {
    return current;
  }
  const at = Math.max(0, choices.indexOf(current));
  return choices[(at + by + choices.length) % choices.length];
}

/**
 * The ways in, in the order Left and Right go through them: map by map as they
 * are offered, and on each map west to east, so Right on the card goes the way
 * the pit's lights lie.
 */
export function rimLandingOrder<T extends { readonly id: string; readonly mapId: string; readonly position: { readonly x: number; readonly y: number } }>(
  ways: readonly T[],
): readonly T[] {
  const maps = [...new Set(ways.map((way) => way.mapId))];
  return [...ways].sort(
    (a, b) => maps.indexOf(a.mapId) - maps.indexOf(b.mapId) || a.position.x - b.position.x || a.position.y - b.position.y,
  );
}

export interface RimChoiceRowOptions {
  readonly id: RimRowId;
  /** The row's name, in the headings' blue: LAND, JOB, SKY. */
  readonly label: string;
  /** What it is set to, already marked up (an icon may lead it). */
  readonly value: string;
  /** How many values it has: with one, its arrows are drawn dim and do nothing. */
  readonly choices: number;
  /** The whole sentence about the value, for the help line. */
  readonly help: string;
  /** Said in red: a job longer than the raid, a job short of what it needs. */
  readonly warn?: boolean;
  /** Which of `choices` it is on, from one: drawn as `2/3` so the choices behind the arrows are counted. */
  readonly at?: number;
}

/**
 * A row that holds a value, as `LAND < MILL SQUARE >`: one control, so the
 * highlight lands on the row and Left and Right are what change it. Its arrows
 * are parts of it a pointer or a finger can press - the left one back, the
 * right one on - and a press on the value goes on, as Enter does.
 */
export function rimChoiceRow(options: RimChoiceRowOptions): string {
  const one = options.choices <= 1;
  const arrow = (by: -1 | 1): string =>
    `<span class="rim-step${by < 0 ? ' is-back' : ''}" data-rim-step="${by}" aria-hidden="true"></span>`;
  return `<button class="rim-choice${one ? ' is-fixed' : ''}${options.warn ? ' is-warn' : ''}" data-rim-row="${options.id}" data-help="${escapeAttribute(options.help)}" aria-label="${escapeAttribute(`${options.label}: ${options.help}`)}"><span class="rim-choice-label">${options.label}</span>${arrow(-1)}<span class="rim-choice-value">${options.warn ? '<span class="rim-warn-mark" aria-hidden="true">!</span>' : ''}${options.value}</span>${
    `<small class="rim-choice-at">${one || options.at === undefined ? '' : `${options.at}/${options.choices}`}</small>`
  }${arrow(1)}</button>`;
}

/** An icon from the card's own set, with the words a screen reader is told instead. */
export function briefingIcon(name: keyof typeof BRIEFING_ICONS, label = ''): string {
  return iconMarkup(BRIEFING_ICONS[name], label);
}

/** A tile on the right of the card: a heading, what it says in pictures, and the sentence it stands for. */
function tile(id: string, heading: string, body: string, help: string, tone: '' | 'is-risk' | 'is-safe' | 'is-pay' = ''): string {
  return `<section class="rim-tile${tone ? ` ${tone}` : ''}" data-rim-tile="${id}" data-help="${escapeAttribute(help)}"><h3 class="rim-tile-head">${heading}</h3><div class="rim-tile-body">${body}</div></section>`;
}

export interface RimTileMember {
  readonly name: string;
  readonly speciesId: string;
  readonly level: number;
  readonly currentHp: number;
  readonly maxHp: number;
  /** The partner or a locker place: a wipe does not take it. */
  readonly safe: boolean;
  readonly partner?: boolean;
}

/**
 * TEAM: who comes, as FireRed's party icons - flapping at the pace their health
 * sets, so a hurt one is seen before a number is read - each with its level and
 * bar, and a padlock beside every one a wipe cannot take. The partner is named.
 */
export function rimTeamTile(options: {
  readonly members: readonly RimTileMember[];
  /** How many stay at base, said as a count after the icons. */
  readonly home: number;
  /** A hurt team's warning, in red over the icons (`hub/railWarning.ts`). */
  readonly hurt?: string;
  readonly help: string;
}): string {
  const members = options.members
    .map(
      (member) =>
        `<span class="rim-mon${member.safe ? ' is-safe' : ' is-risk'}">${pixelMonIcon({ name: member.name, currentHp: member.currentHp, maxHp: member.maxHp, base: { id: member.speciesId } })}${
          member.safe ? `<span class="rim-mon-lock">${briefingIcon('padlock', 'safe')}</span>` : ''
        }<span class="rim-mon-line"><span class="px-mon-level">LV${member.level}</span>${pixelHpBar(member.currentHp, member.maxHp, 18)}</span></span>`,
    )
    .join('');
  const partner = options.members.find((member) => member.partner);
  const notes = [
    ...(options.hurt ? [`<small class="rim-note px-warning">${options.hurt}</small>`] : []),
    ...(partner ? [`<small class="rim-note rim-wide">PARTNER <b>${escapeAttribute(partner.name)}</b></small>`] : []),
    ...(options.home > 0 ? [`<small class="rim-note">+${options.home} AT BASE</small>`] : []),
  ].join('');
  const atRisk = options.members.filter((member) => !member.safe).length;
  const state =
    options.members.length === 0
      ? ''
      : atRisk === 0
        ? ''
        : `<small class="px-warning">${atRisk} AT RISK</small>`;
  return tile('team', `Team${state}`, `<div class="rim-team"><div class="rim-mons">${members}</div><div class="rim-team-notes">${notes}</div></div>`, options.help, options.hurt ? 'is-risk' : '');
}

export interface RimTileStack {
  readonly itemId: string;
  readonly name: string;
  /** How many; a pack is one and has no count. */
  readonly quantity?: number;
}

/** A kind of Pokémon's party icon, at full health's pace. */
function speciesIcon(speciesId: string, name: string): string {
  return pixelMonIcon({ name, currentHp: 1, maxHp: 1, base: { id: speciesId } });
}

function stackIcon(stack: RimTileStack): string {
  const count = stack.quantity !== undefined && stack.quantity > 1 ? `<span class="rim-count">×${stack.quantity}</span>` : '';
  return `<span class="rim-stack">${itemIcon(stack.itemId, stack.name)}${count}</span>`;
}

/**
 * THE PACK: what a wipe takes, the pack first because it is the biggest single
 * thing it takes, and under it, after a padlock, what the locker keeps.
 */
export function rimPackTile(options: {
  readonly risked: readonly RimTileStack[];
  readonly kept: readonly RimTileStack[];
  /** Pokémon a wipe takes for good: drawn first among what it takes. */
  readonly lostPokemon: readonly { readonly speciesId: string; readonly name: string }[];
  readonly help: string;
}): string {
  const lost = options.lostPokemon
    .map((pokemon) => `<span class="rim-stack is-mon">${speciesIcon(pokemon.speciesId, pokemon.name)}</span>`)
    .join('');
  const risked =
    options.risked.length + options.lostPokemon.length === 0
      ? `<small class="rim-note">NOTHING</small>`
      : `${lost}${options.risked.map(stackIcon).join('')}`;
  const kept =
    options.kept.length === 0
      ? ''
      : `<div class="rim-line is-kept">${briefingIcon('padlock', 'safe')}${options.kept.map(stackIcon).join('')}</div>`;
  return tile('risk', 'A wipe takes', `<div class="rim-line">${risked}</div>${kept}`, options.help, options.risked.length + options.lostPokemon.length > 0 ? 'is-risk' : 'is-safe');
}

/**
 * HUNTERS: who, drawn, and how hard - a meter of the ladder's rungs lit red to
 * the one this raid opens on - over the two facts that decide the fight: how
 * many they bring and how strong their lead is beside your best.
 */
export function rimHunterTile(options: {
  readonly name: string;
  readonly design: CharacterDesignId;
  /** A raid alone meets a pack, a hunter a district; a room shares one. */
  readonly pack: boolean;
  /** Lit rungs, from one, of `rungs`. */
  readonly rung: number;
  readonly rungs: number;
  /** How many Pokémon they bring. */
  readonly count?: number;
  /** Their lead's level, and your best's. */
  readonly lead?: { readonly theirs: number; readonly yours: number };
  /** Seconds sooner a job brings it, said when it is any. */
  readonly soonerSeconds: number;
  readonly help: string;
}): string {
  const pips = Array.from({ length: options.rungs }, (_, index) => `<span class="rim-pip${index < options.rung ? ' is-lit' : ''}"></span>`).join('');
  const brings =
    options.count === undefined
      ? ''
      : `<span class="rim-balls" role="img" aria-label="${options.count} Pokémon">${Array.from({ length: options.count }, () => '<span class="rim-ball"></span>').join('')}</span>`;
  const lead = options.lead
    ? `<span class="rim-fact${options.lead.theirs >= options.lead.yours ? ' px-warning' : ''}"><span class="rim-wide">LEAD </span><b>LV${options.lead.theirs}</b> · YOURS LV${options.lead.yours}</span>`
    : '';
  const sooner = options.soonerSeconds > 0 ? `<span class="rim-fact px-warning">COMES ${options.soonerSeconds}S SOONER</span>` : '';
  return tile(
    'hunters',
    `${options.pack ? 'Hunters' : 'Hunter'}<span class="rim-pips" role="img" aria-label="danger ${options.rung} of ${options.rungs}">${pips}</span>`,
    `<div class="rim-hunter">${pixelFigure(options.design, options.name)}<div class="rim-hunter-words"><span><strong class="px-name">${options.name}</strong> ${brings}${options.pack ? '<small class="rim-wide"> +1 PER DISTRICT</small>' : ''}</span><span class="rim-facts">${lead}</span>${sooner}</div></div>`,
    options.help,
    options.rung > 1 ? 'is-risk' : '',
  );
}

/** What a job pays, as the things themselves. */
export interface RimJobPay {
  readonly items: readonly RimTileStack[];
  readonly pokemon: readonly { readonly speciesId: string; readonly name: string; readonly level: number }[];
}

/**
 * THE JOB: what it pays, as the things themselves, and the walk it is against
 * the clock - a track the clock's length, the straight walk solid and the time
 * to allow for stops lighter after it, red and running off the end when that
 * is longer than the raid - and a way in that walks it much quicker.
 */
export function rimJobTile(
  options:
    | {
        readonly kind: 'job';
        readonly pay: RimJobPay;
        readonly walkMs?: number;
        readonly allowMs?: number;
        readonly clockMs: number;
        readonly tooLong: boolean;
        /** Short of what it needs carried in: the things, in red. */
        readonly short: readonly RimTileStack[];
        /** A way in on offer that walks it much quicker. */
        readonly quicker?: { readonly id: string; readonly label: string; readonly ms: number };
        readonly help: string;
        readonly format: (ms: number) => string;
      }
    | { readonly kind: 'none'; readonly arrowTo?: string; readonly help: string },
): string {
  if (options.kind === 'none') {
    return tile('job', 'No job', `<small class="rim-note">${options.arrowTo ? `THE GOLD ARROW: ${options.arrowTo}` : 'NOTHING TO FETCH'}</small>`, options.help, 'is-pay');
  }
  const pay = [
    ...options.pay.items.map(stackIcon),
    ...options.pay.pokemon.map(
      (pokemon) => `<span class="rim-stack is-mon">${speciesIcon(pokemon.speciesId, pokemon.name)}<span class="rim-count">LV${pokemon.level}</span></span>`,
    ),
  ].join('');
  const short =
    options.short.length > 0
      ? `<div class="rim-line is-short"><small class="px-warning">NEEDS</small>${options.short.map(stackIcon).join('')}</div>`
      : '';
  const allow = options.allowMs ?? options.walkMs ?? 0;
  // The track is the longer of the raid and the walk, so a walk past the end
  // of the raid is drawn going past the notch where the raid ends.
  const span = Math.max(1, options.clockMs, allow);
  const share = (ms: number): number => Math.max(0, Math.min(1, ms / span));
  const walk =
    options.walkMs === undefined
      ? ''
      : `<div class="rim-walk${options.tooLong ? ' is-warn' : ''}" style="--walk:${share(options.walkMs)};--allow:${share(allow)};--clock:${share(options.clockMs)}"><small class="rim-wide">WALK</small><span class="rim-walk-bar" role="img" aria-label="${escapeAttribute(`walk ${options.format(options.walkMs)}, allow ${options.format(allow)}, of ${options.format(options.clockMs)}`)}"><span class="rim-walk-allow"></span><span class="rim-walk-fill"></span>${options.tooLong ? '<span class="rim-walk-over"></span>' : ''}<span class="rim-walk-end"></span></span><small class="rim-walk-time"><b>${options.format(allow)}</b>/${options.format(options.clockMs)}</small></div>`;
  const quicker = options.quicker
    ? `<button class="px-window px-chip rim-quicker" data-insertion="${escapeAttribute(options.quicker.id)}" data-help="${escapeAttribute(`Land at ${options.quicker.label} instead: the job walks in ${options.format(options.quicker.ms)} from there.`)}"><span class="rim-wide">QUICKER </span>FROM ${escapeAttribute(options.quicker.label.toUpperCase())}: ${options.format(options.quicker.ms)}</button>`
    : '';
  const head = `Pays${options.tooLong ? '<small class="px-warning rim-wide">LONGER THAN THE RAID</small>' : ''}`;
  return tile('job', head, `${short || `<div class="rim-line">${pay}</div>`}${walk}${quicker}`, options.help, options.short.length > 0 ? 'is-risk' : 'is-pay');
}

/** The clock a raid jumped now starts with, large, and what came off it. */
export function rimClock(options: { readonly clock: string; readonly off?: string; readonly night: boolean; readonly help: string }): string {
  return `<div class="rim-clock${options.night ? ' is-night' : ''}" data-rim-tile="clock" data-help="${escapeAttribute(options.help)}">${briefingIcon('raidClock', 'raid clock')}<span class="rim-choice-label">Raid</span><b class="rim-clock-time">${options.clock}</b>${options.off ? `<small class="rim-note">${options.off}</small>` : ''}</div>`;
}

/**
 * The SKY row's value: the sky's own picture and its name, and when the sky
 * next turns, or what waiting for it costs. Dawn is the morning's dusk, drawn the same.
 */
export function rimSkyValue(light: 'day' | 'dusk' | 'night', waited: boolean, note = ''): string {
  const icon = light === 'night' ? briefingIcon('night', 'night') : light === 'dusk' ? briefingIcon('dusk', 'dusk') : briefingIcon('day', 'day');
  const word = light === 'night' ? (waited ? 'Dark' : 'Night') : light === 'dusk' ? 'Dusk' : 'Day';
  return `${icon}<strong>${word}</strong>${note ? `<small class="rim-note rim-wide">${note}</small>` : ''}`;
}
