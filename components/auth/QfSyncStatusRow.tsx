import React from 'react';
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
import {useTranslation} from 'react-i18next';

// Fixed copy per status. Idle shows the last sync time instead; signed out
// renders nothing.
const STATUS_KEYS = {
  signed_out: null,
  idle: null,
  disabled: 'qfAccount.status.disabled',
  syncing: 'qfAccount.status.syncing',
  offline: 'qfAccount.status.offline',
  auth_expired: 'qfAccount.status.authExpired',
  conflict: 'qfAccount.status.conflict',
  retry: 'qfAccount.status.retry',
} as const satisfies Record<QfSyncStatus, string | null>;

export function QfSyncStatusRow() {
  const {theme} = useTheme();
  const {t, i18n} = useTranslation(['settings', 'common']);
  const status = useQfSyncStore(state => state.status);
  const lastSuccessAt = useQfSyncStore(state => state.lastSuccessAt);

  if (status === 'signed_out') return null;
  const canRetry = status === 'retry' || status === 'conflict';
  const fixedKey = STATUS_KEYS[status];
  const label = fixedKey
    ? t(fixedKey)
    : lastSuccessAt
      ? t('qfAccount.status.lastSynced', {
          time: new Date(lastSuccessAt).toLocaleTimeString(i18n.language, {
            hour: 'numeric',
            minute: '2-digit',
          }),
        })
      : t('qfAccount.status.ready');

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
            {t('common:actions.retry')}
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
