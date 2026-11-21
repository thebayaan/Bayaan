// @ai-generated
/**
 * Readers (qurra') and narrators of the 20 rewayat: getQari agrees with the
 * registry's teacher, and the reader / narrator names resolve in en and ar.
 */
import i18n from 'i18next';
import {getAllRewayatWithCounts, getRewayatPersonLabel} from '@/data/rewayat';
import {
  ALL_REWAYAH_IDS,
  getNarratorLabel,
  getQari,
  getQariLabel,
  getShortLabel,
  resolveRewayahFromEntry,
  type RewayahId,
} from '../RewayahIdentity';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('getQari', () => {
  it("is total over the 20 slugs and equals each registry entry's teacher", () => {
    const byId = new Map(
      getAllRewayatWithCounts()
        .map(entry => [resolveRewayahFromEntry(entry), entry] as const)
        .filter((pair): pair is [RewayahId, (typeof pair)[1]] => !!pair[0]),
    );
    expect(byId.size).toBe(ALL_REWAYAH_IDS.length);
    for (const id of ALL_REWAYAH_IDS) {
      const entry = byId.get(id);
      if (!entry) throw new Error(`no registry entry for ${id}`);
      // Both sides go through content:rewayat.people, so equal labels mean
      // the same reader.
      expect(getQariLabel(getQari(id))).toBe(
        getRewayatPersonLabel(entry.teacher),
      );
      expect(getNarratorLabel(id)).toBe(getRewayatPersonLabel(entry.student));
    }
  });

  it('pairs the narrators of each reader', () => {
    expect(getQari('hafs')).toBe('asim');
    expect(getQari('shubah')).toBe('asim');
    expect(getQari('al-bazzi')).toBe('ibnKathir');
    expect(getQari('qunbul')).toBe('ibnKathir');
    expect(getQari('warsh')).toBe('nafi');
    expect(getQari('qalun')).toBe('nafi');
    expect(getQari('al-duri-abi-amr')).toBe('abuAmr');
    expect(getQari('al-susi')).toBe('abuAmr');
    expect(getQari('al-duri-al-kisai')).toBe('kisai');
  });
});

describe('labels', () => {
  const resolved = (label: string) =>
    label.length > 0 && !label.includes('rewayat.people');

  it('resolve to names, not keys, in English and Arabic', async () => {
    for (const lang of ['en', 'ar']) {
      await i18n.changeLanguage(lang);
      for (const id of ALL_REWAYAH_IDS) {
        expect(resolved(getQariLabel(getQari(id)))).toBe(true);
        expect(resolved(getNarratorLabel(id))).toBe(true);
      }
    }
  });

  it("names al-Duri without his reader (no doubled parentheses in a reader's list)", async () => {
    expect(getShortLabel('al-duri-abi-amr')).toBe('Al-Duri (Abu Amr)');
    expect(getNarratorLabel('al-duri-abi-amr')).toBe('Al-Duri');
    expect(getNarratorLabel('al-duri-al-kisai')).toBe('Al-Duri');
    expect(getQariLabel('abuAmr')).toBe('Abu Amr');
    expect(getNarratorLabel('al-duri-abi-amr')).not.toMatch(/[()]/);

    await i18n.changeLanguage('ar');
    expect(getNarratorLabel('al-duri-abi-amr')).toBe('الدوري');
    expect(getNarratorLabel('hafs')).toBe('حفص');
    expect(getQariLabel('asim')).toBe('عاصم');
    expect(getNarratorLabel('al-duri-abi-amr')).not.toMatch(/[()]/);
  });
});
