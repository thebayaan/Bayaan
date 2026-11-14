# Chatter test

Measures what people talking nearby do to the word marks. Correct, unedited
recitation is played with everyday speech mixed behind it.

## Boundaries

- Test only. Nothing here trains a model, and the mixes are never played to anyone.
- No mistake is added. The clips come from the natural benchmark's pool, where
  every mark is false.
- The recitation is only added to: no cut, fade, filter, echo or speed change. A mix
  that would clip is scaled down as a whole.
- The chatter tracks hold no recitation. The `rec_` tracks are for someone reciting
  nearby: correct recitation by reciters who are never the reader
  (`build_reciters.py`). This does not use `.out/noise/babble.f32`, which is two
  recitations mixed with unknown levels and rooms.
- Mixed audio exists only while its condition runs.

The chatter clips are screened on their transcripts (`quran_screen.py`): four words
in a row matching the mushaf drop the clip, and English clips that mention the Quran
are dropped. A transcript can miss something, so `alone:<track>` feeds each track with
no recitation at all and reports what the engine thought it was following.

## Tracks

From CC BY 4.0 speech (`stage_speech.py` pins and hashes the files):

| Track | What it sounds like | Source |
|---|---|---|
| `one_ar` | one Arabic voice talking | ClArTTS |
| `tv_ar` | Arabic TV or radio, voices changing | MediaSpeech |
| `one_en` | one English voice at a time, men and women | LibriSpeech dev-clean |
| `crowd` | eight voices at once, as in a hall or cafe | MediaSpeech and LibriSpeech |
| `rec_one` | one other reciter at a time, on other passages | natural benchmark's test reciters |
| `rec_same` | the same passage by another reciter, 6 s ahead of the reader | the pool's second reader of each passage |

Each voice goes through a simulated room (`far_field.py`): 0.35-0.65 s of reverberation
with more room than direct sound, as for someone a few metres from the phone.

## What the level difference means

Levels are the mean of the frames that hold sound, so a reciter's pauses don't make
them look quieter. As a rough guide, at a phone held to read from, someone talking
across a room is about 15 dB below the reader, someone beside them about 5-10 dB,
and 0 dB means someone as loud as the reader. These are estimates, not measurements:
the bench can't say what a given room does, and the recitations are clean recordings,
not a phone in a room, so this ranks fixes and does not predict what a phone will do.

## Running

```sh
PY=<a venv with numpy and pyarrow>
python3 -I chatter/stage_speech.py
$PY -I chatter/build_tracks.py
$PY -I chatter/test_chatter.py
node --test chatter/test_mix.mjs chatter/test_run.mjs

# Needs the natural manifests and its pool baseline.
nice -n 10 node chatter/run.mjs --jobs 2 \
  --conds none:0,alone:one_ar,alone:tv_ar,alone:one_en,alone:crowd,one_ar:15,one_ar:10,one_ar:5,one_ar:0
node chatter/score.mjs
```

Clips come from the tuning half of the pool (dev reciters on dev passages). `--half
test` reads test reciters on test passages instead, with its own clip list: that half
is for one held-out read (`../../second-look/SCOREBOARD.md`), with its own `--variant`.
`rec_one`'s voices are test reciters, so on that half a reader can have his own voice
behind him. `none:0` must match the baseline word for word or the harness is wrong. `--variant` keeps an engine variant's runs apart, and `TILAWA_DIST`,
`ENGINE_OPTS` and `WORD_MARKS` work as in the natural benchmark.

The W1 suite can run the same way later, to see what chatter costs in catches. Its
audio is correct recitation too; the mistake is only in which ayah's text it is read
against.
