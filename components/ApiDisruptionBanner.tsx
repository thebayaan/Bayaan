import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useApiHealthStore} from '@/store/apiHealthStore';

export function ApiDisruptionBanner() {
  const {isDisrupted, usingStaleCache, retryFn} = useApiHealthStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const insets = useSafeAreaInsets();

  if (!isDisrupted) return null;

  const handleRetry = async () => {
    if (!retryFn || retrying) return;
    setRetrying(true);
    try {
      await retryFn();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      <View
        style={[
          styles.banner,
          {paddingTop: insets.top > 0 ? insets.top + 4 : 12},
        ]}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerIcon}>⚠️</Text>
          <Text style={styles.bannerText} numberOfLines={1}>
            {usingStaleCache
              ? 'Showing cached data — backend unreachable'
              : 'Backend unreachable — some content unavailable'}
          </Text>
        </View>
        <View style={styles.bannerActions}>
          <TouchableOpacity
            onPress={handleRetry}
            disabled={retrying}
            style={styles.bannerButton}>
            {retrying ? (
              <ActivityIndicator size="small" color="#7a5400" />
            ) : (
              <Text style={styles.bannerButtonText}>Retry</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={[styles.bannerButton, styles.bannerButtonMore]}>
            <Text style={styles.bannerButtonText}>More</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Service Disruption</Text>
            <Text style={styles.modalSubtitle}>
              The Bayaan backend is temporarily unreachable. Our team is already
              aware and working to restore it.
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What's affected</Text>
              <StatusRow emoji="🔴" label="Loading new reciters" ok={false} />
              <StatusRow emoji="🔴" label="Reciter metadata updates" ok={false} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What still works</Text>
              <StatusRow emoji="🟢" label="Audio playback" ok={true} />
              <StatusRow emoji="🟢" label="Downloads" ok={true} />
              <StatusRow emoji="🟢" label="Bookmarks & notes" ok={true} />
              <StatusRow emoji="🟢" label="Playlists & favorites" ok={true} />
              <StatusRow emoji="🟢" label="Mushaf & reading" ok={true} />
              {usingStaleCache && (
                <StatusRow
                  emoji="🟡"
                  label="Reciter list (showing cached data)"
                  ok={true}
                />
              )}
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                We apologize for the inconvenience. If this persists, check our
                status page or reach out on GitHub.
              </Text>
            </View>
          </ScrollView>

          <View
            style={[styles.modalFooter, {paddingBottom: insets.bottom + 8}]}>
            <TouchableOpacity
              style={[styles.retryButton, retrying && styles.retryButtonDisabled]}
              onPress={async () => {
                await handleRetry();
                setModalVisible(false);
              }}
              disabled={retrying}>
              {retrying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.retryButtonText}>Retry Now</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function StatusRow({
  emoji,
  label,
  ok,
}: {
  emoji: string;
  label: string;
  ok: boolean;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusEmoji}>{emoji}</Text>
      <Text style={[styles.statusLabel, !ok && styles.statusLabelDown]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F59E0B',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  bannerIcon: {
    fontSize: 13,
  },
  bannerText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  bannerButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FDE68A',
    minWidth: 44,
    alignItems: 'center',
  },
  bannerButtonMore: {
    backgroundColor: '#F59E0B22',
  },
  bannerButtonText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  modal: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalContent: {
    padding: 24,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  statusEmoji: {
    fontSize: 14,
  },
  statusLabel: {
    fontSize: 15,
    color: '#374151',
  },
  statusLabelDown: {
    color: '#6B7280',
  },
  notice: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  modalFooter: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  retryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 15,
  },
});
