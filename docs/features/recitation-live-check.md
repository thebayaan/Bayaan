# Recitation: the live word check (Fix 2)

Status: built and measured offline, **off in the app** (`LIVE_CHECK_ENABLED = false`
in `services/recitation/liveCheck/config.ts`). It has not been run on a phone.

The follower marks a word only when it already suspects it, and on a phone it
suspects too little. The live check does not wait for suspicion. While the reader
recites, the checker model that is already in the app (`quran-asr-small`, MIT) reads
the ayah about twice a second, and the check says of each word, once enough audio has
followed it, whether the written word was said: `fine`, `changed` or `missed`. A bad
verdict is written into the mark book as a mistake while the reader is still in the
ayah.

Places are written `surah:ayah:word`, words counted from 0. Nothing here holds Quran
text.

## Where the code is

| Part | File |
| --- | --- |
| The contract between the check and the app | `services/recitation/liveCheck/types.ts` |
| The model's output cut into heard words, the score test, quiet stretches | `liveCheck/reading.ts` |
| Heard words laid on the written words | `liveCheck/laying.ts` |
| The check itself: windows, verdicts, moving from ayah to ayah | `liveCheck/check.ts` |
| Words the model is known to misread | `liveCheck/blindSpots.json`, `blindSpots.ts` |
| The app's loop: audio in, model run, opinions out | `liveCheck/runner.ts`, `config.ts` |
| Opinions into the mark book | `liveCheck/liveMarks.ts`, `wordMarks.ts` |
| The offline bench | `scripts/recitation-bench/fix2/` |

`check.ts`, `reading.ts` and `laying.ts` import nothing from the app, so the bench
compiles and runs the same files the app ships.

## How it decides

1. **Windows.** Each tick (0.48 s of audio) the check asks for up to three model
   runs over the engine's own log-mel frames: the ayah being read from its start (or
   from a cut, when it is longer than 9.6 s), a short window from the ayah's last
   word that watches for the next ayah's first word, and one last look at an ayah
   that has ended, cut where it ended. The model is an ayah reader: a window never
   holds two ayat on purpose.
2. **Laying.** The model's letters are cut into heard words and laid on the written
   words, allowing a word left out, two words run together, a word cut in two, an
   extra word, a word started again and a jump back.
3. **Two tests.** A word is suspect only if its letters differ (test A) **and** the
   model's own scores lose at least 15 nats when the written word is forced in, or
   put back for a missed word (test B). The bar started at 6. Spliced mistakes lose
   14.5 nats at the 5th percentile and 46 at the median, while the marks background
   speech produced, and the one blind spot found, sat mostly between 7 and 12, so the
   bar went up: see the table under "What it measures".
4. **Sound words around it.** The words that did not read right around a suspect
   word form a run. The run may be three written words at most, the written words
   just before and just after it must have been heard letter for letter, and a run of
   two or three needs a second such word on one side. A run that starts the ayah
   needs a window that starts in a pause with that word; a run that ends the ayah
   needs quiet after it.
5. **Twice.** The verdict must hold on two runs in a row, unless the gap is twice
   what is needed.
6. **Ripe.** A word inside the ayah is judged once 2 s of the same ayah have followed
   the next word's start, or the reader has stopped for 0.6 s. The last two words
   wait for the ayah's end, and are judged on its last look whether or not a pause
   followed. After an ayah start found with no pause before it, the first word is
   context only; after a start the check had to guess, the first two are.

Every rule after the third exists because clean audio broke without it. The ones
added in this round, each from a traced false mark:

| Rule | What broke |
| --- | --- |
| The ayah ends at the **first** pause after its last word; sound between that pause and the long quiet makes the next ayah's first words context only | A short first word of the next ayah said before a breath was cut out of its window and called missed or changed |
| The ending quiet counts from the last letter the model wrote, leaving out letters written with the window's edge | A slow reader's held sound passed for quiet and the last word was judged half read |
| A word whose last letter came with the window's end is not judged | The same |
| Last words are not judged in a window that already holds sound after the ending pause | The next ayah's first letters were written onto the last word |
| A click of up to 30 ms does not end a stretch of quiet | Pauses were missed and ayat ended blind |
| A start found blind (the follower moved on, no ayah end seen) is never a clean start | The window began after the first word and the second was called changed |
| A word begun, dropped and said again is never called bad | A doubled letter was written as two words |
| A run that starts the ayah must start the window too | At a take's start, with three ayat in one window, a short first word was called missed |
| Visits after the ayah's last word are not readings of this window, and the place of the last word is remembered | Twin ayat: the second twin's opening was counted as the first read again |
| With no word of this ayah heard, the model's move to the next ayah needs the follower when both open alike | A take that began on the first of two twin ayat was judged as the second |

