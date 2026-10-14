# Sign Mushaf prototype: notes

Internal prototype. **Illustrations: LPMQ Kemenag RI, used for internal review pending permission; not for distribution.** Do not publish `index.html` or `assets/lpmq/` publicly until LPMQ has given permission.

Source: Lajnah Pentashihan Mushaf Al-Qur'an (LPMQ), _Pedoman Membaca Mushaf Al-Qur'an bagi Penyandang Disabilitas Sensorik Rungu Wicara_ (Kemenag RI, 2022), public PDF at quran.kemenag.go.id. Page numbers below are the book's own (the PDF page is 8 more).

## Files

| Path                                     | What                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                             | The page (built, self-contained: modules and illustrations inlined). Open it directly in a browser.                        |
| `src/converter.mjs`                      | Rule-based converter: Uthmani ayah text to sign tokens, Kitabah and Tilawah.                                                |
| `src/letters.mjs`                        | The 32 letters of the guideline's table plus the Tilawah hamza: name, palm, English description, letter-own movement.      |
| `src/marks.mjs`                          | Harakat and marks: movement descriptors (for the animation phase) and `markLayout` (which glyphs go above / below a hand). |
| `src/asset-map.mjs`                      | Sign token ids to illustration files.                                                                                      |
| `src/fatihah.mjs`                        | Al-Fatihah: Bayaan's text (`data/quran.json`), the MSI spelling transcribed from the guideline, transliteration.           |
| `src/page.mjs`, `src/index.template.html` | Page code and markup.                                                                                                      |
| `assets/lpmq/letters/*.png`, `assets/lpmq/marks/*.png` | LPMQ's drawings, cropped (internal review only).                                                               |
| `tools/extract_lpmq.py`                  | Crops the drawings from the PDF (renders at 600 dpi; the drawings are vector, `pdfimages` finds nothing).                   |
| `tools/build.mjs`                        | Builds `index.html`.                                                                                                       |
| `test/converter.test.mjs`                | `node:test` suite.                                                                                                         |

Commands (from the repo root):

```sh
node --test 'prototypes/sign-mushaf/test/*.test.mjs'   # tests
node prototypes/sign-mushaf/tools/build.mjs    # rebuild index.html
# re-extract the drawings (needs poppler and Pillow):
pdftoppm -r 600 -f 23 -l 39 -png Pedoman-Membaca-Mushaf-Al-Quran-Isyarat.pdf /tmp/lpmq/hr
python3 prototypes/sign-mushaf/tools/extract_lpmq.py /tmp/lpmq prototypes/sign-mushaf/assets/lpmq
```

No new repo dependencies. The sources are plain ES modules with JSDoc types and `// @ts-check` (not `.ts`), so the app's `tsc` and Jest do not pick them up.

## How it renders

- Letters: the drawing from the guideline's letter table (section II.B, pp. 15 to 19), one PNG per letter, transparent background. `hamza_tilawah` comes from the first row of the Tilawah hamza table (p. 30), since the letter table has no drawing for it.
- Marks: the guideline's own glyphs, cropped from the harakat table and its examples (pp. 20 to 26): fathah, kasrah, dammah, the three tanwin, sukun, tasydid, fathah tegak, kasrah tegak, dammah terbalik, tanda mad, tanda sifr, and the stroke forms used on the Kitabah hamza. Marks are drawn at the guideline's mark-to-hand proportion.
- Layout follows the guideline: fathah, dammah, sukun, tanwin and the long and madd forms above the hand; tasydid and the kasrah forms below it, tasydid nearest the hand. Words read right to left; the ayah marker and waqf signs sit beside the hands, not fingerspelled.
- Left hand: the guideline says a left-handed reader mirrors everything (II.A.3). The page's "Left (mirrored)" toggle mirrors each sign, marks included.
- Earlier in this task three 3D hands were tried (procedural, WebXR generic hand, Ultraleap GenericHand) and dropped at the founder's request; none of that code is on the branch.

## Converter: rules and decisions

Input is the Uthmani text of one ayah (a trailing Arabic-Indic number becomes the ayah end). Output is a list of words, each with sign tokens `{letter, vowel, shadda, madd, sifr, hold, qalqalah}` and waqf marks.

### Kitabah (II.D.1: sign what is written)

The guideline is written for the **Mushaf Standar Indonesia (MSI)**. Bayaan's text is the **KFGQPC Hafs (Madani)** text, which is spelled differently in places. The converter maps a Madani convention onto the MSI form only where the guideline's own examples show the MSI form; otherwise it signs what is written.

Mappings (each is shown by an example in the guideline):

