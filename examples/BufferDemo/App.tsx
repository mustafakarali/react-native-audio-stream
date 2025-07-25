import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AudioStream from '@mustafakarali/react-native-audio-stream';

const { width: screenWidth } = Dimensions.get('window');

// PlaybackState enum values (as strings)
const PlaybackState = {
  IDLE: 'idle',
  LOADING: 'loading',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error',
  COMPLETED: 'completed',
};

// Working stream URLs - tested and verified
const SAMPLE_STREAMS = [
  { name: 'SoundHelix Demo', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: 'Radio Paradise (AAC)', url: 'https://stream.radioparadise.com/aac-320' },
  { name: 'Radio Paradise (MP3)', url: 'https://stream.radioparadise.com/mp3-320' },
  { name: 'Classical Radio', url: 'https://live.musopen.org:8085/streamvbr0' },
  { name: 'Jazz Radio', url: 'https://jazz.streamr.ru/jazz-64.mp3' },
  { name: 'Lofi Hip Hop', url: 'https://usa9.fastcast4u.com/proxy/jamz?mp=/1' },
  { name: 'SomaFM - Groove Salad', url: 'https://somafm.com/groovesalad256.pls' },
  { name: 'Test MP3 Stream', url: 'https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3' },
  { name: 'Kafa Radyo', url: 'https://moondigitaledge2.radyotvonline.net/kafaradyo/playlist.m3u8' },
  { name: 'BBC Radio 1', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_one' },
  { name: 'Streaming Test (HLS)', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
];

// Time formatting helper
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Helper function to detect stream type
const getStreamType = (url: string): string => {
  if (url.includes('.m3u8')) return 'HLS';
  if (url.includes('.mpd')) return 'DASH';
  if (url.includes('.mp3')) return 'MP3';
  if (url.includes('.aac')) return 'AAC';
  if (url.includes('.ogg')) return 'OGG';
  if (url.includes('.flac')) return 'FLAC';
  return 'HTTP Stream';
};

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Buffer visualization component
const BufferVisualizer: React.FC<{
  currentTime: number;
  duration: number;
  bufferedPercentage: number;
  isBuffering: boolean;
  onSeek: (value: number) => void;
}> = ({ currentTime, duration, bufferedPercentage, isBuffering, onSeek }) => {
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Buffer pulse animation
  useEffect(() => {
    if (isBuffering) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(1);
    }
  }, [isBuffering, pulseAnimation]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.bufferContainer}>
      {/* Main progress bar */}
      <View style={styles.progressBarContainer}>
        {/* Buffer indicator (background) */}
        <View 
          style={[
            styles.bufferBar,
            { width: `${Math.min(bufferedPercentage, 100)}%` }
          ]} 
        />
        
        {/* Playback progress */}
        <View 
          style={[
            styles.progressBar,
            { width: `${Math.min(progressPercentage, 100)}%` }
          ]} 
        />

        {/* Buffer loading animation */}
        {isBuffering && (
          <Animated.View 
            style={[
              styles.bufferIndicator,
              {
                left: `${Math.min(progressPercentage, 100)}%`,
                transform: [{ scale: pulseAnimation }]
              }
            ]} 
          />
        )}
      </View>

      {/* Time labels */}
      <View style={styles.timeLabels}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.bufferText}>
          Buffer: {Math.round(bufferedPercentage)}%
          {isBuffering && ' ⏳'}
        </Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* Seek slider (invisible, on top) */}
      {duration > 0 && (
        <Slider
          style={styles.seekSlider}
          minimumValue={0}
          maximumValue={duration}
          value={currentTime}
          onSlidingComplete={onSeek}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor="transparent"
        />
      )}
    </View>
  );
};

