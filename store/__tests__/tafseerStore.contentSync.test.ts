const mockInstall = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(undefined);
let mockManaging = true;
let mockOffered: ReadonlySet<string> | null = null;

jest.mock('@/services/content/contentSync', () => ({
  installContent: (key: string) => mockInstall(key),
  removeContent: (key: string) => mockRemove(key),
  isEngineManagingTafsir: () => mockManaging,
  getOfferedTafsirIds: async () => mockOffered,
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({
  tafseerDbService: {
    getDownloadedTafaseer: jest.fn().mockResolvedValue([]),
    deleteTafseer: jest.fn().mockResolvedValue(undefined),
    saveTafseer: jest.fn().mockResolvedValue(undefined),
  },
}));
const mockFetchFull = jest.fn();
jest.mock('@/services/tafseer/TafseerApiService', () => ({
  tafseerApiService: {
    fetchFullTafseer: (...args: unknown[]) => mockFetchFull(...args),
  },
}));

import {browsableTafaseer, useTafseerStore} from '../tafseerStore';
import type {DownloadedTafseerMeta, TafseerEdition} from '@/types/tafseer';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {reportInstall} from '@/services/content/installActivity';

const edition = {
  identifier: '169',
  name: 'Ibn Kathir',
  englishName: 'Ibn Kathir',
  language: 'English',
  direction: 'ltr',
};

describe('tafseerStore with content sync', () => {
  beforeEach(() => {
    mockInstall.mockClear();
    mockRemove.mockClear();
    mockFetchFull.mockClear();
    jest.mocked(tafseerDbService.deleteTafseer).mockClear();
    mockManaging = true;
    useTafseerStore.setState({downloadingId: null, downloadProgress: 0});
  });

  it('downloads through the content engine and never calls the legacy provider', async () => {
    await useTafseerStore.getState().downloadTafseer('169');
    expect(mockInstall).toHaveBeenCalledWith('qf:tafsirs:169');
    expect(mockFetchFull).not.toHaveBeenCalled();
    expect(useTafseerStore.getState().downloadingId).toBeNull();
  });

  it('resets state and rethrows when the engine install fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockInstall.mockRejectedValueOnce(new Error('offline'));
    await expect(
      useTafseerStore.getState().downloadTafseer('169'),
    ).rejects.toThrow('offline');
    expect(useTafseerStore.getState().downloadingId).toBeNull();
  });

  it('deletes through the content engine', async () => {
    await useTafseerStore.getState().deleteTafseer('169');
    expect(mockRemove).toHaveBeenCalledWith('qf:tafsirs:169');
    expect(tafseerDbService.deleteTafseer).not.toHaveBeenCalled();
  });

  it('uses the fork provider when the engine is not managing tafsir', async () => {
    mockManaging = false;
    mockFetchFull.mockResolvedValue({edition, verses: []});
    await useTafseerStore.getState().downloadTafseer('169');
    expect(mockFetchFull).toHaveBeenCalled();
    expect(tafseerDbService.saveTafseer).toHaveBeenCalled();
    expect(mockInstall).not.toHaveBeenCalled();
  });

  it('deletes through the local database when the engine is not managing tafsir', async () => {
    mockManaging = false;
    await useTafseerStore.getState().deleteTafseer('169');
    expect(tafseerDbService.deleteTafseer).toHaveBeenCalledWith('169');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('selects the downloaded tafsir when the selection is not installed (engine and fork paths)', async () => {
    jest
      .mocked(tafseerDbService.getDownloadedTafaseer)
      .mockResolvedValue([{...edition, identifier: '16'} as never]);
    for (const managing of [true, false]) {
      mockManaging = managing;
      mockFetchFull.mockResolvedValue({
        edition: {...edition, identifier: '16'},
        verses: [],
      });
      useTafseerStore.setState({selectedTafseerId: '169'});
      await useTafseerStore.getState().downloadTafseer('16');
      expect(useTafseerStore.getState().selectedTafseerId).toBe('16');
    }
    jest.mocked(tafseerDbService.getDownloadedTafaseer).mockResolvedValue([]);
  });

  it('keeps an installed selection on the fork path', async () => {
    mockManaging = false;
    jest
      .mocked(tafseerDbService.getDownloadedTafaseer)
      .mockResolvedValue([
        edition as never,
        {...edition, identifier: '16'} as never,
      ]);
    mockFetchFull.mockResolvedValue({
      edition: {...edition, identifier: '16'},
      verses: [],
    });
    useTafseerStore.setState({selectedTafseerId: '169'});
    await useTafseerStore.getState().downloadTafseer('16');
    expect(useTafseerStore.getState().selectedTafseerId).toBe('169');
    jest.mocked(tafseerDbService.getDownloadedTafaseer).mockResolvedValue([]);
  });
});

describe('tafseerStore during an engine auto-install', () => {
  beforeEach(() => {
    mockInstall.mockClear();
    mockManaging = true;
    useTafseerStore.setState({downloadingId: null, downloadProgress: 0});
  });

  it('shows the auto-install as downloading (indeterminate) until it finishes', async () => {
    let finish: () => void = () => undefined;
    const running = reportInstall(
      'qf:tafsirs:169',
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    expect(useTafseerStore.getState()).toMatchObject({
      downloadingId: '169',
      downloadProgress: 0,
    });
    finish();
    await running;
    expect(useTafseerStore.getState().downloadingId).toBeNull();
  });

  it('clears the indicator when the auto-install fails', async () => {
    await expect(
      reportInstall('qf:tafsirs:169', () => Promise.reject(new Error('x'))),
    ).rejects.toThrow('x');
    expect(useTafseerStore.getState().downloadingId).toBeNull();
  });

  it('leaves a user download indicator alone', async () => {
    useTafseerStore.setState({downloadingId: '16'});
    await reportInstall('qf:tafsirs:169', () => Promise.resolve());
    expect(useTafseerStore.getState().downloadingId).toBe('16');
  });

  it('a user request for the in-flight key joins it instead of being dropped', async () => {
    let finish: () => void = () => undefined;
    const running = reportInstall(
      'qf:tafsirs:169',
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const joined = useTafseerStore.getState().downloadTafseer('169');
    // A different tafsir is still refused while the indicator is busy.
    await useTafseerStore.getState().downloadTafseer('16');
    expect(mockInstall).toHaveBeenCalledTimes(1);
    expect(mockInstall).toHaveBeenCalledWith('qf:tafsirs:169');
    finish();
    await running;
    await joined;
    expect(useTafseerStore.getState().downloadingId).toBeNull();
  });
});

describe('tafsir catalog offered by the manifest', () => {
  const catalog: TafseerEdition[] = ['169', '15', '16', '17'].map(
    identifier => ({
      identifier,
      language: 'English',
      name: identifier,
      englishName: identifier,
      format: 'text',
      type: 'tafsir',
      direction: 'ltr',
    }),
  );
  const ids = (list: {identifier: string}[]): string[] =>
    list.map(item => item.identifier);

  it('hides withdrawn and absent keys when a manifest is cached', () => {
    // The manifest offers 169 and 16; 15 is withdrawn and 17 is absent.
    const offered = new Set(['169', '16']);
    expect(ids(browsableTafaseer(catalog, new Set(), offered))).toEqual([
      '169',
      '16',
    ]);
  });

  it('shows the full catalog when no manifest is known', () => {
    expect(ids(browsableTafaseer(catalog, new Set(), null))).toEqual([
      '169',
      '15',
      '16',
      '17',
    ]);
  });

  it('leaves installed tafsirs to the installed sections', () => {
    expect(
      ids(browsableTafaseer(catalog, new Set(['15']), new Set(['16']))),
    ).toEqual(['16']);
  });

  it('loads the offered ids without touching installed metadata', async () => {
    const installed: DownloadedTafseerMeta[] = [
      {
        identifier: '15',
        name: 'Tabari',
        englishName: 'Tabari',
        language: 'Arabic',
        direction: 'rtl',
        downloadedAt: 1,
        verseCount: 6236,
      },
    ];
    useTafseerStore.setState({
      downloadedMeta: installed,
      selectedTafseerId: '15',
    });
    mockOffered = new Set(['169']);
    await useTafseerStore.getState().loadOfferedTafsirs();
    expect(useTafseerStore.getState()).toMatchObject({
      offeredTafsirIds: new Set(['169']),
      downloadedMeta: installed,
      selectedTafseerId: '15',
    });
    mockOffered = null;
    await useTafseerStore.getState().loadOfferedTafsirs();
    expect(useTafseerStore.getState().offeredTafsirIds).toBeNull();
  });
});
