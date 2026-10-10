# Pitching in

So you'd like to help. Lovely. Pull up a chair, mind the Rattata.

**Escape from Pallet Town** is a free fan project made for fun, so the bar for joining in is low and
the welcome is warm. Here are the ways in, roughly from least to most typing.

## Play it and tell us what you think

Honestly the most useful thing anyone can do. [Play it in your browser](https://ollysalanson.github.io/escape-from-pallet-town-web/),
lose a raid or two, and then:

- **Something broke?** [Report a bug](https://github.com/OllySalanson/escape-from-pallet-town-web/issues/new?template=bug_report.yml).
  A screenshot and the steps that got you there are worth their weight in Thunder Stones.
- **Had an idea?** [Share it](https://github.com/OllySalanson/escape-from-pallet-town-web/issues/new?template=idea.yml).
  Small ones count: a rival line that would land better, a corner of a map that's too quiet, a menu
  that takes one key press too many.

## Draw a map

Choose **MAKE A MAP** on the title screen, build something, play it with **WALK IT** or **RAID IT**,
and when the checklist is happy, press **Send it in**. Maps are sent from inside the game, not as
pull requests: once one is approved it is added for everybody under **PLAYER MAPS**, with your name
on it. More on that in the [README](README.md#draw-your-own-map).

## Write some code

It's TypeScript, Phaser 3 and Vite, and it all runs in the page. You'll need [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Before you open a pull request, run the four checks GitHub runs on `main` after every merge:

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

A few things that will save us both a round trip:

- **Read [AGENTS.md](AGENTS.md) first.** It is long, and it is the reason the game hangs together:
  how each part works, why it was built that way, and the traps somebody already fell into so you
  don't have to. If your change adds a part or makes a note there untrue, update it in the same pull
  request.
- **Show, don't tell.** If anything on screen changes, put a before and after screenshot in the pull
  request. [docs/screens/](docs/screens/) is full of examples.
- **The rules are FireRed's.** Stats, learnsets, types and battle rules come from generation III,
  and say where they came from. Where the game differs on purpose, it is written down, so a number
  from a fan site or from memory is the wrong one to reach for.
- **Mind the art.** Every asset needs its line in
  [ASSET_PROVENANCE.md](public/assets/ASSET_PROVENANCE.md), and a ripped source sheet is never
  committed in the form it was downloaded in.
- **The music stays off.** Sound effects are welcome. Music is not. This one isn't up for debate.

## The small print

This is a fan project. It is **not affiliated with, endorsed by or sponsored by Nintendo, Game Freak,
Creatures Inc. or The Pokémon Company**. Pokémon and every name, character and design belonging to
it are trademarks of their respective owners.
