// What the Tilawa 1.0 engine hands the app, in the app's word numbers (0-based,
// the same split as the 0.4 engine and the app's text; see v1/__tests__/reference).

export type V1MarkClass =
  | 'wrong_word'
  | 'omitted_word'
  | 'added_word'
  | 'skipped_passage';

export type V1MarkState = 'suspected' | 'confirmed' | 'resolved' | 'uncertain';

/** One state of one of Tilawa's possible mistakes. */
export interface V1Mark {
  /** Stays the same across the mistake's states. */
  id: string;
  state: V1MarkState;
  errorClass: V1MarkClass;
  surah: number;
  ayah: number;
  /** 0-based word in the ayah. */
  word: number;
  /** Words in the ayah. */
  totalWords: number;
  /** Seconds of the take's audio when Tilawa raised this state. */
  audioTime: number;
  /** Tilawa's mean decoder confidence. */
  confidence: number;
}

export interface V1MarkMessage extends V1Mark {
  type: 'v1_mark';
}

/** Where the follower put a word: seconds of the take's audio. */
export interface WordTime {
  /** When it first became the word being recited. */
  from: number;
  /** When it last was, or when the next word took over. */
  to: number;
}

/** What Tilawa's position events said about the take so far. */
export interface V1Timeline {
  /** By `surah:ayah:word` (0-based word). */
  words: ReadonlyMap<string, WordTime>;
  /** Seconds when the follower first locked on a word of this ayah, by `surah:ayah`. */
  ayahEntered: ReadonlyMap<string, number>;
  /** Every place the follower locked on, in order, as `[seconds, word]`. */
  path: readonly (readonly [
    number,
    {surah: number; ayah: number; word: number},
  ])[];
}
