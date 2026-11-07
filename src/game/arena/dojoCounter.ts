import type { GridPosition, Direction } from '../movement/gridMovement';
import { Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { SPECIES_BY_ID } from '../pokemon/species';
import { HARBOUR_BOTS, type HarbourBot } from '../base/harbourBots';
import { DOJO_LEVEL, DOJO_TEAM_SIZE } from './boutRules';
import type { DojoRecord } from './dojoRecord';

/**
 * THE BATTLE ARENA's floor and its reception counter (the harbour arenas plan,
 * H2a): who is in the dojo today, the team each of them fields, and what the
 * receptionist says. Phaser-free.
 *
 * **Who you fight are the dojo's regulars**: the harbour's twelve regulars
 * (`base/harbourBots.ts`), each with their own partner leading and two more that
 * fit their handle - KARPKING's water, OZ-HIKES's rock, BEEBEE22's bugs. Six of
 * them train here on any day, the same six for everybody (the date picks them),
 * standing in the two lines down the sides of FireRed's dojo as its Black Belts
 * stand. They are the dojo's regulars and nothing else: they fight only here,
 * are only ever chosen at the counter, and nothing here counts or lists them as
 * players (the captain's ruling on the regulars, 30 Oct).
 *
 * **They fight on the gym AI** (`pokemon/battle/trainerAi.ts`, `ai: 'gym'`):
 * FireRed's own trainer AI, the one Misty plays her combo with, so a regular
 * knocks out what it can, sets up when it is safe and never throws a move that
 * cannot work. Everybody, both sides, is a flat-level copy (`boutRules.ts`).
 */

/** The room, as `base/rooms.ts` lays FireRed's dojo out: eleven across, fourteen deep, the mat at the foot. */
export const DOJO_ROOM = { width: 11, height: 14, mat: { x: 5, y: 13 } } as const;

/** Where the receptionist stands: on the master's floor, between the two pillars, behind the counter, clear of the vase on the wall. */
export const DOJO_RECEPTIONIST: { readonly position: GridPosition; readonly facing: Direction } = {
  position: { x: 5, y: 3 },
  facing: 'down',
};

/** The counter across the front of the master's floor, straight up the mat from the door. */
export const DOJO_COUNTER_AT: GridPosition = { x: 4, y: 4 };
export const DOJO_COUNTER_TILES: readonly GridPosition[] = [4, 5, 6].flatMap((x) => [4, 5].map((y) => ({ x, y })));

/** The two lines of fighters down the sides of the hall, facing the mats, where FireRed's Black Belts stand. */
export const DOJO_FIGHTER_SPOTS: readonly { readonly tile: GridPosition; readonly facing: Direction }[] = [
  { tile: { x: 0, y: 3 }, facing: 'right' },
  { tile: { x: 10, y: 3 }, facing: 'left' },
  { tile: { x: 0, y: 6 }, facing: 'right' },
  { tile: { x: 10, y: 6 }, facing: 'left' },
  { tile: { x: 0, y: 9 }, facing: 'right' },
  { tile: { x: 10, y: 9 }, facing: 'left' },
];

/** A regular as the dojo knows them: who, their team (partner first), and what they say about it. */
export interface DojoRegular {
  readonly bot: HarbourBot;
  /** Species ids, the partner first: they lead with the Pokémon they walk the harbour with. */
  readonly team: readonly string[];
  /** Said as the bout is taken: one line, in their own voice. */
  readonly greeting: string;
  /** Said by them when they lose. */
  readonly beaten: string;
}

/** Each regular's two besides their partner, chosen by what their handle says they love. Every one knows moves at Lv 30. */
const TEAMS: Readonly<Record<string, { readonly with: readonly [string, string]; readonly greeting: string; readonly beaten: string }>> = {
  'bot:bulbaluv': { with: ['oddish', 'bellsprout'], greeting: 'Grass all the way down. Sleep Powder first, ask questions later.', beaten: 'Ok ok, you earned that one.' },
  'bot:finny2011': { with: ['ponyta', 'vulpix'], greeting: 'Three fire types. Hot take, I know.', beaten: 'Burnt out. GG.' },
  'bot:tess-swims': { with: ['horsea', 'staryu'], greeting: 'Straight from the pool. Try and keep up.', beaten: 'Out of my depth. Nice.' },
  'bot:oz-hikes': { with: ['geodude', 'onix'], greeting: 'Rocks don’t care how strong you think you are.', beaten: 'Crumbled. Fair play.' },
  'bot:karpking': { with: ['gyarados', 'slowpoke'], greeting: 'Everyone laughs at a Magikarp. Nobody laughs twice.', beaten: 'Splash. That was me, splashing.' },
  'bot:xkitx': { with: ['meowth', 'growlithe'], greeting: 'Cats and dogs. Mostly cats.', beaten: 'Meowth, that’s right. I lost.' },
  'bot:dexhunter': { with: ['pikachu', 'eevee'], greeting: 'Every one of these took me a week to find.', beaten: 'Worth it anyway.' },
  'bot:beebee22': { with: ['beedrill', 'butterfree'], greeting: 'Bugs! Bugs are the best and I will prove it.', beaten: 'Squashed. Rematch later?' },
  'bot:1moreraid': { with: ['rattata', 'spearow'], greeting: 'Quick one before the next raid.', beaten: 'Ok ONE more.' },
  'bot:og-nell': { with: ['exeggcute', 'tangela'], greeting: 'I was battling here before the arena had a roof, dear.', beaten: 'Well played. Truly.' },
  'bot:toise4life': { with: ['lapras', 'krabby'], greeting: 'Shell up. We’re here all day.', beaten: 'Cracked my shell. Respect.' },
  'bot:skyezard': { with: ['pidgeotto', 'fearow'], greeting: 'Nothing on the ground can touch us.', beaten: 'Grounded. Ouch.' },
};

/** Every regular the dojo knows, in the harbour's own order. */
export const DOJO_REGULARS: readonly DojoRegular[] = HARBOUR_BOTS.filter((bot) => TEAMS[bot.id] !== undefined).map((bot) => {
  const own = TEAMS[bot.id];
  return { bot, team: [bot.partner, ...own.with], greeting: own.greeting, beaten: own.beaten };
});

/** How many train in the dojo on any one day: one for each spot in the lines. */
export const DOJO_REGULARS_A_DAY = DOJO_FIGHTER_SPOTS.length;

/** A day as a whole number, the same everywhere on the same calendar date. */
function dayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

/** Who trains in the dojo today, in the spots they stand at: the same six for everybody on the same day. */
export function dojoRegularsToday(now: Date): readonly DojoRegular[] {
  const start = (dayNumber(now) * 5) % DOJO_REGULARS.length;
  return Array.from(
    { length: Math.min(DOJO_REGULARS_A_DAY, DOJO_REGULARS.length) },
    (_entry, index) => DOJO_REGULARS[(start + index) % DOJO_REGULARS.length],
  );
}

export function dojoRegular(id: string): DojoRegular | undefined {
  return DOJO_REGULARS.find((regular) => regular.bot.id === id);
}

/** A regular's team at the bout's level, as many as the player brings: partner first. */
export function dojoOpponentParty(regular: DojoRegular, size: number = DOJO_TEAM_SIZE): Pokemon[] {
  return regular.team.slice(0, Math.max(1, Math.min(DOJO_TEAM_SIZE, size))).map((id) => {
    const base = SPECIES_BY_ID[id];
    if (!base) {
      throw new Error(`the dojo knows no ${id}`);
    }
    return new Pokemon(base, DOJO_LEVEL);
  });
}

/** The bout, as the battle screen takes it: the regular's team on FireRed's trainer AI. */
export function dojoTrainer(regular: DojoRegular, size: number): TrainerBattle {
  return {
    id: `dojo-${regular.bot.id.replace(/^bot:/, '')}`,
    name: regular.bot.name,
    party: dojoOpponentParty(regular, size),
    defeatText: regular.beaten,
    ai: 'gym',
  };
}

/** What their row says of a regular's team: the three kinds, in the order they come out. */
export function dojoTeamLine(regular: DojoRegular): string {
  return regular.team.map((id) => SPECIES_BY_ID[id]?.name.toUpperCase() ?? id).join(', ');
}

// --- the receptionist ---------------------------------------------------------

export const DOJO_RECEPTIONIST_NAME = 'RECEPTION';

/** What the receptionist says before the list opens: how a bout works, once, short. */
export function receptionLines(record: DojoRecord | undefined): readonly string[] {
  const held = record ?? { wins: 0, losses: 0, beaten: [] };
  if (held.wins + held.losses === 0) {
    return [
      'Welcome to THE BATTLE ARENA! Bouts here are for sport.',
      `Everybody fights at Lv ${DOJO_LEVEL}, yours and theirs. Up to three a side, no bag.`,
      'Nothing you bring can be hurt or lost. Pick who to fight, then your team.',
    ];
  }
  return [`${held.wins} won, ${held.losses} lost. Who will it be?`];
}

/** What the receptionist says as the player comes back to the counter from a bout. */
export function boutResultLine(regular: DojoRegular | undefined, won: boolean, record: DojoRecord | null): string {
  const who = regular?.bot.name ?? 'them';
  const tally = record ? ` That is ${record.wins} won, ${record.losses} lost.` : '';
  return won ? `You beat ${who}!${tally}` : `${who} took that one.${tally}`;
}

/** The line a fighter's plate says when faced: who they are and what they bring. */
export function fighterLine(regular: DojoRegular, record: DojoRecord | undefined): string {
  const beaten = record?.beaten.includes(regular.bot.id) ? ' You have beaten them before.' : '';
  return `${regular.bot.name} trains here: ${dojoTeamLine(regular)}.${beaten} Ask at the counter for a bout.`;
}
