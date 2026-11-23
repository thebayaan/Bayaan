// @ai-generated
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///test/',
  getInfoAsync: jest.fn(async () => ({exists: false})),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(async () => ({status: 200})),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn(async () => []),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({
    bytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
  })),
}));
jest.mock('../QCFColorPalette', () => ({
  withQCFDarkPalette: jest.fn((bytes: Uint8Array) => bytes),
  withoutQCFColor: jest.fn((bytes: Uint8Array) => bytes),
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: {fromURI: jest.fn(async () => ({})), fromBytes: jest.fn(() => ({}))},
    Typeface: {MakeFreeTypeFaceFromData: jest.fn(() => ({face: true}))},
  },
}));

import * as FileSystem from 'expo-file-system/legacy';
import {Skia} from '@shopify/react-native-skia';
import {withQCFDarkPalette, withoutQCFColor} from '../QCFColorPalette';
import {getQCFFontVariant, qcfFontLoader} from '../QCFFontLoader';

const V4_CDN =
  'https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v4-tajweed/ttf';

describe('Mushaf 1440 font variants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('picks tajweed palettes or plain outlines', () => {
    expect(getQCFFontVariant(true, false)).toBe('v4');
    expect(getQCFFontVariant(true, true)).toBe('v4-dark');
    expect(getQCFFontVariant(false, false)).toBe('v4-mono');
    expect(getQCFFontVariant(false, true)).toBe('v4-mono');
  });

  it('downloads a page once for all variants and deduplicates requests', async () => {
    const [day, dayAgain, night, plain] = await Promise.all([
      qcfFontLoader.ensure(2, 'v4'),
      qcfFontLoader.ensure(2, 'v4'),
      qcfFontLoader.ensure(2, 'v4-dark'),
      qcfFontLoader.ensure(2, 'v4-mono'),
    ]);
    expect(dayAgain).toBe(day);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
      `${V4_CDN}/p2.ttf`,
      'file:///test/qcf-fonts/p2-v4.ttf.download',
    );
    // The published file is the day palette; the others are made in memory.
    expect(Skia.Data.fromURI).toHaveBeenCalledTimes(1);
    expect(withQCFDarkPalette).toHaveBeenCalledTimes(1);
    expect(withoutQCFColor).toHaveBeenCalledTimes(1);
    expect(night).toBeTruthy();
    expect(plain).toBeTruthy();
    for (const variant of ['v4', 'v4-dark', 'v4-mono'] as const) {
      expect(qcfFontLoader.isReady(2, variant)).toBe(true);
      expect(qcfFontLoader.peekTypeface(2, variant)).not.toBeNull();
    }
    expect(qcfFontLoader.getTypeface(2, 'v4')).toBe(day);
  });

  it('serves a cached file without downloading it again', async () => {
    jest
      .mocked(FileSystem.getInfoAsync)
      .mockResolvedValueOnce({exists: true, size: 1000} as never);
    await qcfFontLoader.ensure(8, 'v4-mono');
    expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
  });

  it('cleans up failed downloads and allows a retry', async () => {
    jest.mocked(FileSystem.downloadAsync).mockResolvedValueOnce({
      status: 503,
    } as FileSystem.FileSystemDownloadResult);
    await expect(qcfFontLoader.ensure(3, 'v4')).rejects.toThrow('HTTP 503');
    expect(qcfFontLoader.isReady(3, 'v4')).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///test/qcf-fonts/p3-v4.ttf.download',
      {idempotent: true},
    );
    await qcfFontLoader.ensure(3, 'v4');
    expect(qcfFontLoader.isReady(3, 'v4')).toBe(true);
  });

  it('removes a partially downloaded file after a network rejection', async () => {
    jest
      .mocked(FileSystem.downloadAsync)
      .mockRejectedValueOnce(new Error('offline'));
    await expect(qcfFontLoader.ensure(6, 'v4')).rejects.toThrow('offline');
    expect(FileSystem.moveAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///test/qcf-fonts/p6-v4.ttf.download',
      {idempotent: true},
    );
    await qcfFontLoader.ensure(6, 'v4');
    expect(qcfFontLoader.isReady(6, 'v4')).toBe(true);
  });

  it('evicts an unreadable font so a retry can download a fresh copy', async () => {
    jest
      .mocked(Skia.Typeface.MakeFreeTypeFaceFromData)
      .mockReturnValueOnce(null);
    await expect(qcfFontLoader.ensure(7, 'v4')).rejects.toThrow(
      'typeface creation',
    );
    expect(qcfFontLoader.isReady(7, 'v4')).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///test/qcf-fonts/p7-v4.ttf',
      {idempotent: true},
    );
    await qcfFontLoader.ensure(7, 'v4');
    expect(qcfFontLoader.isReady(7, 'v4')).toBe(true);
  });

  it('rejects pages outside the mushaf', async () => {
    await expect(qcfFontLoader.ensure(0)).rejects.toThrow('out of range');
    await expect(qcfFontLoader.ensure(605)).rejects.toThrow('out of range');
  });

  it('keeps the most recently used typefaces only', async () => {
    for (let page = 100; page < 130; page++) {
      await qcfFontLoader.ensure(page, 'v4-mono');
    }
    expect(qcfFontLoader.isReady(129, 'v4-mono')).toBe(true);
    expect(qcfFontLoader.isReady(100, 'v4-mono')).toBe(false);
  });

  it('prefetches neighbours without surfacing their errors', async () => {
    jest
      .mocked(FileSystem.downloadAsync)
      .mockRejectedValueOnce(new Error('offline'));
    qcfFontLoader.prefetch([0, 200, 201, 605], 'v4-mono');
    await new Promise(resolve => setTimeout(resolve, 0));
    await qcfFontLoader.ensure(201, 'v4-mono');
    expect(qcfFontLoader.isReady(201, 'v4-mono')).toBe(true);
  });

  it('deletes the 1421H glyph fonts earlier releases downloaded', async () => {
    jest.resetModules();
    const fs = jest.requireMock('expo-file-system/legacy');
    fs.readDirectoryAsync.mockResolvedValueOnce([
      'QCF2001.ttf',
      'QCF2604.ttf.download',
      'p1-v4.ttf',
    ]);
    const {qcfFontLoader: fresh} = require('../QCFFontLoader');
    await fresh.ensure(1, 'v4');
    await new Promise(resolve => setTimeout(resolve, 0));
    const deleted = fs.deleteAsync.mock.calls.map((call: unknown[]) => call[0]);
    expect(deleted).toContain('file:///test/qcf-fonts/QCF2001.ttf');
    expect(deleted).toContain('file:///test/qcf-fonts/QCF2604.ttf.download');
    expect(deleted).not.toContain('file:///test/qcf-fonts/p1-v4.ttf');
  });
});
