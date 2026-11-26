import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { SPECIES_BY_ID } from '../pokemon/species';
import { arenaTabs, cupPoster, rentalPoster, type ArenaFoe } from './arenaBoldView';
import { CUP_RUN_BOUTS, CUPS, cupFoe, cupSideProblem } from './cups';
import { pairToday, rentalFoe, rentalsToday } from './rentals';

const at = (date: string): Date => new Date(`${date}T12:00:00`);
const of = (id: string): Pokemon => new Pokemon(SPECIES_BY_ID[id], 30);
const ground = CUPS.find((one) => one.id === 'ground')!;
const foe = (one: { readonly name: string; readonly team: readonly string[] }): ArenaFoe => ({ name: one.name, team: one.team, sheet: '' });

/** The cup's page for a side, two bouts into the week's run. */
function groundCup(team: readonly Pokemon[]): string {
  const now = at('2026-11-26');
  return cupPoster({
    tabs: arenaTabs('cup', ground),
    cup: ground,
    week: { week: '2026-W48', run: 2, best: 2, paid: 0 },
    bout: 3,
    team,
    problem: team.length === 0 ? 'Choose who goes first.' : cupSideProblem(team, ground),
    foes: Array.from({ length: CUP_RUN_BOUTS }, (_, index) => foe(cupFoe(ground, index + 1, now))),
  });
}

describe("THE BATTLE ARENA's cup page, in Champion Red", () => {
  it('names the cup and its rule, and lays out all seven bouts with the next one marked', () => {
    const page = groundCup([of('dugtrio'), of('charizard'), of('blastoise')]);
    expect(page).toContain('GROUND CUP');
    expect(page).toContain(ground.rule);
    expect(page.match(/class="bold-bout /g)).toHaveLength(CUP_RUN_BOUTS);
    expect(page.match(/bold-bout is-won/g)).toHaveLength(2);
    expect(page).toContain('bold-bout is-next');
    expect(page).toContain('Fight bout 3');
  });

  it('shows what the week pays, three, five and seven in a row', () => {
    const page = groundCup([of('dugtrio')]);
    for (const tickets of [50, 100, 200]) expect(page).toContain(`<em>${tickets}</em>`);
    expect(page).toContain('Best this week: 2 of 7');
  });

  it('holds FIGHT back and starts the cursor on YOUR THREE while the side breaks the rule', () => {
    const page = groundCup([of('charizard')]);
    expect(page).toMatch(/data-fight aria-disabled="true"/);
    expect(page).toMatch(/data-pick-team data-cursor-start/);
    expect(page).toContain(cupSideProblem([of('charizard')], ground)!);
  });

  it('starts the cursor on FIGHT once the side keeps the rule', () => {
    const page = groundCup([of('dugtrio'), of('charizard')]);
    expect(page).toMatch(/data-fight data-cursor-start/);
    expect(page).toContain('Keeps the rule');
  });

  it('has the three ways to fight as tabs, the open one marked', () => {
    const tabs = arenaTabs('cup', ground);
    expect(tabs.match(/data-mode="/g)).toHaveLength(3);
    expect(tabs).toMatch(/is-open" data-mode="cup"/);
  });
});

describe("THE BATTLE ARENA's rentals page, in Champion Red", () => {
  const now = at('2026-11-26');
  const page = (team: readonly string[]): string =>
    rentalPoster({
      tabs: arenaTabs('rental', ground),
      six: rentalsToday(now).map((rental) => rental.species),
      live: undefined,
      team,
      swapTake: null,
      pair: pairToday(now),
      bout: 1,
      foe: foe(rentalFoe(1, now)),
      scored: true,
    });

  it("puts today's six on the rail, each with a picture pane that answers for it", () => {
    const html = page([]);
    for (const rental of rentalsToday(now)) {
      expect(html).toContain(`data-rental="${rental.species}"`);
      expect(html).toContain(`data-shown-by="six-${rental.species}"`);
    }
  });

  it('marks the lead and the second taken, and says what ENTER does on the third', () => {
    const [lead, second, third] = rentalsToday(now).map((rental) => rental.species);
    const html = page([lead, second]);
    expect(html).toContain('<span class="bold-card-tag">Lead</span>');
    expect(html).toContain('<span class="bold-card-tag">2</span>');
    expect(html).toMatch(new RegExp(`data-shown-by="six-${third}"[\\s\\S]*?Take as 3rd`));
    expect(html).toMatch(/data-fight aria-disabled="true"/);
  });

  it('lets FIGHT go once three are on loan, and says what the run pays', () => {
    const html = page(rentalsToday(now).slice(0, 3).map((rental) => rental.species));
    expect(html).not.toMatch(/data-fight aria-disabled/);
    expect(html).toContain('5 a win · 50 more for all 7');
  });
});
