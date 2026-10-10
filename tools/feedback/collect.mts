/**
 * Collects player feedback onto the owner's PC: the far end of the FEEDBACK tab.
 *
 *   npx --no-install vite-node tools/feedback/collect.mts -- --out=<folder> [--transcribe] [--quiet]
 *
 * Every message the lab holds that has not been collected yet becomes a folder
 * in <folder> - `message.md` to read, `picture.png`, the voice clips, the save
 * if the player sent one, and `row.json` - and is then marked received. The
 * clips are deleted from the project as soon as they are safe on the PC (the
 * plan's promise: voice does not stay online), and anything received more than
 * ninety days ago is cleared out of the project entirely. `index.html` in
 * <folder> lists everything collected, newest first. The work is
 * `collector.ts`; this is the command.
 *
 * With --transcribe, each clip is turned into text on this PC by
 * `transcribe.py` (faster-whisper, free and local) where it is installed; a
 * folder with clips and no `transcript.txt` is listened to again on every run
 * until it has one.
 *
 * It prints one line when something new came in and nothing when nothing did,
 * so a scheduled check can run it every few minutes and speak only when there
 * is news. The line names tags, screens and kinds - never a player's words,
 * because whoever reads it may be an agent (`inbox.ts`, `announcement`).
 * --quiet drops the progress lines on stderr.
 *
 * It needs the project's service-role key, which never leaves this PC:
 * `SUPABASE_SERVICE_ROLE_KEY`, or the file named by
 * `SUPABASE_SERVICE_ROLE_KEY_FILE` (which must not be readable by other users).
 * `SUPABASE_URL` points it at a local stand-in to try it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUBMISSIONS_URL } from '../../src/game/maker/submitConfig';
import { collectFeedback } from './collector';

const argv = process.argv.slice(2).filter((argument) => argument !== '--');
const option = (name: string): string | undefined =>
  argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = option('out');
const quiet = argv.includes('--quiet');

if (!out) {
  console.error('Say where to put the messages: --out=<folder>');
  process.exit(2);
}

function serviceKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  }
  const file = process.env.SUPABASE_SERVICE_ROLE_KEY_FILE;
  if (file && existsSync(file)) {
    // Readable by group or world is a key anybody on the PC can read.
    if ((statSync(file).mode & 0o077) !== 0) {
      console.error(`${file} can be read by other users; run: chmod 600 ${file}`);
      process.exit(2);
    }
    return readFileSync(file, 'utf8').trim();
  }
  return '';
}

const key = serviceKey();
// No key is a broken check, never a quiet one: silence is what "no new
// feedback" sounds like, and nobody would ever learn the check could not read.
if (!key) {
  console.error('No service-role key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY_FILE): feedback cannot be read.');
  process.exit(1);
}

const transcriber = fileURLToPath(new URL('./transcribe.py', import.meta.url));
const result = await collectFeedback({
  url: process.env.SUPABASE_URL ?? SUBMISSIONS_URL,
  key,
  out,
  ...(argv.includes('--transcribe')
    ? {
        transcribe: (clips: readonly string[]) =>
          execFileSync('python3', [transcriber, ...clips], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      }
    : {}),
  say: quiet ? undefined : (line) => console.error(line),
});

if (result.news) {
  console.log(`${result.news} - ${out}/index.html`);
}
