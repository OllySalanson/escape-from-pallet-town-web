# Player feedback, on the owner's PC

The far end of the game's FEEDBACK tab. Players' messages wait in the game's Supabase project (`pallet-town-maps`) until this collects them.

## One-off setup

1. **The service-role key.** Supabase dashboard > project `pallet-town-maps` > Project Settings > API Keys > create a new **secret key** (`sb_secret_...`) for this PC - not the legacy `service_role` JWT, which is due to be switched off - and copy it. Save it as one line in a file only you can read:

   ```sh
   mkdir -p ~/.config/pallet-town && umask 077 && printf '%s' 'PASTE-THE-KEY' > ~/.config/pallet-town/service-role-key
   ```

   It reads every message and deletes them after ninety days, so it never goes in the game, the repo or a chat.

   A clip is a stranger's file, and turning it into text runs it through FFmpeg's decoders (inside faster-whisper's PyAV). Run `--transcribe` as a user that cannot read this key file - another login, or a container - if you can; the collector only checks a clip's first bytes, which is not a sandbox.

2. **Voice to text (optional, free, on this PC).** `pip install faster-whisper`. The first `--transcribe` run downloads the speech model once (`small.en`, about 480 MB; set `FEEDBACK_WHISPER_MODEL=base.en` for about 145 MB). Until then a voice message is kept as its clip, and `message.md` says it has not been turned into text yet. A clip the speech model cannot read, or that takes over two minutes, is noted in `transcribe-failed.txt` beside it and not tried again; delete that file to try it once more.

## Collecting

```sh
SUPABASE_SERVICE_ROLE_KEY_FILE=~/.config/pallet-town/service-role-key \
  npx --no-install vite-node tools/feedback/collect.mts -- --out=<folder> --transcribe --quiet
```

Each new message becomes `<folder>/<date> <tag>/` (`message.md`, `picture.png`, `voice-N.webm`, `save.json`, `row.json`, and `transcript.txt` once heard), and `<folder>/index.html` lists everything, newest first. It prints **one line when something new came in and nothing otherwise**, so it can run on a timer: the line names tags, screens and what kind of message each is, and never a player's words, because the reader may be an agent.

What it does to the project: marks each collected message received, deletes its voice clips as soon as they are on the PC, deletes messages (and their pictures) received more than ninety days ago, deletes uploads no message names once they are a day old, and removes anonymous visitors not seen for thirty days who have no message, map, leaderboard score or block in the lab. The project itself answers which uploads and which visitors those are (`unclaimed_feedback_uploads`, `idle_anonymous_visitors`), so the answer is never cut short at the 1000 rows one read returns, and every read the collector makes is paged. A message whose files will not download is left for the next run and never stops the others. Nothing else.

What it never does: let a player name anything on this PC. A folder is the time and the tag, the picture is `picture.png`, a clip is `voice-<n>.<the type its bytes say>`, and a file whose first bytes are not a PNG or recorded audio is left out (`left-out.txt` says so) and never reaches the speech model - though a file that only starts like audio does (see the setup note on running it apart). Everything a player's browser sent is written into `message.md` inside code blocks, so a viewer never renders it or fetches a link from it, and one folder it cannot read is named and skipped rather than stopping the list page.

`node tools/supabase/anonymousProbe.mjs` checks the other side: that a player can send and can read nothing.
