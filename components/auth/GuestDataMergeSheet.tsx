import React, {useCallback} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {formatCount} from '@/utils/pluralize';

export function GuestDataMergeSheet() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const prompt = useQfSyncStore(state => state.guestMergePrompt);
  const decide = useCallback((decision: 'merge' | 'keep_separate') => {
    qfSyncLifecycle.resolveGuestDecision(decision).catch(() => undefined);
  }, []);

  if (!prompt) return null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible
      statusBarTranslucent
      onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              paddingBottom: Math.max(insets.bottom, moderateScale(16)),
            },
          ]}>
          <View
            style={[
              styles.handle,
              {backgroundColor: theme.colors.textSecondary},
            ]}
          />
          <Text style={[styles.title, {color: theme.colors.text}]}>
            Keep your data together?
          </Text>
          <Text
            style={[styles.description, {color: theme.colors.textSecondary}]}>
            We found {prompt.totalCount}{' '}
            {prompt.totalCount === 1 ? 'item' : 'items'} saved while using
            Bayaan as a guest. You can copy them into this account or keep the
            two sets separate.
          </Text>
          <View style={styles.counts}>
            <Text style={[styles.count, {color: theme.colors.textSecondary}]}>
              {formatCount(prompt.bookmarkCount, 'bookmark')} ·{' '}
              {formatCount(prompt.noteCount, 'note')} ·{' '}
              {formatCount(prompt.highlightCount, 'highlight')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={[styles.primaryButton, {backgroundColor: theme.colors.text}]}
            disabled={prompt.submitting}
            onPress={() => decide('merge')}>
            {prompt.submitting ? (
              <ActivityIndicator color={theme.colors.background} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  {color: theme.colors.background},
                ]}>
                Merge guest data
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.secondaryButton, {borderColor: theme.colors.border}]}
            disabled={prompt.submitting}
            onPress={() => decide('keep_separate')}>
            <Text
              style={[styles.secondaryButtonText, {color: theme.colors.text}]}>
              Keep separate
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  handle: {
    alignSelf: 'center',
    width: moderateScale(36),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    opacity: 0.35,
    marginBottom: moderateScale(18),
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(19),
  },
  description: {
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    marginTop: moderateScale(8),
  },
  counts: {
    marginTop: moderateScale(12),
  },
  count: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(11.5),
  },
  primaryButton: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(20),
  },
  primaryButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(13),
  },
  secondaryButton: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(10),
  },
  secondaryButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(13),
  },
});
