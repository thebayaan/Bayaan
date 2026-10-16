import {
  SURAHS,
  availableChips,
  featuredFirst,
  filterSurahs,
  groupRewayat,
  juzForPage,
  juzOfSurah,
  matchesChips,
  pickPlayableRewayah,
  reciterSubtitle,
  recitationStyle,
  rewayahDisplayName,
  rewayahFamily,
  rewayahShortName,
  styleLabel,
  surahsInJuz,
} from './browseCatalog';
import type {Reciter, Rewayah} from '../types/reciter';

function rewayah(
  name: string,
  style = 'murattal',
  surahs: number[] = [1, 2, 3],
  id = `${name}-${style}`,
): Rewayah {
  return {
    id,
    reciter_id: 'r',
    name,
    style,
    server: 'https://example.com/',
    source_type: 'mp3quran',
    surah_total: surahs.length,
    surah_list: surahs,
    mp3quran_read_id: null,
    qdc_reciter_id: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

function reciter(
  name: string,
  rewayat: Rewayah[],
  is_featured = false,
): Reciter {
  return {
    id: name,
    name,
    name_arabic: null,
    date: '',
    image_url: null,
    bio: null,
    slug: name,
    is_featured,
    is_active: true,
    created_at: '',
    updated_at: '',
    rewayat,
  };
}

const surah = (n: number) => SURAHS.find(s => s.id === n)!;

describe('surah filters', () => {
  it('has all 114 surahs', () => {
    expect(filterSurahs('all', 1)).toHaveLength(114);
  });

  it('splits Makki and Madani without overlap', () => {
    const makki = filterSurahs('makki', 1);
    const madani = filterSurahs('madani', 1);
    expect(makki.length + madani.length).toBe(114);
    expect(makki.map(s => s.id)).toContain(1);
    expect(madani.map(s => s.id)).toContain(2);
  });

  it('short surahs are the ones on two pages or fewer', () => {
    const short = filterSurahs('short', 1).map(s => s.id);
    expect(short).toContain(112);
    expect(short).toContain(1);
    expect(short).not.toContain(2);
    expect(short).not.toContain(36);
  });

  it('maps pages to juz', () => {
    expect(juzForPage(1)).toBe(1);
    expect(juzForPage(21)).toBe(1);
    expect(juzForPage(22)).toBe(2);
    expect(juzForPage(604)).toBe(30);
  });

  it('knows every juz a surah spans', () => {
    expect(juzOfSurah(surah(1))).toEqual([1]);
    expect(juzOfSurah(surah(2))).toEqual([1, 2, 3]);
    expect(juzOfSurah(surah(4))).toEqual([4, 5, 6]);
    expect(juzOfSurah(surah(114))).toEqual([30]);
  });

  it('lists the surahs in a juz, in order', () => {
    expect(surahsInJuz(1).map(s => s.id)).toEqual([1, 2]);
    const amma = surahsInJuz(30).map(s => s.id);
    expect(amma[0]).toBe(78);
    expect(amma[amma.length - 1]).toBe(114);
    expect(filterSurahs('juz', 30)).toEqual(surahsInJuz(30));
  });

  it('every surah is in at least one juz and every juz has a surah', () => {
    for (let j = 1; j <= 30; j++) {
      expect(surahsInJuz(j).length).toBeGreaterThan(0);
    }
    SURAHS.forEach(s => expect(juzOfSurah(s).length).toBeGreaterThan(0));
  });
});

describe('rewayat and styles', () => {
  it('classifies rewayah families', () => {
    expect(rewayahFamily("Hafs A'n Assem")).toBe('hafs');
    expect(rewayahFamily("Warsh A'n Nafi' Men Tariq Alazraq")).toBe('warsh');
    expect(rewayahFamily("Qalon A'n Nafi'")).toBe('qalun');
    expect(rewayahFamily("Aldori A'n Abi Amr")).toBe('duri');
    expect(rewayahFamily("AlDorai A'n Al-Kisa'ai")).toBe('duri');
    expect(rewayahFamily("Shu'bah A'n Assem")).toBe('more');
  });

  it('classifies and labels styles', () => {
    expect(recitationStyle('murattal 2')).toBe('murattal');
    expect(recitationStyle('mojawwad')).toBe('mujawwad');
    expect(recitationStyle('molim')).toBe('teaching');
    expect(styleLabel('mojawwad')).toBe('Mujawwad');
    expect(styleLabel('molim')).toBe('Teaching');
    expect(styleLabel('murattal 2')).toBe('Murattal 2');
  });

  it('names rewayat for display', () => {
    expect(rewayahDisplayName("Hafs A'n Assem")).toBe("Hafs 'an 'Asim");
    expect(rewayahShortName("Albizi and Qunbol A'n Ibn Katheer")).toBe(
      'Al-Bazzi & Qunbul',
    );
    expect(rewayahDisplayName('Something New')).toBe('Something New');
    expect(rewayahShortName('Something New')).toBe('Something');
  });

  it('groups a reciter’s rewayat by name with murattal first', () => {
    const groups = groupRewayat([
      rewayah("Warsh A'n Nafi'"),
      rewayah("Hafs A'n Assem", 'mojawwad'),
      rewayah("Hafs A'n Assem", 'murattal'),
    ]);
    expect(groups.map(g => g.label)).toEqual(['Warsh', 'Hafs']);
    expect(groups[1].items.map(r => r.style)).toEqual(['murattal', 'mojawwad']);
  });

  it('uses full names when two groups share a short name', () => {
    const groups = groupRewayat([
      rewayah("Warsh A'n Nafi'"),
      rewayah("Warsh A'n Nafi' Men Tariq Alazraq"),
    ]);
    expect(groups.map(g => g.label)).toEqual([
      "Warsh 'an Nafi'",
      "Warsh 'an Nafi' (al-Azraq)",
    ]);
  });

  it('writes the subtitle under a portrait', () => {
    expect(reciterSubtitle(reciter('a', [rewayah("Hafs A'n Assem")]))).toBe(
      'Hafs',
    );
    expect(
      reciterSubtitle(
        reciter('b', [rewayah("Hafs A'n Assem"), rewayah("Warsh A'n Nafi'")]),
      ),
    ).toBe('Hafs, Warsh');
    expect(
      reciterSubtitle(
        reciter('c', [
          rewayah("Hafs A'n Assem"),
          rewayah("Hafs A'n Assem", 'mojawwad'),
          rewayah("Hafs A'n Assem", 'molim'),
        ]),
      ),
    ).toBe('Hafs · 3 styles');
    expect(
      reciterSubtitle(reciter('d', [rewayah("Hafs A'n Assem", 'mojawwad')])),
    ).toBe('Hafs · Mujawwad');
    expect(reciterSubtitle(reciter('e', []))).toBe('');
  });
});

describe('reciters grid', () => {
  const minshawi = reciter('Mohammed Siddiq Al-Minshawi', [
    rewayah("Hafs A'n Assem"),
    rewayah("Hafs A'n Assem", 'mojawwad'),
  ]);
  const warshOnly = reciter('W', [rewayah("Warsh A'n Nafi'")]);

  it('matches rewayah and style on the same recording', () => {
    expect(matchesChips(minshawi, 'all', null)).toBe(true);
    expect(matchesChips(reciter('empty', []), 'all', null)).toBe(true);
    expect(matchesChips(reciter('empty', []), 'hafs', null)).toBe(false);
    expect(matchesChips(minshawi, 'hafs', 'mujawwad')).toBe(true);
    expect(matchesChips(minshawi, 'warsh', null)).toBe(false);
    expect(matchesChips(warshOnly, 'warsh', 'mujawwad')).toBe(false);
    expect(matchesChips(warshOnly, 'warsh', 'murattal')).toBe(true);
  });

  it('offers only chips the data supports', () => {
    const chips = availableChips([minshawi, warshOnly]);
    expect(chips.rewayah.has('warsh')).toBe(true);
    expect(chips.rewayah.has('qalun')).toBe(false);
    expect(chips.style.has('mujawwad')).toBe(true);
    expect(chips.style.has('teaching')).toBe(false);
  });

  it('puts featured reciters first, in the phone’s order', () => {
    const list = [
      reciter('Zed', []),
      reciter('Mishary Alafasi', []),
      reciter('Flagged', [], true),
      reciter('Albaraa Basfar', []),
    ];
    expect(featuredFirst(list).map(r => r.name)).toEqual([
      'Albaraa Basfar',
      'Mishary Alafasi',
      'Flagged',
      'Zed',
    ]);
  });

  it('prefers Hafs murattal that has the surah when playing', () => {
    const list = [
      rewayah("Warsh A'n Nafi'", 'murattal', [1, 18]),
      rewayah("Hafs A'n Assem", 'mojawwad', [1, 18]),
      rewayah("Hafs A'n Assem", 'murattal', [1, 2]),
    ];
    expect(pickPlayableRewayah(list, 2)?.style).toBe('murattal');
    expect(pickPlayableRewayah(list, 18)?.style).toBe('mojawwad');
    expect(pickPlayableRewayah(list, 99)?.name).toBe("Hafs A'n Assem");
    expect(pickPlayableRewayah([], 1)).toBeNull();
  });
});
