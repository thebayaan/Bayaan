import React, {useState, useMemo, useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import * as Clipboard from 'expo-clipboard';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';

interface CopyContentProps {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys?: string[];
  arabicText: string;
  translation: string;
  transliteration: string;
  onDone: () => void;
}

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  theme: Theme;
}

const CheckboxRow: React.FC<CheckboxRowProps> = ({
  label,
  checked,
  onToggle,
  disabled = false,
  theme,
}) => (
  <Pressable
    style={[checkboxStyles.row, disabled && {opacity: 0.35}]}
    onPress={onToggle}
    disabled={disabled}>
    <View
      style={[
        checkboxStyles.box,
        {borderColor: Color(theme.colors.text).alpha(0.15).toString()},
        checked && {
          backgroundColor: theme.colors.text,
          borderColor: theme.colors.text,
        },
      ]}>
      {checked ? (
        <Feather
          name="check"
          size={moderateScale(13)}
          color={theme.colors.background}
        />
      ) : null}
    </View>
    <Text
      style={[
        checkboxStyles.label,
        {color: theme.colors.text, fontFamily: theme.fonts.medium},
      ]}>
      {label}
    </Text>
  </Pressable>
);

const checkboxStyles = ScaledSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
  },
  box: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(6),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  label: {
    fontSize: moderateScale(14),
  },
});

export const CopyContent: React.FC<CopyContentProps> = ({
  verseKey,
  surahNumber,
  ayahNumber,
  verseKeys,
  arabicText,
  translation,
  transliteration,
  onDone,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isRange = verseKeys && verseKeys.length > 1;

  const verseRefText = useMemo(() => {
    if (!isRange) return `${surahNumber}:${ayahNumber}`;
    const firstKey = verseKeys[0];
    const lastKey = verseKeys[verseKeys.length - 1];
    const [firstSurah, firstAyah] = firstKey.split(':');
    const [, lastAyah] = lastKey.split(':');
    if (firstSurah === String(surahNumber)) {
      return `${firstSurah}:${firstAyah}-${lastAyah}`;
    }
    return `${firstKey} - ${lastKey}`;
  }, [isRange, verseKeys, surahNumber, ayahNumber]);

  const [copyArabic, setCopyArabic] = useState(true);
  const [copyTransliteration, setCopyTransliteration] = useState(false);
  const [copyTranslation, setCopyTranslation] = useState(false);
  const [copyReference, setCopyReference] = useState(true);

  const handleCopy = useCallback(async () => {
    const parts: string[] = [];
    if (copyArabic && arabicText) parts.push(arabicText);
    if (copyTransliteration && transliteration) {
      parts.push(transliteration.replace(/<[^>]*>/g, ''));
    }
    if (copyTranslation && translation) parts.push(translation);
    if (copyReference) parts.push(`Quran ${verseRefText}`);
    if (parts.length > 0) {
      await Clipboard.setStringAsync(parts.join('\n\n'));
    }
    onDone();
  }, [
    copyArabic,
    copyTransliteration,
    copyTranslation,
    copyReference,
    arabicText,
    transliteration,
    translation,
    verseRefText,
    onDone,
  ]);

  const canCopy =
    copyArabic || copyTransliteration || copyTranslation || copyReference;

  return (
    <View>
      <View style={styles.previewCard}>
        <SkiaVersePreview
          verseKey={verseKey}
          verseKeys={verseKeys}
          numberOfLines={isRange ? 3 : 2}
        />
      </View>

      <Text style={styles.sectionLabel}>SELECT CONTENT</Text>
      <View style={styles.card}>
        <CheckboxRow
          label="Arabic"
          checked={copyArabic}
          onToggle={() => setCopyArabic(!copyArabic)}
          disabled={!arabicText}
          theme={theme}
        />
        <View style={styles.separator} />
        <CheckboxRow
          label="Transliteration"
          checked={copyTransliteration}
          onToggle={() => setCopyTransliteration(!copyTransliteration)}
          disabled={!transliteration}
          theme={theme}
        />
        <View style={styles.separator} />
        <CheckboxRow
          label="Translation"
          checked={copyTranslation}
          onToggle={() => setCopyTranslation(!copyTranslation)}
          disabled={!translation}
          theme={theme}
        />
        <View style={styles.separator} />
        <CheckboxRow
          label="Verse Reference"
          checked={copyReference}
          onToggle={() => setCopyReference(!copyReference)}
          theme={theme}
        />
      </View>

      <Pressable
        style={({pressed}) => [
          styles.copyButton,
          !canCopy && styles.copyButtonDisabled,
          pressed && canCopy && {opacity: 0.85},
        ]}
        onPress={handleCopy}
        disabled={!canCopy}>
        <Feather
          name="copy"
          size={moderateScale(16)}
          color={theme.colors.text}
        />
        <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    previewCard: {
      backgroundColor: Color(theme.colors.text).alpha(0.03).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.05).toString(),
      padding: moderateScale(14),
      marginBottom: moderateScale(14),
    },
    sectionLabel: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      marginBottom: moderateScale(4),
      marginLeft: moderateScale(2),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(2),
      marginBottom: moderateScale(16),
    },
    separator: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.1).toString(),
      paddingVertical: verticalScale(13),
      gap: moderateScale(8),
    },
    copyButtonDisabled: {
      opacity: 0.35,
    },
    copyButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
