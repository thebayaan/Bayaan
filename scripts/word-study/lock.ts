// @ai-generated
/**
 * scripts/word-study/sources.lock.json: the inputs the word-study builds
 * accept, pinned by SHA-256, with what the app shows about each source.
 * SOURCES.md records how each was obtained and its licence status.
 */
import crypto from 'crypto';
import fs from 'fs';
import type {WordStudySource} from '../../services/wordStudy/wordStudyFormat';

/** What the app shows about a source (one row of a DB's sources table). */
export interface SourceNames {
  nameAr: string;
  nameEn: string;
  authorAr: string;
  authorEn: string;
  viaAr: string;
  viaEn: string;
  /** The link the app gives for the source. */
  url: string;
}

/** A book to keep from a gharib input. */
export interface GharibBookLock extends SourceNames {
  id: number;
  /** Display order (lowest first). */
  ord: number;
  /** The build fails when fewer entries than this share go on words. */
  minPlaced: number;
  /** The printed edition the digital text follows. */
  edition: string;
}

export interface InputLock {
  /** File name of the download as SOURCES.md describes it. */
  file: string;
  url: string;
  sha256: string;
  bytes: number;
  /** The publisher's version of the data. */
  version: string;
  retrieved: string;
  licence: string;
}

export interface GharibInputLock extends InputLock {
  adapter: 'quranpedia-meanings' | 'quranpedia-book' | 'jsonl';
  books: GharibBookLock[];
}

export interface RasmLock extends InputLock, SourceNames {
  adapter: 'tanzil' | 'words-json';
  id: number;
  ord: number;
  /**
   * SHA-256 of the verse lines alone (the copyright block left out). Tanzil
   * writes the current year into the block of every download, so a later
   * download of the same text has another file hash but this one.
   */
  textSha256?: string;
}

export interface SourcesLock {
  __format: 1;
  gharib: GharibInputLock[];
  rasm: RasmLock | null;
}

export function readLock(file: string): SourcesLock {
  const lock = JSON.parse(fs.readFileSync(file, 'utf8')) as SourcesLock;
  if (lock.__format !== 1 || !Array.isArray(lock.gharib)) {
    throw new Error(`${file}: expected {"__format":1,"gharib":[…],"rasm":…}`);
  }
  return lock;
}

export function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function sourceRow(
  kind: WordStudySource['kind'],
  id: number,
  ord: number,
  names: SourceNames,
  version: string,
): WordStudySource {
  return {
    id,
    kind,
    ord,
    nameAr: names.nameAr,
    nameEn: names.nameEn,
    authorAr: names.authorAr,
    authorEn: names.authorEn,
    viaAr: names.viaAr,
    viaEn: names.viaEn,
    url: names.url,
    version,
  };
}

/** The value of --name, or the fallback; throws when required and absent. */
export function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

/** Every value of a repeated --name. */
export function argAll(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
