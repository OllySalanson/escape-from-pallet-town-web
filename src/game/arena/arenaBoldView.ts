/**
 * THE BATTLE ARENA's cup of the week and daily rental run, as markup in the
 * boutique's Big and Bold look - Champion Red (Olly's pick of 26 Nov 2026,
 * `docs/screens/arena-bold/`): a red sunburst, ink, white and gold, slanted
 * cards and stickers, the thing under the cursor drawn big. The counter's
 * first page and the class bouts keep the side panel; these two pages are the
 * whole screen (`scenes/DojoCounterScene.ts` asks for it). Phaser-free: the
 * scene hands in the regulars' figures as sheets it drew (`lookFigure`).
 */
import type { Pokemon } from '../pokemon';
import { pokemonSpritePath } from '../pokemon/pokemonSprites';
import { SPECIES_BY_ID } from '../pokemon/species';
import { publicAssetUrl } from '../publicAssetUrl';
import { RENTAL_RUN_COMPLETE_TICKETS, RENTAL_WIN_TICKETS } from '../minigames/tickets';
import { lookFigure } from '../look/boutiqueView';
import { pixelMonIconForDex } from '../ui/monIcon';
import { escapeAttribute } from '../ui/pixelUi';
import { DOJO_LEVEL } from './boutRules';
import { CUP_RUN_BOUTS, CUP_TIERS, cupCopy, type Cup, type CupRecord } from './cups';
import { rentalOf, rentalPokemon, type RentalPair } from './rentals';
import { RUN_BOUTS, type RentalRun } from './runRecords';

/** The three ways to fight, as the tabs across the top of both pages. */
export type ArenaWay = 'class' | 'cup' | 'rental';

/** Somebody met in a run, with the figure the scene drew of them (empty when it could not). */
export interface ArenaFoe {
  readonly name: string;
  readonly team: readonly string[];
  readonly sheet: string;
}

const named = (id: string): string => SPECIES_BY_ID[id]?.name.toUpperCase() ?? id.toUpperCase();

/** A species' battle sprite, at `scale` game pixels a pixel. */
function front(speciesId: string, scale: 1 | 2, shiny = false): string {
  const species = SPECIES_BY_ID[speciesId];
  if (!species) return '';
  return `<img class="bold-mon is-x${scale}" src="${publicAssetUrl(pokemonSpritePath('front', species.dexId, shiny))}" alt="" aria-hidden="true" />`;
}

function icon(speciesId: string): string {
  const species = SPECIES_BY_ID[speciesId];
  return species ? pixelMonIconForDex(species.dexId, species.name) : '';
}

function figure(foe: ArenaFoe): string {
  return foe.sheet ? lookFigure(foe.sheet, { scale: 1, label: foe.name }) : '';
}

/** The tabs: CLASS BOUTS, this week's cup and RENTALS, the open one gold. */
export function arenaTabs(open: ArenaWay, cup: Cup): string {
  const tab = (way: ArenaWay, label: string): string =>
    `<button class="bold-tab${way === open ? ' is-open' : ''}" data-mode="${way}" data-help="${escapeAttribute(
      way === open ? `${label}: you are here.` : `Q and E step between the three ways to fight.`,
    )}">${label}</button>`;
  return `<nav class="bold-tabs" aria-label="Ways to fight">${tab('class', 'Class bouts')}${tab('cup', cup.name)}${tab('rental', 'Rentals')}</nav>`;
}

// --- the cup -------------------------------------------------------------------------

export interface CupPosterState {
  /** The tabs across the top (`arenaTabs`). */
  readonly tabs: string;
  readonly cup: Cup;
  readonly week: CupRecord;
  /** The bout the next FIGHT is, 1 to 7. */
  readonly bout: number;
  /** Who is going, in order: the lead first. */
  readonly team: readonly Pokemon[];
  /** Why FIGHT cannot go yet, or null. */
  readonly problem: string | null;
  /** The seven met this week, in order. */
  readonly foes: readonly ArenaFoe[];
}

