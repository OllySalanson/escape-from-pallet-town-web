/**
 * THE BATTLE ARENA counter's three ways in, as markup (`scenes/DojoCounterScene.ts`
 * draws it): the first page - CLASS BOUTS, this week's CUP, today's RENTALS,
 * each row saying where the player stands in it - and the cup's and the rental
 * run's own pages. Phaser-free, so the words and the order are tested without a
 * browser. The class bouts' pages are `dojoCounterView.ts`.
 */
import type { Pokemon } from '../pokemon';
import { SPECIES_BY_ID } from '../pokemon/species';
import { pickerFindField, pickerOrder, pickerRowAttributes, pickerRowNote, type PickerEntry } from '../ui/boxPicker';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelPokemonName,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';
import { DOJO_LEVEL, DOJO_TEAM_SIZE } from './boutRules';
import { dojoClass, STREAK_TO_CHALLENGE, streakOf } from './classes';
import { CUP_RUN_BOUTS, cupCopy, cupRefusal, cupSideProblem, cupWeek, type Cup, type CupFoe } from './cups';
import { classOf, type DojoRecord } from './dojoRecord';
import { liveRentalRun, nextRunScored, rentalOf, rentalPokemon, rentalsToday, teamWords, pairToday, type RentalFoe } from './rentals';
import { RUN_BOUTS } from './runRecords';

const named = (id: string): string => SPECIES_BY_ID[id]?.name.toUpperCase() ?? id;

/** The first page: the three ways to fight, each saying where the player stands in it. */
export function modesBody(record: DojoRecord | undefined, cup: Cup, now: Date): string {
  const cls = dojoClass(classOf(record));
  const week = cupWeek(record?.cup, now);
  const live = liveRentalRun(record?.rental, now);
  const row = (mode: string, name: string, line: string, tag: string, help: string, first: boolean): string =>
    `<button class="px-row px-tall" data-mode="${mode}"${first ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${name}</strong></span><small>${escapeAttribute(line)}</small></span>${tag}</button>`;
  const classLine =
    classOf(record) === 'master-ball' && record?.topped
      ? `${cls.name} class, top of the ladder.`
      : `${cls.name} class · run ${Math.min(streakOf(record).length, STREAK_TO_CHALLENGE)} of ${STREAK_TO_CHALLENGE}`;
  const rentalLine = live
    ? `Run going: ${live.won} of ${RUN_BOUTS}${live.scored ? '' : ' (practice)'} · ${teamWords(live.team)}`
    : `Borrow three of today's six. ${nextRunScored(record?.rental, now) ? "Today's run pays." : 'Practice: today has paid.'}`;
  const rows = [
    row('class', 'CLASS BOUTS', classLine, pixelTag(cls.name, 'plain'), `Fight the regulars of your class, three in a row, then its Black Belt. ${DOJO_TEAM_SIZE} a side at Lv ${DOJO_LEVEL}.`, true),
    row(
      'cup',
      cup.name,
      `${cup.rule} Lv ${cup.level} · this week ${week.run > 0 ? `${week.run} in a row` : `best ${week.best} of ${CUP_RUN_BOUTS}`}`,
      pixelTag(`${week.best}/${CUP_RUN_BOUTS}`, week.best >= CUP_RUN_BOUTS ? 'good' : 'plain', week.best >= CUP_RUN_BOUTS),
      `This week's rule: ${cup.rule} ${cup.teaches} Seven bouts in a row with your own Pokémon. Three pays 50 tickets, five 100, seven 200.`,
      false,
    ),
    row(
      'rental',
      'RENTALS',
      rentalLine,
      pixelTag(live ? `${live.won}/${RUN_BOUTS}` : 'Today', live ? 'good' : 'plain', live !== undefined),
      `Borrow three Pokémon, fight seven in a row, swap one after each win. Today's pair: ${pairToday(now).why}`,
      false,
    ),
  ].join('');
  return `<main class="px-body">${pixelWindow(`<div class="px-list px-scroll">${rows}</div>`, {
    heading: 'How will you fight?',
    note: 'Lv 30 · no bag',
  })}</main>`;
}

// --- the cup ----------------------------------------------------------------------

/** What a row of the cup's team list says when pointed at. */
function cupMemberHelp(entry: PickerEntry, inTeam: boolean, refusal: string | null, cup: Cup): string {
  if (inTeam) {
    const moves = cupCopy(entry.pokemon, cup).moves.map((move) => move.base.name.toUpperCase());
    return `${entry.pokemon.name} fights at Lv ${cup.level} with ${moves.join(', ')}. ENTER leaves it out.`;
  }
  return refusal ?? `${entry.pokemon.name} (from ${entry.box}) keeps the ${cup.name}'s rule. ENTER brings it.`;
}

