import type {QfSnapshot} from '@/types/content';
import type {TafseerVerse} from '@/types/tafseer';

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;

interface Row {
  verseId: number;
  verseKey: string;
  surah: number;
  ayah: number;
  text: string;
}

function toRow(record: Record<string, unknown>): Row | null {
  const key = record.verse_key;
  if (typeof key !== 'string') return null;
  const match = VERSE_KEY.exec(key);
  if (!match) return null;
  return {
    verseId: typeof record.verse_id === 'number' ? record.verse_id : 0,
    verseKey: key,
    surah: Number(match[1]),
    ayah: Number(match[2]),
    text: typeof record.text === 'string' ? record.text : '',
  };
}

// Same output contract as QuranComTafsirProvider: every member of a verse group
// carries the leader's text and range, so getTafseerForVerse stays unchanged.
export function parseTafsirSnapshot(snapshot: QfSnapshot): TafseerVerse[] {
  const rows = snapshot.records
    .map(toRow)
    .filter((row): row is Row => row !== null)
    .sort((a, b) => a.verseId - b.verseId);

  const groups: {leader: Row; members: Row[]}[] = [];
  for (const row of rows) {
    if (row.text.trim()) groups.push({leader: row, members: [row]});
    else if (groups.length > 0) groups[groups.length - 1].members.push(row);
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