1. Fathah + dagger alif on one letter (Madani `مَٰ`) = MSI vertical fathah (`مٰ`): one **fathah tegak** (example "māliki", p. 22).
2. Dagger alif on a carrier letter (`عَلَىٰ`, `ٱلصَّلَوٰةَ`): the vertical fathah goes on the letter before, carrier signed plain (example "waḍuḥāhā", p. 28).
3. Unmarked madd ya after kasrah and madd waw after dammah: MSI writes a sukun on them, and the example signs that sukun (`الرَّحِيْمِ`, `الْمَغْضُوْبِ`). Madd alif stays unmarked.
4. Hamza on alif at the start of a word, or after a one-letter proclitic (و ف ب ل ك): MSI writes a bare alif with its haraka, signed as **alif** (`اِيَّاكَ`, `وَاِيَّاكَ`, `اَنْعَمْتَ` in the example). Elsewhere أ إ ؤ ئ ء and `ـٔ` are the **hamza** sign; the seat is not signed (p. 27).
5. Word-initial `ءَا` (Madani) = MSI `اٰ`: one alif with fathah tegak (example "Āmana", p. 30).
6. Lafz al-jalalah: MSI always writes a vertical fathah on the doubled lam (`اللّٰهِ`, pp. 29 and 40), so the lam takes fathah tegak. This is the converter's only word-pattern rule.
7. Tanda mad on a carrier (`ٱلضَّآلِّينَ`): the stretched haraka belongs to the letter before (drawn as the madd glyph), and the carrier alif is signed plain (example p. 23 and p. 41).
8. Small ya / small waw after the ha of kinayah (`بِهِۦ`): kasrah tegak / dammah terbalik (example "rabbihī", p. 22).
9. Alif wasla `ٱ`: signed as a plain alif (no haraka, since none is written).
10. Iqlab: the small mim is not signed and the nun has no mark (Kitabah example "mim ba'di", p. 39).
11. Tanda sifr (`۟`, `۠`): signed still like sukun, shown with the sifr glyph (II.C row 15).
12. Open tanwin (Madani `ࣰ ࣱ ࣲ`) = ordinary tanwin.
13. Waqf signs (ۖ ۗ ۘ ۙ ۚ ۛ, ۞, ۩) are kept as marks above the word, not signed. Tatweel is skipped (a `ـٔ` tatweel-with-hamza is a hamza).

Where the guideline is silent, the conservative choice (sign as written, do not guess):

- Madani alif wasla at the start of an ayah gets no haraka in Kitabah, because none is written. MSI prints one at some ayah starts (ayah 2 `اَلْحَمْدُ`, ayah 6 `اِهْدِنَا`) but not others (ayah 3 `الرَّحْمٰنِ`), so there is no rule to copy.
- Madani writes a dagger alif in `صِرَٰطَ` where MSI writes a full alif. That is a rasm difference, not a convention, so it is signed as written (ra with fathah tegak, no alif sign).
- Marks with no instruction are read past and logged in the converter output (`log`): small low seen (U+06E3), small high noon (U+06E8), imala / ishmam / tashil marks (U+06EA to U+06EC), small high seen (U+06DC), small high tah.
- Muqatta'at letters carrying a madd sign (II.C row 14): the madd flag is set on the letter itself; the guideline says hold the letter still for the counted beats, which the static page cannot show beyond the madd glyph.
- Madd sign on a carrier after kasrah or dammah (e.g. `فِيٓ`): stretched haraka on the letter before, madd glyph added. The guideline only draws fathah + madd.

### Tilawah (II.D.2 and the comparison table II.E: sign as recited)

Implemented, and it reproduces the guideline's Tilawah example of Al-Fatihah exactly (pp. 42 to 43):

- Alif wasla: dropped inside the reading; at the start of reading it takes fathah before the article lam, otherwise kasrah (dammah if the third letter has dammah).
- Lam of the article (and of Allah) before a shadda letter: not signed (alif lam syamsiyah). Lam qamariyah keeps its sukun.
- Madd letters (alif after fathah, ya after kasrah, waw after dammah, alif maqsura) are not signed; the letter before takes the long haraka. A madd letter at the end of a word before an alif wasla is dropped and the haraka stays short (two sukun meet: `اهْدِنَا الصِّرَاطَ`, `وَلَا الضَّالِّيْنَ` in the example).
- Tanda mad: carrier dropped, stretched haraka kept.
- Stop at the end of each ayah: last letter takes sukun; tanwin fathah + alif becomes fathah tegak (mad iwad, II.E row 9); ta marbuta becomes ha with sukun (II.E row 11).
- Nun sakinah and tanwin: izhar (ء ه ع ح غ خ, and the alif of an initial hamza) unchanged; idgham across words (ي ن م و ل ر) drops the nun (tanwin keeps its single haraka) and doubles the next letter; iqlab before ب turns nun into mim held 2 beats; ikhfa holds 2 beats.
- Qalqalah letters (ق ط ب ج د) with sukun, including at a stop, are marked to bounce.
- Hamza uses the Tilawah handshape (palm down, index forward, II.D.2) with the ordinary arrows.
- Tanda sifr letters are not signed.

