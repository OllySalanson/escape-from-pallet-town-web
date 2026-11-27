/**
 * THE CHEST's POKéMON tab: every Pokémon the player keeps, in one grid, big
 * (`scenes/ChestPokemonScene.ts` plays it).
 *
 * The captain, 26 Nov 2026: "It should just be a grid system, and then when
 * you click on a Pokemon, then you can see its stats and stuff. And put it in
 * the garden." So there are no boxes on this screen: every Pokémon stands in
 * one grid in the order it is kept, each one four of the bag's squares and its
 * own battle picture at its own size, so a Pokémon is seen rather than read.
 * Over it stand the two places one can go, THE NEXT RAID's six and the
 * GARDEN's six, side by side; beside it the card for the one under the cursor,
 * and under the card the things that can be given.
 *
 * Every job has more than one way in (the captain: "all these cool, intuitive
 * ways of doing things that people might work out"): a Pokémon is dragged onto
 * a place, or its card's key is clicked, or its key is pressed. ENTER is the
 * team, G the garden, L the lead.
 *
 * Phaser-free, so the order and the words are tested without a browser.
 */
import { getHeldItem, isHeldItemId, machineForItem, type ItemDefinition } from '../items';
import { evolutionByStone, type Pokemon } from '../pokemon';
import { outOnRaidLine } from '../run/raidInFlight';
import { pupilVerdict } from './teachScreen';
import { MAX_RUN_PARTY } from '../hub/deploymentFlow';
import { needsRecovery } from '../hub/recovery';
import { GARDEN_SIZE } from '../base/homeGarden';
import type { PickerEntry } from './boxPicker';
import { itemIcon } from './icons';
import { pixelMonIcon } from './monIcon';
import { escapeAttribute, pixelHpBar, pixelPokemonName, pixelPortrait } from './pixelUi';
import { partnerRosette, pokemonCardFigures, pokemonTypeBadges } from './teamView';

/** The chest's two tabs, and which the player is on. */
export type ChestTab = 'things' | 'pokemon';

/**
 * The chest's tabs, for the title bar: THINGS and POKéMON, the one the player
 * is on lit, each a button that goes to the other, with the key that does the
 * same beside it - B for things and P for Pokémon, the keys that open them
 * anywhere in the harbour.
 */
export function chestTabs(here: ChestTab): string {
  const tab = (id: ChestTab, key: string, words: string): string =>
    `<button type="button" class="chest-tab${id === here ? ' is-here' : ''}" data-chest-tab="${id}" tabindex="-1"${id === here ? ' aria-current="page"' : ''}><span class="things-cap" aria-hidden="true">${key}</span>${words}</button>`;
  return `<nav class="chest-tabs" aria-label="The chest">${tab('things', 'B', 'Things')}${tab('pokemon', 'P', 'Pokémon')}</nav>`;
}

export interface ChestPokemonState {
  /** Every Pokémon kept, in the order kept (`pickerEntries`). */
  readonly entries: readonly PickerEntry[];
  /** Who goes on the next raid, in order: the first leads. */
  readonly team: readonly string[];
  /** Who walks about the garden (`gardenPokemon`). */
  readonly garden: readonly string[];
  readonly partnerId?: string;
  /** Out on a raid in another window, so this one cannot touch them (`awayOnRaid`). */
  readonly away: ReadonlySet<string>;
  /**
   * The one Pokémon at base, when it is the only one (`Stash.canSwapStarter`):
   * its card offers to swap it for another starter, as BILL'S PC did.
   */
  readonly swappable?: string;
  /** What in the chest can be given to a Pokémon, and how many (`chestGifts`). */
  readonly gifts?: readonly Gift[];
}

/**
 * The three kinds of thing that are given to a Pokémon: something to hold (a
 * berry, a Leftovers), a stone it may evolve by, and a disc it may learn from.
 */
export type GiftKind = 'hold' | 'stone' | 'disc';

export interface Gift {
  readonly item: ItemDefinition;
  readonly count: number;
  readonly kind: GiftKind;
}

export function giftKind(item: ItemDefinition): GiftKind | null {
  if (isHeldItemId(item.id)) return 'hold';
  if (item.effect.type === 'evolution-stone') return 'stone';
  if (machineForItem(item)) return 'disc';
  return null;
}

const GIFT_ORDER: readonly GiftKind[] = ['hold', 'stone', 'disc'];