Two things were tried and dropped because they failed: judging a word from 1 s after
the next word instead of 2 s (on recitations kept back for validation it left 8 false
marks in 15,526 words, against 2 without it), and trusting the first word of an
ayah that follows with no pause (2 false marks in 11,437 dev words). A third, telling
noisy audio from clean by how far a window's loud frames stand over its quiet ones,
did not separate the two.

## Blind spots

Some words the model misreads however well they are read: the same place is called
bad for different reciters. Rules cannot fix that, because the model's own scores say
the letters are missing. `scripts/recitation-bench/fix2/blind_spots.py` lists every
place called bad for two or more professional reciters, and the check never marks the
places in `blindSpots.json` (it can still pass them as fine). The list holds places
only. One place is listed, 18:48:0: called changed for three of four reciters at the
6-nat bar, with gaps of 8 to 11, so the 15-nat bar now clears it as well. **Only
eight surahs have been swept** (18, 36, 50, 55, 56, 67, 78, 89). The whole mushaf
needs one pass, about 12 CPU-hours with no GPU, before the check is turned on.

## What the app does with a verdict

A final `changed` or `missed` goes straight into the mark book as a mistake with its
evidence (`live`), never through the follower's suspect-and-confirm path, and the
follower's own verdicts leave live marks alone. A later reading of the same word
replaces the earlier one. See `liveMarks.ts` and the tests beside it.

## Runtime warning

`onnxruntime-node` 1.24.3 on x86-64 spoils every 32nd output row of the int8 checker
(row 31, 63, ...: one token at 0, the rest near -4e5). 1.31.1 is clean. The app drops
a run with such a row (`secondLook/corruptOutput.ts`) and the bench refuses to go on.
Whether ARM builds (phones, Apple silicon) do the same has not been checked: look for
a row whose smallest value is under -1000.

## What it measures

Measured on 14 Nov 2026, offline, with onnxruntime-node 1.31.1 on x86-64. The check
was frozen before the held-out sets were run, and those were run once. One fix came
after the freeze (a last look that could outlive the audio the stream keeps); every
dev and spliced recitation replays identically with it. Bench hash of the measured
`reading.ts`, `laying.ts`, `check.ts`: `677013d2`.

**False marks.** Every recitation here is correct, so every mark is false.

| Set | Role | Size | False marks | Per 1,000 judged | Words judged |
| --- | --- | --- | --- | --- | --- |
| 10 studio reciters, surahs 55 56 67 78 89 | tuned on | 50 recitations | 0 of 11,239 | 0.00 | 82% |
| Same reciters, surahs 18 36 50 | options accepted or dropped on | 24 recitations | 0 of 15,524 | 0.00 | 90% |
| 5 of those reciters with background speech at 10 dB | bar tuned on | 15 recitations | 1 of 2,356 | 0.42 | 73% |
| **8 other reciters, quiet** | held out, run once | 60 recitations, 9.8 h | **12 of 25,114** | **0.48** | 89% |
| **The same with background speech at 10 dB** | held out, run once | 60 recitations | **50 of 20,343** | **2.46** | 72% |
| Twin-ayah recordings against their own text, 6 voices | 2 voices dev, 4 not | 714 clips | 0 of 3,725 | 0.00 | 91% |
| Al-Ikhlas by ordinary speakers, dev half, clips labelled correct | not tuned on | 344 clips, 170 speakers | 0 of 1,108 | 0.00 | 88% |

On the held-out voices the rate per reciter runs from 0 to 1.6 per 1,000. What the
twelve are, from the model's reading at each place (nothing was tuned on them):

- 2 are two neighbouring words at 19:73:8-9 that one recording seems to lack: the
  words on either side are heard 0.3 s apart. The same two are marked in the noisy
  copy. They may be true.
- 3 are in 25:68, by two reciters who stop after word 12 and start again from word 7,
  a common place to do so. Word 7 has the same letters as word 15, so the laying took
  the second start for word 15 and called the words between missed.
- 7 of the 12 are `missed`, and all 7 were settled on a single run by a very wide gap.
  Requiring two runs always, and holding a `missed` verdict back when the word that
  follows it could also be an earlier word of the ayah, are the two changes these
  point to. Neither can be decided on the set it was seen on. With background speech the held-out voices run from 0.65 to 8.1 per 1,000, and the
worst voice also has the fewest words judged (39%). The dev row for the same
condition, 0.42, is the set the bar was tuned on, and it did not carry over: 15
recitations by 5 voices were too few to set a bar for noise. At the first bar of 6
nats that dev row was 17 of 2,332 (7.3 per 1,000).

