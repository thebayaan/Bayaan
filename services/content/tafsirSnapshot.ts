import type {QfSnapshot} from '@/types/content';
import type {TafseerVerse} from '@/types/tafseer';

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;
const SURAH_COUNT = 114;

interface Row {
  verseKey: string;
  surah: number;
  ayah: number;
  text: string;
}

// A record placed in verse order. `row` is null when the record is unusable;
// `breaksGroup` marks an unusable record that may have been a group head, so
// the rows after it must not inherit the previous head.
interface Entry {
  verseId: number;
  index: number;
  row: Row | null;
  breaksGroup: boolean;
}

function parseVerseKey(value: unknown): {surah: number; ayah: number} | null {
  if (typeof value !== 'string') return null;
  const match = VERSE_KEY.exec(value);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > SURAH_COUNT || ayah < 1) return null;
  return {surah, ayah};
}

function toEntry(record: Record<string, unknown>, index: number): Entry | null {
  const verseId = record.verse_id;
  // Without a finite verse_id the record cannot be placed in verse order.
  if (typeof verseId !== 'number' || !Number.isFinite(verseId)) return null;
  const text = record.text;
  const position = parseVerseKey(record.verse_key);
  if (typeof text !== 'string' || !position) {
    const maybeHead = typeof text !== 'string' || text.trim() !== '';
    return {verseId, index, row: null, breaksGroup: maybeHead};
  }
  const verseKey = `${position.surah}:${position.ayah}`;
  return {
    verseId,
    index,
    row: {verseKey, ...position, text},
    breaksGroup: false,
  };
}

function byVerseOrder(a: Entry, b: Entry): number {
  return a.verseId - b.verseId || a.index - b.index;
}

// Duplicate verse keys would violate the tafaseer primary key. Keep the first
// in verse order, unless only a later duplicate carries text.
function dedupe(entries: Entry[]): Entry[] {
  const chosen = new Map<string, Entry>();
  for (const entry of entries) {
    if (!entry.row) continue;
    const current = chosen.get(entry.row.verseKey);
    const currentEmpty = current?.row?.text.trim() === '';
    if (!current || (currentEmpty && entry.row.text.trim() !== '')) {
      chosen.set(entry.row.verseKey, entry);
    }
  }
  return entries.filter(
    entry => !entry.row || chosen.get(entry.row.verseKey) === entry,
  );
}

// Same output contract as QuranComTafsirProvider: every member of a verse group
// carries the leader's text and range, so getTafseerForVerse stays unchanged.
export function parseTafsirSnapshot(snapshot: QfSnapshot): TafseerVerse[] {
  const entries = dedupe(
    snapshot.records
      .map(toEntry)
      .filter((entry): entry is Entry => entry !== null)
      .sort(byVerseOrder),
  );

  const groups: {leader: Row; members: Row[]}[] = [];
  let current: {leader: Row; members: Row[]} | null = null;
  for (const {row, breaksGroup} of entries) {
    if (!row) {
      if (breaksGroup) current = null;
      continue;
    }
    if (row.text.trim()) {
      current = {leader: row, members: [row]};
      groups.push(current);
    } else if (current) {
      current.members.push(row);
    }
  }

  const verses: TafseerVerse[] = [];
  for (const {leader, members} of groups) {
    const toAyah = members[members.length - 1].ayah;
    for (const member of members) {
      verses.push({
        surahNumber: member.surah,
        ayahNumber: member.ayah,
        verseKey: member.verseKey,
        text: leader.text,
        groupVerseKey: leader.verseKey,
        fromAyah: leader.ayah,
        toAyah,
      });
    }
  }
  return verses;
}