/** The cup's page: the side on its spot, the cup's name and rule, what the week pays, FIGHT, and the seven bouts along the foot. */
export function cupPoster(state: CupPosterState): string {
  const { cup, week, bout, team, problem } = state;
  const side = [0, 1, 2]
    .map((index) => {
      const pokemon = team[index];
      return pokemon
        ? `<span class="bold-side-mon">${front(pokemon.base.id, 2, pokemon.shiny)}</span>`
        : '<span class="bold-side-mon is-empty"></span>';
    })
    .join('');
  const moves = (pokemon: Pokemon): string =>
    cupCopy(pokemon, cup)
      .moves.map((move) => move.base.name.toUpperCase())
      .join(', ');
  const teamHelp =
    team.length > 0
      ? `${team.map((pokemon) => `${pokemon.name}: ${moves(pokemon)}`).join('. ')}. ENTER chooses who goes.`
      : 'ENTER chooses up to three from your boxes.';
  const keeps = problem
    ? `<span class="bold-sticker is-ink bold-rule-check">${escapeAttribute(problem)}</span>`
    : `<span class="bold-sticker is-ink bold-rule-check has-tick">Keeps the rule</span>`;
  const fightLabel = `Fight bout ${bout}`;
  // The cursor starts where the next press does something: FIGHT when it can go, YOUR THREE when it cannot.
  const fight = `<button class="bold-go" data-fight${problem ? ' aria-disabled="true"' : ' data-cursor-start'} data-help="${escapeAttribute(
    problem ?? `Fight ${state.foes[bout - 1]?.name ?? 'the next regular'} under the ${cup.name}: ${team.length} a side at Lv ${cup.level}, no bag. Nothing you bring can be hurt.`,
  )}">${fightLabel}</button>`;
  const pays = CUP_TIERS.map(
    (tier) =>
      `<div class="bold-pay${week.best >= tier.wins ? ' is-paid' : ''}"><b>${tier.wins}</b><span>in a row</span><em>${tier.tickets}</em></div>`,
  ).join('');
  const bouts = state.foes
    .map((foe, index) => {
      const number = index + 1;
      const kind = number < bout ? 'is-won' : number === bout ? 'is-next' : '';
      return `<div class="bold-bout ${kind}"><span class="bold-bout-n">${number}</span>${figure(foe)}<strong>${escapeAttribute(foe.name)}</strong><span class="bold-bout-team">${foe.team
        .map(icon)
        .join('')}</span>${number < bout ? '<span class="bold-flag is-won">Won</span>' : number === bout ? '<span class="bold-flag">Next!</span>' : ''}</div>`;
    })
    .join('');
  return `<main class="px-body bold-arena is-cup"><div class="bold-burst"></div>${state.tabs}
    <section class="bold-hero">
      <div class="bold-stage">
        <button class="bold-sticker is-white bold-your-three" data-pick-team${problem ? ' data-cursor-start' : ''} data-help="${escapeAttribute(teamHelp)}">Your three</button>
        <div class="bold-side">${side}</div>
        <div class="bold-spot"></div>
        ${keeps}
      </div>
      <div class="bold-bill">
        <h2 class="bold-title">${escapeAttribute(cup.name)}</h2>
        <span class="bold-sticker">${escapeAttribute(cup.rule)}</span>
        <span class="bold-sticker is-white">Lv ${cup.level} · this week only</span>
        ${fight}
      </div>
      <div class="bold-pays-box"><h3>The week's best run pays</h3><div class="bold-pays">${pays}</div><p>Tickets · once a week</p><p>Best this week: ${week.best} of ${CUP_RUN_BOUTS}</p></div>
    </section>
    <section class="bold-strip" aria-label="The seven bouts"><div class="bold-bouts">${bouts}</div></section>
  </main>`;
}

// --- the rentals ---------------------------------------------------------------------

export interface RentalPosterState {
  /** The tabs across the top (`arenaTabs`). */
  readonly tabs: string;
  /** Today's six, when no run is going. */
  readonly six: readonly string[];
  /** The run going, if one is. */
  readonly live: RentalRun | undefined;
  /** The three on loan as the page stands, in order. */
  readonly team: readonly string[];
  /** One of theirs chosen to swap in, waiting for who of yours goes back. */
  readonly swapTake: string | null;
  readonly pair: RentalPair;
  readonly bout: number;
  readonly foe: ArenaFoe;
  /** Whether this run pays. */
  readonly scored: boolean;
}

/** What a rental's card is in the rail: one of today's six, one of yours on loan, or one of theirs to swap in. */
type RailCard =
  | { readonly kind: 'six'; readonly species: string }
  | { readonly kind: 'yours'; readonly species: string }
  | { readonly kind: 'theirs'; readonly species: string };

function railCards(state: RentalPosterState): RailCard[] {
  if (!state.live) return state.six.map((species) => ({ kind: 'six', species }));
  const swapped = state.team.some((species) => !state.live!.team.includes(species));
  const theirs = swapped ? [] : (state.live.swapFrom ?? []).filter((species) => !state.team.includes(species));
  return [
    ...state.team.map((species): RailCard => ({ kind: 'yours', species })),
    ...theirs.map((species): RailCard => ({ kind: 'theirs', species })),
  ];
}

/** What ENTER does on a card, said on the big gold button under its picture. */
function cardGo(card: RailCard, state: RentalPosterState): { readonly label: string; readonly off: boolean } {
  const place = state.team.indexOf(card.species);
  switch (card.kind) {
    case 'six':
      if (place >= 0) return { label: 'Put it back', off: false };
      if (state.team.length >= 3) return { label: 'Three on loan', off: true };
      return { label: state.team.length === 0 ? 'Take as lead' : `Take as ${state.team.length === 1 ? '2nd' : '3rd'}`, off: false };
    case 'yours':
      return state.swapTake ? { label: `Give back for ${named(state.swapTake)}`, off: false } : { label: 'On loan', off: true };
    case 'theirs':
      return state.swapTake === card.species ? { label: 'Taking it', off: true } : { label: 'Swap it in', off: false };
  }
}