/** The cup's page: the rule, who is next, and who to bring, the cup's refusals said on each row. */
export function cupBody(entries: readonly PickerEntry[], team: readonly string[], cup: Cup, foe: CupFoe, bout: number): string {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const chosen = team.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const side = chosen.map((entry) => entry.pokemon);
  const going = new Set(chosen.map((entry) => entry.id));
  const others = pickerOrder(
    entries.filter((entry) => !going.has(entry.id)),
    (entry) => (cupRefusal(entry.pokemon, side, cup) === null ? 2 : 1),
  );
  const row = (entry: PickerEntry, inTeam: boolean, first: boolean): string => {
    const refusal = inTeam ? null : cupRefusal(entry.pokemon, side, cup);
    const tag = inTeam
      ? pixelTag(chosen[0]?.id === entry.id ? 'Lead' : 'In', 'good', true)
      : refusal
        ? side.length >= DOJO_TEAM_SIZE
          ? pixelTag('Full', 'plain')
          : pixelTag('No', 'risk')
        : pixelTag('Bring', 'plain');
    return `<button class="px-row${inTeam ? ' is-selected' : ''}" data-member="${escapeAttribute(entry.id)}" ${pickerRowAttributes(entry)}${
      first ? ' data-cursor-start' : ''
    }${refusal ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(cupMemberHelp(entry, inTeam, refusal, cup))}"><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(
      entry.pokemon,
    )}</span><small>${pickerRowNote(entry, entry.pokemon.base.name.toUpperCase())}</small></span>${tag}</button>`;
  };
  const yours =
    chosen.length > 0
      ? chosen.map((entry, index) => row(entry, true, index === 0)).join('')
      : '<p class="px-empty px-wrap">Nobody yet. Bring up to three who keep the rule.</p>';
  const rest = others.map((entry, index) => row(entry, false, chosen.length === 0 && index === 0)).join('');
  const rule = `<p class="px-wrap dojo-cup-rule">${escapeAttribute(`${cup.rule} ${cup.teaches}`)}</p>`;
  const next = `<p class="px-wrap">${escapeAttribute(`Bout ${bout} of ${CUP_RUN_BOUTS}: ${foe.name} brings ${teamWords(foe.team)}.`)}</p>`;
  const list = `${rule}${next}${pickerFindField()}<h3 class="px-subheading">Your side</h3>${yours}<h3 class="px-subheading">In your boxes</h3>${rest}`;
  const problem = cupSideProblem(side, cup);
  const fight = `<button class="px-window px-button is-primary" data-fight${problem ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(
    problem ?? `Fight ${foe.name} under the ${cup.name}: ${chosen.length} a side at Lv ${cup.level}, no bag. Nothing you bring can be hurt.`,
  )}">Fight</button>`;
  return `<main class="px-body dojo-team-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${list}</div>`, {
    heading: cup.name,
    note: `Bout ${bout} of ${CUP_RUN_BOUTS}`,
  })}${pixelCommitBar({
    title: problem ?? `${chosen.length} vs ${chosen.length} · Lv ${cup.level}`,
    actions: fight,
  })}</main>`;
}

/** The team the cup's page opens on: whoever was brought before, keeping only those the cup allows. */
export function openingCupTeam(entries: readonly PickerEntry[], wanted: readonly string[], cup: Cup): readonly string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const side: Pokemon[] = [];
  const ids: string[] = [];
  for (const id of wanted) {
    const entry = byId.get(id);
    if (entry && cupRefusal(entry.pokemon, side, cup) === null) {
      side.push(entry.pokemon);
      ids.push(id);
    }
  }
  return ids;
}

// --- the rentals --------------------------------------------------------------------

/** What a rental's row says beneath its name: its moves at the dojo's level. */
function rentalMoves(species: string): string {
  return rentalPokemon(species)
    .moves.map((move) => move.base.name.toUpperCase())
    .join(', ');
}

/** What a rental's row says when pointed at: its kind, its ability's job and its moves. */
function rentalHelp(species: string, inTeam: boolean): string {
  const rental = rentalOf(species);
  const role = rental?.role ?? `One of ${named(species)}'s own, as its regular fought it.`;
  return `${named(species)}: ${role} ${rentalMoves(species)}. ${inTeam ? 'ENTER sends it back.' : 'ENTER takes it.'}`;
}

