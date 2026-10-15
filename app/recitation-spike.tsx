import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import type {WorkerOutbound} from '@tilawa/core';
import {useTheme} from '@/hooks/useTheme';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {
  deleteRecitationAssets,
  ensureRecitationAssets,
  getRecitationAssets,
  type RecitationAssetPaths,
} from '@/services/recitation/recitationAssets';
import {
  createRecitationEngine,
  type RecitationEngine,
  type RecitationStats,
} from '@/services/recitation/recitationEngine';
import {
  requestMicPermission,
  startMicStream,
  type MicStream,
} from '@/services/recitation/micStream';

// Phase 0 spike for offline recitation tracking (Tilawa). Hidden screen,
// reachable from the dev menu or bayaan://recitation-spike. Not user-facing.

type Phase =
  | 'checking'
  | 'needs-download'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'listening'
  | 'error';

interface WordState {
  surah: number;
  ayah: number;
  wordIndex: number;
  totalWords: number;
  matched: number[];
}

function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

function rms(pcm: Float32Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / pcm.length);
}

export default function RecitationSpikeScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [verses, setVerses] = useState<string[]>([]);
  const [word, setWord] = useState<WordState | null>(null);
  const [transcript, setTranscript] = useState('');
  const [stats, setStats] = useState<RecitationStats | null>(null);
  const [deviceRate, setDeviceRate] = useState<number | null>(null);
  const [inputRms, setInputRms] = useState(0);
  const [lastEvent, setLastEvent] = useState('-');
  const engineRef = useRef<RecitationEngine | null>(null);
  const followAlong = useDevSettingsStore(s => s.recitationFollowAlong);
  const toggleFollowAlong = useDevSettingsStore(
    s => s.toggleRecitationFollowAlong,
  );
  const micRef = useRef<MicStream | null>(null);

  const handleEvent = useCallback((msg: WorkerOutbound) => {
    setLastEvent(msg.type);
    if (msg.type === 'verse_match') {
      const key = `${msg.surah}:${msg.ayah}`;
      setVerses(prev =>
        prev[prev.length - 1] === key ? prev : [...prev, key],
      );
      return;
    }
    if (msg.type === 'word_progress') {
      setWord({
        surah: msg.surah,
        ayah: msg.ayah,
        wordIndex: msg.word_index,
        totalWords: msg.total_words,
        matched: msg.matched_indices,
      });
      return;
    }
    if (msg.type === 'raw_transcript') setTranscript(msg.text);
  }, []);

  const loadEngine = useCallback(
    async (assets: RecitationAssetPaths) => {
      setPhase('loading');
      engineRef.current = await createRecitationEngine(assets, handleEvent);
      setStats(engineRef.current.getStats());
      setPhase('ready');
    },
    [handleEvent],
  );

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setPhase('error');
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRecitationAssets()
      .then(assets => {
        if (cancelled) return;
        if (!assets) {
          setPhase('needs-download');
          return;
        }
        return loadEngine(assets);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      void micRef.current?.stop();
      void engineRef.current?.dispose();
    };
  }, [fail, loadEngine]);

  useEffect(() => {
    if (phase !== 'listening') return;
    const id = setInterval(() => {
      if (engineRef.current) setStats(engineRef.current.getStats());
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function handleDownload(): Promise<void> {
    try {
      setPhase('downloading');
      const assets = await ensureRecitationAssets(setProgress);
      await loadEngine(assets);
    } catch (e) {
      fail(e);
    }
  }

  async function handleStart(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      if (!(await requestMicPermission())) {
        fail(new Error('Microphone permission denied'));
        return;
      }
      engine.reset();
      setVerses([]);
      setWord(null);
      setTranscript('');
      micRef.current = await startMicStream((pcm, rate) => {
        setDeviceRate(rate);
        setInputRms(rms(pcm));
        engine.feed(pcm);
      });
      setPhase('listening');
    } catch (e) {
      fail(e);
    }
  }

  async function handleStop(): Promise<void> {
    const engine = engineRef.current;
    await micRef.current?.stop();
    micRef.current = null;
    if (engine) {
      await engine.stop();
      setStats(engine.getStats());
    }
    setPhase('ready');
  }

  async function handleClose(): Promise<void> {
    if (micRef.current) await handleStop();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  async function handleDelete(): Promise<void> {
    await engineRef.current?.dispose();
    engineRef.current = null;
    await deleteRecitationAssets();
    setPhase('needs-download');
  }

  const muted = Color(theme.colors.text).alpha(0.6).toString();
  const card = Color(theme.colors.text).alpha(0.06).toString();
  const rtf =
    stats && stats.audioSeconds > 0
      ? stats.busyMs / 1000 / stats.audioSeconds
      : null;
  const jsMs = stats ? stats.busyMs - stats.ortMs : 0;

  function renderButton(label: string, onPress: () => void): React.JSX.Element {
    return (
      <TouchableOpacity
        style={[styles.button, {backgroundColor: theme.colors.text}]}
        onPress={onPress}>
        <Text style={[styles.buttonText, {color: theme.colors.background}]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderStat(label: string, value: string): React.JSX.Element {
    return (
      <View style={styles.statRow} key={label}>
        <Text style={[styles.statLabel, {color: muted}]}>{label}</Text>
        <Text style={[styles.statValue, {color: theme.colors.text}]}>
          {value}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{backgroundColor: theme.colors.background}}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + moderateScale(16),
          paddingBottom: insets.bottom + moderateScale(24),
        },
      ]}>
      <Text style={[styles.title, {color: theme.colors.text}]}>
        Recitation spike
      </Text>
      <Text style={[styles.subtitle, {color: muted}]}>Phase: {phase}</Text>
      {renderButton('Close', handleClose)}
      {renderButton(
        `Mic in mushaf: ${followAlong ? 'ON' : 'OFF'}`,
        toggleFollowAlong,
      )}

      {phase === 'needs-download' &&
        renderButton('Download model (~75 MB)', handleDownload)}
      {phase === 'downloading' && (
        <Text style={[styles.body, {color: theme.colors.text}]}>
          Downloading… {Math.round(progress * 100)}%
        </Text>
      )}
      {phase === 'ready' && renderButton('Start reciting', handleStart)}
      {phase === 'listening' && renderButton('Stop', handleStop)}
      {error && (
        <Text style={[styles.body, {color: theme.colors.text}]}>
          Error: {error}
        </Text>
      )}

      <View style={[styles.card, {backgroundColor: card}]}>
        <Text style={[styles.cardTitle, {color: muted}]}>Recognition</Text>
        {renderStat('Verses', verses.length ? verses.join('  ') : '-')}
        {renderStat(
          'Word',
          word
            ? `${word.surah}:${word.ayah} word ${word.wordIndex + 1}/${
                word.totalWords
              }`
            : '-',
        )}
        {renderStat(
          'Matched',
          word ? word.matched.map(i => i + 1).join(',') : '-',
        )}
        <Text style={[styles.transcript, {color: muted}]} numberOfLines={4}>
          {transcript}
        </Text>
      </View>

      <View style={[styles.card, {backgroundColor: card}]}>
        <Text style={[styles.cardTitle, {color: muted}]}>Performance</Text>
        {renderStat('Load', stats ? formatMs(stats.loadMs) : '-')}
        {renderStat(
          'Audio',
          stats ? `${stats.audioSeconds.toFixed(1)} s` : '-',
        )}
        {renderStat('RTF (busy / audio)', rtf === null ? '-' : rtf.toFixed(3))}
        {renderStat('ONNX', stats ? formatMs(stats.ortMs) : '-')}
        {renderStat('JS', stats ? formatMs(jsMs) : '-')}
        {renderStat('Max feed', stats ? formatMs(stats.maxFeedMs) : '-')}
        {renderStat('Backlog', stats ? String(stats.backlog) : '-')}
        {renderStat('Mic rate', deviceRate ? `${deviceRate} Hz` : '-')}
        {renderStat('Input RMS (gate 0.005)', inputRms.toFixed(4))}
        {renderStat('Chunks', stats ? String(stats.chunks) : '-')}
        {renderStat('Last event', lastEvent)}
        {renderStat('Engine error', stats?.lastError ?? '-')}
      </View>

      {(phase === 'ready' || phase === 'error') &&
        renderButton('Delete model', handleDelete)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(12),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
  },
  subtitle: {
    fontSize: moderateScale(13),
  },
  body: {
    fontSize: moderateScale(14),
  },
  button: {
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(10),
    alignItems: 'center',
  },
  buttonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  card: {
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    gap: moderateScale(6),
  },
  cardTitle: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: moderateScale(13),
  },
  statValue: {
    fontSize: moderateScale(13),
    fontVariant: ['tabular-nums'],
  },
  transcript: {
    fontSize: moderateScale(12),
    marginTop: moderateScale(4),
  },
});
