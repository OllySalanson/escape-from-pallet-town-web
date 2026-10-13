// Builds each game the house console plays from its own repository, at a pinned
// commit, and keeps the built module in `src/game/console/vendor/<id>/`.
//
//   node scripts/fetch-console-games.mjs            every game below
//   node scripts/fetch-console-games.mjs <id> ...   only those
//
// Every console game lives in a repository of its own and is built there
// (Pallet Blocks: github.com/OllySalanson/pallet-blocks). This game takes its
// published module - the self-contained ES module the game's own `build:lib`
// makes, the same one its GitHub Pages serves - but from a commit named here
// rather than whatever Pages holds today, so a build of this game is the same
// build next year and a new version of a game arrives as a reviewed change.
//
// Why vendored and not a git dependency in package.json: a git dependency is
// built by npm's install scripts, and the map publishing workflow installs with
// `--ignore-scripts` on purpose (its job holds a service key; no dependency's
// code may run there), so the module would simply not exist in that build.
// Built here, the game is plain committed JavaScript the bundler code-splits:
// nobody downloads it until they sit down at the console.
//
// What it writes for each game: `<id>.js` (the module), `types/` and `<id>.d.ts`
// (its declarations, so the host is type-checked against the real API),
// `LICENSE`, and `SOURCE.json` (repository, commit, and the module's sha256,
// which `console/vendor.test.ts` reads the committed file back against).
//
// Adding a game is a row here, then `src/game/console/consoleGames.ts`, then a
// migration that names it to the leaderboard - see AGENTS.md.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lowerOwnPriority } from '../tools/lowPriority.mjs';

lowerOwnPriority();

/**
 * Every console game: its id (the leaderboard's and the vendor folder's name),
 * where its code lives, the commit to build, and where its build leaves the
 * module and its declarations.
 */
export const CONSOLE_GAME_SOURCES = [
  {
    id: 'pallet-blocks',
    repo: 'https://github.com/OllySalanson/pallet-blocks.git',
    commit: '6e21369c851cc9a940d1cc4309ffecc6d7c6fd89',
    build: ['npm', 'run', 'build:lib'],
    module: 'dist-lib/pallet-blocks.js',
    types: 'dist-lib/types',
    typesEntry: 'embed',
  },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wanted = process.argv.slice(2);
const games = wanted.length ? CONSOLE_GAME_SOURCES.filter((game) => wanted.includes(game.id)) : CONSOLE_GAME_SOURCES;
for (const id of wanted) {
  if (!CONSOLE_GAME_SOURCES.some((game) => game.id === id)) {
    console.error(`No console game called ${id}.`);
    process.exit(1);
  }
}

const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });

for (const game of games) {
  const work = mkdtempSync(join(tmpdir(), `console-game-${game.id}-`));
  try {
    console.log(`${game.id}: ${game.repo} at ${game.commit}`);
    run('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', game.repo, 'src'], work);
    const source = join(work, 'src');
    run('git', ['checkout', '--quiet', game.commit], source);
    // The game's own lockfile, and none of its install scripts: what runs is
    // the one build command named above.
    run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], source);
    run(game.build[0], game.build.slice(1), source);

    const out = join(root, 'src/game/console/vendor', game.id);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const module = readFileSync(join(source, game.module));
    writeFileSync(join(out, `${game.id}.js`), module);
    cpSync(join(source, game.types), join(out, 'types'), { recursive: true });
    writeFileSync(join(out, `${game.id}.d.ts`), `export * from './types/${game.typesEntry}';\n`);
    if (existsSync(join(source, 'LICENSE'))) {
      cpSync(join(source, 'LICENSE'), join(out, 'LICENSE'));
    }
    const record = {
      id: game.id,
      repo: game.repo,
      commit: game.commit,
      module: game.module,
      sha256: createHash('sha256').update(module).digest('hex'),
    };
    writeFileSync(join(out, 'SOURCE.json'), `${JSON.stringify(record, null, 2)}\n`);
    console.log(`${game.id}: ${module.length} bytes, sha256 ${record.sha256}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
