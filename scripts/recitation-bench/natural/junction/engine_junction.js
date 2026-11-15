// Junction check, for a patched copy of @tilawa/core (make_dist.mjs). Not used by
// the app yet.
//
// While the cursor is on an ayah's last two words, and until one chunk after it enters
// the next ayah, find the best CTC fit of two hypotheses in the audio decoded so far,
// from a little before the word before the last word:
//
//   word before + last word + next word's first sounds     (h1)
//   word before + next word's first sounds                 (h0)
//
// Each may start and stop at any frame: audio outside the fit costs nothing. The
// difference per token of the last word is llr. The last word is unsaid when:
//
// - early: h0 fits (fitNext or better) and llr is under llrMissing. The tracker has not
//   crossed yet: it bends the next word's sounds onto the missing word for a second or
//   two. While the last word is being said h0 does not fit, since the next word's
//   sounds are not there. Off when the two words open alike (sameOpening).
// - late: the cursor is one chunk into the next ayah, or past its first word, the last
//   word's verdict is settled and not 'ok', llr is under llrMissing and h0 fits at least
//   loosely (fitLate): a reader who went back to an earlier word is in neither hypothesis.
//
// It reuses the frames the session already keeps in correction mode and the engine's
// own tokenizer; no other model runs. The hypotheses exist only inside this computation
// and are never shown.
import { encodePhonemes } from "./posteriors.js";
import { BLANK_ID } from "./tokens.js";
import { pausalPhonemes } from "./verdicts.js";

const memo = new Map();
export function encode(text) {
    let ids = memo.get(text);
    if (ids === undefined) {
        ids = encodePhonemes(text);
        memo.set(text, ids);
    }
    return ids;
}

const MADD = /(ۦ{3,}|ۥ{3,}|ا{3,})/gu;

/** An ayah-end long madd read at two counts, as many reciters do. */
export function shortMadd(ph) {
    return ph.replace(MADD, (m) => m.slice(0, 2));
}

/**
 * Viterbi score of `ids` against the free decode over frames [from, to), where
 * the path may stop at any frame and the frames after it cost nothing. <= 0;
 * about 0 when the hypothesis fits the start of the window.
 */
export function forcedFreeTail(post, ids, from, to, blank = BLANK_ID) {
    const L = ids.length;
    const S = 2 * L + 1;
    if (to <= from)
        return L === 0 ? 0 : -Infinity;
    const ext = new Int32Array(S);
    for (let s = 0; s < S; s++)
        ext[s] = s % 2 === 1 ? ids[(s - 1) >> 1] : blank;
    let prev = new Float64Array(S).fill(-Infinity);
    let next = new Float64Array(S);
    prev[0] = post.logp(from, ext[0]);
    if (S > 1)
        prev[1] = post.logp(from, ext[1]);
    let free = post.bestLogp(from);
    const end = (a) => (L === 0 ? a[0] : Math.max(a[S - 1], a[S - 2]));
    let best = end(prev) - free;
    for (let t = from + 1; t < to; t++) {
        for (let s = 0; s < S; s++) {
            let m = prev[s];
            if (s >= 1 && prev[s - 1] > m)
                m = prev[s - 1];
            if (s >= 2 && ext[s] !== blank && ext[s] !== ext[s - 2] && prev[s - 2] > m)
                m = prev[s - 2];
            next[s] = m === -Infinity ? -Infinity : m + post.logp(t, ext[s]);
        }
        [prev, next] = [next, prev];
        free += post.bestLogp(t);
        const v = end(prev) - free;
        if (v > best)
            best = v;
    }
    return best;
}

/**
 * Best fit of `ids` anywhere in frames [from, to): the path may start and stop at
 * any frame, and frames outside it cost nothing. Against the free decode: <= 0,
 * about 0 when the hypothesis is there. The tracker's idea of where the word before
 * starts can be late when two nearby words sound alike, so the start must not be
 * forced on it.
 */
