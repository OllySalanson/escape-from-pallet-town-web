/**
 * The browser's own "Leave site?" question, asked only while a raid is being
 * played in this page.
 *
 * Leaving a raid half way costs its pack (`settleAbandonedRaid`, the captain's
 * ruling on playtest 11's B1), and nothing stood between a player and that but
 * one key: Back, a stray Ctrl+W or Ctrl+R, a swipe on a trackpad. The break-it
 * test of 23 Nov 2026 lost a Raid pack to a reload during the jump over the
 * rail, before the player had set foot in the vale. The rule is unchanged - a
 * player who means to go still goes, and still pays - but leaving is now a
 * choice rather than an accident.
 *
 * Only while a raid is under way in *this* page: the base, the title and a
 * raid's result screen lose nothing by being closed, and a raid another tab is
 * playing is that tab's to guard. Never in test mode, whose drivers reload and
 * close pages mid-raid on purpose and could not answer the browser's question.
 *
 * Phaser-free, so the rule is tested on a stand-in window; `main.ts` installs
 * it, asking `raidHeartbeat` and the save whether a raid is being played here.
 */

/** The part of `window` the guard needs. */
export interface LeaveTarget {
  addEventListener(type: 'beforeunload', listener: (event: BeforeUnloadEvent) => void): void;
  removeEventListener(type: 'beforeunload', listener: (event: BeforeUnloadEvent) => void): void;
}

/**
 * Asks the browser to confirm leaving the page whenever `raidUnderWay` says a
 * raid is being played here. Returns the function that stops guarding.
 */
export function guardLeavingDuringRaid(target: LeaveTarget, raidUnderWay: () => boolean): () => void {
  const listener = (event: BeforeUnloadEvent): void => {
    if (!raidUnderWay()) {
      return;
    }
    // The browser writes its own words; these two lines are what make it ask,
    // the first for current browsers and the second for the older ones.
    event.preventDefault();
    event.returnValue = '';
  };
  target.addEventListener('beforeunload', listener);
  return () => target.removeEventListener('beforeunload', listener);
}