/** What in the chest can be given, by how many are spare at base: things to hold, then stones, then discs. */
export function chestGifts(items: readonly ItemDefinition[], spare: (itemId: string) => number): readonly Gift[] {
  return items
    .flatMap((item) => {
      const kind = giftKind(item);
      const count = spare(item.id);
      return kind && count > 0 ? [{ item, count, kind }] : [];
    })
    .sort((a, b) => GIFT_ORDER.indexOf(a.kind) - GIFT_ORDER.indexOf(b.kind));
}

/** Whether a thing can go to a Pokémon: the question to ask if it can, the reason if it cannot. */
export type GiftAnswer = { readonly ok: true; readonly question: string } | { readonly ok: false; readonly why: string };

export function giftAnswer(item: ItemDefinition, pokemon: Pokemon, away: boolean): GiftAnswer {
  const name = pokemon.name.toUpperCase();
  const thing = item.displayName.toUpperCase();
  if (away) {
    return { ok: false, why: outOnRaidLine(pokemon.name) };
  }
  switch (giftKind(item)) {
    case 'hold':
      return pokemon.heldItemId === item.id
        ? { ok: false, why: `${name} is holding ${aThing(thing)} already.` }
        : { ok: true, question: `Give the ${thing} to ${name}?` };
    case 'stone':
      // FireRed's own words for a stone that does nothing.
      return evolutionByStone(pokemon.base.id, item.id)
        ? { ok: true, question: `Use the ${thing} on ${name}?` }
        : { ok: false, why: "It won't have any effect." };
    case 'disc': {
      const machine = machineForItem(item)!;
      const move = machine.move.name.toUpperCase();
      const verdict = pupilVerdict(machine, pokemon);
      if (verdict === 'knows') return { ok: false, why: `${name} knows ${move} already.` };
      if (verdict === 'cannot') return { ok: false, why: `${name} can't learn ${move}.` };
      return { ok: true, question: `Teach ${move} to ${name}?` };
    }
    default:
      return { ok: false, why: `${thing} is not something to give.` };
  }
}

const aThing = (thing: string): string => (/^[AEIOU]/.test(thing) ? `an ${thing}` : `a ${thing}`);

/**
 * FireRed's two-button question, over the tab: the thing, an arrow, the
 * Pokémon, and the question under them, YES lit.
 */
export function chestAsk(item: ItemDefinition, pokemon: Pokemon, question: string): string {
  return '<div class="chest-ask" data-ask role="dialog" aria-modal="true">'
    + '<section class="px-window px-plate px-world chest-ask-window">'
    + `<div class="chest-ask-pics">${itemIcon(item.id, item.displayName)}<span class="chest-ask-arrow" aria-hidden="true"></span>${pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)}</div>`
    + `<p class="chest-ask-words">${escapeAttribute(question)}</p>`
    + '<div class="chest-ask-buttons"><button type="button" class="px-window px-button is-primary" data-ask-yes>Yes</button><button type="button" class="px-window px-button" data-ask-no>No</button></div>'
    + '</section></div>';
}

/** How many Pokémon a row of the grid holds: four, each two of the bag's squares across. */
export const CHEST_COLUMNS = 4;
/** The fewest places the grid draws, filled or not: the three rows it has room for, so a MORE never points at nothing. */
const CHEST_MIN_PLACES = CHEST_COLUMNS * 3;

/** The keys the tab answers, on its keys line. */
export const CHEST_POKEMON_KEYS = 'ARROWS move · ENTER team · G garden · L lead · T take back · B things · ESC close';

/** Where a Pokémon is, in a word, for its card and for a screen reader. */
export function whereItIs(state: ChestPokemonState, id: string): string {
  if (state.away.has(id)) return 'Out on a raid';
  if (state.team[0] === id) return state.partnerId === id ? 'Your partner, leading' : 'Leads the next raid';
  if (state.team.includes(id)) return 'Next raid';
  if (state.garden.includes(id)) return 'In the garden';
  return 'In the chest';
}

/** A mark in a tile's corner: where it is going, and what it is holding. */
function tileMarks(state: ChestPokemonState, entry: PickerEntry): string {
  const marks: string[] = [];
  if (entry.id === state.partnerId) {
    marks.push(partnerRosette());
  }
  if (state.team.includes(entry.id) && entry.id !== state.partnerId) {
    marks.push('<span class="chest-mark is-team" role="img" aria-label="Next raid"></span>');
  }
  if (state.garden.includes(entry.id)) {
    marks.push('<span class="chest-mark is-garden" role="img" aria-label="In the garden"></span>');
  }
  const held = getHeldItem(entry.pokemon.heldItemId);
  if (held) {
    marks.push(`<span class="chest-mark is-held">${itemIcon(held.id, held.displayName)}</span>`);
  }
  return marks.length > 0 ? `<span class="chest-mon-marks">${marks.join('')}</span>` : '';
}