function cardHelp(card: RailCard, state: RentalPosterState): string {
  const rental = rentalOf(card.species);
  const role = rental?.role ?? `One of ${named(card.species)}'s own, as its regular fought it.`;
  const go = cardGo(card, state);
  return `${named(card.species)}: ${role} ${go.off ? '' : `ENTER: ${go.label.toLowerCase()}.`}`.trim();
}

/** The rentals' page: the one under the cursor drawn big, your three and who you meet, and the rail of cards along the foot. */
export function rentalPoster(state: RentalPosterState): string {
  const cards = railCards(state);
  const tag = (species: string): string => {
    const place = state.team.indexOf(species);
    return place < 0 ? '' : `<span class="bold-card-tag">${place === 0 ? 'Lead' : place + 1}</span>`;
  };
  const rail = cards
    .map((card, index) => {
      const attribute = card.kind === 'six' ? `data-rental="${card.species}"` : card.kind === 'yours' ? `data-yours="${card.species}"` : `data-theirs="${card.species}"`;
      const chosen = state.swapTake === card.species ? ' is-taking' : '';
      return `<button class="bold-card${card.kind === 'theirs' ? ' is-theirs' : ''}${chosen}" ${attribute} data-shows="${card.kind}-${card.species}"${
        index === 0 ? ' data-cursor-start' : ''
      } data-help="${escapeAttribute(cardHelp(card, state))}"><span class="bold-card-in">${front(card.species, 1)}<strong>${named(card.species)}</strong></span>${
        card.kind === 'theirs' ? '<span class="bold-card-tag is-theirs">Theirs</span>' : tag(card.species)
      }</button>`;
    })
    .join('');
  const again = state.live
    ? `<button class="bold-card is-again" data-new-run data-help="${escapeAttribute('Give the three back and choose again from today’s six. This run ends.')}"><span class="bold-card-in"><strong>Start again</strong><small>Ends this run</small></span></button>`
    : '';
  const heroes = cards
    .map((card, index) => {
      const pokemon = rentalPokemon(card.species);
      const go = cardGo(card, state);
      return `<div class="bold-hero-pane" data-shown-by="${card.kind}-${card.species}"${index === 0 ? '' : ' hidden'}>
        <div class="bold-stage is-one"><div class="bold-side">${front(card.species, 2)}</div><div class="bold-spot"></div></div>
        <div class="bold-bill">
          <h2 class="bold-title">${named(card.species)}</h2>
          <div class="bold-moves">${pokemon.moves.map((move) => `<span>${move.base.name.toUpperCase()}</span>`).join('')}</div>
          <span class="bold-sticker">Today's pair ${icon(state.pair.setter)}${named(state.pair.setter)} + ${icon(state.pair.payoff)}${named(state.pair.payoff)}</span>
          <span class="bold-go is-label${go.off ? ' is-off' : ''}">${go.label}</span>
        </div>
      </div>`;
    })
    .join('');
  const slots = [0, 1, 2]
    .map((index) => {
      const species = state.team[index];
      return species
        ? `<span class="bold-slot is-full">${icon(species)}<small>${index === 0 ? 'Lead' : index + 1}</small></span>`
        : '<span class="bold-slot"></span>';
    })
    .join('');
  const ready = state.team.length === 3;
  const fight = `<button class="bold-go is-small" data-fight${ready ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(
    ready ? `Fight ${state.foe.name}: three on loan a side at Lv ${DOJO_LEVEL}, no bag.` : 'Choose three first.',
  )}">Fight</button>`;
  const pays = state.scored
    ? `${RENTAL_WIN_TICKETS} a win · ${RENTAL_RUN_COMPLETE_TICKETS} more for all ${RUN_BOUTS}`
    : 'Practice: today has paid';
  return `<main class="px-body bold-arena is-rental"><div class="bold-burst"></div>${state.tabs}
    <section class="bold-hero">${heroes}
      <div class="bold-side-boxes">
        <div class="bold-box"><h3>Your three</h3><div class="bold-slots">${slots}</div>${fight}</div>
        <div class="bold-box is-ink" data-bout="${state.bout}" data-foe="${escapeAttribute(state.foe.name)}"><h3>Bout ${state.bout} of ${RUN_BOUTS} · Lv ${DOJO_LEVEL}</h3><div class="bold-foe">${figure(state.foe)}<strong>${escapeAttribute(
          state.foe.name,
        )}</strong></div><div class="bold-foe-team">${state.foe.team.map(icon).join('')}</div><p class="bold-foe-pay">${pays}</p></div>
      </div>
    </section>
    <section class="bold-strip" aria-label="${state.live ? 'On loan' : 'Today’s six'}"><div class="bold-cards">${rail}${again}</div></section>
  </main>`;
}
