// @ai-start
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///test/',
  getInfoAsync: jest.fn(async () => ({exists: false})),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(async () => ({status: 200})),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({
    bytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
  })),
}));
jest.mock('../QCFColorPalette', () => ({
  withQCFDarkPalette: jest.fn((bytes: Uint8Array) => bytes),
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: {fromURI: jest.fn(async () => ({})), fromBytes: jest.fn(() => ({}))},
    Typeface: {MakeFreeTypeFaceFromData: jest.fn(() => ({}))},
  },
}));

import * as FileSystem from 'expo-file-system/legacy';
import {Skia, type SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {withQCFDarkPalette} from '../QCFColorPalette';
import {qcfFontLoader} from '../QCFFontLoader';

const registerFont = jest.fn();
const fontMgr = {registerFont} as unknown as SkTypefaceFontProvider;

describe('QCF font variants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads V4 independently of a ready V2 font and deduplicates concurrent requests', async () => {
    await qcfFontLoader.ensure(2, fontMgr);
    expect(qcfFontLoader.isReady(2, fontMgr, 'v4')).toBe(false);
    await Promise.all([
      qcfFontLoader.ensure(2, fontMgr, 'v4'),
      qcfFontLoader.ensure(2, fontMgr, 'v4'),
    ]);
    expect(registerFont.mock.calls.map(call => call[1])).toEqual([
      'p2-v2',
      'p2-v4',
    ]);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
    expect(FileSystem.downloadAsync).toHaveBeenLastCalledWith(
      'https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v4-tajweed/ttf/p2.ttf',
      'file:///test/qcf-fonts/p2-v4.ttf.download',
    );
    expect(qcfFontLoader.isReady(2, fontMgr, 'v4-dark')).toBe(false);
    await qcfFontLoader.ensure(2, fontMgr);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('cleans up failed downloads and allows a retry', async () => {
    jest.mocked(FileSystem.downloadAsync).mockResolvedValueOnce({
      status: 503,
    } as FileSystem.FileSystemDownloadResult);
    await expect(qcfFontLoader.ensure(3, fontMgr, 'v4')).rejects.toThrow(
      'HTTP 503',
    );
    expect(qcfFontLoader.isReady(3, fontMgr, 'v4')).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///test/qcf-fonts/p3-v4.ttf.download',
      {idempotent: true},
    );
    await qcfFontLoader.ensure(3, fontMgr, 'v4');
    expect(qcfFontLoader.isReady(3, fontMgr, 'v4')).toBe(true);
  });

  it('registers the font with each provider while sharing its download', async () => {
    const other = {
      registerFont: jest.fn(),
    } as unknown as SkTypefaceFontProvider;
    await Promise.all([
      qcfFontLoader.ensure(4, fontMgr, 'v4'),
      qcfFontLoader.ensure(4, other, 'v4'),
    ]);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
    expect(other.registerFont).toHaveBeenCalledTimes(1);
    expect(registerFont).toHaveBeenCalledTimes(1);
    expect(qcfFontLoader.isReady(4, other, 'v4')).toBe(true);
  });

  it('shares the V4 file across day/night but registers separate palettes', async () => {
    await Promise.all([
      qcfFontLoader.ensure(5, fontMgr, 'v4'),
      qcfFontLoader.ensure(5, fontMgr, 'v4-dark'),
    ]);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
    expect(withQCFDarkPalette).toHaveBeenCalledTimes(1);
    expect(registerFont.mock.calls.map(call => call[1]).sort()).toEqual([
      'p5-v4',
      'p5-v4-dark',
    ]);
  });

  it('removes a partially downloaded file after a network rejection', async () => {
    jest
      .mocked(FileSystem.downloadAsync)
      .mockRejectedValueOnce(new Error('offline'));
    await expect(qcfFontLoader.ensure(6, fontMgr, 'v4')).rejects.toThrow(
      'offline',
    );
    expect(FileSystem.moveAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///test/qcf-fonts/p6-v4.ttf.download',
      {idempotent: true},
    );
    await qcfFontLoader.ensure(6, fontMgr, 'v4');
    expect(qcfFontLoader.isReady(6, fontMgr, 'v4')).toBe(true);
  });

  it('evicts an unreadable font so a retry can download a fresh copy', async () => {
    jest
      .mocked(Skia.Typeface.MakeFreeTypeFaceFromData)
      .mockReturnValueOnce(null);
    await expect(qcfFontLoader.ensure(7, fontMgr, 'v4')).rejects.toThrow(
      'typeface creation',
    );
    expect(qcfFontLoader.isReady(7, fontMgr, 'v4')).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///test/qcf-fonts/p7-v4.ttf',
      {idempotent: true},
    );
    await qcfFontLoader.ensure(7, fontMgr, 'v4');
    expect(qcfFontLoader.isReady(7, fontMgr, 'v4')).toBe(true);
  });
});
// @ai-end
