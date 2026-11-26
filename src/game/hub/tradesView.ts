/**
 * THE TRADER's screen, in the round-3 look: a trade shown as the two
 * Pokémon facing each other, not told (the captain, 25 Nov 2026, of the
 * trader: "it's too basic. Although I do love the big Pokemons").
 *
 * - **The stage** is the battle field's own grass (`team-stage`'s bands and
 *   platforms): yours on the left, what he gives on the right, the two arrows
 *   of a swap between them.
 * - **YOU GET** names what comes back - his nickname, its kind, its types and
 *   NEW IN THE POKéDEX when the save has none - with ENTER TRADE.
 * - **WHO GOES?** runs along the foot: everybody at base, those he would
 *   trade first, each tile naming itself.
 *
 * Phaser-free, so it is tested without a browser; `HubScene.tradesView` hands
 * it the rows and wires the presses (the ask-before-trading bar stays its).
 */
import type { PokemonBase } from '../pokemon';
import { publicAssetUrl } from '../publicAssetUrl';
import { pixelMonTile } from '../ui/monIcon';
import { escapeAttribute, pixelFigure, pixelPortrait, pixelTypeBadge } from '../ui/pixelUi';
import { tradeHelp, type TradeDeal } from './trades';

export interface TradeRow {
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
  /** What he would give for it, or undefined when he will not trade it. */
  readonly deal?: TradeDeal;
  /** Why not, when he will not. */
  readonly refusal?: string;
  readonly box: string;
  readonly away: boolean;
  readonly partner: boolean;
}

const ROSETTE = '<span class="px-rosette" role="img" aria-label="Partner" title="Partner"></span>';

/** What comes back from a deal: his Pokémon for a swap, or one's own evolved form for one sent over and back. */
function cameBack(deal: TradeDeal): { readonly name: string; readonly kind: PokemonBase } {
  return deal.kind === 'swap' ? { name: deal.trade.nickname, kind: deal.gives } : { name: deal.into.name, kind: deal.into };
}

/** A Pokémon on its platform with its plate under it. */
function standing(dexId: number, name: string, plate: string, shiny = false): string {
  return `<div class="tr-stand"><img class="team-platform" src="${publicAssetUrl('assets/battle/platform.png')}" alt="" aria-hidden="true" />${pixelPortrait(dexId, name, shiny)}<span class="team-plate">${plate}</span></div>`;
}

function pane(row: TradeRow, shown: boolean, owned: ReadonlySet<number>): string {
  const { pokemon } = row;
  const yours = standing(pokemon.base.dexId ?? 0, pokemon.name, `${row.partner ? ROSETTE : ''}YOUR ${escapeAttribute(pokemon.name)}<span class="team-plate-level">LV${pokemon.level}</span>`, pokemon.shiny);
  if (!row.deal) {
    return `<div class="tr-pane" data-shown-by="${escapeAttribute(row.id)}"${shown ? '' : ' hidden'}><div class="tr-field is-refused">${yours}</div>`
      + `<section class="px-window tr-card"><header class="px-heading"><span>He says</span></header><p class="tr-refused">${escapeAttribute(row.refusal ?? '')}</p></section></div>`;
  }
  const back = cameBack(row.deal);
  const isNew = back.kind.dexId !== undefined && !owned.has(back.kind.dexId);
  const theirs = standing(back.kind.dexId ?? 0, back.name, `${escapeAttribute(back.name)}<span class="team-plate-level">LV${pokemon.level}</span>${isNew ? '<span class="tr-new">New in the Pokédex</span>' : ''}`);
  const types = [back.kind.primaryType, back.kind.secondaryType].filter((type): type is NonNullable<typeof type> => Boolean(type));
  const kind = row.deal.kind === 'swap' ? `A ${back.kind.name}` : `${pokemon.name} grown`;
  return `<div class="tr-pane" data-shown-by="${escapeAttribute(row.id)}"${shown ? '' : ' hidden'}>`
    + `<div class="tr-field">${yours}<span class="tr-swap"><span class="tr-arrows" aria-hidden="true"><i></i><i></i></span>${pixelFigure('poke-maniac', 'The trader')}</span>${theirs}</div>`
    + '<section class="px-window tr-card"><header class="px-heading"><span>You get</span></header>'
    + `<p class="tr-name">${escapeAttribute(back.name)}</p><p class="tr-kind">${escapeAttribute(kind)}</p><p class="tr-types">${types.map((type) => pixelTypeBadge(type)).join('')}</p>`
    + `<button class="px-window px-button is-primary tr-go" data-trade="${escapeAttribute(row.id)}" data-shows="${escapeAttribute(row.id)}" data-help="${escapeAttribute(tradeHelp(pokemon.name, row.deal))}"><span class="px-keycap">ENTER</span>Trade</button>`
    + '</section></div>';
}

function tile(row: TradeRow, start: boolean): string {
  const wiring = row.deal
    ? `data-trade="${escapeAttribute(row.id)}" data-help="${escapeAttribute(tradeHelp(row.pokemon.name, row.deal))}"`
    : `data-refused="${escapeAttribute(row.refusal ?? '')}" aria-disabled="true" data-help="${escapeAttribute(row.refusal ?? '')}"`;
  return pixelMonTile(row.pokemon, {
    classes: ['is-named', ...(row.away ? ['is-away'] : [])],
    attributes: `${wiring} data-shows="${escapeAttribute(row.id)}" data-box-name="${escapeAttribute(row.box)}" aria-label="${escapeAttribute(`${row.pokemon.name}, level ${row.pokemon.level}, ${row.box}${row.refusal === undefined ? '' : `, ${row.refusal}`}`)}"${start ? ' data-cursor-start' : ''}`,
    line: `${row.partner ? ROSETTE : ''}<span class="dc-tile-name">${escapeAttribute(row.pokemon.name)}</span><span class="dc-tile-level">LV${row.pokemon.level}</span>`,
  });
}

export interface TradesBodyOptions {
  /** The find and sort bar over the tiles. */
  readonly browse: string;
  readonly note: string;
  /** The Pokédex kinds the save owns, for NEW IN THE POKéDEX. */
  readonly owned: ReadonlySet<number>;
  /** The row a trade is being asked about, which keeps the stage and the cursor. */
  readonly armed?: string;
  /** The ask-before-trading bar, when one is up. */
  readonly asking?: string;
}

export function tradesBody(rows: readonly TradeRow[], options: TradesBodyOptions): string {
  const shownFirst = options.armed ?? rows[0]?.id;
  const panes = rows.map((row) => pane(row, row.id === shownFirst, options.owned)).join('');
  const tiles = rows.map((row, index) => tile(row, index === 0 && options.armed === undefined)).join('') || '<p class="px-empty">No Pokémon answers that.</p>';
  return `<main class="px-body tr-layout"><div class="tr-stage">${panes}</div>`
    + `<section class="px-window tr-who"><header class="px-heading"><span>Who goes?</span><small>${escapeAttribute(options.note)}</small></header><div class="px-mon-tiles px-scroll">${options.browse}${tiles}</div></section>`
    + `${options.asking ?? ''}</main>`;
}
