// @ai-generated
/**
 * Labels and notes of the word view's Readings section (pure: no React, no
 * data access). Names come from content:rewayat.people / content:rewayah, the
 * separators and sentences from sheets:wordReadings, in the app language.
 */
// Bare i18next singleton (initialised by '@/i18n' at app start), as in
// RewayahIdentity: these helpers run outside components too.
import i18n from 'i18next';
import {
  getNarratorLabel,
  getQari,
  getQariLabel,
  getShortLabel,
  type QariId,
} from '@/services/rewayah/RewayahIdentity';
import type {
  ReadingsRewayah,
  WordReadings,
} from '@/services/mushaf/wordReadingsFormat';

export interface QariCluster {
  readonly qari: QariId;
  readonly rewayat: readonly ReadingsRewayah[];
}

/** The rewayat of a group under their readers, in member order (the two
 *  narrators of a reader are adjacent in it). */
export function clusterByQari(
  rewayat: readonly ReadingsRewayah[],
): QariCluster[] {
  const clusters: {qari: QariId; rewayat: ReadingsRewayah[]}[] = [];
  for (const rewayah of rewayat) {
    const qari = getQari(rewayah);
    const cluster = clusters.find(c => c.qari === qari);
    if (cluster) cluster.rewayat.push(rewayah);
    else clusters.push({qari, rewayat: [rewayah]});
  }
  return clusters;
}

/** "Hafs, Shu'bah (Asim) · Warsh (Nafi')": narrators by reader. */
export function formatNarrators(rewayat: readonly ReadingsRewayah[]): string {
  const listSeparator = i18n.t('sheets:wordReadings.listSeparator');
  return clusterByQari(rewayat)
    .map(cluster =>
      i18n.t('sheets:wordReadings.narrators', {
        narrators: cluster.rewayat.map(getNarratorLabel).join(listSeparator),
        reader: getQariLabel(cluster.qari),
      }),
    )
    .join(i18n.t('sheets:wordReadings.clusterSeparator'));
}

/** "Warsh, Qalun, Al-Duri (Abu Amr)": standalone rewayah names (notes). */
export function formatNames(rewayat: readonly ReadingsRewayah[]): string {
  return rewayat
    .map(getShortLabel)
    .join(i18n.t('sheets:wordReadings.listSeparator'));
}

export interface ReadingNotes {
  /** The readings cover the next / previous word too (a word one rewayah
   *  writes over two Hafs slots), or null. */
  readonly span: 'next' | 'previous' | null;
  /** Rewayat writing the span as fewer words than Hafs. */
  readonly joined: readonly ReadingsRewayah[];
  /** Rewayat writing it as more words than Hafs. */
  readonly apart: readonly ReadingsRewayah[];
  /** Rewayat that end a verse after the word where Hafs does not. */
  readonly verseEnds: readonly {
    verse: number;
    rewayat: readonly ReadingsRewayah[];
  }[];
  /** Rewayat that end no verse after the word where Hafs does (al-Fatiha's
   *  unnumbered basmala aside: basmalaUnnumbered says it). */
  readonly noVerseEnd: readonly ReadingsRewayah[];
  /** al-Fatiha's basmala is not numbered in these (1:1 only). */
  readonly basmalaUnnumbered: readonly ReadingsRewayah[];
  /** Rewayat with silah in this word. */
  readonly silah: readonly ReadingsRewayah[];
}

/** What the section notes under the readings of the word at `dkPositions`. */
export function readingNotes(
  readings: WordReadings,
  dkPositions: readonly number[],
): ReadingNotes {
  const members = readings.groups.flatMap(g => g.members);
  const hafsWords = readings.hafsText
    ? readings.hafsText.split(' ').length
    : null;
  const joined: ReadingsRewayah[] = [];
  const apart: ReadingsRewayah[] = [];
  const noVerseEnd: ReadingsRewayah[] = [];
  const silah: ReadingsRewayah[] = [];
  const verseEnds = new Map<number, ReadingsRewayah[]>();
  const basmala = new Set(readings.basmalaUnnumberedIn);
  for (const m of members) {
    if (m.wordCount !== null && hafsWords !== null) {
      if (m.wordCount < hafsWords) joined.push(m.rewayah);
      if (m.wordCount > hafsWords) apart.push(m.rewayah);
    }
    if (m.verseEnd === 0 && !basmala.has(m.rewayah)) {
      noVerseEnd.push(m.rewayah);
    } else if (m.verseEnd !== null && m.verseEnd > 0) {
      const list = verseEnds.get(m.verseEnd) ?? [];
      list.push(m.rewayah);
      verseEnds.set(m.verseEnd, list);
    }
    if (m.silahChars.length > 0) silah.push(m.rewayah);
  }
  let span: ReadingNotes['span'] = null;
  if (readings.positions.length > dkPositions.length) {
    span = readings.positions[0] === dkPositions[0] ? 'next' : 'previous';
  }
  return {
    span,
    joined,
    apart,
    verseEnds: [...verseEnds]
      .sort(([a], [b]) => a - b)
      .map(([verse, rewayat]) => ({verse, rewayat})),
    noVerseEnd,
    basmalaUnnumbered: readings.basmalaUnnumberedIn,
    silah,
  };
}
