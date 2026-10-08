const mockInstall = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(undefined);
let mockManaging = true;

jest.mock('@/services/content/contentSync', () => ({
  installContent: (key: string) => mockInstall(key),
  removeContent: (key: string) => mockRemove(key),
  isEngineManagingTafsir: () => mockManaging,
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

import {useTafseerStore} from '../tafseerStore';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';

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
});
