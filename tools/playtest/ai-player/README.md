# The AI playtester

An AI plays the real game, start to finish, as a veteran or as a newcomer, and
writes down the bugs, the confusing moments and the lines that sound
machine-written. A dashboard shows what each one is doing.

| file | what it is |
|---|---|
| `act.mjs` (`act`) | the AI's hands: one short command per action |
| `game.mjs` | the actions themselves, over test mode's `describe()` |
| `render.mjs` | the screen as a few short lines |
| `runs.mjs` | the run folders: status, findings, the stuck rule |
| `PLAYTEST.md` | the prompt an AI session plays with: personas, finish line, findings |
| `overnight.mjs` | AI sessions one after another until a deadline |
| `../dashboard.html`, `../dashboard.mjs` | the page that shows it all |

## One run, by hand

```bash
tools/playtest/ai-player/act start --persona=newcomer   # or veteran; builds the game once
tools/playtest/ai-player/act look
tools/playtest/ai-player/act choose NEW GAME
...
tools/playtest/ai-player/act stop                       # closes the tab, the browser and the server
```

`start` makes a test-mode build in `.build/` (once; `--rebuild` makes it again),
serves it, opens it in the machine's watched headless browser
(`fm-browser.sh`, named `eptw-ai-player`; `--port=N` uses a CDP browser you
started instead) and pauses it. The game only moves when a command steps it.
`start --resume=<run-id>` carries a run on in a new browser from the save its
folder holds.

## An AI session

```bash
claude -p "$(cat tools/playtest/ai-player/PLAYTEST.md)" --permission-mode dontAsk \
  --allowedTools 'Bash(tools/playtest/ai-player/act:*)' Read Edit
```

after a `start`. Or all night, alternating personas, one browser at a time,
waiting whenever the machine is short of memory or busy:

```bash
node tools/playtest/ai-player/overnight.mjs --until=10:00 --session-minutes=60
```

Each run carries on across sessions until it is finished: its save and its
`memory.md` stay in its folder.

## What a run writes

`runs/<run-id>/` (or `$EPTW_AI_RUNS/<run-id>/`):

- `status.json` - persona, started, last action and when, current goal, the
  finish-line milestones, raids, wipes, extractions, raid clock, stuck count,
  findings by kind
- `findings.jsonl` - one finding a line: kind (`bug`, `confusing`, `ai-feel`),
  what, where, the goal, and its screenshot under `shots/`
- `actions.jsonl` - every action, how long it took and what it changed
- `memory.md` - the AI's own notes, for the next session
- `save.json` - the game's save after the last action

## The dashboard

```bash
node tools/playtest/dashboard.mjs          # http://127.0.0.1:4719/
```

It reads the run folders and the machine's memory and processor every 30
seconds.
