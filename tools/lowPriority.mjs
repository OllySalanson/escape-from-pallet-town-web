// Low CPU priority for everything this repo starts that can eat a core: the
// playtest browser, the test suite and the Vite server. Several agents work on
// this machine beside the captain's own desktop, and a brief asking each of them
// to type `nice -n 15` was measured not to work (2026-09-20: browsers and test
// runs at nice 0, competing with a Windows game on equal terms). So the tools
// lower themselves, and nothing has to be remembered.
//
// It is politeness, not a limit: nothing here caps how many run at once, and a
// niced process still takes every idle core it can find.
import { getPriority, setPriority } from 'node:os';
import { readdirSync } from 'node:fs';

/** The niceness everything is lowered to - what the briefs used to ask for. */
export const POLITE_NICENESS = 15;

/**
 * Lowers this process to `POLITE_NICENESS`, every thread of it, so that anything
 * it spawns afterwards - Chromium, vitest's workers - is born polite too.
 * Never raises: a process started under `nice -n 19` stays at 19 (and an
 * unprivileged process could not raise itself anyway).
 *
 * Every thread, because on Linux a niceness is a thread's: `setpriority` on the
 * pid moves only the main thread, and Node's worker and libuv threads already
 * running would stay at 0. A thread spawned later inherits from its creator.
 */
export function lowerOwnPriority(niceness = POLITE_NICENESS) {
  for (const thread of ownThreads()) {
    try {
      if (getPriority(thread) < niceness) {
        setPriority(thread, niceness);
      }
    } catch {
      // The thread ended between the listing and the call.
    }
  }
}

function ownThreads() {
  try {
    return readdirSync('/proc/self/task').map(Number);
  } catch {
    // Not Linux: the process's own priority is the only handle there is.
    return [0];
  }
}