/** One Pokémon in the grid: its picture at its own size, its level and its health along the foot. */
function monTile(state: ChestPokemonState, entry: PickerEntry, first: boolean): string {
  const { pokemon } = entry;
  const classes = [
    'chest-mon',
    state.team.includes(entry.id) ? 'is-team' : '',
    state.garden.includes(entry.id) ? 'is-garden' : '',
    needsRecovery(pokemon) ? 'is-hurt' : '',
    pokemon.isFainted ? 'is-fainted' : '',
    state.away.has(entry.id) ? 'is-away' : '',
  ].filter(Boolean);
  const spoken = `${pokemon.name}, level ${pokemon.level}, ${whereItIs(state, entry.id).toLowerCase()}`;
  return `<button type="button" class="${classes.join(' ')}" data-mon="${escapeAttribute(entry.id)}" data-shows="${escapeAttribute(entry.id)}" aria-label="${escapeAttribute(spoken)}" data-help="${escapeAttribute(tileHelp(state, entry))}"${first ? ' data-cursor-start' : ''}>`
    + pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)
    + `<span class="chest-mon-lv">Lv${pokemon.level}</span>`
    + pixelHpBar(pokemon.currentHp, pokemon.maxHp, 28)
    + tileMarks(state, entry)
    + '</button>';
}

/** What the help line says of a Pokémon under the cursor: who it is and where. */
export function tileHelp(state: ChestPokemonState, entry: PickerEntry): string {
  return `${entry.pokemon.name}, level ${entry.pokemon.level}. ${whereItIs(state, entry.id)}.`;
}

/** One of the six places on THE NEXT RAID or in the GARDEN: who is there, or a gap to drop one in. */
function placeSlot(state: ChestPokemonState, place: 'team' | 'garden', entry: PickerEntry | undefined, index: number): string {
  if (!entry) {
    return `<span class="chest-slot is-free" data-place="${place}" aria-hidden="true"></span>`;
  }
  const lead = place === 'team' && index === 0;
  return `<button type="button" class="chest-slot${lead ? ' is-lead' : ''}" data-place="${place}" data-mon="${escapeAttribute(entry.id)}" data-shows="${escapeAttribute(entry.id)}" aria-label="${escapeAttribute(`${entry.pokemon.name}, ${place === 'team' ? (lead ? 'leads the next raid' : 'next raid') : 'in the garden'}`)}" data-help="${escapeAttribute(tileHelp(state, entry))}">`
    + pixelMonIcon(entry.pokemon)
    + (entry.id === state.partnerId ? partnerRosette() : '')
    + '</button>';
}

/** The card for one Pokémon: its picture, what it holds, its figures and what its keys do to it. */
function card(state: ChestPokemonState, entry: PickerEntry): string {
  const { pokemon } = entry;
  const held = getHeldItem(pokemon.heldItemId);
  const going = state.team.includes(entry.id);
  const out = state.garden.includes(entry.id);
  const key = (attribute: string, cap: string, words: string, on: boolean): string =>
    `<button type="button" class="chest-key${on ? ' is-on' : ''}" ${attribute} data-mon-key="${escapeAttribute(entry.id)}" aria-pressed="${on}"><span class="things-cap">${cap}</span>${words}</button>`;
  const keys = state.away.has(entry.id)
    ? ''
    : key('data-key="team"', 'ENTER', 'Next raid', going)
      + key('data-key="garden"', 'G', 'Garden', out)
      + (going && state.team[0] !== entry.id ? key('data-key="lead"', 'L', 'Lead', false) : '')
      + (held ? key('data-key="take"', 'T', `Take ${escapeAttribute(held.displayName)}`, false) : '')
      + (state.swappable === entry.id ? key('data-key="swap"', 'C', 'Change partner', false) : '');
  return `<section class="px-window team-card chest-card" data-shown-by="${escapeAttribute(entry.id)}" hidden>`
    + `<header class="px-heading"><span>${entry.id === state.partnerId ? partnerRosette() : ''}${pixelPokemonName(pokemon)}<span class="team-card-level">LV${pokemon.level}</span></span><small>${pokemonTypeBadges(pokemon)}</small></header>`
    + '<div class="chest-card-body">'
    + `<div class="chest-card-side">${pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)}<span class="chest-held"><small>Holding</small>${
      held && !state.away.has(entry.id)
        ? `<button type="button" class="chest-held-square" data-held="${escapeAttribute(entry.id)}" data-drop="held" aria-label="${escapeAttribute(`${pokemon.name} is holding ${held.displayName}`)}" data-help="${escapeAttribute(`${held.displayName}: ${held.description}`)}">${itemIcon(held.id, held.displayName)}</button>`
        : `<span class="chest-held-square" data-drop="held">${held ? itemIcon(held.id, held.displayName) : ''}</span>`
    }</span></div>`
    + `<div class="chest-card-figures">${pokemonCardFigures(pokemon)}</div>`
    + '</div>'
    + `<footer class="chest-card-foot"><span class="chest-keys">${keys}</span><small class="team-card-where">${escapeAttribute(whereItIs(state, entry.id))}</small></footer>`
    + '</section>';
}