export function forcedLocal(post, ids, from, to, blank = BLANK_ID) {
    const L = ids.length;
    const S = 2 * L + 1;
    if (to <= from)
        return L === 0 ? 0 : -Infinity;
    const ext = new Int32Array(S);
    for (let s = 0; s < S; s++)
        ext[s] = s % 2 === 1 ? ids[(s - 1) >> 1] : blank;
    let prev = new Float64Array(S).fill(-Infinity);
    let next = new Float64Array(S);
    let best = -Infinity;
    for (let t = from; t < to; t++) {
        const top = post.bestLogp(t);
        for (let s = 0; s < S; s++) {
            let m = prev[s];
            if (s >= 1 && prev[s - 1] > m)
                m = prev[s - 1];
            if (s >= 2 && ext[s] !== blank && ext[s] !== ext[s - 2] && prev[s - 2] > m)
                m = prev[s - 2];
            // A path may start here, on the first blank or the first token.
            if (s <= 1 && m < 0)
                m = 0;
            next[s] = m === -Infinity ? -Infinity : m + post.logp(t, ext[s]) - top;
        }
        [prev, next] = [next, prev];
        const v = L === 0 ? prev[0] : Math.max(prev[S - 1], prev[S - 2]);
        if (v > best)
            best = v;
    }
    return best;
}

function bestLocal(post, list, from, to) {
    let best = -Infinity;
    for (const ids of list) {
        if (!ids)
            continue;
        const v = forcedLocal(post, ids, from, to);
        if (v > best)
            best = v;
    }
    return best;
}

function bestFree(post, list, from, to) {
    let best = -Infinity;
    for (const ids of list) {
        if (!ids)
            continue;
        const v = forcedFreeTail(post, ids, from, to);
        if (v > best)
            best = v;
    }
    return best;
}

/**
 * Both hypotheses over [from, to), each read every way the words allow: the word
 * before as written or at a stop, the last word as written or with a short madd,
 * and the next word tokenized jointly (run on) or apart (stopped). `anchor` keeps
 * only the next word's first tokens; null keeps all of them.
 */
export function junctionFree(post, before, lastForms, after, from, to, anchor = null, local = false) {
    const fit = local ? bestLocal : bestFree;
    const cut = (head, tail) => {
        const h = encode(head);
        const joined = encode(head + tail);
        const t = encode(tail);
        const out = [];
        if (h && t)
            out.push([...h, ...(anchor === null ? t : t.slice(0, anchor))]);
        if (h && joined)
            out.push(anchor === null ? joined : joined.slice(0, h.length + anchor));
        return out;
    };
    const withLast = [];
    const without = [];
    for (const b of before) {
        without.push(...cut(b, after));
        for (const l of lastForms)
            withLast.push(...cut(b + l, after));
    }
    return { s1: fit(post, withLast, from, to), s0: fit(post, without, from, to) };
}

/** Readings of words g0..g1-1: the last of them may be read at a stop. */
export function beforeForms(corpus, g0, g1) {
    let stem = "";
    for (let g = g0; g < g1 - 1; g++)
        stem += corpus.wordPhonemes(g);
    const last = corpus.wordPhonemes(g1 - 1);
    const atEnd = corpus.wordInAyah[g1 - 1]
        === corpus.ayahWordCount(corpus.wordSurah[g1 - 1], corpus.wordAyah[g1 - 1]) - 1;
    const pausal = pausalPhonemes(last, corpus.plain[g1 - 1], atEnd);
    const forms = pausal ? [stem + last, stem + pausal] : [stem + last];
    // A reader who stops there holds a madd before the last letter, as at an ayah's end.
    const held = (pausal ?? last).match(/^(.*?)(ۥۥ|ۦۦ|اا)(.)$/su);
    if (held)
        forms.push(stem + held[1] + held[2] + held[2] + held[3]);
    return forms;
}

