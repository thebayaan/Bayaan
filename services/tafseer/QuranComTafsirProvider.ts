import type {TafseerEdition, TafseerVerse} from '@/types/tafseer';
import type {TafsirProvider} from '@/types/TafsirProvider';

/**
 * RFC-009 — Bayaan's default `TafsirProvider`, backed by the
 * api.quran.com (Quran.com / QF) public API. Extracted verbatim from the
 * former `TafseerApiService` class body; behaviour is unchanged.
 */

const API_BASE = 'https://api.quran.com/api/v4';

const RTL_LANGUAGES = new Set([
  'arabic',
  'urdu',
  'kurdish',
  'persian',
  'pashto',
]);

interface QFTafsirResource {
  id: number;
  name: string;
  author_name: string;
  slug: string;
  language_name: string;
}

interface QFTafsirVerse {
  resource_id: number;
  verse_key: string;
  // `text` is typed as `string` by QF's OpenAPI spec but the response is
  // cast unvalidated, and empty grouped-verse slots have been observed
  // returning `null` in the wild. The fetch path null-guards `.trim()`
  // (see `fetchChapterTafseer`).
  text: string | null;
}

interface QFPagination {
  per_page: number;
  current_page: number;
  next_page: number | null;
  total_pages: number;
  total_records: number;
}

interface QFTafsirResponse {
  tafsirs: QFTafsirVerse[];
  pagination: QFPagination;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

class QuranComTafsirProvider implements TafsirProvider {
  async fetchAvailableEditions(): Promise<TafseerEdition[]> {
    const res = await fetch(`${API_BASE}/resources/tafsirs`);
    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as {tafsirs: QFTafsirResource[]};

    return json.tafsirs.map(t => {
      const lang = capitalize(t.language_name);
      return {
        identifier: String(t.id),
        language: lang,
        name: t.name,
        englishName: t.name,
        authorName: t.author_name,
        format: 'text',
        type: 'tafsir',
        direction: RTL_LANGUAGES.has(t.language_name.toLowerCase())
          ? ('rtl' as const)
          : ('ltr' as const),
      };
    });
  }

  async fetchFullTafseer(
    editionId: string,
    onProgress?: (progress: number) => void,
    edition?: TafseerEdition,
  ): Promise<{
    edition: TafseerEdition;
    verses: TafseerVerse[];
  }> {
    onProgress?.(0);

    // Resolve the edition. Callers that already have it in scope (e.g.
    // from `AVAILABLE_TAFASEER`) can pass it to skip the extra network
    // round-trip; otherwise we look it up from the live editions list.
    let resolvedEdition: TafseerEdition;
    if (edition && edition.identifier === editionId) {
      resolvedEdition = edition;
    } else {
      const editions = await this.fetchAvailableEditions();
      const found = editions.find(e => e.identifier === editionId);
      if (!found) {
        throw new Error(`Tafseer edition not found: ${editionId}`);
      }
      resolvedEdition = found;
    }

    const verses: TafseerVerse[] = [];

    for (let ch = 1; ch <= 114; ch++) {
      const chapterVerses = await this.fetchChapterTafseer(editionId, ch);
      verses.push(...chapterVerses);
      onProgress?.(ch / 114);
    }

    return {edition: resolvedEdition, verses};
  }

  private async fetchChapterTafseer(
    tafsirId: string,
    chapterNumber: number,
  ): Promise<TafseerVerse[]> {
    const raw: QFTafsirVerse[] = [];
    let page = 1;

    while (true) {
      const url = `${API_BASE}/tafsirs/${tafsirId}/by_chapter/${chapterNumber}?page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as QFTafsirResponse;
      raw.push(...json.tafsirs);

      if (!json.pagination.next_page) break;
      page = json.pagination.next_page;
    }

    // Detect verse groups: empty-text entries belong to the previous non-empty entry.
    // `entry.text` is typed `string` by QF's spec but the response is cast
    // unvalidated; treat `null` / `undefined` / whitespace as empty so an
    // unexpected `null` doesn't throw and abort the chapter download mid-flight.
    // The leader carries a narrowed non-null `text` so downstream consumers
    // don't have to re-check.
    type GroupLeader = QFTafsirVerse & {text: string};
    const groups: {leader: GroupLeader; members: QFTafsirVerse[]}[] = [];
    for (const entry of raw) {
      const trimmed = entry.text?.trim();
      if (trimmed) {
        groups.push({
          leader: {...entry, text: entry.text as string},
          members: [entry],
        });
      } else if (groups.length > 0) {
        groups[groups.length - 1].members.push(entry);
      }
    }

    // Flatten groups into TafseerVerse array with range info
    const verses: TafseerVerse[] = [];
    for (const group of groups) {
      const leaderParts = group.leader.verse_key.split(':');
      const leaderAyah = parseInt(leaderParts[1], 10);
      const lastMember = group.members[group.members.length - 1];
      const lastAyah = parseInt(lastMember.verse_key.split(':')[1], 10);

      for (const member of group.members) {
        const parts = member.verse_key.split(':');
        verses.push({
          surahNumber: parseInt(parts[0], 10),
          ayahNumber: parseInt(parts[1], 10),
          verseKey: member.verse_key,
          text: group.leader.text,
          groupVerseKey: group.leader.verse_key,
          fromAyah: leaderAyah,
          toAyah: lastAyah,
        });
      }
    }

    return verses;
  }
}

export const quranComTafsirProvider = new QuranComTafsirProvider();
