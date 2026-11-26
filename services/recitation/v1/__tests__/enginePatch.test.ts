// The patched Tilawa 1.0 tracker (patches/@tilawa+core-v1+1.0.0-rc.1.patch), on real
// code and the real reference from node_modules, with the options the SDK's session
// gives it. It is fed the reference's own phonemes, one push each, as a listener that
// heard every sound would give them.
//
// 1.0.0-rc.1 holds off a lock right after a phrase (a basmala, the isti'adha) ends,
// by an offset into the heard phonemes that only acquisition clears. When the first
// lock landed in the same 1 s cell as the end of the opening basmala, the offset
// stayed for the rest of the take, and a later lock found by search came late or
// never: after a jump, or after a basmala into a surah other than the next one. The
// patch clears the offset when the tracker locks.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const PACKAGE = path.join(ROOT, 'node_modules/@tilawa/core-v1');
const ENGINE = path.join(PACKAGE, 'dist/engine');
const {createTracker} = jest.requireActual(`${ENGINE}/tracker.js`);
const {loadReferenceIndex} = jest.requireActual(`${ENGINE}/reference.js`);

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const phrases = readJson(path.join(ENGINE, 'phrases-v1.json'));
const index = loadReferenceIndex(
  readJson(path.join(PACKAGE, 'assets/ref-v2.json')),
);

interface RefWord {
  surah: number;
  ayah: number;
  word: number;
  start: number;
  end: number;
}
interface PositionEvent {
  type: 'position';
  state: string;
  timeMs: number;
  observed: {word: {surah: number; ayah: number; word: number}}[];
}

const FRAME_MS = 20;
/** The SDK's session searches for the first lock once per second of audio. */
const ACQUIRE_MS = 1000;
const CELL_FRAMES = ACQUIRE_MS / FRAME_MS;

function ayah(surah: number, n: number): string {
  const words = (index.words as RefWord[]).filter(
    w => w.surah === surah && w.ayah === n && w.end > w.start,
  );
  return index.phonemes.slice(words[0].start, words[words.length - 1].end);
}

interface Segment {
  label: string;
  phonemes: string;
  /** Frames of silence before it. */
  pause?: number;
  /** Frames from one phoneme to the next. */
  step?: number;
  /** Start it so that its last phoneme opens an acquisition cell. */
  endOnCell?: boolean;
}

interface Take {
  events: {at: number; event: PositionEvent}[];
  /** Where each segment starts, in phonemes pushed. */
  starts: Map<string, number>;
  /** The frame of each segment's last phoneme. */
  lastFrames: Map<string, number>;
}

function play(segments: Segment[]): Take {
  const tracker = createTracker(index, {
    mode: 'free',
    phrases,
    acquireMs: ACQUIRE_MS,
  });
  const take: Take = {events: [], starts: new Map(), lastFrames: new Map()};
  let frame = 0;
  let at = 0;
  for (const segment of segments) {
    const step = segment.step ?? 5;
    frame += segment.pause ?? 0;
    if (segment.endOnCell) {
      const last = frame + step * (segment.phonemes.length - 1);
      frame += Math.ceil(last / CELL_FRAMES) * CELL_FRAMES - last;
    }
    take.starts.set(segment.label, at);
    for (const p of segment.phonemes) {
      const events = tracker.push({
        inventory: index.inventoryId,
        frameMs: FRAME_MS,
        phonemes: [{p, start: frame, end: frame, conf: 1}],
        decodedTo: frame,
      });
      for (const event of events) {
        if (event.type === 'position') take.events.push({at, event});
      }
      take.lastFrames.set(segment.label, frame);
      frame += step;
      at++;
    }
  }
  return take;
}

const cellOfFrame = (frame: number) => Math.floor(frame / CELL_FRAMES);
/** A position event's time is one frame past the last phoneme it has seen. */
const cellOfEvent = (e: PositionEvent) => cellOfFrame(e.timeMs / FRAME_MS - 1);

/**
 * Phonemes from the start of `label` until the tracker locks on the passage read from
 * there: surah, from ayah `first` to ayah `last`.
 */
function phonemesToLock(
  take: Take,
  label: string,
  surah: number,
  first: number,
  last: number,
) {
  const from = take.starts.get(label) ?? 0;
  const lock = take.events.find(({at, event}) => {
    const word = event.observed[0]?.word;
    return (
      at >= from &&
      event.state === 'locked' &&
      word?.surah === surah &&
      word.ayah >= first &&
      word.ayah <= last
    );
  });
  return lock ? lock.at - from : null;
}

// Al-Ikhlas opened with a basmala, then an-Naba opened with a basmala, read from 78:1
// to 78:2 and then from 78:6 to 78:10: a jump of four ayat, past the local search's
// window.
const readAfterOpening: Segment[] = [
  {label: '112:1', phonemes: ayah(112, 1), step: 4},
  {label: '112:2', phonemes: ayah(112, 2)},
  {label: '112:3', phonemes: ayah(112, 3)},
  {label: '112:4', phonemes: ayah(112, 4)},
  {label: 'basmala before 78', phonemes: ayah(1, 1), pause: 25},
  {label: '78:1', phonemes: ayah(78, 1)},
  {label: '78:2', phonemes: ayah(78, 2)},
  {label: '78:6', phonemes: ayah(78, 6), pause: 25},
  {label: '78:7', phonemes: ayah(78, 7)},
  {label: '78:8', phonemes: ayah(78, 8)},
  {label: '78:9', phonemes: ayah(78, 9)},
  {label: '78:10', phonemes: ayah(78, 10)},
];
const opening = (endOnCell: boolean): Segment => ({
  label: 'basmala',
  phonemes: ayah(1, 1),
  pause: 10,
  endOnCell,
});

describe('the Tilawa 1.0 tracker after its first lock', () => {
  let sameCell: Take;
  let laterCell: Take;
  beforeAll(() => {
    sameCell = play([opening(true), ...readAfterOpening]);
    laterCell = play([opening(false), ...readAfterOpening]);
  });

  /** Where the take first locked, and the cell in which its opening basmala ended. */
  const firstLock = (take: Take) => {
    const lock = take.events.find(({event}) => event.state === 'locked')?.event;
    return {
      surah: lock?.observed[0]?.word.surah,
      cell: lock ? cellOfEvent(lock) : null,
      basmalaEnded: cellOfFrame(take.lastFrames.get('basmala') ?? NaN),
    };
  };

  it('first locks in the cell where the opening basmala ends, or in the other take a cell later', () => {
    const same = firstLock(sameCell);
    const later = firstLock(laterCell);
    expect(same.surah).toBe(112);
    expect(later.surah).toBe(112);
    expect(same.cell).toBe(same.basmalaEnded);
    expect(later.cell).toBeGreaterThan(later.basmalaEnded);
  });

  it('locks on a surah opened with a basmala as soon either way', () => {
    const after = phonemesToLock(laterCell, '78:1', 78, 1, 2);
    expect(after).not.toBeNull();
    expect(phonemesToLock(sameCell, '78:1', 78, 1, 2)).toBe(after);
  });

  it('follows a jump of four ayat as soon either way', () => {
    const after = phonemesToLock(laterCell, '78:6', 78, 6, 10);
    expect(after).not.toBeNull();
    expect(phonemesToLock(sameCell, '78:6', 78, 6, 10)).toBe(after);
  });
});
