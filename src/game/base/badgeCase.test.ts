import { describe, expect, it } from 'vitest';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { TILE_SIZE } from '../worldMap';
import { baseGame } from './baseGames.testkit';
import {
  BADGES,
  badgeCaseLines,
  badgeCaseNote,
  badgeCasePoster,
  badgeSeats,
  wonBadges,
} from './badgeCase';
import { BADGE_CASE_WALL } from './rooms';

const pixel = (picture: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] => {
  const at = (y * picture.width + x) * 4;
  return [...picture.data.subarray(at, at + 4)];
};
const hex = (ink: string): number[] => [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));

describe('THE BADGE CASE', () => {
  /** A keeper with no badge is a win the house does not show; a badge with no keeper can never shine. */
  it('has a badge for every keeper in the game, and for nobody else', () => {
    const keepers = bossEncounters(createRunTrainerEncounters()).map((boss) => boss.bossId);
    expect(BADGES.map((badge) => badge.bossId).sort()).toEqual([...new Set(keepers)].sort());
    expect(new Set(BADGES.map((badge) => badge.name)).size).toBe(BADGES.length);
  });

  it('names each badge after the keeper it is won from, as the fight names them', () => {
    const names = new Map(
      bossEncounters(createRunTrainerEncounters()).map((boss) => [boss.bossId, boss.trainer.name]),
    );
    for (const badge of BADGES) {
      expect([badge.bossId, badge.keeper.toUpperCase()]).toEqual([badge.bossId, names.get(badge.bossId)]);
    }
  });

  it('draws every badge eight pixels square, in its own ink, and no two alike', () => {
    for (const badge of BADGES) {
      expect([badge.name, badge.art.length]).toEqual([badge.name, 8]);
      for (const row of badge.art) {
        expect([badge.name, row.length, /^[oabcg.]+$/.test(row)]).toEqual([badge.name, 8, true]);
      }
    }
    expect(new Set(BADGES.map((badge) => badge.art.join('|'))).size).toBe(BADGES.length);
  });

  it('shines a badge only once its keeper is beaten', () => {
    expect(wonBadges(baseGame())).toEqual([]);
    const game = baseGame({ progress: { defeatedBosses: ['overlook-warden', 'floodplain-toll-keeper'] } });
    // In the case's own order, whatever order the save beat them in.
    expect(wonBadges(game).map((badge) => badge.name)).toEqual(['TOLL BADGE', 'OVERLOOK BADGE']);
    expect(badgeCaseNote(game)).toBe(`2 of ${BADGES.length} badges`);
    expect(badgeCaseNote(baseGame())).toBe('Every slot still empty');
  });

  it('reads out every badge it holds, and says how many slots are left', () => {
    const empty = badgeCaseLines(baseGame());
    expect(empty[0]).toContain(`${BADGES.length} slots`);
    const two = badgeCaseLines(
      baseGame({ progress: { defeatedBosses: ['pallet-mill-keeper', 'floodplain-toll-keeper'] } }),
    );
    expect(two[0]).toContain(`2 of ${BADGES.length} badges`);
    expect(two[0]).toContain(`${BADGES.length - 2} slots still empty`);
    expect(two.slice(1)).toEqual([
      'TOLL BADGE: from Tollman Briggs, who held the bridge off Market Isle.',
      'MILL BADGE: from Miller Vance, who held the far bank of the millpond.',
    ]);
    const full = badgeCaseLines(baseGame({ progress: { defeatedBosses: BADGES.map((badge) => badge.bossId) } }));
    expect(full[0]).toContain(`All ${BADGES.length} badges`);
    expect(full).toHaveLength(BADGES.length + 1);
  });

  /** Eleven badges a pixel apart in a case four tiles wide: none may touch the frame or another. */
  it('seats every badge inside the velvet, clear of the frame and of every other badge', () => {
    const { frame, seats } = badgeSeats(BADGE_CASE_WALL);
    expect(seats).toHaveLength(BADGES.length);
    const velvet = { left: frame.x + 2, top: frame.y + 2, right: frame.x + frame.width - 3, bottom: frame.y + frame.height - 3 };
    for (const seat of seats) {
      expect(seat.x).toBeGreaterThanOrEqual(velvet.left);
      expect(seat.y).toBeGreaterThanOrEqual(velvet.top);
      expect(seat.x + 7).toBeLessThanOrEqual(velvet.right);
      expect(seat.y + 7).toBeLessThanOrEqual(velvet.bottom);
    }
    for (const [index, a] of seats.entries()) {
      for (const b of seats.slice(index + 1)) {
        const apart = a.x + 8 <= b.x || b.x + 8 <= a.x || a.y + 8 <= b.y || b.y + 8 <= a.y;
        expect([a.badge.name, b.badge.name, apart]).toEqual([a.badge.name, b.badge.name, true]);
      }
    }
  });

  it('paints a won badge in its colours and an empty slot as its shape pressed into the velvet', () => {
    const won = BADGES[0];
    const game = baseGame({ progress: { defeatedBosses: [won.bossId] } });
    const poster = badgeCasePoster(game, BADGE_CASE_WALL);
    expect([poster.width, poster.height]).toEqual([
      BADGE_CASE_WALL.width * TILE_SIZE,
      BADGE_CASE_WALL.height * TILE_SIZE,
    ]);
    const { seats } = badgeSeats(BADGE_CASE_WALL);
    const first = seats[0];
    // A pixel of the won badge's own colour, where its art says `a`.
    const ay = won.art.findIndex((row) => row.includes('a'));
    const ax = won.art[ay].indexOf('a');
    expect(pixel(poster, first.x + ax, first.y + ay)).toEqual([...hex(won.ink.a), 255]);
    // The second slot's badge has not been won: the same pixel of its shape is
    // the pressed velvet, not its colour.
    const other = seats[1];
    const oy = other.badge.art.findIndex((row) => row.includes('a'));
    const ox = other.badge.art[oy].indexOf('a');
    expect(pixel(poster, other.x + ox, other.y + oy)).not.toEqual([...hex(other.badge.ink.a), 255]);
    expect(pixel(poster, other.x + ox, other.y + oy)[3]).toBe(255);
  });

  it('leaves the wall it hangs on showing round the frame', () => {
    const poster = badgeCasePoster(baseGame(), BADGE_CASE_WALL);
    expect(pixel(poster, 0, 0)[3]).toBe(0);
    expect(pixel(poster, poster.width - 1, poster.height - 1)[3]).toBe(0);
    const { frame } = badgeSeats(BADGE_CASE_WALL);
    expect(pixel(poster, frame.x, frame.y)[3]).toBe(255);
  });
});