// LOOK_BACK_FRAMES, ANCHOR_TOKENS, WAIT_FRAMES and LOOK_BACK were set on the follower's
// output, so these numbers are under the Quran-Lab NPL-1.2 (licenses/NPL-1.2.txt), not
// the repo's licence. The app reads its copy from followerConstants.npl.json.

/** Frames searched before the word before. The tracker can place that word late
 * when two nearby words sound alike; 3 s holds even a long last word. */
export const LOOK_BACK_FRAMES = 75;
/** How much of the next word the hypotheses must reach: enough to pin down what
 * sits between it and the word before, no more than one chunk can hold. */
export const ANCHOR_TOKENS = 3;
/** One 480 ms chunk after the cursor enters the next ayah. */
export const WAIT_FRAMES = 12;

function hypotheses(corpus, gBefore, L, anchor) {
    const expected = corpus.wordPhonemes(L);
    const forms = [expected, shortMadd(expected)].filter((x, i, a) => a.indexOf(x) === i);
    const before = beforeForms(corpus, gBefore, L);
    const next = corpus.wordPhonemes(L + 1);
    // The next word may open with a long madd read at two counts too, as in يا أيها.
    const nextForms = [next, shortMadd(next)].filter((x, i, a) => a.indexOf(x) === i);
    const cut = (head) => {
        const out = [];
        for (const tail of nextForms) {
            const h = encode(head);
            const joined = encode(head + tail);
            const t = encode(tail);
            if (h && t)
                out.push([...h, ...(anchor === null ? t : t.slice(0, anchor))]);
            if (h && joined)
                out.push(anchor === null ? joined : joined.slice(0, h.length + anchor));
        }
        return out;
    };
    const withLast = [];
    const without = [];
    for (const b of before) {
        without.push(...cut(b));
        for (const l of forms)
            withLast.push(...cut(b + l));
    }
    return { withLast, without, nL: encode(expected)?.length ?? 1 };
}

/**
 * The last word and the next word open with the same sounds (two joins in the whole
 * text share a word's opening, 30:6 and 76:15, and a few more their first sounds). While
 * the last word is being said its sounds pass for the next word's, so the early path
 * cannot tell, and stays off there.
 */
