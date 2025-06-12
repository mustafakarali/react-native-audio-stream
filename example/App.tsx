import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import AudioStream, {
  PlaybackState,
  AudioStreamConfig,
  LogLevel,
  EQUALIZER_PRESETS,
  type PlaybackStats,
  type AudioMetadata,
  type StreamError,
} from 'react-native-audio-stream';

const SAMPLE_STREAMS = [
  {
    name: 'MP3 Stream',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    name: 'Radio Stream',
    url: 'http://ice1.somafm.com/groovesalad-256-mp3',
  },
  {
    name: 'HLS Stream',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
  },
];

export default function App() {
  const [streamUrl, setStreamUrl] = useState(SAMPLE_STREAMS[0].url);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0, percentage: 0 });
  const [volume, setVolume] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [stats, setStats] = useState<PlaybackStats | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [selectedEqualizer, setSelectedEqualizer] = useState(0);

  useEffect(() => {
    initializeAudioStream();
    return () => {
      AudioStream.destroy();
    };
  }, []);

  const initializeAudioStream = async () => {
    try {
      const config: AudioStreamConfig = {
        bufferSize: 64,
        prebufferThreshold: 16,
        enableBackgroundMode: true,
        maintainAudioFocus: true,
        enableCache: true,
        cacheSize: 100,
        logLevel: LogLevel.DEBUG,
        autoPlay: true,
      };

      await AudioStream.initialize(config);
      
      // Setup event listeners
      AudioStream.addEventListener('onStateChange', setPlaybackState);
      AudioStream.addEventListener('onBuffer', setIsBuffering);
      AudioStream.addEventListener('onProgress', setProgress);
      AudioStream.addEventListener('onStats', setStats);
      AudioStream.addEventListener('onMetadata', setMetadata);
      AudioStream.addEventListener('onError', handleError);
      AudioStream.addEventListener('onEnd', handleStreamEnd);

      // Request audio focus on iOS
      if (Platform.OS === 'ios') {
        await AudioStream.setAudioSessionCategory('playback');
      }
      
      await AudioStream.requestAudioFocus();
      
      setIsInitialized(true);
    } catch (err) {
      Alert.alert('Initialization Error', 'Failed to initialize audio stream');
      console.error('Failed to initialize:', err);
    }
  };

  const handleError = useCallback((error: StreamError) => {
    setError(error);
    Alert.alert(
      'Stream Error',
      `${error.message}\nCode: ${error.code}`,
      [
        { text: 'OK', onPress: () => setError(null) },
        error.recoverable && { text: 'Retry', onPress: handleRetry },
      ].filter(Boolean) as any
    );
  }, []);

  const handleStreamEnd = useCallback(() => {
    console.log('Stream ended');
  }, []);

  const handleRetry = async () => {
    if (streamUrl) {
      await startStream();
    }
  };

  const startStream = async () => {
    try {
      await AudioStream.startStream(streamUrl);
    } catch (err) {
      console.error('Failed to start stream:', err);
    }
  };

  const handlePlay = async () => {
    if (playbackState === PlaybackState.IDLE || playbackState === PlaybackState.STOPPED) {
      await startStream();
    } else {
      await AudioStream.play();
    }
  };

  const handlePause = async () => {
    await AudioStream.pause();
  };

  const handleStop = async () => {
    await AudioStream.stop();
  };

  const handleSeek = async (position: number) => {
    await AudioStream.seek(position);
  };

  const handleVolumeChange = async (value: number) => {
    setVolume(value);
    await AudioStream.setVolume(value);
  };

  const handlePlaybackRateChange = async (rate: number) => {
    setPlaybackRate(rate);
    await AudioStream.setPlaybackRate(rate);
  };

  const handleEqualizerChange = async (index: number) => {
    setSelectedEqualizer(index);
    const preset = EQUALIZER_PRESETS[index];
    await AudioStream.applyEqualizerPreset(preset);
  };

  const clearCache = async () => {
    try {
      await AudioStream.clearCache();
      const cacheSize = await AudioStream.getCacheSize();
      Alert.alert('Cache Cleared', `Cache size: ${(cacheSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isPlaying = playbackState === PlaybackState.PLAYING;
  const canPlay = isInitialized && !isBuffering;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>React Native Audio Stream</Text>

      {/* Stream URL Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stream URL</Text>
        <TextInput
          style={styles.input}
          value={streamUrl}
          onChangeText={setStreamUrl}
          placeholder="Enter stream URL"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.sampleStreams}>
          {SAMPLE_STREAMS.map((stream, index) => (
            <TouchableOpacity
              key={index}
              style={styles.sampleButton}
              onPress={() => setStreamUrl(stream.url)}
            >
              <Text style={styles.sampleButtonText}>{stream.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Playback State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback State</Text>
        <View style={styles.stateContainer}>
          <Text style={styles.state}>{playbackState.toUpperCase()}</Text>
          {isBuffering && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controls</Text>
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, !canPlay && styles.buttonDisabled]}
            onPress={handlePlay}
            disabled={!canPlay}
          >
            <Text style={styles.buttonText}>{isPlaying ? 'Playing' : 'Play'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, !isPlaying && styles.buttonDisabled]}
            onPress={handlePause}
            disabled={!isPlaying}
          >
            <Text style={styles.buttonText}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, playbackState === PlaybackState.IDLE && styles.buttonDisabled]}
            onPress={handleStop}
            disabled={playbackState === PlaybackState.IDLE}
          >
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressContainer}>
          <Text style={styles.time}>{formatTime(progress.currentTime)}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress.percentage}%` }]} />
          </View>
          <Text style={styles.time}>{formatTime(progress.duration)}</Text>
        </View>
        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => handleSeek(progress.duration * 0.5)}
          disabled={!progress.duration}
        >
          <Text style={styles.seekButtonText}>Seek to 50%</Text>
        </TouchableOpacity>
      </View>

      {/* Volume Control */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Volume: {Math.round(volume * 100)}%</Text>
        <View style={styles.sliderContainer}>
          <TouchableOpacity onPress={() => handleVolumeChange(0)}>
            <Text>0%</Text>
          </TouchableOpacity>
          <View style={styles.slider}>
            <TouchableOpacity onPress={() => handleVolumeChange(0.5)}>
              <Text style={styles.sliderText}>50%</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => handleVolumeChange(1)}>
            <Text>100%</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Playback Rate */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback Rate</Text>
        <View style={styles.rateButtons}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <TouchableOpacity
              key={rate}
              style={[styles.rateButton, playbackRate === rate && styles.rateButtonActive]}
              onPress={() => handlePlaybackRateChange(rate)}
            >
              <Text style={[styles.rateButtonText, playbackRate === rate && styles.rateButtonTextActive]}>
                {rate}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Equalizer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equalizer</Text>
        <View style={styles.equalizerButtons}>
          {EQUALIZER_PRESETS.map((preset, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.eqButton, selectedEqualizer === index && styles.eqButtonActive]}
              onPress={() => handleEqualizerChange(index)}
            >
              <Text style={[styles.eqButtonText, selectedEqualizer === index && styles.eqButtonTextActive]}>
                {preset.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Metadata */}
      {metadata && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metadata</Text>
          <View style={styles.metadata}>
            {metadata.title && <Text style={styles.metadataText}>Title: {metadata.title}</Text>}
            {metadata.artist && <Text style={styles.metadataText}>Artist: {metadata.artist}</Text>}
            {metadata.album && <Text style={styles.metadataText}>Album: {metadata.album}</Text>}
            {metadata.duration && <Text style={styles.metadataText}>Duration: {formatTime(metadata.duration)}</Text>}
          </View>
        </View>
      )}

      {/* Statistics */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.stats}>
            <Text style={styles.statText}>Buffer: {stats.bufferedDuration.toFixed(1)}s</Text>
            <Text style={styles.statText}>Network: {stats.networkSpeed.toFixed(1)} KB/s</Text>
            <Text style={styles.statText}>Bitrate: {stats.bitRate.toFixed(0)} kbps</Text>
            <Text style={styles.statText}>Buffer Health: {stats.bufferHealth}%</Text>
          </View>
        </View>
      )}

      {/* Cache Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cache</Text>
        <TouchableOpacity style={styles.button} onPress={clearCache}>
          <Text style={styles.buttonText}>Clear Cache</Text>
        </TouchableOpacity>
      </View>

      {/* Error Display */}
      {error && (
        <View style={[styles.section, styles.errorSection]}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <Text style={styles.errorCode}>Code: {error.code}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  sampleStreams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sampleButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  sampleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  stateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  state: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  time: {
    fontSize: 12,
    color: '#666',
    minWidth: 40,
  },
  seekButton: {
    alignSelf: 'center',
    marginTop: 5,
  },
  seekButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slider: {
    flex: 1,
    alignItems: 'center',
  },
  sliderText: {
    color: '#007AFF',
  },
  rateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  rateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  rateButtonActive: {
    backgroundColor: '#007AFF',
  },
  rateButtonText: {
    fontSize: 14,
    color: '#333',
  },
  rateButtonTextActive: {
    color: 'white',
  },
  equalizerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  eqButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
    marginRight: 8,
  },
  eqButtonActive: {
    backgroundColor: '#007AFF',
  },
  eqButtonText: {
    fontSize: 14,
    color: '#333',
  },
  eqButtonTextActive: {
    color: 'white',
  },
  metadata: {
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 4,
  },
  metadataText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    width: '48%',
    marginBottom: 4,
  },
  errorSection: {
    backgroundColor: '#fee',
    borderColor: '#fcc',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c00',
    marginBottom: 5,
  },
  errorText: {
    fontSize: 14,
    color: '#800',
    marginBottom: 3,
  },
  errorCode: {
    fontSize: 12,
    color: '#666',
  },
}); 