/**
 * The rental page. With no run going: today's six, pick three. With one going:
 * the three on loan, who is next, and - after a win - the team just beaten to
 * swap one from (ENTER on theirs, then on the one of yours it replaces).
 */
export function rentalBody(
  record: DojoRecord | undefined,
  team: readonly string[],
  foe: RentalFoe,
  now: Date,
  swapTake: string | null,
): string {
  const live = liveRentalRun(record?.rental, now);
  const bout = live ? live.won + 1 : 1;
  const row = (species: string, attribute: string, tag: string, help: string, first: boolean, selected: boolean): string =>
    `<button class="px-row${selected ? ' is-selected' : ''}" ${attribute}${first ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${named(
      species,
    )}</strong></span><small>${escapeAttribute(rentalMoves(species))}</small></span>${tag}</button>`;
  let list: string;
  if (!live) {
    const pair = pairToday(now);
    const six = rentalsToday(now)
      .map((rental, index) =>
        row(
          rental.species,
          `data-rental="${rental.species}"`,
          team.includes(rental.species)
            ? pixelTag(team[0] === rental.species ? 'Lead' : 'In', 'good', true)
            : team.length >= 3
              ? pixelTag('Full', 'plain')
              : rental.species === pair.setter || rental.species === pair.payoff
                ? pixelTag('Pair', 'plain')
                : pixelTag('Take', 'plain'),
          rentalHelp(rental.species, team.includes(rental.species)),
          index === 0,
          team.includes(rental.species),
        ),
      )
      .join('');
    list = `<p class="px-wrap">${escapeAttribute(`Today's pair: ${pair.why}`)}</p><h3 class="px-subheading">On loan today · Lv ${DOJO_LEVEL}</h3>${six}`;
  } else {
    const yours = team
      .map((species, index) =>
        row(
          species,
          `data-yours="${species}"`,
          swapTake ? pixelTag('Swap', 'risk') : pixelTag(index === 0 ? 'Lead' : 'In', 'good', true),
          swapTake ? `Give ${named(species)} back for ${named(swapTake)}.` : `${named(species)} on loan: ${rentalMoves(species)}.`,
          index === 0 && !swapTake,
          false,
        ),
      )
      .join('');
    const swapped = team.some((species) => !live.team.includes(species));
    const theirs = (live.swapFrom ?? [])
      .filter((species) => !team.includes(species))
      .map((species, index) =>
        row(
          species,
          `data-theirs="${species}"`,
          swapTake === species ? pixelTag('Taking', 'good', true) : pixelTag(swapped ? 'Swapped' : 'Swap in', 'plain'),
          swapped ? 'One swap a win: you have made it.' : `${rentalHelp(species, false)} Then choose who of yours goes back.`,
          index === 0 && swapTake !== null,
          swapTake === species,
        ),
      )
      .join('');
    list = `<h3 class="px-subheading">On loan${live.scored ? '' : ' · practice'}</h3>${yours}${
      theirs && !swapped ? `<h3 class="px-subheading">Swap one for one of theirs</h3>${theirs}` : ''
    }<button class="px-row" data-new-run data-help="${escapeAttribute(
      'Give the three back and choose again from today’s six. This run ends.',
    )}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">START AGAIN</strong></span><small>Ends this run</small></span>${pixelTag(
      'New run',
      'plain',
    )}</button>`;
  }
  const next = `<p class="px-wrap">${escapeAttribute(`Bout ${bout} of ${RUN_BOUTS}: ${foe.name} brings ${teamWords(foe.team)}.`)}</p>`;
  const ready = team.length === 3;
  const scored = live ? live.scored : nextRunScored(record?.rental, now);
  const fight = `<button class="px-window px-button is-primary" data-fight${ready ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(
    ready ? `Fight ${foe.name}: three on loan a side at Lv ${DOJO_LEVEL}, no bag.` : 'Choose three first.',
  )}">Fight</button>`;
  return `<main class="px-body dojo-team-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${next}${list}</div>`, {
    heading: 'Rentals',
    note: `${scored ? 'Pays' : 'Practice'} · ${bout} of ${RUN_BOUTS}`,
  })}${pixelCommitBar({
    title: ready ? `3 vs 3 · Lv ${DOJO_LEVEL}` : `${team.length} of 3 chosen`,
    actions: fight,
  })}</main>`;
}