export function sameOpening(corpus, L, anchor = ANCHOR_TOKENS) {
    const a = encode(corpus.wordPhonemes(L));
    const b = encode(corpus.wordPhonemes(L + 1));
    if (!a || !b)
        return false;
    const n = Math.min(anchor, a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}

/**
 * The scores behind the check. `from` is where the tracker says the word before
 * starts. `needH1` says, given h0, whether h1 is worth computing; without it llr is
 * null. s0 is in nats against the free decode; llr is per token of the last word.
 */
export function junctionTest(corpus, post, gBefore, L, from, to, needH1 = null, anchor = ANCHOR_TOKENS) {
    const { withLast, without, nL } = hypotheses(corpus, gBefore, L, anchor);
    const start = Math.max(post.firstFrame, from - LOOK_BACK_FRAMES);
    const s0 = bestLocal(post, without, start, to);
    if (needH1 && !needH1(s0))
        return { s0, llr: null, nL };
    const s1 = bestLocal(post, withLast, start, to);
    return { s0, s1, llr: (s1 - s0) / nL, nL };
}

const LOOK_BACK = 3;

function spansOf(tracer) {
    const t = tracer.tracker;
    const spans = new Map();
    for (const seg of tracer.segment(t.trail).slice(-4)) {
        for (const [w, sp] of tracer.alignSegment(seg))
            spans.set(w, sp);
    }
    return spans;
}

/**
 * One decision per join of the tracker. `apply` adds it to the verdicts the session
 * reports: a last word the check finds unsaid reads 'skipped' with
 * `junctionMissing: true`, unless it was since heard 'ok'; one it finds said carries
 * `junctionMissing: false`. Options: llrMissing, fitNext and fitLate, constants tuned on
 * this model's posteriors, so they ship with the model.
 */
export class JunctionCheck {
    constructor(corpus, opts) {
        this.corpus = corpus;
        this.llrMissing = opts.llrMissing;
        this.fitNext = opts.fitNext;
        this.fitLate = opts.fitLate ?? -Infinity;
        this.tracker = null;
        this.done = new Map();
        this.crossed = new Map();
        this.tests = 0;
        this.ms = 0;
    }

    apply(tracer, post, framesDecoded, verdicts) {
        const started = performance.now();
        const out = this.step(tracer, post, framesDecoded, verdicts);
        this.ms += performance.now() - started;
        return out;
    }

    step(tracer, post, framesDecoded, verdicts) {
        const t = tracer.tracker;
        if (t !== this.tracker) {
            this.tracker = t;
            this.done = new Map();
            this.crossed = new Map();
        }
        const c = this.corpus;
        const cw = t.cursorWordIndex;
        const s = c.wordSurah[cw];
        const a = c.wordAyah[cw];
        const first = c.ayahFirstWord(s, a);
        const end = first + c.ayahWordCount(s, a) - 1;
        const candidates = [];
        if (a > 1)
            candidates.push(first - 1);
        if (cw >= end - 1)
            candidates.push(end);
        const byWord = new Map(verdicts.map((v) => [v.wordIndex, v]));
        let spans = null;
        for (const L of candidates) {
            if (this.done.has(L) || L + 1 >= t.endWord || L <= t.firstWord)
                continue;
            if (cw >= L + 1 && !this.crossed.has(L))
                this.crossed.set(L, framesDecoded);
            const state = byWord.get(L)?.state ?? null;
            const settled = state !== null && state !== "pending";
            const due = this.crossed.has(L)
                && (cw >= L + 2 || framesDecoded >= this.crossed.get(L) + WAIT_FRAMES);
            if (due && state === "ok") {
                this.done.set(L, null);
                continue;
            }
            spans ??= spansOf(tracer);
            const result = this.test(t, spans, post, framesDecoded, L, due && settled);
            if (result?.decided || (due && settled))
                this.done.set(L, result?.decided ? result : null);
        }
        for (const [L, result] of this.done) {
            if (!result)
                continue;
            let v = byWord.get(L);
            if (!v && result.missing) {
                v = tracer.makeVerdict(L, "skipped", 1, 0, 0);
                verdicts.push(v);
                byWord.set(L, v);
            }
            if (!v)
                continue;
            v.junction = result.llr;
            v.junctionMissing = result.missing;
            if (result.missing && v.state !== "ok")
                v.state = "skipped";
        }
        return verdicts;
    }

    /** `final`: decide now either way. Otherwise only an early 'unsaid' decides. */
    test(t, spans, post, end, L, final) {
        const heardOn = (g) => {
            const sp = spans.get(g - t.firstWord);
            return sp && sp.to > sp.from ? sp : null;
        };
        let g0 = L - 1;
        while (g0 >= t.firstWord && g0 >= L - LOOK_BACK && !heardOn(g0))
            g0--;
        const sp = g0 >= t.firstWord && g0 >= L - LOOK_BACK ? heardOn(g0) : null;
        if (!sp)
            return null;
        const from = Math.max(0, t.heard[sp.from].frame - 1);
        if (!post.has(from, end) || end <= from)
            return null;
        const early = !final && !sameOpening(this.corpus, L);
        if (!final && !early)
            return null;
        const got = junctionTest(this.corpus, post, g0, L, from, end, final ? null : (s0) => s0 >= this.fitNext);
        this.tests += 1;
        if (got.llr === null)
            return null;
        const missing = got.llr < this.llrMissing && (!final || got.s0 >= this.fitLate);
        if (missing || final)
            return { decided: true, llr: got.llr, missing };
        return null;
    }
}
