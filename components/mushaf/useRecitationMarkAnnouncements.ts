import {useEffect, useRef} from 'react';
import {AccessibilityInfo} from 'react-native';
import {useTranslation} from 'react-i18next';
import {recitationMarkRef} from '@/components/sheets/recitationMarkRef';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {wordMarkKey} from '@/services/recitation/wordMarks';
import {
  isTakeActive,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';
import {dkWordPosition} from './skia/recitedWord';

const MESSAGE_KEYS = {
  missed: 'recitationSummary.markKinds.missed',
  wrong: 'recitationSummary.markKinds.wrong',
  added: 'recitationSummary.markKinds.added',
} as const;

/**
 * Marks are drawn on a canvas, which a screen reader cannot see. While a take runs,
 * each new one is said: what may have happened, and where. Does nothing with no
 * screen reader on.
 */
export function useRecitationMarkAnnouncements(): void {
  const {t} = useTranslation('sheets');
  const marks = useRecitationTrackingStore(s => s.marks);
  const active = useRecitationTrackingStore(s => isTakeActive(s.status));
  const said = useRef(new Set<string>());

  useEffect(() => {
    if (!active) {
      said.current = new Set();
      return;
    }
    const standing = new Set<string>();
    for (const mark of marks) {
      if (mark.status !== 'mistake') continue;
      const key = wordMarkKey(mark);
      standing.add(key);
      if (said.current.has(key)) continue;
      const position =
        dkWordPosition(
          digitalKhattDataService.getVerseWords(`${mark.surah}:${mark.ayah}`),
          mark.word,
          mark.totalWords,
        ) ?? mark.word + 1;
      const where = recitationMarkRef(mark, position);
      AccessibilityInfo.announceForAccessibility(
        `${t(MESSAGE_KEYS[mark.kind])} ${t(where.key, where.values)}`,
      );
    }
    said.current = standing;
  }, [marks, active, t]);
}