// Main component
const App: React.FC = () => {
  // State definitions
  const [isInitialized, setIsInitialized] = useState(false);
  const [streamUrl, setStreamUrl] = useState(SAMPLE_STREAMS[0].url);
  const [playbackState, setPlaybackState] = useState(PlaybackState.IDLE);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercentage, setBufferedPercentage] = useState(0);
  const [volume, setVolume] = useState(1);
  const [metadata, setMetadata] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkSpeed, setNetworkSpeed] = useState(0);
  const [bufferHealth, setBufferHealth] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [enableBackgroundMode, setEnableBackgroundMode] = useState(true);
  const [detailedStats, setDetailedStats] = useState<any>(null);
  const [bufferEvents, setBufferEvents] = useState<string[]>([]);
  const [streamHistory, setStreamHistory] = useState<any[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Animation refs
  const bufferHealthAnimation = useRef(new Animated.Value(100)).current;
  const networkSpeedAnimation = useRef(new Animated.Value(0)).current;

  // Initialize AudioStream
  useEffect(() => {
    initializeAudioStream();
    return () => {
      AudioStream.destroy().catch(console.error);
    };
  }, []);

  // Handle background mode change
  useEffect(() => {
    // Background mode is set during initialization
    // No need to reinitialize on toggle
    if (playbackState === PlaybackState.PLAYING && !enableBackgroundMode) {
      console.warn('Background mode disabled - playback may stop when app goes to background');
    }
  }, [enableBackgroundMode, playbackState]);

  // Update buffer percentage from stats
  useEffect(() => {
    // Buffer percentage is now updated through onStats event
    // No need for separate polling
    if (playbackState === PlaybackState.IDLE || playbackState === PlaybackState.STOPPED) {
      setBufferedPercentage(0);
    }
  }, [playbackState]);

  const initializeAudioStream = async () => {
    try {
      await AudioStream.initialize({
        bufferSize: 16,  // Smaller buffer for faster start
        prebufferThreshold: 8,  // Lower threshold
        maxBufferSize: 128,  // Smaller max buffer
        enableBackgroundMode,
        maintainAudioFocus: true,
        logLevel: 'INFO',
        reconnectAttempts: 3,
        reconnectDelay: 1000,
        enableCache: true,
        cacheSize: 50, // 50MB cache
      });
      
      // Add event listeners
      AudioStream.addEventListener('onStateChange', (state: string) => {
        console.log('State changed:', state);
        setPlaybackState(state);
        setIsLoading(state === PlaybackState.LOADING);
      });

      AudioStream.addEventListener('onBuffer', (buffering: boolean) => {
        console.log('Buffering:', buffering);
        setIsBuffering(buffering);
        
        // Track buffer events
        const event = `${new Date().toLocaleTimeString()}: Buffer ${buffering ? 'started' : 'ended'}`;
        setBufferEvents(prev => [...prev.slice(-9), event]);
      });

      AudioStream.addEventListener('onProgress', (progress: any) => {
        setCurrentTime(progress.currentTime || 0);
        setDuration(progress.duration || 0);
      });

      AudioStream.addEventListener('onMetadata', (meta: any) => {
        console.log('Metadata:', meta);
        setMetadata(meta);
      });

      AudioStream.addEventListener('onStats', (streamStats: any) => {
        const stats = streamStats.stats;
        if (stats) {
          setStats(stats);
          setDetailedStats(stats);
          setNetworkSpeed(stats.networkSpeed || 0);
          setBufferHealth(stats.bufferHealth || 0);
          
          // Update buffer percentage from stats
          if (stats.bufferedPercentage !== undefined) {
            setBufferedPercentage(stats.bufferedPercentage);
          }
          
          // Update animations
          Animated.timing(bufferHealthAnimation, {
            toValue: stats.bufferHealth || 0,
            duration: 300,
            useNativeDriver: false,
          }).start();
          
          Animated.timing(networkSpeedAnimation, {
            toValue: Math.min(stats.networkSpeed || 0, 1000),
            duration: 300,
            useNativeDriver: false,
          }).start();
        }
      });

      AudioStream.addEventListener('onError', (error: any) => {
        console.error('Stream error:', error);
        console.error('Error details:', JSON.stringify(error.details || {}, null, 2));
        setError(`${error.code}: ${error.message}`);
        setIsLoading(false);
        
        // More detailed error alert
        Alert.alert(
          'Stream Error', 
          `${error.message}\n\nCode: ${error.code}\nRecoverable: ${error.recoverable ? 'Yes' : 'No'}`,
          error.recoverable ? [
            {text: 'Retry', onPress: () => startStream()},
            {text: 'Cancel', style: 'cancel'}
          ] : [{text: 'OK'}]
        );
      });

      AudioStream.addEventListener('onEnd', () => {
        console.log('Stream ended');
        setBufferedPercentage(0);
        setCurrentTime(0);
      });

      // Request audio focus (Android)
      if (Platform.OS === 'android') {
        const granted = await AudioStream.requestAudioFocus();
        console.log('Audio focus granted:', granted);
      }

      setIsInitialized(true);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError('Failed to initialize AudioStream');
      Alert.alert('Initialization Error', 'Failed to initialize audio stream');
    }
  };

  // Start stream
  const startStream = async () => {
    if (!streamUrl) {
      Alert.alert('Error', 'Please enter a stream URL');
      return;
    }

    try {
      setError(null);
      setBufferedPercentage(0);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(true);
      
      await AudioStream.startStream(streamUrl, {
        autoPlay: true,
        headers: {
          'User-Agent': 'React Native Audio Stream Demo/1.0',
        },
      });
    } catch (err: any) {
      console.error('Start stream error:', err);
      setError('Failed to start stream');
      setIsLoading(false);
      Alert.alert('Stream Error', 'Failed to start stream. Please check the URL.');
    }
  };

  // Play/Pause toggle
  const togglePlayPause = async () => {
    try {
      if (playbackState === PlaybackState.PLAYING) {
        await AudioStream.pause();
      } else if (playbackState === PlaybackState.PAUSED) {
        await AudioStream.play();
      } else if (playbackState === PlaybackState.IDLE || playbackState === PlaybackState.STOPPED) {
        await startStream();
      }
    } catch (err) {
      console.error('Play/Pause error:', err);
      Alert.alert('Playback Error', 'Failed to control playback');
    }
  };

  // Stop stream
  const stopStream = async () => {
    try {
      await AudioStream.stop();
      setBufferedPercentage(0);
      setCurrentTime(0);
    } catch (err) {
      console.error('Stop error:', err);
    }
  };

  // Cancel stream
  const cancelStream = async () => {
    try {
      await AudioStream.cancelStream();
      setBufferedPercentage(0);
      setCurrentTime(0);
      setDuration(0);
      setStats(null);
      setMetadata(null);
      setDetailedStats(null);
    } catch (err) {
      console.error('Cancel stream error:', err);
    }
  };

  // Volume change handler
  const handleVolumeChange = async (value: number) => {
    try {
      setVolume(value);
      await AudioStream.setVolume(value);
    } catch (err) {
      console.error('Volume error:', err);
    }
  };

  // Seek handler
  const handleSeek = async (value: number) => {
    try {
      await AudioStream.seek(value);
    } catch (err) {
      console.error('Seek error:', err);
      Alert.alert('Seek Error', 'Cannot seek in this stream');
    }
  };

  // Clear cache
  const clearCache = async () => {
    try {
      await AudioStream.clearCache();
      Alert.alert('Success', 'Cache cleared successfully');
    } catch (err) {
      console.error('Clear cache error:', err);
      Alert.alert('Error', 'Failed to clear cache');
    }
  };

  // Show cache size
  const showCacheSize = async () => {
    try {
      const size = await AudioStream.getCacheSize();
      const sizeInMB = (size / (1024 * 1024)).toFixed(2);
      Alert.alert('Cache Size', `Current cache size: ${sizeInMB} MB`);
    } catch (err) {
      console.error('Get cache size error:', err);
      Alert.alert('Error', 'Failed to get cache size');
    }
  };

  // Get play button text
  const getPlayButtonText = (): string => {
    if (isLoading) return '⏳ Loading...';
    
    switch (playbackState) {
      case PlaybackState.PLAYING:
        return '⏸️ Pause';
      case PlaybackState.PAUSED:
      case PlaybackState.IDLE:
      case PlaybackState.STOPPED:
      case PlaybackState.ERROR:
        return '▶️ Play';
      case PlaybackState.LOADING:
      case PlaybackState.BUFFERING:
        return '⏳ Loading...';
      default:
        return '▶️ Play';
    }
  };

  // Get state color
  const getStateColor = (): string => {
    switch (playbackState) {
      case PlaybackState.PLAYING:
        return '#4CAF50';
      case PlaybackState.PAUSED:
        return '#FF9800';
      case PlaybackState.ERROR:
        return '#F44336';
      case PlaybackState.BUFFERING:
      case PlaybackState.LOADING:
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  // Buffer health color
  const getBufferHealthColor = (health: number): string => {
    if (health >= 75) return '#4CAF50';
    if (health >= 50) return '#FF9800';
    if (health >= 25) return '#FF5722';
    return '#F44336';
  };

  // Network speed color
  const getNetworkSpeedColor = (speed: number): string => {
    if (speed >= 500) return '#4CAF50';
    if (speed >= 200) return '#FF9800';
    if (speed >= 100) return '#FF5722';
    return '#F44336';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>🎵 Audio Stream Buffer Demo</Text>
          <Text style={styles.version}>v1.3.0 - Real-time Buffer Monitor</Text>
        </View>

        {!isInitialized ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Initializing AudioStream...</Text>
          </View>
        ) : (
          <>
            {/* URL Input */}
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
              
              {/* Sample Streams */}
              <View style={styles.samples}>
                {SAMPLE_STREAMS.map((sample, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.sampleButton}
                    onPress={() => setStreamUrl(sample.url)}
                  >
                    <Text style={styles.sampleText}>{sample.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status Indicator */}
            <View style={styles.section}>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: getStateColor() }]} />
                <Text style={styles.statusText}>
                  Status: {playbackState}
                </Text>
              </View>
              {error && <Text style={styles.errorText}>❌ {error}</Text>}
            </View>

            {/* Buffer Visualization */}
            {(playbackState !== PlaybackState.IDLE && playbackState !== PlaybackState.STOPPED) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Buffer Status</Text>
                <BufferVisualizer
                  currentTime={currentTime}
                  duration={duration}
                  bufferedPercentage={bufferedPercentage}
                  isBuffering={isBuffering}
                  onSeek={handleSeek}
                />
              </View>
            )}

            {/* Metadata */}
            {(metadata && Object.keys(metadata).length > 0) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎵 Now Playing</Text>
                <Text style={styles.metadataText}>
                  🎤 Artist: {metadata.artist || 'Unknown Artist'}
                </Text>
                <Text style={styles.metadataText}>
                  🎵 Title: {metadata.title || 'Unknown Title'}
                </Text>
                <Text style={styles.metadataText}>
                  💿 Album: {metadata.album || 'Unknown Album'}
                </Text>
                {metadata.duration && (
                  <Text style={styles.metadataText}>
                    ⏱️ Duration: {formatTime(metadata.duration)}
                  </Text>
                )}
              </View>
            ) : (
              playbackState === PlaybackState.PLAYING && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🎵 Now Playing</Text>
                  <Text style={styles.metadataText}>No metadata available</Text>
                  <Text style={styles.metadataText}>Stream: {getStreamType(streamUrl)}</Text>
                </View>
              )
            )}

            {/* Background Mode Toggle */}
            <View style={styles.section}>
              <View style={styles.toggleContainer}>
                <Text style={styles.sectionTitle}>Background Mode</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, enableBackgroundMode && styles.toggleButtonActive]}
                  onPress={() => setEnableBackgroundMode(!enableBackgroundMode)}
                >
                  <Text style={styles.toggleText}>
                    {enableBackgroundMode ? 'Enabled' : 'Disabled'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Detailed Buffer Information */}
            {detailedStats && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Detailed Buffer Information</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Buffered Position:</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(detailedStats.bufferedPosition || 0)}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Position:</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(detailedStats.currentPosition || 0)}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Buffer Percentage:</Text>
                  <Text style={[styles.detailValue,
                    { fontWeight: 'bold', color: detailedStats.bufferedPercentage > 0 ? '#4CAF50' : '#F44336' }
                  ]}>
                    {detailedStats.bufferedPercentage || 0}%
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Is Buffering:</Text>
                  <Text style={[styles.detailValue, 
                    detailedStats.isBuffering && { color: '#FF5722' }
                  ]}>
                    {detailedStats.isBuffering ? 'Yes ⏳' : 'No ✅'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Play When Ready:</Text>
                  <Text style={styles.detailValue}>
                    {detailedStats.playWhenReady ? 'Yes' : 'No'}
                  </Text>
                </View>

                {/* Buffer chunks visualization */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Buffer Size:</Text>
                  <Text style={styles.detailValue}>
                    {((detailedStats.bufferedPosition - detailedStats.currentPosition) * 1000).toFixed(0)} ms
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Buffered:</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(detailedStats.bufferedDuration || 0)}
                  </Text>
                </View>
              </View>
            )}

            {/* Real-time Buffer Monitor */}
            {stats && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔴 Real-time Buffer Monitor</Text>
                
                {/* Live buffer chunks */}
                <View style={styles.bufferChunksContainer}>
                  <Text style={styles.bufferChunkLabel}>Buffer Chunks:</Text>
                  <View style={styles.bufferChunks}>
                    {Array.from({ length: 10 }).map((_, index) => {
                      const isBuffered = stats.bufferedPercentage > (index * 10);
                      const isCurrent = Math.floor((currentTime / duration) * 10) === index;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.bufferChunk,
                            isBuffered && styles.bufferChunkFilled,
                            isCurrent && styles.bufferChunkCurrent,
                          ]}
                        >
                          <Text style={styles.chunkText}>{index * 10}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Buffer percentage display */}
                <View style={styles.bufferPercentageContainer}>
                  <Text style={styles.bufferPercentageLabel}>Buffer Fill:</Text>
                  <View style={styles.bufferPercentageBar}>
                    <View 
                      style={[
                        styles.bufferPercentageFill,
                        { 
                          width: `${stats.bufferedPercentage || 0}%`,
                          backgroundColor: stats.bufferedPercentage > 50 ? '#4CAF50' : '#FF9800'
                        }
                      ]} 
                    />
                    <Text style={styles.bufferPercentageText}>
                      {stats.bufferedPercentage || 0}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Buffer Statistics */}
            {stats && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Buffer Statistics</Text>
                
                {/* Buffer Health */}
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Buffer Health</Text>
                  <View style={styles.statBarContainer}>
                    <Animated.View 
                      style={[
                        styles.statBar,
                        {
                          width: bufferHealthAnimation.interpolate({
                            inputRange: [0, 100],
                            outputRange: ['0%', '100%'],
                          }),
                          backgroundColor: getBufferHealthColor(bufferHealth),
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.statValue, { color: getBufferHealthColor(bufferHealth) }]}>
                    {Math.round(bufferHealth)}%
                  </Text>
                </View>

                {/* Network Speed */}
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Network Speed</Text>
                  <View style={styles.statBarContainer}>
                    <Animated.View 
                      style={[
                        styles.statBar,
                        {
                          width: networkSpeedAnimation.interpolate({
                            inputRange: [0, 1000],
                            outputRange: ['0%', '100%'],
                          }),
                          backgroundColor: getNetworkSpeedColor(networkSpeed),
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.statValue, { color: getNetworkSpeedColor(networkSpeed) }]}>
                    {Math.round(networkSpeed)} KB/s
                  </Text>
                </View>

                {/* Other statistics */}
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Buffered</Text>
                    <Text style={styles.statValue}>{formatTime(stats.bufferedDuration)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Bitrate</Text>
                    <Text style={styles.statValue}>{Math.round(stats.bitRate)} kbps</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Played</Text>
                    <Text style={styles.statValue}>{formatTime(stats.playedDuration)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Latency</Text>
                    <Text style={styles.statValue}>{stats.latency} ms</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Control Buttons */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={togglePlayPause}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>{getPlayButtonText()}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={stopStream}
              >
                <Text style={styles.buttonText}>⏹️ Stop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={cancelStream}
              >
                <Text style={styles.buttonText}>❌ Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Buffer Events History */}
            {bufferEvents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Buffer Events History</Text>
                <ScrollView style={styles.eventHistory}>
                  {bufferEvents.map((event, index) => (
                    <Text key={index} style={styles.eventText}>{event}</Text>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Advanced Stream Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎛️ Advanced Controls</Text>
              
              {/* Network Priority */}
              <View style={styles.advancedControlRow}>
                <Text style={styles.advancedControlLabel}>Network Priority:</Text>
                <View style={styles.priorityButtons}>
                  <TouchableOpacity
                    style={[styles.priorityButton, styles.priorityLow]}
                    onPress={() => AudioStream.setNetworkPriority('low')}
                  >
                    <Text style={styles.priorityButtonText}>Low</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButton, styles.priorityNormal]}
                    onPress={() => AudioStream.setNetworkPriority('normal')}
                  >
                    <Text style={styles.priorityButtonText}>Normal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButton, styles.priorityHigh]}
                    onPress={() => AudioStream.setNetworkPriority('high')}
                  >
                    <Text style={styles.priorityButtonText}>High</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Playback Rate */}
              <View style={styles.advancedControlRow}>
                <Text style={styles.advancedControlLabel}>Speed: {playbackSpeed.toFixed(1)}x</Text>
                <Slider
                  style={styles.rateSlider}
                  minimumValue={0.5}
                  maximumValue={2.0}
                  value={playbackSpeed}
                  onValueChange={async (value) => {
                    setPlaybackSpeed(value);
                    await AudioStream.setPlaybackRate(value);
                  }}
                  minimumTrackTintColor="#2196F3"
                  maximumTrackTintColor="#CCCCCC"
                  thumbTintColor="#2196F3"
                />
              </View>
            </View>

            {/* Network Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🌐 Network Status</Text>
              <View style={styles.networkStatus}>
                <View style={[styles.networkIndicator, { backgroundColor: networkSpeed > 200 ? '#4CAF50' : '#FF5722' }]} />
                <Text style={styles.networkText}>
                  {networkSpeed > 0 ? `Connected (${Math.round(networkSpeed)} KB/s)` : 'Connecting...'}
                </Text>
              </View>
              
              {/* Stream Info */}
              {stats && (
                <View style={styles.streamInfo}>
                  <Text style={styles.streamInfoText}>Protocol: {getStreamType(streamUrl)}</Text>
                  <Text style={styles.streamInfoText}>Bitrate: {stats.bitRate || 0} kbps</Text>
                  <Text style={styles.streamInfoText}>Buffer Size: {((stats.bufferedPosition - stats.currentPosition) * 1000).toFixed(0)} ms</Text>
                  <Text style={styles.streamInfoText}>Latency: {stats.latency || 0} ms</Text>
                  <Text style={styles.streamInfoText}>Played: {formatTime(stats.playedDuration || 0)}</Text>
                  <Text style={styles.streamInfoText}>Buffered: {formatTime(stats.bufferedDuration || 0)}</Text>
                  <Text style={styles.streamInfoText}>Network Speed: {Math.round(stats.networkSpeed || 0)} KB/s</Text>
                  <Text style={styles.streamInfoText}>Buffer Health: {Math.round(stats.bufferHealth || 0)}%</Text>
                </View>
              )}
            </View>

            {/* Cache Controls */}
            <View style={styles.cacheControls}>
              <TouchableOpacity
                style={[styles.button, styles.cacheButton]}
                onPress={clearCache}
              >
                <Text style={styles.buttonText}>🗑️ Clear Cache</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.cacheButton]}
                onPress={showCacheSize}
              >
                <Text style={styles.buttonText}>📊 Cache Size</Text>
              </TouchableOpacity>
            </View>

            {/* Volume Control */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volume: {Math.round(volume * 100)}%</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={volume}
                onValueChange={handleVolumeChange}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#CCCCCC"
                thumbTintColor="#4CAF50"
              />
            </View>

            {/* Info Section */}
            <View style={styles.section}>
              <Text style={styles.infoTitle}>Buffer Configuration:</Text>
              <Text style={styles.infoText}>• Buffer Size: 16 KB (small for quick start)</Text>
              <Text style={styles.infoText}>• Prebuffer Threshold: 8 KB</Text>
              <Text style={styles.infoText}>• Max Buffer: 128 KB</Text>
              <Text style={styles.infoText}>• This configuration prioritizes quick playback start</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  version: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  samples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  sampleButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 8,
  },
  sampleText: {
    fontSize: 12,
    color: '#1976D2',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: '#F44336',
    marginTop: 8,
    fontSize: 14,
  },
  metadataText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  cacheControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#757575',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  cacheButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  
  // Buffer visualization styles
  bufferContainer: {
    marginTop: 10,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  bufferBar: {
    height: '100%',
    backgroundColor: '#B3E5FC',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  bufferIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF5722',
    position: 'absolute',
    top: -4,
    marginLeft: -10,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  bufferText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  seekSlider: {
    position: 'absolute',
    width: '100%',
    height: 40,
    top: -14,
    opacity: 0.01, // Invisible but touchable
  },
  
  // Statistics styles
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  statBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  statBar: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 80,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statItem: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  
  // Buffer chunks styles
  bufferChunksContainer: {
    marginVertical: 10,
  },
  bufferChunkLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  bufferChunks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  bufferChunk: {
    width: 40,
    height: 40,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
    marginBottom: 5,
  },
  bufferChunkFilled: {
    backgroundColor: '#2196F3',
  },
  bufferChunkCurrent: {
    borderWidth: 2,
    borderColor: '#FF5722',
  },
  chunkText: {
    fontSize: 10,
    color: '#666',
  },
  
  // Buffer percentage styles
  bufferPercentageContainer: {
    marginTop: 20,
  },
  bufferPercentageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  bufferPercentageBar: {
    height: 30,
    backgroundColor: '#E0E0E0',
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  bufferPercentageFill: {
    height: '100%',
    borderRadius: 15,
  },
  bufferPercentageText: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    textAlign: 'center',
    lineHeight: 30,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  eventHistory: {
    maxHeight: 150,
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  eventText: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
  advancedControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  advancedControlLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  priorityLow: {
    backgroundColor: '#9E9E9E',
  },
  priorityNormal: {
    backgroundColor: '#2196F3',
  },
  priorityHigh: {
    backgroundColor: '#FF5722',
  },
  priorityButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rateSlider: {
    flex: 1,
    marginLeft: 20,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  networkIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  networkText: {
    fontSize: 14,
    color: '#333',
  },
  streamInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  streamInfoText: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
});

export default App; 