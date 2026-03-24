import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import audioStreamInstance, {
  AudioStream,
  PlaybackState,
  LogLevel,
  EQUALIZER_PRESETS,
  type AudioStreamConfig,
  type PlaybackStats,
  type AudioMetadata,
  type StreamError,
  type EqualizerBand,
  type PlaylistItem,
} from 'react-native-audio-stream';
import { useAudioStream, useStreamProgress } from 'react-native-audio-stream';

// ─── Singleton reference ───────────────────────────────────────
const audio = AudioStream.getInstance();

// ─── Sample Streams ────────────────────────────────────────────
const SAMPLE_STREAMS = [
  { name: '🎵 MP3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: '📻 Radio', url: 'http://ice1.somafm.com/groovesalad-256-mp3' },
  { name: '📺 HLS', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8' },
  { name: '🔗 No Ext', url: 'https://stream.zeno.fm/fyn0nb1x7quv' },
];

// ─── Tab Type ──────────────────────────────────────────────────
type TabName = 'player' | 'playlist' | 'equalizer' | 'live' | 'recording' | 'stream' | 'cache' | 'settings';

const TAB_CONFIG: { key: TabName; icon: string; label: string }[] = [
  { key: 'player', icon: '▶️', label: 'Player' },
  { key: 'playlist', icon: '📋', label: 'Playlist' },
  { key: 'equalizer', icon: '🎛️', label: 'EQ' },
  { key: 'live', icon: '📡', label: 'Live' },
  { key: 'recording', icon: '🎙️', label: 'Record' },
  { key: 'stream', icon: '🌐', label: 'Stream' },
  { key: 'cache', icon: '💾', label: 'Cache' },
  { key: 'settings', icon: '⚙️', label: 'Settings' },
];

// ─── Helper ────────────────────────────────────────────────────
const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const safeCall = async (label: string, fn: () => Promise<any>) => {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[${label}]`, err?.message || err);
    Alert.alert(label, err?.message || 'Unknown error');
  }
};

// ═══════════════════════════════════════════════════════════════
// ROOT APP — App-level initialization
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('player');
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await audio.initialize({
          bufferSize: 64,
          prebufferThreshold: 16,
          enableBackgroundMode: true,
          maintainAudioFocus: true,
          enableCache: true,
          cacheSize: 100,
          reconnectAttempts: 5,
          reconnectDelay: 1500,
          timeout: 30000,
          logLevel: LogLevel.DEBUG,
          autoPlay: true,
        });
        if (!cancelled) setIsReady(true);
      } catch (e: any) {
        if (!cancelled) setInitError(e?.message || 'Init failed');
      }
    })();
    return () => {
      cancelled = true;
      audio.destroy().catch(() => {});
    };
  }, []);

  if (initError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
        <Text style={{ color: '#f87171', fontSize: 18, marginBottom: 12 }}>⚠️ Init Error</Text>
        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>{initError}</Text>
        <TouchableOpacity style={{ marginTop: 20, backgroundColor: '#4f46e5', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 }}
          onPress={() => { setInitError(null); setIsReady(false); audio.initialize({ logLevel: LogLevel.DEBUG, enableCache: true, cacheSize: 100, autoPlay: true }).then(() => setIsReady(true)).catch((e: any) => setInitError(e?.message)); }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
        <ActivityIndicator size="large" color="#818cf8" />
        <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16 }}>Initializing AudioStream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎧 Audio Stream v2</Text>
        <Text style={styles.headerSubtitle}>Expo SDK 55 • All Features • Production-Grade</Text>
      </View>
      <View style={styles.content}>
        {activeTab === 'player' && <PlayerTab />}
        {activeTab === 'playlist' && <PlaylistTab />}
        {activeTab === 'equalizer' && <EqualizerTab />}
        {activeTab === 'live' && <LiveTab />}
        {activeTab === 'recording' && <RecordingTab />}
        {activeTab === 'stream' && <StreamTab />}
        {activeTab === 'cache' && <CacheTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 4 }}>
        {TAB_CONFIG.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
            <Text style={styles.tabText}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLAYER TAB
// ═══════════════════════════════════════════════════════════════
function PlayerTab() {
  const [streamUrl, setStreamUrl] = useState(SAMPLE_STREAMS[0].url);
  const [volume, setVolumeState] = useState(1.0);
  const [playbackRate, setRateState] = useState(1.0);
  const [pitch, setPitchState] = useState(1.0);
  const [isMuted, setMutedState] = useState(false);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [stats, setStats] = useState<PlaybackStats | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [networkState, setNetworkState] = useState<{ isConnected: boolean; type?: string } | null>(null);

  const {
    state: playbackState,
    isBuffering,
    startStream,
    play,
    pause,
    stop,
    seek,
  } = useAudioStream({
    autoInit: false, // Already initialized at App level
    onError: (err) => setError(err),
    onMetadata: (meta) => setMetadata(meta),
    onStats: (s) => setStats(s),
    onNetworkStateChange: (ns) => setNetworkState(ns),
  });

  const { currentTime, duration, percentage } = useStreamProgress();

  const stateColor = playbackState === PlaybackState.PLAYING ? '#4ade80' :
    playbackState === PlaybackState.ERROR ? '#f87171' :
    playbackState === PlaybackState.BUFFERING ? '#facc15' : '#94a3b8';

  const handlePlay = useCallback(async () => {
    setError(null);
    if (playbackState === PlaybackState.PAUSED) {
      await safeCall('Play', () => play());
    } else {
      await safeCall('Start Stream', () => startStream(streamUrl));
    }
  }, [streamUrl, playbackState, play, startStream]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Stream Source */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stream Source</Text>
        <TextInput style={styles.urlInput} value={streamUrl} onChangeText={setStreamUrl}
          placeholder="Enter stream URL..." placeholderTextColor="#475569" autoCapitalize="none" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {SAMPLE_STREAMS.map((s) => (
            <TouchableOpacity key={s.url} style={[styles.chipBtn, streamUrl === s.url && styles.chipBtnActive]}
              onPress={() => setStreamUrl(s.url)}>
              <Text style={[styles.chipText, streamUrl === s.url && styles.chipTextActive]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* State + Controls */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text style={styles.stateText}>{playbackState}</Text>
          {isBuffering && <Text style={styles.bufferingText}>Buffering...</Text>}
        </View>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${percentage}%` }]} />
        </View>
        <View style={styles.rowSpread}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{duration > 0 ? formatTime(duration) : 'Live'}</Text>
        </View>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => safeCall('Seek', () => seek(Math.max(0, currentTime - 10)))}>
            <Text style={styles.ctrlIcon}>⏪</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctrlBtn, styles.playBtn]} onPress={playbackState === PlaybackState.PLAYING ? () => safeCall('Pause', pause) : handlePlay}>
            <Text style={styles.playIcon}>{playbackState === PlaybackState.PLAYING ? '⏸️' : '▶️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => safeCall('Seek', () => seek(currentTime + 10))}>
            <Text style={styles.ctrlIcon}>⏩</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => safeCall('Stop', stop)}>
            <Text style={styles.ctrlIcon}>⏹️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Volume / Rate / Pitch / Mute */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Volume: {Math.round(volume * 100)}%</Text>
        <View style={styles.sliderRow}>
          <TouchableOpacity style={styles.miniBtn} onPress={() => { const v = Math.max(0, volume - 0.1); setVolumeState(v); audio.setVolume(v); }}>
            <Text style={styles.miniBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${volume * 100}%` }]} /></View>
          <TouchableOpacity style={styles.miniBtn} onPress={() => { const v = Math.min(1, volume + 0.1); setVolumeState(v); audio.setVolume(v); }}>
            <Text style={styles.miniBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.cardTitle, { marginTop: 12 }]}>Speed: {playbackRate}x</Text>
        <View style={styles.chipRow}>
          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((r) => (
            <TouchableOpacity key={r} style={[styles.chipBtn, playbackRate === r && styles.chipBtnActive]}
              onPress={() => { setRateState(r); audio.setPlaybackRate(r); }}>
              <Text style={[styles.chipText, playbackRate === r && styles.chipTextActive]}>{r}x</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.cardTitle, { marginTop: 12 }]}>Pitch: {pitch.toFixed(1)}</Text>
        <View style={styles.sliderRow}>
          <TouchableOpacity style={styles.miniBtn} onPress={() => { const p = Math.max(0.5, pitch - 0.1); setPitchState(p); audio.setPitch(p); }}>
            <Text style={styles.miniBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${((pitch - 0.5) / 1.5) * 100}%` }]} /></View>
          <TouchableOpacity style={styles.miniBtn} onPress={() => { const p = Math.min(2.0, pitch + 0.1); setPitchState(p); audio.setPitch(p); }}>
            <Text style={styles.miniBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.actionBtn, { marginTop: 12 }]}
          onPress={() => { const next = !isMuted; setMutedState(next); next ? audio.mute() : audio.unmute(); }}>
          <Text style={styles.actionBtnText}>{isMuted ? '🔇 Unmute' : '🔊 Mute'}</Text>
        </TouchableOpacity>
      </View>

      {/* Metadata */}
      {metadata && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Metadata</Text>
          {metadata.title && <Text style={styles.infoText}>🎵 {metadata.title}</Text>}
          {metadata.artist && <Text style={styles.infoText}>🎤 {metadata.artist}</Text>}
          {metadata.album && <Text style={styles.infoText}>💿 {metadata.album}</Text>}
          {metadata.genre && <Text style={styles.infoText}>🏷️ {metadata.genre}</Text>}
        </View>
      )}

      {/* Stats */}
      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Stats</Text>
          <View style={styles.statsGrid}>
            <Text style={styles.statItem}>Buffer: {stats.bufferHealth}%</Text>
            <Text style={styles.statItem}>Bitrate: {stats.bitRate} kbps</Text>
            <Text style={styles.statItem}>Speed: {Math.round(stats.networkSpeed)} KB/s</Text>
            <Text style={styles.statItem}>Latency: {stats.latency}ms</Text>
          </View>
        </View>
      )}

      {/* Network */}
      {networkState && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network</Text>
          <Text style={styles.infoText}>{networkState.isConnected ? '🟢 Connected' : '🔴 Disconnected'}{networkState.type ? ` (${networkState.type})` : ''}</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>⚠️ Error</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <Text style={styles.errorCode}>Code: {error.code} • Recoverable: {error.recoverable ? 'Yes' : 'No'}</Text>
        </View>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLAYLIST TAB
// ═══════════════════════════════════════════════════════════════
function PlaylistTab() {
  const [queue, setQueue] = useState<PlaylistItem[]>([]);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  const refreshQueue = useCallback(async () => {
    await safeCall('Get Queue', async () => {
      const q = await audio.getQueue();
      setQueue(q);
    });
  }, []);

  useEffect(() => { refreshQueue(); }, []);

  const loadSamplePlaylist = useCallback(async () => {
    await safeCall('Set Playlist', async () => {
      await audio.setPlaylist(SAMPLE_STREAMS.map((s, i) => ({ id: `track-${i}`, url: s.url, title: s.name })));
      await refreshQueue();
    });
  }, [refreshQueue]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Queue ({queue.length} tracks)</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={loadSamplePlaylist}>
          <Text style={styles.actionBtnText}>📋 Load Sample Playlist</Text>
        </TouchableOpacity>
        {queue.map((item, i) => (
          <View key={item.id || i} style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.infoText, { flex: 1 }]}>{i + 1}. {item.title || item.url}</Text>
            <TouchableOpacity onPress={() => safeCall('Remove', async () => { await audio.removeFromQueue(i); refreshQueue(); })}>
              <Text style={{ color: '#f87171', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Playback Controls</Text>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => safeCall('Prev', () => audio.skipToPrevious())}>
            <Text style={styles.ctrlIcon}>⏮️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => safeCall('Next', () => audio.skipToNext())}>
            <Text style={styles.ctrlIcon}>⏭️</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.chipRow, { marginTop: 12 }]}>
          <TouchableOpacity style={[styles.chipBtn, shuffleOn && styles.chipBtnActive]}
            onPress={() => { const next = !shuffleOn; setShuffleOn(next); safeCall('Shuffle', () => audio.setShuffle(next)); }}>
            <Text style={[styles.chipText, shuffleOn && styles.chipTextActive]}>🔀 Shuffle</Text>
          </TouchableOpacity>
          {(['off', 'all', 'one'] as const).map((mode) => (
            <TouchableOpacity key={mode} style={[styles.chipBtn, repeatMode === mode && styles.chipBtnActive]}
              onPress={() => { setRepeatMode(mode); safeCall('Repeat', () => audio.setRepeat(mode as any)); }}>
              <Text style={[styles.chipText, repeatMode === mode && styles.chipTextActive]}>🔁 {mode}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Queue Actions</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => safeCall('Clear', async () => { await audio.clearQueue(); refreshQueue(); })}>
          <Text style={styles.actionBtnText}>🗑️ Clear Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={refreshQueue}>
          <Text style={styles.actionBtnText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// EQUALIZER TAB
// ═══════════════════════════════════════════════════════════════
function EqualizerTab() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [bands, setBands] = useState<EqualizerBand[]>(EQUALIZER_PRESETS[0]?.bands || []);

  const applyPreset = useCallback(async (index: number) => {
    setSelectedPreset(index);
    const preset = EQUALIZER_PRESETS[index];
    if (preset) setBands([...preset.bands]);
    await safeCall('Apply Preset', () => audio.applyEqualizerPreset(index));
  }, []);

  const adjustBand = useCallback(async (bandIndex: number, delta: number) => {
    const newBands = [...bands];
    newBands[bandIndex] = { ...newBands[bandIndex], gain: Math.max(-12, Math.min(12, newBands[bandIndex].gain + delta)) };
    setBands(newBands);
    await safeCall('Set EQ', () => audio.setEqualizer(newBands));
  }, [bands]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Presets</Text>
        <View style={styles.chipRow}>
          {EQUALIZER_PRESETS.map((preset, i) => (
            <TouchableOpacity key={preset.name} style={[styles.chipBtn, selectedPreset === i && styles.chipBtnActive]}
              onPress={() => applyPreset(i)}>
              <Text style={[styles.chipText, selectedPreset === i && styles.chipTextActive]}>{preset.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>5-Band Equalizer</Text>
        {bands.map((band, i) => (
          <View key={band.frequency} style={styles.bandRow}>
            <Text style={styles.bandFreq}>{band.frequency >= 1000 ? `${band.frequency / 1000}k` : band.frequency} Hz</Text>
            <TouchableOpacity style={styles.miniBtn} onPress={() => adjustBand(i, -1)}><Text style={styles.miniBtnText}>−</Text></TouchableOpacity>
            <View style={styles.bandSlider}>
              <View style={[styles.bandFill, { width: `${((band.gain + 12) / 24) * 100}%`, backgroundColor: band.gain > 0 ? '#4ade80' : band.gain < 0 ? '#f87171' : '#94a3b8' }]} />
            </View>
            <TouchableOpacity style={styles.miniBtn} onPress={() => adjustBand(i, 1)}><Text style={styles.miniBtnText}>+</Text></TouchableOpacity>
            <Text style={styles.bandGain}>{band.gain > 0 ? '+' : ''}{band.gain}dB</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIVE TAB
// ═══════════════════════════════════════════════════════════════
function LiveTab() {
  const [liveState, setLiveState] = useState<any>(null);
  const [dvrWindow, setDvrWindow] = useState<any>(null);
  const [edgeOffset, setEdgeOffset] = useState<number | null>(null);
  const [targetLatency, setTargetLatency] = useState('2000');

  const refresh = useCallback(async () => {
    await safeCall('Live State', async () => { setLiveState(await audio.getLiveStreamState()); });
    await safeCall('DVR Window', async () => { setDvrWindow(await audio.getDvrWindow()); });
    await safeCall('Edge Offset', async () => { setEdgeOffset(await audio.getLiveEdgeOffset()); });
  }, []);

  useEffect(() => { refresh(); }, []);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Stream Controls</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => safeCall('Seek to Live', () => audio.seekToLiveEdge())}>
          <Text style={styles.actionBtnText}>📡 Seek to Live Edge</Text>
        </TouchableOpacity>
        <View style={[styles.row, { marginTop: 12 }]}>
          <TextInput style={[styles.urlInput, { flex: 1, marginBottom: 0, marginRight: 8 }]} value={targetLatency} onChangeText={setTargetLatency} keyboardType="numeric" placeholder="ms" placeholderTextColor="#475569" />
          <TouchableOpacity style={styles.actionBtn} onPress={() => safeCall('Set Latency', () => audio.setTargetLatency(parseInt(targetLatency) || 2000))}>
            <Text style={styles.actionBtnText}>Set Latency</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={refresh}>
          <Text style={styles.actionBtnText}>🔄 Refresh State</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live State</Text>
        {edgeOffset !== null && <Text style={styles.infoText}>Edge Offset: {edgeOffset}ms</Text>}
        {dvrWindow && <Text style={styles.infoText}>DVR Window: {JSON.stringify(dvrWindow)}</Text>}
        {liveState && <Text style={styles.infoText}>State: {JSON.stringify(liveState)}</Text>}
        {!liveState && !dvrWindow && edgeOffset === null && <Text style={styles.infoText}>No live stream active. Play an HLS/DASH stream first.</Text>}
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// RECORDING TAB
// ═══════════════════════════════════════════════════════════════
function RecordingTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [aecEnabled, setAecEnabled] = useState(false);
  const [nsEnabled, setNsEnabled] = useState(false);
  const [agcEnabled, setAgcEnabled] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(false);
  const levelInterval = useRef<any>(null);

  const startRec = useCallback(async () => {
    await safeCall('Start Recording', async () => {
      await audio.startRecording({ sampleRate: 44100, channels: 1, format: 'wav' as any });
      setIsRecording(true);
      levelInterval.current = setInterval(async () => {
        try { setRecordingLevel(await audio.getRecordingLevel()); } catch {}
      }, 200);
    });
  }, []);

  const stopRec = useCallback(async () => {
    if (levelInterval.current) clearInterval(levelInterval.current);
    await safeCall('Stop Recording', async () => {
      const path = await audio.stopRecording();
      setIsRecording(false);
      setRecordingLevel(0);
      Alert.alert('Recording Saved', path);
    });
  }, []);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recording</Text>
        <TouchableOpacity style={[styles.actionBtn, isRecording && { backgroundColor: '#dc2626' }]}
          onPress={isRecording ? stopRec : startRec}>
          <Text style={styles.actionBtnText}>{isRecording ? '⏹ Stop Recording' : '🎙️ Start Recording'}</Text>
        </TouchableOpacity>
        {isRecording && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.infoText}>Level: {Math.round(recordingLevel * 100)}%</Text>
            <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${recordingLevel * 100}%`, backgroundColor: recordingLevel > 0.8 ? '#f87171' : '#4ade80' }]} /></View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Audio Processing</Text>
        {[
          { label: '🔇 AEC (Echo Cancel)', value: aecEnabled, toggle: () => { const n = !aecEnabled; setAecEnabled(n); safeCall('AEC', () => audio.enableAEC(n)); } },
          { label: '🔉 Noise Suppression', value: nsEnabled, toggle: () => { const n = !nsEnabled; setNsEnabled(n); safeCall('NS', () => audio.enableNoiseSuppression(n)); } },
          { label: '📢 Auto Gain (AGC)', value: agcEnabled, toggle: () => { const n = !agcEnabled; setAgcEnabled(n); safeCall('AGC', () => audio.enableAGC(n)); } },
          { label: '🗣️ Voice Detection (VAD)', value: vadEnabled, toggle: () => { const n = !vadEnabled; setVadEnabled(n); safeCall('VAD', () => n ? audio.enableVAD() : audio.disableVAD()); } },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={[styles.chipBtn, item.value && styles.chipBtnActive, { marginBottom: 8 }]} onPress={item.toggle}>
            <Text style={[styles.chipText, item.value && styles.chipTextActive]}>{item.label}: {item.value ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// STREAM TAB — WebSocket + Realtime PCM
// ═══════════════════════════════════════════════════════════════
function StreamTab() {
  const [wsUrl, setWsUrl] = useState('wss://echo.websocket.org');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [streamStats, setStreamStats] = useState<any>(null);

  const connectWs = useCallback(async () => {
    await safeCall('WS Connect', async () => {
      await audio.startWebSocketStream({ url: wsUrl, sampleRate: 24000, channels: 1, autoPlay: true, autoReconnect: true, reconnectAttempts: 5, reconnectDelay: 1000 });
      setWsConnected(true);
      setWsMessages(prev => [...prev, `✅ Connected to ${wsUrl}`]);
    });
  }, [wsUrl]);

  const disconnectWs = useCallback(async () => {
    await safeCall('WS Disconnect', async () => { await audio.stopWebSocketStream(); setWsConnected(false); setWsMessages(prev => [...prev, '🔌 Disconnected']); });
  }, []);

  const sendMsg = useCallback(async () => {
    const msg = JSON.stringify({ type: 'ping', timestamp: Date.now() });
    await safeCall('WS Send', async () => { await audio.sendWebSocketMessage(msg); setWsMessages(prev => [...prev, `📤 ${msg}`]); });
  }, []);

  const startRt = useCallback(async () => {
    await safeCall('Realtime Start', async () => {
      await audio.startRealtimeStream({ sampleRate: 24000, channels: 1, autoPlay: true } as AudioStreamConfig);
      setRealtimeActive(true);
    });
  }, []);

  const stopRt = useCallback(async () => {
    await safeCall('Realtime Stop', async () => { await audio.completeRealtimeStream(); setRealtimeActive(false); });
  }, []);

  useEffect(() => {
    if (!realtimeActive) return;
    const iv = setInterval(async () => { try { setStreamStats(await audio.getStreamingStats()); } catch {} }, 1000);
    return () => clearInterval(iv);
  }, [realtimeActive]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>WebSocket Streaming</Text>
        <TextInput style={styles.urlInput} value={wsUrl} onChangeText={setWsUrl} placeholder="wss://..." placeholderTextColor="#475569" autoCapitalize="none" />
        <View style={styles.controlRow}>
          <TouchableOpacity style={[styles.ctrlBtn, wsConnected && { backgroundColor: '#dc2626' }]} onPress={wsConnected ? disconnectWs : connectWs}>
            <Text style={styles.ctrlIcon}>{wsConnected ? '⏹' : '🔌'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctrlBtn, !wsConnected && { opacity: 0.5 }]} onPress={sendMsg} disabled={!wsConnected}>
            <Text style={styles.ctrlIcon}>📤</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.infoText, { marginTop: 8 }]}>Status: {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}</Text>
      </View>

      {wsMessages.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Messages</Text>
          {wsMessages.slice(-10).map((m, i) => <Text key={i} style={styles.configText}>{m}</Text>)}
          <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={() => setWsMessages([])}>
            <Text style={styles.actionBtnText}>Clear Log</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Realtime PCM Stream</Text>
        <Text style={styles.configText}>24000 Hz • Mono • Raw PCM</Text>
        <View style={[styles.controlRow, { marginTop: 12 }]}>
          <TouchableOpacity style={[styles.ctrlBtn, realtimeActive && { backgroundColor: '#dc2626' }]} onPress={realtimeActive ? stopRt : startRt}>
            <Text style={styles.ctrlIcon}>{realtimeActive ? '⏹' : '▶️'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.infoText, { marginTop: 8 }]}>Status: {realtimeActive ? '🟢 Active' : '⚪ Inactive'}</Text>
      </View>

      {streamStats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Streaming Stats</Text>
          <Text style={styles.statItem}>Written: {streamStats.bytesWritten} B</Text>
          <Text style={styles.statItem}>Read: {streamStats.bytesRead} B</Text>
          <Text style={styles.statItem}>Active: {streamStats.isActive ? '✅' : '❌'}</Text>
        </View>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// CACHE TAB
// ═══════════════════════════════════════════════════════════════
function CacheTab() {
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [preloadUrl, setPreloadUrl] = useState(SAMPLE_STREAMS[0].url);
  const [preloadStatus, setPreloadStatus] = useState('');

  const refresh = useCallback(async () => {
    await safeCall('Cache Size', async () => setCacheSize(await audio.getCacheSize()));
  }, []);

  useEffect(() => { refresh(); }, []);

  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cache Status</Text>
        <Text style={styles.cacheSize}>{cacheSize !== null ? formatBytes(cacheSize) : 'Loading...'}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.actionBtn} onPress={refresh}><Text style={styles.actionBtnText}>🔄 Refresh</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn, { marginLeft: 8 }]}
            onPress={() => safeCall('Clear Cache', async () => { await audio.clearCache(); setCacheSize(0); })}>
            <Text style={styles.actionBtnText}>🗑️ Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preload Stream</Text>
        <TextInput style={styles.urlInput} value={preloadUrl} onChangeText={setPreloadUrl} placeholder="URL to preload..." placeholderTextColor="#475569" autoCapitalize="none" />
        <TouchableOpacity style={styles.actionBtn} onPress={async () => {
          setPreloadStatus('Preloading...');
          await safeCall('Preload', async () => { await audio.preloadStream(preloadUrl, 30); setPreloadStatus('Preloaded ✅'); refresh(); });
          if (preloadStatus === 'Preloading...') setPreloadStatus('');
        }}>
          <Text style={styles.actionBtnText}>⬇️ Preload (30s)</Text>
        </TouchableOpacity>
        {preloadStatus !== '' && <Text style={[styles.infoText, { marginTop: 8 }]}>{preloadStatus}</Text>}
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════
function SettingsTab() {
  const [spatialAudio, setSpatialAudio] = useState(false);
  const [enhancedBuffer, setEnhancedBuffer] = useState(false);
  const [networkPri, setNetworkPri] = useState<'low' | 'normal' | 'high'>('normal');

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Library Info</Text>
        <Text style={styles.configText}>📦 react-native-audio-stream v2.0</Text>
        <Text style={styles.configText}>📱 Platform: {Platform.OS} ({Platform.Version})</Text>
        <Text style={styles.configText}>🏗️ Expo SDK 55 • ⚛️ React Native 0.83</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Audio Features</Text>
        <TouchableOpacity style={[styles.chipBtn, spatialAudio && styles.chipBtnActive, { marginBottom: 8 }]}
          onPress={() => { const n = !spatialAudio; setSpatialAudio(n); safeCall('Spatial', () => audio.enableSpatialAudio(n)); }}>
          <Text style={[styles.chipText, spatialAudio && styles.chipTextActive]}>🎧 Spatial Audio: {spatialAudio ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chipBtn, enhancedBuffer && styles.chipBtnActive, { marginBottom: 8 }]}
          onPress={() => { const n = !enhancedBuffer; setEnhancedBuffer(n); safeCall('Buffer', () => audio.enableEnhancedBuffering(n)); }}>
          <Text style={[styles.chipText, enhancedBuffer && styles.chipTextActive]}>📦 Enhanced Buffering: {enhancedBuffer ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network Priority</Text>
        <View style={styles.chipRow}>
          {(['low', 'normal', 'high'] as const).map((p) => (
            <TouchableOpacity key={p} style={[styles.chipBtn, networkPri === p && styles.chipBtnActive]}
              onPress={() => { setNetworkPri(p); safeCall('Network', () => audio.setNetworkPriority(p)); }}>
              <Text style={[styles.chipText, networkPri === p && styles.chipTextActive]}>{p.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Audio Focus</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => safeCall('Request Focus', () => audio.requestAudioFocus())}>
            <Text style={styles.actionBtnText}>🔊 Request</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { marginLeft: 8 }]} onPress={() => safeCall('Abandon Focus', () => audio.abandonAudioFocus())}>
            <Text style={styles.actionBtnText}>🔇 Abandon</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Supported Formats</Text>
        <Text style={styles.configText}>MP3, AAC, WAV, OGG, FLAC, PCM</Text>
        <Text style={styles.configText}>HLS (.m3u8) — Both platforms</Text>
        <Text style={styles.configText}>DASH (.mpd) — Android only</Text>
        <Text style={styles.configText}>SmoothStreaming — Android only</Text>
        <Text style={styles.configText}>Extension-less URLs — Auto-detect</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All Features</Text>
        {[
          '✅ Stream reconnect (exponential backoff)',
          '✅ 5-band hardware equalizer',
          '✅ Background playback',
          '✅ Lock screen controls (iOS)',
          '✅ Volume / rate / pitch control',
          '✅ Network state monitoring',
          '✅ Stream caching + preload',
          '✅ Real-time stats',
          '✅ Metadata extraction',
          '✅ WebSocket streaming',
          '✅ Realtime PCM streaming',
          '✅ Playlist / queue management',
          '✅ Live stream (DVR, seek to edge)',
          '✅ Audio recording + VAD',
          '✅ AEC / NS / AGC processing',
          '✅ Spatial audio',
        ].map((f) => <Text key={f} style={styles.configText}>{f}</Text>)}
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: '#16213e' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#e2e8f0' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 16 },
  tabBar: { backgroundColor: '#16213e', paddingBottom: Platform.OS === 'ios' ? 24 : 8, paddingTop: 8, maxHeight: 64 },
  tab: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12, minWidth: 54 },
  tabActive: {},
  tabText: { fontSize: 18 },
  tabLabel: { fontSize: 9, color: '#64748b', marginTop: 2 },
  tabLabelActive: { color: '#818cf8' },
  tabContent: { flex: 1, paddingTop: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  urlInput: { backgroundColor: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowSpread: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  stateText: { color: '#e2e8f0', fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  bufferingText: { color: '#facc15', fontSize: 12, marginLeft: 8 },
  progressContainer: { height: 6, backgroundColor: '#334155', borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#818cf8', borderRadius: 3 },
  timeText: { color: '#64748b', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  controlRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  ctrlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4f46e5' },
  ctrlIcon: { fontSize: 22 },
  playIcon: { fontSize: 28 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipBtn: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 4, marginBottom: 4 },
  chipBtnActive: { backgroundColor: '#4f46e5' },
  chipText: { color: '#94a3b8', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  miniBtnText: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  sliderTrack: { flex: 1, height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: '#818cf8', borderRadius: 3 },
  infoText: { color: '#cbd5e1', fontSize: 14, marginBottom: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { color: '#94a3b8', fontSize: 12, width: '50%', marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  errorCard: { backgroundColor: '#451a1a', borderColor: '#991b1b', borderWidth: 1 },
  errorTitle: { color: '#fca5a5', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  errorText: { color: '#fca5a5', fontSize: 13, marginBottom: 4 },
  errorCode: { color: '#9a5a5a', fontSize: 11 },
  bandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  bandFreq: { color: '#64748b', fontSize: 11, width: 45, textAlign: 'right' },
  bandSlider: { flex: 1, height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  bandFill: { height: '100%', borderRadius: 4 },
  bandGain: { color: '#94a3b8', fontSize: 11, width: 40 },
  cacheSize: { color: '#818cf8', fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  actionBtn: { backgroundColor: '#334155', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#e2e8f0', fontSize: 14, textAlign: 'center' },
  dangerBtn: { backgroundColor: '#7f1d1d' },
  configText: { color: '#cbd5e1', fontSize: 13, marginBottom: 4 },
});
