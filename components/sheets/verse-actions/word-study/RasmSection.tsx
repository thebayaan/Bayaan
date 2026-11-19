// @ai-generated
/**
 * The rasm of the selected word: its mushaf spelling (the app's own text),
 * its standard (imla'i) spelling with the differing letters marked, and one
 * line per difference. Only confirmed notes are shown (RasmBasis); renders
 * nothing when there is none.
 */
import React from 'react';
import {Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  shownRasmNotes,
  type RasmKind,
  type RasmNote,
  type WordRasm,
} from '@/services/wordStudy/wordStudyFormat';
import {useWordStudyStyles} from './styles';
import {isolate, markRuns, pickBilingualText} from './text';

interface RasmSectionProps {
  rasm: WordRasm | null;
  /**
   * The app's text of the unit (its words from..to); undefined for a
   * damaged word, which leaves the Mushaf row out.
   */
  uthmani: string | undefined;
}

type T = ReturnType<typeof useTranslation<'sheets'>>['t'];

export const RasmSection: React.FC<RasmSectionProps> = ({rasm, uthmani}) => {
  const {t} = useTranslation('sheets');
  const styles = useWordStudyStyles();
  const notes = rasm ? shownRasmNotes(rasm) : [];
  if (!rasm || !notes.length) return null;

  const runs = markRuns(
    rasm.imlaei,
    notes.flatMap(n => (n.mark ? [n.mark] : [])),
  );
  const via = pickBilingualText(rasm.source.viaAr, rasm.source.viaEn);

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {t('wordStudy.rasm.title')}
      </Text>
      {uthmani ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('wordStudy.rasm.uthmani')}</Text>
          <Text style={styles.value}>{uthmani}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.label}>{t('wordStudy.rasm.imlaei')}</Text>
        <Text style={styles.value}>
          {runs.map((run, i) =>
            run.marked ? (
              <Text key={i} style={styles.mark}>
                {run.text}
              </Text>
            ) : (
              run.text
            ),
          )}
        </Text>
      </View>
      {notes.map((note, i) => (
        <Text key={i} style={styles.note}>
          <Text style={styles.noteKind}>{kindLabel(t, note.kind)}</Text>
          {': '}
          {noteText(t, note)}
        </Text>
      ))}
      <Text style={styles.source}>
        {t('wordStudy.rasm.sources', {source: isolate(via)})}
      </Text>
    </View>
  );
};

/** A letter as a note quotes it: «ا», isolated from the sentence. */
const letter = (value: string) => isolate(`«${value}»`);

// The keys are literal so that the extractor sees each of them.
function kindLabel(t: T, kind: RasmKind): string {
  switch (kind) {
    case 'hadhf':
      return t('wordStudy.rasm.kind.hadhf');
    case 'ziyada':
      return t('wordStudy.rasm.kind.ziyada');
    case 'badal':
      return t('wordStudy.rasm.kind.badal');
    case 'hamz':
      return t('wordStudy.rasm.kind.hamz');
    case 'wasl':
      return t('wordStudy.rasm.kind.wasl');
    case 'fasl':
      return t('wordStudy.rasm.kind.fasl');
  }
}

function noteText(t: T, note: RasmNote): string {
  switch (note.kind) {
    case 'hadhf':
      return t('wordStudy.rasm.note.hadhf', {letter: letter(note.standard)});
    case 'ziyada':
      return t('wordStudy.rasm.note.ziyada', {letter: letter(note.mushaf)});
    case 'badal':
      return t('wordStudy.rasm.note.badal', {
        standard: letter(note.standard),
        mushaf: letter(note.mushaf),
      });
    case 'hamz':
      return t('wordStudy.rasm.note.hamz', {
        standard: letter(note.standard),
        mushaf: letter(note.mushaf),
      });
    case 'wasl':
      return t('wordStudy.rasm.note.wasl');
    case 'fasl':
      return t('wordStudy.rasm.note.fasl');
  }
}
