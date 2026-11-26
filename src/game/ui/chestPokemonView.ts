/**
 * THE CHEST's POKéMON tab: every Pokémon the player keeps, in one grid, big
 * (`scenes/ChestPokemonScene.ts` plays it).
 *
 * The captain, 26 Nov 2026: "It should just be a grid system, and then when
 * you click on a Pokemon, then you can see its stats and stuff. And put it in
 * the garden." So there are no boxes on this screen: every Pokémon stands in
 * one grid in the order it is kept, each one four of the bag's squares and its
 * own battle picture at its own size, so a Pokémon is seen rather than read.
 * Beside the grid stand the two places one can go - THE NEXT RAID's six above
 * and the GARDEN's six below - with the card for the one under the cursor
 * between them.
 *
 * Every job has more than one way in (the captain: "all these cool, intuitive
 * ways of doing things that people might work out"): a Pokémon is dragged onto
 * a place, or its card's key is clicked, or its key is pressed. ENTER is the
 * team, G the garden, L the lead.
 *
 * Phaser-free, so the order and the words are tested without a browser.
 */
import { getHeldItem } from '../items';
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
}

/** How many Pokémon a row of the grid holds: four, each two of the bag's squares across. */
export const CHEST_COLUMNS = 4;
/** The fewest places the grid draws, filled or not: four rows. */
const CHEST_MIN_PLACES = CHEST_COLUMNS * 4;

/** The keys the tab answers, on its keys line. */
export const CHEST_POKEMON_KEYS = 'ARROWS move · ENTER team · G garden · L lead · B things · ESC close';

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
      + (going && state.team[0] !== entry.id ? key('data-key="lead"', 'L', 'Lead', false) : '');
  return `<section class="px-window team-card chest-card" data-shown-by="${escapeAttribute(entry.id)}" hidden>`
    + `<header class="px-heading"><span>${entry.id === state.partnerId ? partnerRosette() : ''}${pixelPokemonName(pokemon)}<span class="team-card-level">LV${pokemon.level}</span></span><small>${pokemonTypeBadges(pokemon)}</small></header>`
    + '<div class="chest-card-body">'
    + `<div class="chest-card-side">${pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)}<span class="chest-held"><small>Holding</small><span class="chest-held-square">${held ? itemIcon(held.id, held.displayName) : ''}</span></span></div>`
    + `<div class="chest-card-figures">${pokemonCardFigures(pokemon)}</div>`
    + '</div>'
    + `<footer class="chest-card-foot"><span class="chest-keys">${keys}</span><small class="team-card-where">${escapeAttribute(whereItIs(state, entry.id))}</small></footer>`
    + '</section>';
}

/** The tab's body: the grid on the left; the next raid, the card and the garden on the right. */
export function chestPokemonBody(state: ChestPokemonState): string {
  const byId = new Map(state.entries.map((entry) => [entry.id, entry]));
  const team = state.team.flatMap((id) => byId.get(id) ?? []);
  const garden = state.garden.flatMap((id) => byId.get(id) ?? []);
  // Empty places drawn as the bag draws an empty square, four to a place: the
  // grid's last row filled out, and at least four rows, so it reads as room.
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
    + `<section class="px-window px-tone-secure chest-mons"><header class="px-heading"><span class="things-side-name"><span class="things-chest" aria-hidden="true"></span>Pokémon</span><small>${state.entries.length} kept</small></header><div class="px-scroll chest-mon-scroll" data-drop="chest">${grid}</div></section>`
    + `<section class="px-window chest-team"><header class="px-heading"><span class="things-side-name">Next raid</span><small>Team ${team.length} of ${MAX_RUN_PARTY}</small></header>${slots('team', team, MAX_RUN_PARTY)}</section>`
    + `<div class="chest-cards">${cards}</div>`
    + `<section class="px-window px-tone-secure chest-garden"><header class="px-heading"><span class="things-side-name">Garden</span><small>${garden.length} of ${GARDEN_SIZE}</small></header>${slots('garden', garden, GARDEN_SIZE)}</section>`
    + '</main>';
}
