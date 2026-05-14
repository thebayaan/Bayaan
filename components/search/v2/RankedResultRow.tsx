// components/search/v2/RankedResultRow.tsx
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {RankedResult} from '@/services/search/types';
import {SignalIcon} from './SignalIcon';

interface Props {
  result: RankedResult;
  onPress: (r: RankedResult) => void;
}

export function RankedResultRow({result, onPress}: Props) {
  return (
    <Pressable
      onPress={() => onPress(result)}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      {result.artwork && (
        <View
          style={[
            styles.art,
            styles[`art_${result.artwork.kind}` as keyof typeof styles],
          ]}>
          <Text style={styles.artText}>{result.artwork.label}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {result.title}
          </Text>
          <SignalIcon signal={result.features.signal} />
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {result.subtitle}
        </Text>
        {result.arabicPreview && (
          <Text style={styles.arabic} numberOfLines={1}>
            {result.arabicPreview}
          </Text>
        )}
      </View>
      {result.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{result.badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rowPressed: {backgroundColor: 'rgba(255,255,255,0.04)'},
  art: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
  },
  art_reciter: {borderRadius: 22},
  art_surah: {},
  art_rewayat: {},
  art_adhkar: {},
  art_name: {},
  art_playlist: {},
  art_verse: {},
  artText: {color: '#d4af37', fontWeight: '700', fontSize: 14},
  meta: {flex: 1, minWidth: 0},
  titleRow: {flexDirection: 'row', alignItems: 'center'},
  title: {color: '#f5f5f7', fontSize: 14, fontWeight: '600', flexShrink: 1},
  subtitle: {color: '#8e8e93', fontSize: 12, marginTop: 2},
  arabic: {color: '#cbb87a', fontSize: 14, marginTop: 4, textAlign: 'right'},
  badge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