**Catches.** Mistakes spliced into the audio of 28 studio recitations (10 reciters,
surahs 67 78 89): a word replaced by another from the same recording, a word cut out.
A mark on the word or a neighbour counts.

| Mistake | n | Live check | Follower's own marks today | Either |
| --- | --- | --- | --- | --- |
| Changed word | 33 | 15 (45%) | 25 (76%) | 27 (82%) |
| Skipped word inside an ayah | 53 | 40 (75%) | 49 (92%) | 51 (96%) |
| Skipped first word | 15 | 3 (20%) | 11 (73%) | 12 (80%) |
| Skipped last word | 15 | 0 | 7 (47%) | 7 (47%) |
| False marks on these recitations | | 0 | 17 | |

Look-alike changes, from twin ayat (a recording of one ayah judged against its
twin's text, 6 voices, 690 clips): 47% caught (first word 23%, inside the ayah 75%,
last word 41%); 54% and 53% on the two voice groups the checker was or was not
trained near, 34% on the two held-out voices. Spelling-only twins: 0 marks in 84
clips. A word the text has and the recording lacks: 8 of 108.

**Speed.** From the word to its mark: median 2.5 s, 90th percentile 3.8 s (spliced
mistakes); 2.2 s and 2.7 s (twin clips). One run costs 50-70 ms for a 4-5 s window
on a 2.1 GHz Xeon thread.

## Against the gates

| Gate | Result | |
| --- | --- | --- |
| At most 1.0 false marks per 1,000 on held-out voices, quiet | 0.48 | met |
| The same with speech at 10 dB | 2.46 | **not met** |
| At most 1.0 per 1,000 on correct phone-learner clips (Al-Ikhlas) | 0 of 1,108 on the dev half; the 95% upper bound is 2.7 | met on the count, not proven at this size |
| At most 0.5 per 1,000 on the pool's test cell | not run: 0 of 26,763 on the dev and validation recitations | open |
| At most 5 of 958 junction controls marked | not run | open |
| Non-look-alike changed words caught, 80% | 45% alone, 82% with the follower | not met alone |
| W1 changed words caught, 80% | 47% (75% inside the ayah) | not met |
| First words, 40% | 20% alone, 80% with the follower | not met alone |
| Skipped words, 70% | 75% | met |
| Median 1.5 s, 90th percentile 2.5 s | 2.5 s and 3.8 s | not met |

On quiet audio the check stays inside the false-mark gate on voices it was not tuned
on. With another voice talking in the room it does not, so by the release rule it
cannot ship as it is. It does not catch enough on its own either, and on studio audio
the follower's own marks already catch more than it does: its worth is on phone
audio, where the follower's suspicion fails, and that is exactly what could not be
measured here.

## What is not measured, and what limits it

- **A phone.** No run on a device: no timings, no memory, no answer on the runtime
  fault above, and no phone-recorded mistakes. The gated sets that hold them (TLOG,
  QUA) need a Hugging Face token.
- **Real mistakes.** Catches are spliced studio audio and twin texts, not learners'
  slips.
- **The whole mushaf.** Blind spots were swept on eight surahs only.
- **Speed.** A skipped word shows as skipped only once two more words have been
  heard, and a word reads reliably only about 2 s after the next one starts. Earlier
  verdicts failed validation. The limit is the model, which was trained to read whole
  ayat, not a stream.
- **Ayah edges.** A changed or skipped last word is judged only when a pause of about
  half a second follows the ayah: with less, the check cannot tell a word said wrong
  from an ayah cut too soon, and leaves it to the follower. A first word is judged
  only after a pause. Fast readers of short ayat therefore get few words judged
  (first words: 63% on the dev set).
- **Twin neighbours.** A word heard as a word of the ayah before or after gets no
  verdict, so the other twin's word said in a twin that directly follows is not marked.
- **Known loose ends in the code** (lost verdicts, not false marks): the first pause
  after the last word ignores letters the model writes late, so a stop inside the
  last word can make the next ayah's first two words context only; the word a take was
  found on keeps its earlier words unjudged on a later reading of that ayah; a
  stretch of quiet may be bridged across clicks that together outweigh it.

## Next steps

1. Measure on a phone, with the flag on in a debug build, on the owner's takes.
2. Sweep the whole mushaf for blind spots (`blind_spots.py`).
3. Try "two runs always", holding back a `missed` verdict when the reader may have
   gone back to a word with the same letters, and the loose ends above, then measure
   on a fresh held-out set (the present one has now been looked at).
4. Noise: the 50 marks on the noisy held-out set are the data for a way to know when
   not to judge (nothing tried here told noisy windows from clean ones), or for
   training.
5. The catch, speed and noise gates all point at the model: a checker trained for
   streaming and for noise. That is the Modal training round, which has not been
   started and needs the owner's OK.
