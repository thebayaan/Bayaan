import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useQfSyncStore, type QfSyncStatus} from '@/store/qfSyncStore';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
import i18n from '@/i18n';
import {useTranslation} from 'react-i18next';

function statusText(
  status: QfSyncStatus,
  lastSuccessAt: number | null,
): string {
  const key = 'settings:qfAccount.status';
  if (status === 'disabled') return i18n.t(`${key}.disabled`);
  if (status === 'syncing') return i18n.t(`${key}.syncing`);
  if (status === 'offline') return i18n.t(`${key}.offline`);
  if (status === 'auth_expired') return i18n.t(`${key}.authExpired`);
  if (status === 'conflict') return i18n.t(`${key}.conflict`);
  if (status === 'retry') return i18n.t(`${key}.retry`);
  if (lastSuccessAt) {
    const time = new Date(lastSuccessAt).toLocaleTimeString(i18n.language, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return i18n.t(`${key}.lastSynced`, {time});
  }
  return i18n.t(`${key}.ready`);
}

export function QfSyncStatusRow() {
  const {theme} = useTheme();
  const {
    t,
    i18n: {language},
  } = useTranslation('common');
  const status = useQfSyncStore(state => state.status);
  const lastSuccessAt = useQfSyncStore(state => state.lastSuccessAt);
  const label = useMemo(
    () => statusText(status, lastSuccessAt),
    // The text depends on the app language too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastSuccessAt, status, language],
  );

  if (status === 'signed_out') return null;
  const canRetry = status === 'retry' || status === 'conflict';

  return (
    <View style={styles.row}>
      {status === 'syncing' ? (
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      ) : (
        <Feather
          name={status === 'offline' ? 'wifi-off' : 'refresh-cw'}
          size={moderateScale(13)}
          color={theme.colors.textSecondary}
        />
      )}
      <Text style={[styles.label, {color: theme.colors.textSecondary}]}>
        {label}
      </Text>
      {canRetry ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => qfSyncLifecycle.retryNow()}>
          <Text style={[styles.retry, {color: theme.colors.text}]}>
            {t('actions.retry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(7),
    marginTop: moderateScale(10),
  },
  label: {
    flex: 1,
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(10.5),
  },
  retry: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(10.5),
  },
});
