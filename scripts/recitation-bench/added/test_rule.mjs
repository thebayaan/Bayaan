/* eslint-env node, es2020 */
// node --test added/test_rule.mjs
// Logic checks: pure functions, and the engine copy's gap report on symbol
// streams built from the corpus's own phonemes. No audio is involved, nothing
// here measures how often anything is caught.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  DEFAULTS,
  NOT_TEXT_PHRASES,
  around,
  collapse,
  echoCost,
  buildVocab,
  explainedBy,
  fold,
  isRealWord,
  isWordInRun,
  loadWords,
  phraseCost,
  restartCost,
  shape,
  tolerance,
  wordShaped,
} from './rule.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');
const DIST = path.join(BENCH, '.out/added/core/dist/recitation');
const load = f => import(pathToFileURL(path.join(DIST, f)));
const {costTable} = await load('phonemeCost.js');
const {Tracker} = await load('tracker.js');
const {VerdictTracer} = await load('verdicts.js');
const {QuranCorpus} = await load('corpus.js');
const {DEFAULT_CONFIG} = await load('config.js');
const table = costTable();
const corpus = new QuranCorpus(
  JSON.parse(fs.readFileSync(path.join(BENCH, '.out/assets/zipformer_quran.json'), 'utf8')),
);
const CFG = {...DEFAULT_CONFIG, commitDwell: 2, wholeWordAtCut: true};

/** Feeds a phoneme string as a heard stream, 3 frames a sound, and reads gaps. */
function run(surah, startWord, phonemes) {
  const tracker = new Tracker(corpus, table, surah, startWord, CFG);
  const chars = [...phonemes].map((ch, i) => ({ch, frame: i * 3, margin: 1}));
  tracker.feed(chars);
  const tracer = new VerdictTracer(tracker, table, CFG);
  const out = tracer.verdicts(true);
  return {out, gaps: out.filter(v => v.gap)};
}

const wi = (s, a, w) => corpus.wordIndex(s, a, w);
const ph = (s, a, w) => corpus.wordPhonemes(wi(s, a, w));
const ayah = (s, a) => corpus.ayahPhonemes(s, a);

test('shape', () => {
  assert.equal(collapse('ممم'), 'م');
  assert.equal(shape('هُم').sounds, 3);
  assert.equal(wordShaped('هُم'), true);
  assert.equal(wordShaped('هُوَ'), true);
  assert.equal(wordShaped('لَاا'), true);
  assert.equal(wordShaped('وَ'), false);
  assert.equal(wordShaped('ممم'), false);
  assert.equal(wordShaped('ااا'), false);
  assert.equal(wordShaped('ننننَ'), false);
  assert.equal(wordShaped('ُۥۥ'), false);
});

test('restart and echo costs', () => {
  const left = ['وَجَعَلَ', 'خِلَاالَهَاااا'];
  const right = ['ءَنهَاارَوو', 'وَجَعَلَ', 'لَهَاا'];
  assert.equal(restartCost('ءَنهَاارَووخِلَاالَهَاااا', left, right, table), 0);
  assert.equal(restartCost('ءَنهَاارَوو', left, right, table), 0);
  assert.equal(restartCost('وَجَعَلَ', left, right, table), 0);
  assert.ok(restartCost('هُم', left, right, table) >= 1);
  assert.equal(echoCost('اَهَاااا'.slice(1), 'خِلَاالَهَاااا', table), 0);
  assert.ok(echoCost('هُم', 'خِلَاالَهَاااا', table) >= 1);
});

test('a run must be one word of the Quran', () => {
  const {words} = loadWords();
  const vocab = buildVocab(words);
  for (const w of ['هُوَ', 'هُم', 'لَيسَ', 'كَاانَت', 'عَمَلَںںں', 'لَاا', 'مَرجِعُكُم']) {
    assert.equal(isRealWord(w, vocab), true, w);
  }
  for (const w of ['تُاااا', 'ءِهَث', 'بَ۾۾۾', 'َءِ', 'ذَعَلَهِم', 'يُسَااعُ', 'وَاااا']) {
    assert.equal(isRealWord(w, vocab), false, w);
  }
  assert.equal(fold('هَااذَاا'), 'هَاذَا');
  // The run's first consonant merged with the left word's last.
  assert.equal(isWordInRun('َكَ', 'ل', vocab), true);
  // A nasal tail of the left word in front of the word.
  assert.equal(isWordInRun('ںںںكِتَاابِ', 'ب', vocab), true);
  assert.equal(isWordInRun('َءِ', 'ب', vocab), false);
});

test('phrases said that are not the text', () => {
  assert.ok(phraseCost('بِسمِللَااهِررَحمَاانِررَحِۦۦم', table) <= 0.3);
  assert.ok(phraseCost('ءَعُۥۥذُبِللَااهِ', table) <= 0.3);
  assert.ok(phraseCost('ءَللَااهُءَكبَر', table) <= 0.3);
  assert.ok(phraseCost('ءَاامِۦۦن', table) <= 0.3);
  assert.ok(phraseCost('هُم', table) > 0.3);
  assert.ok(phraseCost('مَاا', table) > 0.3);
});

test('around() keeps to the surah and the nearest word last', () => {
  const {words, index} = loadWords();
  const near = around(words, index, '1:1:0', '1:1:1', 5, 2);
  assert.deepEqual(near.left, [words[index.get('1:1:0')].phon]);
  assert.equal(near.right.length, 2);
});

