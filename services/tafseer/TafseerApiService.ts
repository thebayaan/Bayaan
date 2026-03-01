import type {TafseerEdition} from '@/types/tafseer';

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
  text: string;
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

export interface TafseerVerse {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  text: string;
  groupVerseKey?: string;
  fromAyah?: number;
  toAyah?: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

class TafseerApiService {
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
  ): Promise<{
    edition: TafseerEdition;
    verses: TafseerVerse[];
  }> {
    onProgress?.(0);

    // Fetch edition info from available list
    const editions = await this.fetchAvailableEditions();
    const edition = editions.find(e => e.identifier === editionId);
    if (!edition) {
      throw new Error(`Tafseer edition not found: ${editionId}`);
    }

    const verses: TafseerVerse[] = [];

    for (let ch = 1; ch <= 114; ch++) {
      const chapterVerses = await this.fetchChapterTafseer(editionId, ch);
      verses.push(...chapterVerses);
      onProgress?.(ch / 114);
    }

    return {edition, verses};
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

    // Detect verse groups: empty-text entries belong to the previous non-empty entry
    const groups: {leader: QFTafsirVerse; members: QFTafsirVerse[]}[] = [];
    for (const entry of raw) {
      if (entry.text.trim()) {
        groups.push({leader: entry, members: [entry]});
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

export const tafseerApiService = new TafseerApiService();
