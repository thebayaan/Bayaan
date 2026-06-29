// @ai-start
// Unit tests for the reciter "download all" bulk helper.
//
// The helper is dependency-injected and free of expo/React Native imports, so
// these tests exercise the real control flow with lightweight mocks.

import {
  bulkDownloadSurahs,
  buildDownloadId,
  type BulkDownloadDeps,
  type BulkDownloadItem,
} from '../bulkDownloadSurahs';

function makeItems(count: number, rewayatId?: string): BulkDownloadItem[] {
  return Array.from({length: count}, (_, i) => ({
    surahId: i + 1,
    reciterId: 'abdul_basit',
    rewayatId,
  }));
}

function makeDeps(overrides: Partial<BulkDownloadDeps> = {}): BulkDownloadDeps {
  return {
    downloadSurah: jest.fn(async (surahId: number) => ({
      filePath: `${surahId}.mp3`,
      fileSize: 1000,
    })),
    isDownloaded: jest.fn(() => false),
    isDownloadedWithRewayat: jest.fn(() => false),
    isDownloading: jest.fn(() => false),
    isDownloadingWithRewayat: jest.fn(() => false),
    setDownloading: jest.fn(),
    clearDownloading: jest.fn(),
    addDownload: jest.fn(),
    setDownloadProgress: jest.fn(),
    ...overrides,
  };
}

// No real delay between downloads so the suite stays fast.
const fast = {interDownloadDelayMs: 0};

describe('buildDownloadId', () => {
  it('omits rewayah when absent', () => {
    expect(buildDownloadId({surahId: 2, reciterId: 'r'})).toBe('r-2');
  });

  it('includes rewayah when present (matching SurahItem)', () => {
    expect(
      buildDownloadId({surahId: 2, reciterId: 'r', rewayatId: 'hafs'}),
    ).toBe('r-2-hafs');
  });
});

describe('bulkDownloadSurahs', () => {
  it('downloads every pending surah and records each one', async () => {
    const deps = makeDeps();
    const summary = await bulkDownloadSurahs(makeItems(3, 'hafs'), deps, fast);

    expect(deps.downloadSurah).toHaveBeenCalledTimes(3);
    expect(deps.addDownload).toHaveBeenCalledTimes(3);
    expect(deps.setDownloading).toHaveBeenCalledWith('abdul_basit-1-hafs');
    expect(deps.clearDownloading).toHaveBeenCalledWith('abdul_basit-1-hafs');
    expect(summary).toEqual({
      total: 3,
      downloaded: 3,
      skipped: 0,
      failed: 0,
      cancelled: false,
    });
  });

  it('skips surahs that are already downloaded', async () => {
    const deps = makeDeps({
      isDownloadedWithRewayat: jest.fn(
        (_reciterId, surahId) => surahId === '2',
      ),
    });
    const summary = await bulkDownloadSurahs(makeItems(3, 'hafs'), deps, fast);

    expect(deps.downloadSurah).toHaveBeenCalledTimes(2);
    expect(summary.skipped).toBe(1);
    expect(summary.downloaded).toBe(2);
  });

  it('continues past a failed download and counts it', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const deps = makeDeps({
      downloadSurah: jest.fn(async (surahId: number) => {
        if (surahId === 2) throw new Error('network error');
        return {filePath: `${surahId}.mp3`, fileSize: 10};
      }),
    });
    const summary = await bulkDownloadSurahs(makeItems(3, 'hafs'), deps, fast);

    expect(summary).toMatchObject({downloaded: 2, failed: 1, cancelled: false});
    expect(deps.addDownload).toHaveBeenCalledTimes(2);
    // downloading state is always cleared, even on failure
    expect(deps.clearDownloading).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });

  it('stops early when cancellation is requested', async () => {
    let processed = 0;
    const deps = makeDeps({
      downloadSurah: jest.fn(async (surahId: number) => {
        processed += 1;
        return {filePath: `${surahId}.mp3`, fileSize: 10};
      }),
    });
    const summary = await bulkDownloadSurahs(makeItems(5, 'hafs'), deps, {
      ...fast,
      isCancelled: () => processed >= 2,
    });

    expect(summary.cancelled).toBe(true);
    expect(summary.downloaded).toBe(2);
    expect(deps.downloadSurah).toHaveBeenCalledTimes(2);
  });

  it('skips items already in flight without downloading again', async () => {
    const deps = makeDeps({
      isDownloadingWithRewayat: jest.fn(
        (_reciterId, surahId) => surahId === '1',
      ),
    });
    const summary = await bulkDownloadSurahs(makeItems(2, 'hafs'), deps, fast);

    expect(deps.downloadSurah).toHaveBeenCalledTimes(1);
    expect(summary.downloaded).toBe(1);
  });

  it('reports aggregate progress over the pending set', async () => {
    const deps = makeDeps();
    const progress: Array<[number, number]> = [];
    await bulkDownloadSurahs(makeItems(2, 'hafs'), deps, {
      ...fast,
      onProgress: (completed, total) => progress.push([completed, total]),
    });

    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('uses non-rewayah queries and IDs when no rewayah is given', async () => {
    const deps = makeDeps();
    await bulkDownloadSurahs(makeItems(1), deps, fast);

    expect(deps.isDownloaded).toHaveBeenCalledWith('abdul_basit', '1');
    expect(deps.setDownloading).toHaveBeenCalledWith('abdul_basit-1');
    expect(deps.addDownload).toHaveBeenCalledWith(
      expect.objectContaining({rewayatId: '', status: 'completed'}),
    );
  });
});
// @ai-end
