/**
 * THE DAY-CARE's screen, in the round-3 look: who stays with him, shown in his
 * own pen rather than told (the captain, 25 Nov 2026: "daycare man needs a bit
 * of work. I don't like the SVG art and I don't like the green background, it's
 * too basic ... I do love the big Pokemons").
 *
 * - **The stage** is the yard's own pen (`public/assets/day-care-pen.png`, cut
 *   by `scripts/draw-day-care-stage.mjs`), the Day-Care Man at its gate and the
 *   one under the cursor standing big inside the fence.
 * - **WHILE YOU RAID** says what staying does as a sum of pictures: two raids
 *   are a level (`DAY_CARE_SHARE_OF_A_LEVEL`), LV7 ▸ LV8.
 * - **WHO STAYS?** runs along the foot: everybody at base, those he would take
 *   first, as FireRed's PC box stands them.
 *
 * Phaser-free, so it is tested without a browser; `HubScene.dayCareView` hands
 * it the rows and wires the presses.
 */
import { DAY_CARE_SHARE_OF_A_LEVEL } from './dayCare';
import { MAX_LEVEL } from '../pokemon/Pokemon';
import { publicAssetUrl } from '../publicAssetUrl';
import { iconMarkup } from '../ui/icons';
import { pixelMonTile } from '../ui/monIcon';
import { escapeAttribute, pixelFigure, pixelPortrait } from '../ui/pixelUi';

/** How many raids make the level the card promises. */
export const RAIDS_TO_A_LEVEL = Math.round(1 / DAY_CARE_SHARE_OF_A_LEVEL);

export interface DayCareRow {
  readonly id: string;
  readonly pokemon: {
    readonly name: string;
    readonly level: number;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly isFainted: boolean;
    readonly shiny: boolean;
    readonly heldItemId: string | null;
    readonly base: { readonly id: string; readonly dexId?: number };
  };
  /** Why he will not take it, or undefined when he will. */
  readonly refusal?: string;
  /** Out on a raid in another window. */
  readonly away: boolean;
  /** The player's partner, which wears the rosette. */
  readonly partner: boolean;
}

/** The words the help bar says of a row he would take. */
export function leaveHelp(name: string): string {
  return `Leave ${name} with him. Two raids, and it is a level up.`;
}

/** The green rosette, as YOUR TEAM draws it. */
const ROSETTE = '<span class="px-rosette" role="img" aria-label="Partner" title="Partner"></span>';

/** The card and the Pokémon in the pen, for one row: shown while the cursor is on it. */
function penPane(row: DayCareRow, first: boolean): string {
  const { pokemon } = row;
  const grown = pokemon.level >= MAX_LEVEL;
  const levels = grown
    ? '<p class="dc-levels"><span>FULLY GROWN</span></p>'
    : `<p class="dc-levels"><span>LV${pokemon.level}</span><span class="dc-to" aria-label="to"></span><span class="dc-next">LV${pokemon.level + 1}</span></p>`;
  const raid = `<span class="dc-raid">${iconMarkup('raid-clock', 'A raid')}<small>RAID</small></span>`;
  const sum = grown
    ? ''
    : `<p class="dc-sum" aria-label="${RAIDS_TO_A_LEVEL} raids make a level">${Array.from({ length: RAIDS_TO_A_LEVEL }, () => raid).join('<span class="dc-op">+</span>')}<span class="dc-op">=</span><span class="dc-next">+1</span></p>`;
  const deed = row.refusal === undefined
    ? `<button class="px-window px-button is-primary dc-leave" data-day-care-leave="${escapeAttribute(row.id)}" data-shows="${escapeAttribute(row.id)}" data-help="${escapeAttribute(leaveHelp(pokemon.name))}"><span class="px-keycap">ENTER</span>Leave ${escapeAttribute(pokemon.name)}</button>`
    : `<p class="dc-refused">${escapeAttribute(row.refusal)}</p>`;
  return `<div class="dc-pane" data-shown-by="${escapeAttribute(row.id)}"${first ? '' : ' hidden'}>`
    + `<div class="dc-in-pen${row.refusal === undefined ? '' : ' is-refused'}">${pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)}</div>`
    + `<section class="px-window px-tone-care dc-card"><header class="px-heading"><span>While you raid</span></header>${levels}${sum}${deed}</section>`
    + '</div>';
}

/** One at base, along the foot: the icon at its pace, its name and level. */
function strollTile(row: DayCareRow, first: boolean): string {
  const name = escapeAttribute(row.pokemon.name);
  const wiring = row.refusal === undefined
    ? `data-day-care-leave="${escapeAttribute(row.id)}" data-help="${escapeAttribute(leaveHelp(row.pokemon.name))}"`
    : `data-refused="${escapeAttribute(row.refusal)}" aria-disabled="true" data-help="${escapeAttribute(row.refusal)}"`;
  return pixelMonTile(row.pokemon, {
    classes: ['dc-tile', ...(row.away ? ['is-away'] : [])],
    attributes: `${wiring} data-shows="${escapeAttribute(row.id)}" aria-label="${escapeAttribute(`${row.pokemon.name}, level ${row.pokemon.level}${row.refusal === undefined ? '' : `, ${row.refusal}`}`)}"${first ? ' data-cursor-start' : ''}`,
    line: `${row.partner ? ROSETTE : ''}<span class="dc-tile-name">${name}</span><span class="dc-tile-level">LV${row.pokemon.level}</span>`,
  });
}

/** The screen's body: the pen with the one under the cursor in it, and everybody at base along the foot. */
export function dayCareBody(rows: readonly DayCareRow[], options: { readonly browse: string; readonly note: string }): string {
  const panes = rows.map((row, index) => penPane(row, index === 0)).join('');
  const tiles = rows.map((row, index) => strollTile(row, index === 0)).join('') || '<p class="px-empty">No Pokémon answers that.</p>';
  const stage = `<div class="dc-stage" style="--pen:url('${publicAssetUrl('assets/day-care-pen.png')}')"><div class="dc-keeper">${pixelFigure('gentleman', 'The Day-Care Man')}</div>${panes}</div>`;
  const who = `<section class="px-window dc-who"><header class="px-heading"><span>Who stays?</span><small>${escapeAttribute(options.note)}</small></header><div class="px-mon-tiles px-scroll">${options.browse}${tiles}</div></section>`;
  return `<main class="px-body dc-layout">${stage}${who}</main>`;
}
