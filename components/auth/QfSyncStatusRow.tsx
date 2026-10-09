import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useQfSyncStore, type QfSyncStatus} from '@/store/qfSyncStore';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';

function statusText(
  status: QfSyncStatus,
  lastSuccessAt: number | null,
): string {
  if (status === 'disabled') return 'Account sync is turned off';
  if (status === 'syncing') return 'Syncing';
  if (status === 'offline') return 'Offline — changes will sync later';
  if (status === 'auth_expired') return 'Session expired — sign in again';
  if (status === 'conflict') return 'Some changes need another sync';
  if (status === 'retry') return 'Sync paused — retry available';
  if (lastSuccessAt) {
    return `Last synced ${new Date(lastSuccessAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }
  return 'Ready to sync';
}

export function QfSyncStatusRow() {
  const {theme} = useTheme();
  const status = useQfSyncStore(state => state.status);
  const lastSuccessAt = useQfSyncStore(state => state.lastSuccessAt);
  const label = useMemo(
    () => statusText(status, lastSuccessAt),
    [lastSuccessAt, status],
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
          <Text style={[styles.retry, {color: theme.colors.text}]}>Retry</Text>
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
