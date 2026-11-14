# Phone test: one session on an iPhone over Metro

A checklist for the first time the word marks, the junction check, the added-word mark and
the second model run on a phone. Every go and no-go value below is a judgement call for one
session, set from the bench numbers in `SCOREBOARD.md`; none of them was measured on a phone.

## 0. Before: no native rebuild

- The working tree changes no native file: `git diff HEAD --stat -- ios android modules
  plugins app.config.js` is empty. `package.json` changes only jest's settings, and the only
  patch that changed is `@tilawa+core+0.4.0.patch`, which is JavaScript in the package's
  `dist`. No dependency was added.
- The last native change for iOS is commit `b11b2afc` (3 November 2026, 18:40, "load
  onnxruntime on the bridgeless bridge proxy"). Since then only Android's manifest changed.
  So a dev client built from that commit or later needs no rebuild.
- To see the installed build's version, connect the phone by cable and run `xcrun devicectl
  device info apps --device <phone name>`. Simpler: if the first take below follows the
  reader at all, the follower's ONNX session loaded, and that needs `b11b2afc`. If it does
  not load, stop: a rebuild is needed.
- Phone and Mac on the same Wi-Fi. The second model (36 MB) downloads at the start of a take
  with no Wi-Fi check, so stay on Wi-Fi.
- In the mushaf settings: "Check my recitation" on, "Vibrate on mistakes" on.

## 1. Metro

From the repo root:

```sh
npx expo start --dev-client --port 8081 --lan > /tmp/metro.log 2>&1
```

Open the dev client and connect to the Mac. Follow the trace with
`grep -a "\[recitation" /tmp/metro.log`. Every line below starts `[recitation <seconds
since the take began>s]`.

First take: `second look: no model file, downloading it for the next take`. Let the download
finish (about a minute on Wi-Fi), stop, and start again: `second look: model loaded in N ms`.

- Go: `model loaded`, N under 3000.
- No-go: `second look: model failed to load (...)`. That is the first real test of the second
  model's operators on iOS; note the message and run only section 3's control.

## 2. The runs

Use one passage you know well for the correct runs, about 5 minutes (roughly 300 words), the
same each time. Hold the phone as you would to read from it. After each run, stop the take
and copy the `checks this take:` line. Take audio is kept on the phone in
`Documents/recitation-debug/` and can be copied off for the bench.

| run | setup | what to do | expect at the default (Step 1) | go | no-go |
|---|---|---|---|---|---|
| A | quiet room | the passage, correctly | no mark | 0 or 1 red | 3 or more |
| B | Arabic TV or radio on, about 3 m behind | the passage, correctly | bench: about 1 per 1,000 words | 2 or fewer | 5 or more |
| C | someone talking nearby, 1 to 2 m | the passage, correctly | bench: 0.2 to 2 per 1,000 | 2 or fewer | 5 or more |
| D | someone reciting another passage nearby (a second phone will do) | the passage, correctly | bench: 5 to 8 per 1,000 | 4 or fewer | 8 or more |
| E | quiet | a wrong word: recite 7:83, 7:111, 10:48, 15:11 and 26:106, and at their 5th, 4th, 4th, 4th and 5th word say the word that 27:57, 26:36, 32:28, 43:7 and 26:142 have there; then carry on | each of these pairs was caught by every bench reciter, at both steps | 3 of 5 | 0 or 1 |
| F | quiet | a left-out last word: recite 4:135, 8:71, 9:110, 24:18 and 33:2, leave out the ayah's last word, and go straight on into the next ayah | a red "missed" mark within about 3 s of the next ayah's first word | 4 of 5 | 2 or fewer |
| G | quiet | an added word: in 90:19 after its 2nd word add the 3rd word of 2:39; in 16:115 between its 9th and 10th words add the 10th word of 2:173; in 40:27 after its 2nd word add the 3rd word of 7:104; then go on as written | a small mark in the gap before the next word, no red on the words around it | 2 of 3 | none |
| H | quiet | a letter slip: change one inner consonant of the 26th word of 4:3, the 12th of 10:4, the 9th of 2:24 and the 3rd of 23:112 | the bench keeps about a third of the slips the follower marks; any mark here is a gain | no crash | a mark on a word you read correctly |

Between runs:

1. After A to H at the default, open `bayaan://recitation-spike` (Safari or Notes), choose
   "skipped marks only", close it, and repeat H and A. The choice counts from the next take.
   Expect more of H marked and possibly a false mark in A. Set it back to "all marks".
2. Step 2: in `services/recitation/secondLook/config.ts` line 28 change `JUDGE_STEP = 1` to
   `JUDGE_STEP = 2`, save, and reload (shake the phone, Reload). Repeat A, C and E, and add the
   close pair: recite 26:106 and at its 5th word say the word 26:124 has there. The bench
   catches that pair only at Step 2. Set it back to 1.
3. Control: line 21 `SECOND_LOOK_ENABLED = true` to `false`, reload, repeat A. This is the
   follower without the second model, for timing. Set it back to `true`.

## 3. What to read, and the values

From each run's `checks this take:` line:

| reading | where | go | no-go |
|---|---|---|---|
| follower's real time | `real time r` | 0.5 or less | 0.8 or more |
| follower backlog | `follower backlog now x max y` | y of 1 or less | y of 3 or more: the follower is waiting |
| slowest chunk | `slowest chunk z ms` | 480 ms or less | 1500 ms or more |
| second model's cost to the follower | `real time` of run A against the control in step 3 | up by 0.05 or less | up by 0.15 or more |
| first pass | `first pass median a max b ms` | a of 600 or less | timeouts on more than 1 in 10 first passes |
| padded look | `padded median c max d ms` | c of 900 or less | d over 2000 (the time limit) |
| timeouts, dropped | `T timeouts, D dropped` | 0 and 0 at Step 1 in runs A to C | any dropped at Step 1 in quiet |
| failed open | `X failed open` | at most 1 in 20 of the checks | `failed open (no model)` after the model loaded |
| model runs a minute | `R model runs` over the run's minutes | near the bench: 0.3 to 0.4 quiet, 0.7 to 1.8 with speech behind, 3 to 4.4 with a reciter behind | three times the bench or more |
| time to a mark | a `MARK` line against the `verdict` line of its word | within 3.5 s | over 5 s |

Per check, the `judge ...` line gives the first pass's milliseconds (model and wait) and the
`padded ...` line the padded look's (features and model). The `check ...` line says whether the
mark showed, was cancelled, or failed open, and why.

Memory: in Xcode, Debug, Attach to Process, Bayaan, then the Debug navigator's memory gauge,
during run D and during the control.

- Go: peak footprint at most 300 MB above the control, and no memory warning.
- No-go: the app is killed, or a memory warning, which shows as later checks failing open
  with `no model`.

## 4. The voice filter's load test

Skipped: no build of the voice filter exists in the app; it is a bench prototype only.

## 5. After the session

Note per run: words read, red marks and on which words, added marks, and the `checks this
take:` line. Copy the take audio off the phone if a run should go back to the bench. A run
that fails a no-go is worth its audio more than one that passes.
