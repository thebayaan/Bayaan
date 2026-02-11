import React, {useState, useMemo, useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

const CheckboxRow: React.FC<CheckboxRowProps> = ({
  label,
  checked,
  onToggle,
  disabled = false,
  theme,
  styles,
}) => {
  return (
    <Pressable
      style={[styles.checkboxRow, disabled && styles.checkboxRowDisabled]}
      onPress={onToggle}
      disabled={disabled}>
      <View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
          disabled && styles.checkboxDisabled,
        ]}>
        {checked ? (
          <Feather
            name="check"
            size={moderateScale(14)}
            color={theme.colors.background}
          />
        ) : null}
      </View>
      <Text
        style={[
          styles.checkboxLabel,
          disabled && styles.checkboxLabelDisabled,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
};

export const VerseCopySheet = (props: SheetProps<'verse-copy'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey;
  const surahNumber = props.payload?.surahNumber;
  const ayahNumber = props.payload?.ayahNumber;
  const arabicText = props.payload?.arabicText;
  const translation = props.payload?.translation;

  const [copyArabic, setCopyArabic] = useState(true);
  const [copyTranslation, setCopyTranslation] = useState(false);
  const [copyReference, setCopyReference] = useState(true);

  const handleCopy = useCallback(async () => {
    const parts: string[] = [];

    if (copyArabic && arabicText) {
      parts.push(arabicText);
    }

    if (copyTranslation && translation) {
      parts.push(translation);
    }

    if (copyReference && surahNumber != null && ayahNumber != null) {
      parts.push(`Quran ${surahNumber}:${ayahNumber}`);
    }

    if (parts.length > 0) {
      await Clipboard.setStringAsync(parts.join('\n\n'));
    }

    SheetManager.hideAll();
  }, [
    copyArabic,
    copyTranslation,
    copyReference,
    arabicText,
    translation,
    surahNumber,
    ayahNumber,
  ]);

  const canCopy = copyArabic || copyTranslation || copyReference;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={styles.title}>Copy Options</Text>
        <Text style={styles.subtitle}>Select what to copy</Text>

        <View style={styles.optionsContainer}>
          <CheckboxRow
            label="Arabic"
            checked={copyArabic}
            onToggle={() => setCopyArabic(!copyArabic)}
            disabled={!arabicText}
            theme={theme}
            styles={styles}
          />
          <CheckboxRow
            label="Translation"
            checked={copyTranslation}
            onToggle={() => setCopyTranslation(!copyTranslation)}
            disabled={!translation}
            theme={theme}
            styles={styles}
          />
          <CheckboxRow
            label="Verse Reference"
            checked={copyReference}
            onToggle={() => setCopyReference(!copyReference)}
            theme={theme}
            styles={styles}
          />
        </View>

        <Pressable
          style={[styles.copyButton, !canCopy && styles.copyButtonDisabled]}
          onPress={handleCopy}
          disabled={!canCopy}>
          <Feather
            name="copy"
            size={moderateScale(18)}
            color={canCopy ? theme.colors.text : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.copyButtonText,
              !canCopy && styles.copyButtonTextDisabled,
            ]}>
            Copy to Clipboard
          </Text>
        </Pressable>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    container: {
      padding: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: verticalScale(4),
      marginBottom: verticalScale(16),
    },
    optionsContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(8),
      marginBottom: verticalScale(16),
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(12),
    },
    checkboxRowDisabled: {
      opacity: 0.4,
    },
    checkbox: {
      width: moderateScale(24),
      height: moderateScale(24),
      borderRadius: moderateScale(6),
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    checkboxChecked: {
      backgroundColor: theme.colors.text,
      borderColor: theme.colors.text,
    },
    checkboxDisabled: {
      borderColor: Color(theme.colors.border).alpha(0.5).toString(),
    },
    checkboxLabel: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    checkboxLabelDisabled: {
      color: theme.colors.textSecondary,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(12),
      gap: moderateScale(8),
    },
    copyButtonDisabled: {
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.2).toString(),
    },
    copyButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    copyButtonTextDisabled: {
      color: theme.colors.textSecondary,
    },
  });
