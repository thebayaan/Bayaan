// @ai-generated
/**
 * The Arabic meaning (gharib) of the selected word: each book entry whose
 * span covers it, with the book's name. Verse-level entries (placed on no
 * word) are never shown here. Renders nothing when there is none, which is
 * the normal state for many words.
 *
 * The Quran words quoted for a multi-word span are the app's own
 * (`wordTextOf`); the data supplies only the book's text.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {GharibEntry} from '@/services/wordStudy/wordStudyFormat';
import {useWordStudyStyles} from './styles';
import {cutText, isolate, pickBilingualText} from './text';

/** Glosses longer than this are cut, with Show more. */
const LONG_GLOSS = 400;

interface GharibSectionProps {
  /** Entries of the word's verse (gharibForWord's, or all of them). */
  entries: GharibEntry[];
  /** The selected word (word-by-word numbering). */
  position: number;
  /** The app's text of a word of the same verse; undefined if damaged. */
  wordTextOf: (position: number) => string | undefined;
}

export const GharibSection: React.FC<GharibSectionProps> = ({
  entries,
  position,
  wordTextOf,
}) => {
  const {t} = useTranslation(['sheets', 'common']);
  const styles = useWordStudyStyles();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const shown = useMemo(
    () =>
      entries.filter(
        e => e.span !== null && e.span[0] <= position && position <= e.span[1],
      ),
    [entries, position],
  );
  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!shown.length) return null;
  const vias = [
    ...new Set(
      shown.map(e => pickBilingualText(e.source.viaAr, e.source.viaEn)),
    ),
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {t('wordStudy.gharib.title')}
      </Text>
      {shown.map((entry, i) => {
        const key = `${entry.source.id}:${entry.ord}`;
        const quote = spanQuote(entry, wordTextOf);
        const long = entry.gloss.length > LONG_GLOSS;
        const open = expanded.has(key);
        return (
          <View key={key} style={[styles.entry, i > 0 && styles.entryBorder]}>
            <Text style={styles.arabic}>
              {quote ? (
                <Text style={styles.arabicBold}>{`«${quote}» `}</Text>
              ) : null}
              {long && !open ? cutText(entry.gloss, LONG_GLOSS) : entry.gloss}
            </Text>
            <Text style={styles.bookLine}>
              {`${entry.source.nameAr} — ${entry.source.authorAr}`}
            </Text>
            {long ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={{top: 13, bottom: 13, left: 8, right: 8}}
                onPress={() => toggle(key)}>
                <Text style={styles.more}>
                  {t(
                    open
                      ? 'common:actions.showLess'
                      : 'common:actions.showMore',
                  )}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {vias.map(via => (
        <Text key={via} style={styles.source}>
          {t('wordStudy.gharib.sources', {source: isolate(via)})}
        </Text>
      ))}
    </View>
  );
};

/**
 * The app's words of a span longer than one word, or null (one word, or a
 * word of the span whose text is damaged).
 */
function spanQuote(
  entry: GharibEntry,
  wordTextOf: (position: number) => string | undefined,
): string | null {
  if (!entry.span || entry.span[1] <= entry.span[0]) return null;
  const words: string[] = [];
  for (let p = entry.span[0]; p <= entry.span[1]; p++) {
    const text = wordTextOf(p);
    if (!text) return null;
    words.push(text);
  }
  return words.join(' ');
}