/** THE CHEST's things that can be given, a bag square each: dragged onto a Pokémon, or ENTER and then a Pokémon. */
function giftStrip(gifts: readonly Gift[]): string {
  const squares = gifts
    .map(
      ({ item, count }) =>
        `<button type="button" class="chest-gift" data-gift="${escapeAttribute(item.id)}" aria-label="${escapeAttribute(`${item.displayName}${count > 1 ? `, ${count}` : ''}`)}" data-help="${escapeAttribute(`${item.displayName}: ${item.description}`)}">${itemIcon(item.id, item.displayName)}${count > 1 ? `<b>×${count}</b>` : ''}</button>`,
    )
    .join('');
  return `<section class="px-window chest-give"><header class="px-heading"><span class="things-side-name">To give</span><small>${gifts.length} ${gifts.length === 1 ? 'kind' : 'kinds'}</small></header><div class="chest-gifts" data-drop="gifts">${squares || '<p class="px-empty">Nothing to give.</p>'}</div></section>`;
}

/** The tab's body: the next raid and the garden across the top, the grid under them, the card and TO GIVE beside it. */
export function chestPokemonBody(state: ChestPokemonState): string {
  const byId = new Map(state.entries.map((entry) => [entry.id, entry]));
  const team = state.team.flatMap((id) => byId.get(id) ?? []);
  const garden = state.garden.flatMap((id) => byId.get(id) ?? []);
  // Empty places drawn as the bag draws an empty square, four to a place: the
  // grid's last row filled out, and at least three rows, so it reads as room.
  const places = Math.max(CHEST_MIN_PLACES, Math.ceil(state.entries.length / CHEST_COLUMNS) * CHEST_COLUMNS);
  const gaps = '<span class="chest-mon-gap" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'.repeat(places - state.entries.length);
  const tiles = state.entries.map((entry, index) => monTile(state, entry, index === 0)).join('') + gaps;
  const grid = state.entries.length > 0
    ? `<div class="chest-mon-grid">${tiles}</div>`
    : '<p class="px-empty">No Pokémon in the chest.</p>';
  const slots = (place: 'team' | 'garden', who: readonly PickerEntry[], size: number): string =>
    `<div class="chest-slots" data-drop="${place}">${Array.from({ length: size }, (_slot, index) => placeSlot(state, place, who[index], index)).join('')}</div>`;
  const cards = state.entries.map((entry) => card(state, entry)).join('');
  return `<main class="px-body chest-mons-layout">`
    // No heading over the grid: the title bar says how many are kept, and the
    // grid has the room for a third whole row of Pokémon.
    + `<section class="px-window chest-mons" aria-label="Every Pokémon in the chest"><div class="px-scroll chest-mon-scroll" data-drop="chest">${grid}</div></section>`
    + `<section class="px-window chest-team"><header class="px-heading"><span class="things-side-name">Next raid</span><small>Team ${team.length} of ${MAX_RUN_PARTY}</small></header>${slots('team', team, MAX_RUN_PARTY)}</section>`
    + `<div class="chest-cards">${cards}</div>`
    + giftStrip(state.gifts ?? [])
    + `<section class="px-window px-tone-secure chest-garden"><header class="px-heading"><span class="things-side-name">Garden</span><small>${garden.length} of ${GARDEN_SIZE}</small></header>${slots('garden', garden, GARDEN_SIZE)}</section>`
    + '</main>';
}

/** What the title bar says beside the tabs: how many Pokémon the chest keeps. */
export function chestKept(count: number): string {
  return `<span class="things-chest" aria-hidden="true"></span>${count} kept`;
}
