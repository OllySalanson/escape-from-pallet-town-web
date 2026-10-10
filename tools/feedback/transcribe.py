"""Turns a player's voice clips into text on this PC, free and offline.

    python3 tools/feedback/transcribe.py voice-1.webm [voice-2.webm ...]

Prints the clips' words, one clip a paragraph, in order. It uses faster-whisper
(https://github.com/SYSTRAN/faster-whisper, MIT), which runs Whisper on the CPU;
the model is downloaded once, on the first run, into the usual Hugging Face
cache. FEEDBACK_WHISPER_MODEL picks it (default `small.en`, about 480 MB, which
is clear on English speech; `base.en` is about 145 MB and rougher). Nothing is
sent anywhere: the clip never leaves the PC it was collected onto.
"""

import os
import sys


def main(paths):
    if not paths:
        print("Name at least one clip.", file=sys.stderr)
        return 2
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed: pip install faster-whisper", file=sys.stderr)
        return 1
    model = WhisperModel(os.environ.get("FEEDBACK_WHISPER_MODEL", "small.en"), device="cpu", compute_type="int8")
    paragraphs = []
    for path in paths:
        segments, _info = model.transcribe(path, beam_size=5, vad_filter=True)
        paragraphs.append(" ".join(segment.text.strip() for segment in segments).strip())
    print("\n\n".join(paragraph for paragraph in paragraphs if paragraph))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