test('correct symbol stream: no gap', () => {
  const {gaps} = run(1, wi(1, 2, 0), ayah(1, 2) + ayah(1, 3) + ayah(1, 4));
  assert.equal(gaps.length, 0);
});

test('an extra word inside an ayah: the gap names the two words around it', () => {
  const s = 3;
  const a = 51;
  const heard = ph(s, a, 0) + ph(s, a, 1) + 'هُوَ' + ph(s, a, 2) + ph(s, a, 3) + ph(s, a, 4) + ph(s, a, 5);
  const {gaps} = run(s, wi(s, a, 0), heard);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap.chars, 'هُوَ');
  assert.equal(gaps[0].word, 2);
  assert.equal(gaps[0].gap.leftWord, wi(s, a, 1));
  assert.equal(gaps[0].gap.fitL, 0);
  assert.equal(gaps[0].gap.fitR, 0);
});

test('an extra word between two ayat: the gap sits before the next ayah', () => {
  const s = 67;
  const a = 2;
  const extra = 'قُل';
  const heard = ayah(s, a) + extra + ayah(s, a + 1);
  const {gaps} = run(s, wi(s, a, 0), heard);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap.chars, extra);
  assert.equal(gaps[0].ayah, a + 1);
  assert.equal(gaps[0].word, 0);
});

test('a repeated word with the text around it is explained by nearby text', () => {
  const s = 67;
  const a = 2;
  const n = corpus.ayahWordCount(s, a);
  let heard = '';
  for (let w = 0; w < n; w++) {
    heard += ph(s, a, w);
    if (w === 4) heard += ph(s, a, w);
  }
  const {gaps} = run(s, wi(s, a, 0), heard);
  assert.ok(gaps.length >= 1);
  const {words, index} = loadWords();
  const c = corpus;
  for (const v of gaps) {
    const leftId = `${c.wordSurah[v.gap.leftWord]}:${c.wordAyah[v.gap.leftWord]}:${c.wordInAyah[v.gap.leftWord]}`;
    assert.ok(explainedBy(v.gap.chars, words, index, leftId, `${v.surah}:${v.ayah}:${v.word}`, table, DEFAULTS));
  }
});

test('explainedBy: a word from elsewhere is not explained; going back is', () => {
  const {words, index} = loadWords();
  // 3:51 reads ... ٱللَّهَ رَبِّي ...: an extra هُوَ between them is nobody's repeat.
  assert.equal(explainedBy('هُوَ', words, index, '3:51:1', '3:51:2', table, DEFAULTS), null);
  // Saying the left word again, whole.
  const leftWord = words[index.get('3:51:1')].phon;
  assert.equal(explainedBy(leftWord, words, index, '3:51:1', '3:51:2', table, DEFAULTS), 'repeat');
  // A stutter on the next word.
  const next = words[index.get('3:51:2')].phon;
  assert.equal(explainedBy(next.slice(0, 3), words, index, '3:51:1', '3:51:2', table, DEFAULTS), 'repeat');
  // Read on two words, went back two: long enough for two pieces.
  const w = i => words[index.get(`3:51:${i}`)].phon;
  const backAndOn = w(2) + w(3) + w(0) + w(1);
  assert.ok(explainedBy(backAndOn, words, index, '3:51:1', '3:51:2', table, DEFAULTS));
});

test('elongation of a madd leaves no word-shaped gap', () => {
  const s = 1;
  const a = 2;
  const heard = ph(s, a, 0) + ph(s, a, 1) + ph(s, a, 2).replace('اا', 'اااااااا') + ph(s, a, 3) + ayah(s, 3);
  const {gaps} = run(s, wi(s, a, 0), heard);
  for (const v of gaps) assert.equal(wordShaped(v.gap.chars), false);
});

test('phrases said mid-passage never leave a gap the rule could mark', () => {
  const s = 67;
  const a = 3;
  for (const phrase of NOT_TEXT_PHRASES) {
    const {gaps} = run(s, wi(s, a, 0), ayah(s, a) + phrase + ayah(s, a + 1));
    const isLast = w => corpus.wordInAyah[w] === corpus.ayahWordCount(corpus.wordSurah[w], corpus.wordAyah[w]) - 1;
    const clean = g =>
      g.gap.fitL <= (isLast(g.gap.leftWord) ? DEFAULTS.fitLast : DEFAULTS.fit) &&
      g.gap.fitR <= (isLast(g.wordIndex) ? DEFAULTS.fitLast : DEFAULTS.fit);
    for (const v of gaps.filter(g => wordShaped(g.gap.chars) && clean(g))) {
      assert.ok(phraseCost(v.gap.chars, table) <= tolerance(collapse(v.gap.chars).length, DEFAULTS), `${phrase} / ${v.gap.chars}`);
    }
  }
  // The short one sits whole at the join, the right word's sounds found past it.
  const {gaps} = run(s, wi(s, a, 0), ayah(s, a) + 'ءَللَااهُءَكبَر' + ayah(s, a + 1));
  const atJoin = gaps.find(g => g.ayah === a + 1 && g.word === 0);
  assert.equal(atJoin.gap.chars, 'ءَللَااهُءَكبَر');
  assert.equal(atJoin.gap.fitR, 0);
});
