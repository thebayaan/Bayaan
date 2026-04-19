import {useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {useMemo, useState} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import recitersFallback from '../data/reciters-fallback.json';

const TEST_AUDIO = require('./assets/audio/test.mp3');

type Reciter = {
  id: string;
  name: string;
  name_arabic: string | null;
};

const RECITERS_LIMIT = 12;

export default function App(): React.ReactElement {
  const player = useAudioPlayer(TEST_AUDIO);
  const status = useAudioPlayerStatus(player);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const reciters = useMemo<Reciter[]>(
    () => (recitersFallback as Reciter[]).slice(0, RECITERS_LIMIT),
    [],
  );

  function handleSelect(reciter: Reciter): void {
    setSelectedId(reciter.id);
    if (status.playing) {
      player.pause();
    } else {
      player.seekTo(0);
      player.play();
    }
  }

  const isTV = Platform.isTV === true;
  const selected = reciters.find(r => r.id === selectedId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bayaan TV</Text>
        <Text style={styles.subtitle}>
          {reciters.length} reciters from shared data · {Platform.OS}
          {isTV ? ' (TV)' : ''}
        </Text>
      </View>

      <View style={styles.railSection}>
        <Text style={styles.railLabel}>Reciters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}>
          {reciters.map((reciter, idx) => {
            const isFocused = focusedId === reciter.id;
            const isSelected = selectedId === reciter.id;
            return (
              <Pressable
                key={reciter.id}
                style={[
                  styles.card,
                  isFocused && styles.cardFocused,
                  isSelected && styles.cardSelected,
                ]}
                onPress={() => handleSelect(reciter)}
                onFocus={() => setFocusedId(reciter.id)}
                onBlur={() =>
                  setFocusedId(id => (id === reciter.id ? null : id))
                }
                hasTVPreferredFocus={idx === 0}>
                <Text style={styles.cardInitial}>
                  {reciter.name.charAt(0).toUpperCase()}
                </Text>
                <Text style={styles.cardName} numberOfLines={2}>
                  {reciter.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.nowPlaying}>
        {selected ? (
          <>
            <Text style={styles.nowPlayingLabel}>Now Playing</Text>
            <Text style={styles.nowPlayingName}>{selected.name}</Text>
            <Text style={styles.nowPlayingMeta}>
              {status.playing ? 'Playing' : 'Paused'} ·{' '}
              {status.currentTime.toFixed(1)}s / {status.duration.toFixed(1)}s
            </Text>
          </>
        ) : (
          <Text style={styles.nowPlayingHint}>
            {isTV
              ? 'Focus a reciter and press select'
              : 'Tap a reciter to play'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 64,
    paddingVertical: 48,
    gap: 40,
  },
  header: {
    gap: 8,
  },
  title: {
    color: '#f2f0e8',
    fontSize: 48,
    fontWeight: '700',
  },
  subtitle: {
    color: '#707070',
    fontSize: 16,
  },
  railSection: {
    gap: 16,
  },
  railLabel: {
    color: '#a0a0a0',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  rail: {
    gap: 20,
    paddingRight: 64,
  },
  card: {
    width: 180,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 3,
    borderColor: 'transparent',
    padding: 20,
    justifyContent: 'space-between',
  },
  cardFocused: {
    borderColor: '#f2f0e8',
    transform: [{scale: 1.08}],
  },
  cardSelected: {
    backgroundColor: '#2a2a2a',
  },
  cardInitial: {
    color: '#f2f0e8',
    fontSize: 72,
    fontWeight: '300',
    opacity: 0.6,
  },
  cardName: {
    color: '#f2f0e8',
    fontSize: 16,
    fontWeight: '600',
  },
  nowPlaying: {
    marginTop: 'auto',
    gap: 6,
  },
  nowPlayingLabel: {
    color: '#707070',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  nowPlayingName: {
    color: '#f2f0e8',
    fontSize: 28,
    fontWeight: '600',
  },
  nowPlayingMeta: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  nowPlayingHint: {
    color: '#707070',
    fontSize: 16,
  },
});