Not implemented (the guideline does not cover it): mim sakinah rules (ikhfa / idgham syafawi), lam of `ال` after a word ending in a long vowel beyond the two-sukun case, stopping at waqf signs inside an ayah (every ayah end is treated as a stop, none of the inner signs are, which is how the example reads), sakt, imala, ishmam, tashil. Ghunnah and idgham bilaghunnah are signed alike (the guideline signs them alike).

## Al-Fatihah: Bayaan's text against the guideline's example

`test/converter.test.mjs` holds the example transcribed sign by sign from the drawings (Kitabah pp. 40 to 41, Tilawah pp. 42 to 43).

- MSI spelling (transcribed in `fatihah.mjs`) through the converter: matches the example **exactly** in both methods, including the waqf signs.
- Bayaan's Madani text, Tilawah: matches exactly (the example's waqf signs are MSI marks Bayaan's text does not carry).
- Bayaan's Madani text, Kitabah: matches except four words, which differ because the spelling differs, as Kitabah requires:
  - ayah 2 `ٱلۡحَمۡدُ`: alif without the fathah MSI prints;
  - ayah 6 `ٱهۡدِنَا`: alif without the kasrah MSI prints;
  - ayah 6 `ٱلصِّرَٰطَ` and ayah 7 `صِرَٰطَ`: dagger alif, so ra takes fathah tegak and there is no separate alif sign.
- Waqf signs: the example shows MSI's لا (ayahs 2, 3, 6), قلى (ayahs 4, 5) and a لا with a ۵-like sign after the first عليهم in ayah 7 (an ayah boundary in another counting). Bayaan's `quran.json` has no waqf signs for Al-Fatihah, so none are shown in Madani mode.
- Ayah numbers are not fingerspelled in the guideline (no digit handshapes are defined); the page shows the ayah marker as in the mushaf.

Things in the guideline that look inconsistent (worth asking LPMQ):

- The alif wasla haraka at ayah starts (2 and 6 have one, 3 does not), see above.
- The letter table describes kha's thumb as "lurus ke atas menghadap luar" (straight up, facing out) while the drawing shows it pointing up behind the bent fingers.
- `hamza_tilawah` exists only as a foreshortened drawing in the Tilawah table; it has no row in the letter table.

## Letters

All 32 letter drawings are LPMQ's own, so the handshapes are as the guideline intends. The English one-line descriptions in `letters.mjs` are ours (summaries of the Indonesian text) and are the part to review. Pairs that differ by one finger or by orientation (ba/ta/tha, jim/ha/kha, dal/dhal, ra/zay, sin/shin, sad/dad, ta/za, ain/ghain, fa/qaf) are described in terms of that difference.

## Animation phase notes

The data is already shaped for it:

- A sign token is a **base handshape** (the letter) plus a **movement**: `MARKS[id].movement` is a list of steps (`translate`, `arc`, `rotate`, `hold`, `stroke`, `bounce`) with direction (signer's frame), distance (in hand lengths), repeat and beats. Shadda comes first, then the haraka, as the guideline orders them. Letters with a movement of their own (hamza traces its shape, alif maqsura flicks the wrist twice) carry it in `letters.mjs`.
- Keyframes come straight from the steps: one beat is a fixed duration (say 400 ms); `translate` is two keyframes (start, end), `arc` three (start, sag point, end), `rotate` two with the rotation about the forearm, `hold` one held for its beats, `stroke` swaps to the tanwin V handshape for its part. A sequence of tokens is a timeline of such clips with a short transition between handshapes.
- With 2D illustrations (today's assets) the movement is a CSS / Web Animations transform on the hand image (translate, rotate, a small scale for "toward / away from the body"); handshape changes cross-fade. Cost: one composited layer per animating hand, effectively free; a glossary view (tap a letter or word, play it) or optional inline playback of the current word both fit easily, even on low-end phones.
- With a rigged 3D hand later (if LPMQ prefers our own artwork), the same steps drive the wrist, and handshapes become poses to interpolate. The Ultraleap GenericHand experiment in this task posed a letter (finger angles plus thumb CCD IK, 14 iterations) in well under a millisecond and rendered with one WebGL context; playing a word at 60 fps would cost one small WebGL canvas, a few ms of GPU per frame. A per-word video or sprite sheet rendered offline is the cheaper alternative for a glossary.
