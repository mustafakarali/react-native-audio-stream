# React Native Audio Stream

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://coff.ee/mustafakarali)

A comprehensive React Native audio streaming library with real-time playback support for iOS and Android. Built with TypeScript and featuring advanced capabilities like buffering management, network resilience, equalizer support, and background playback.

> ⚠️ **Important**: This is a comprehensive implementation but has not been fully tested in production. Please see [TESTING.md](TESTING.md) for testing requirements and known limitations.

## Features

- 🎵 **Real-time Audio Streaming** - Start playback immediately upon receiving first chunk
- 📱 **Cross-Platform** - Full iOS and Android support with platform-specific optimizations
- 🔧 **TypeScript** - Complete type definitions for excellent developer experience
- 🎛️ **Advanced Controls** - Play, pause, stop, seek, volume, and playback rate control
- 📊 **Real-time Statistics** - Network speed, buffer health, latency monitoring
- 🎚️ **Equalizer** - Built-in equalizer with presets
- 💾 **Smart Caching** - Automatic caching with configurable size limits
- 🔄 **Network Resilience** - Automatic reconnection and retry logic
- 🎯 **Background Playback** - Continue playing when app is in background
- 📡 **Multiple Protocols** - Support for HTTP, HTTPS, HLS, DASH, and WebSocket streaming
- 🎨 **Multiple Formats** - MP3, AAC, WAV, OGG, FLAC support
- 🎬 **HLS/DASH Support** - Adaptive bitrate streaming support
- ❌ **Cancel Stream** - Properly cancel ongoing streams

## Compatibility

| React Native Version | Package Version | Status |
|---------------------|----------------|---------|
| 0.80.x              | 1.0.0          | ✅ Supported (needs testing) |
| 0.79.x              | 1.0.0          | ✅ Supported (needs testing) |
| 0.78.x              | 1.0.0          | ✅ Supported (needs testing) |
| 0.77.x              | 1.0.0          | ✅ Supported (needs testing) |
| 0.76.x              | 1.0.0          | ✅ Supported (needs testing) |
| < 0.76              | -              | ❌ Not supported |

## Installation

```bash
npm install @mustafakarali/react-native-audio-stream
# or
yarn add @mustafakarali/react-native-audio-stream
```

### iOS Setup

```bash
cd ios && pod install
```

Add the following to your `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

**[📖 View Detailed iOS Setup Guide](./docs/IOS_SETUP.md)** - Includes troubleshooting, performance tips, and common issues.

### Android Setup

The library automatically handles Android configuration. However, ensure your `minSdkVersion` is at least 21 in `android/build.gradle`.

## Quick Start

```typescript
import AudioStream from '@mustafakarali/react-native-audio-stream';

// Initialize the audio stream
await AudioStream.initialize({
  enableBackgroundMode: true,
  autoPlay: true,
});

// Start streaming
await AudioStream.startStream('https://your-audio-stream-url.mp3');

// Add event listeners
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`Current time: ${progress.currentTime}s`);
});

AudioStream.addEventListener('onError', (error) => {
  console.error('Stream error:', error);
});
```

## API Reference

### Initialization

#### `initialize(config?: AudioStreamConfig): Promise<void>`

Initialize the audio stream with optional configuration.

```typescript
await AudioStream.initialize({
  bufferSize: 64,              // Buffer size in KB (default: 64)
  prebufferThreshold: 16,      // Start playback threshold in KB (default: 16)
  enableBackgroundMode: true,   // Enable background playback (default: false)
  enableCache: true,           // Enable caching (default: false)
  cacheSize: 100,             // Cache size in MB (default: 100)
  logLevel: LogLevel.DEBUG,    // Logging level (default: WARNING)
});
```

### Streaming Control

#### `startStream(url: string, config?: AudioStreamConfig): Promise<void>`

Start streaming from the specified URL.

```typescript
await AudioStream.startStream('https://example.com/audio.mp3', {
  headers: {
    'Authorization': 'Bearer token',
  },
  autoPlay: true,
});
```

#### `stopStream(): Promise<void>`

Stop the current stream and clean up resources.

#### `cancelStream(): Promise<void>`

Cancel the current stream immediately and set state to IDLE. Unlike `stopStream()`, this doesn't wait for cleanup.

### Playback Control

#### `play(): Promise<void>`
Resume playback.

#### `pause(): Promise<void>`
Pause playback.

#### `stop(): Promise<void>`
Stop playback and reset position.

#### `seek(position: number): Promise<void>`
Seek to position in seconds.

```typescript
await AudioStream.seek(30.5); // Seek to 30.5 seconds
```

### Volume and Rate

#### `setVolume(volume: number): Promise<void>`
Set volume (0.0 to 1.0).

#### `setPlaybackRate(rate: number): Promise<void>`
Set playback rate (0.5 to 2.0).

```typescript
await AudioStream.setVolume(0.8);        // 80% volume
await AudioStream.setPlaybackRate(1.5);  // 1.5x speed
```

### State and Information

#### `getState(): Promise<PlaybackState>`
Get current playback state.

#### `getCurrentTime(): Promise<number>`
Get current playback position in seconds.

#### `getDuration(): Promise<number>`
Get total duration in seconds.

#### `getBufferedPercentage(): Promise<number>`
Get buffered percentage (0-100).

#### `getStats(): Promise<PlaybackStats>`
Get detailed playback statistics.

```typescript
const stats = await AudioStream.getStats();
console.log(`Buffer health: ${stats.bufferHealth}%`);
console.log(`Network speed: ${stats.networkSpeed} KB/s`);
```

### Equalizer

#### `setEqualizer(bands: EqualizerBand[]): Promise<void>`
Set custom equalizer bands.

#### `applyEqualizerPreset(preset: EqualizerPreset): Promise<void>`
Apply a preset equalizer configuration.

```typescript
// Apply bass boost preset
await AudioStream.applyEqualizerPreset(EQUALIZER_PRESETS[1]);

// Custom equalizer
await AudioStream.setEqualizer([
  { frequency: 60, gain: 6 },
  { frequency: 230, gain: 4 },
  { frequency: 910, gain: 0 },
  { frequency: 3600, gain: 2 },
  { frequency: 14000, gain: 4 },
]);
```

### Event Handling

#### `addEventListener(event: string, callback: Function): void`

Available events:
- `onStart` - Stream started
- `onBuffer` - Buffer state changed
- `onProgress` - Playback progress update
- `onError` - Error occurred
- `onEnd` - Stream ended
- `onStateChange` - Playback state changed
- `onMetadata` - Metadata received
- `onStats` - Statistics update

```typescript
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`${progress.currentTime}s / ${progress.duration}s`);
});

AudioStream.addEventListener('onError', (error) => {
  if (error.recoverable) {
    // Retry logic
  }
});
```

### Cache Management

#### `clearCache(): Promise<void>`
Clear all cached data.

#### `getCacheSize(): Promise<number>`
Get current cache size in bytes.

#### `preloadStream(url: string, duration?: number): Promise<void>`
Preload a stream for faster playback.

```typescript
// Preload first 30 seconds
await AudioStream.preloadStream(url, 30);
```

### Platform Specific

#### iOS

```typescript
// Set audio session category
await AudioStream.setAudioSessionCategory('playback');
```

#### Android

```typescript
// Request audio focus
const granted = await AudioStream.requestAudioFocus();
```

## Types

### AudioStreamConfig

```typescript
interface AudioStreamConfig {
  bufferSize?: number;
  prebufferThreshold?: number;
  maxBufferSize?: number;
  chunkSize?: number;
  protocol?: StreamingProtocol;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
  format?: AudioFormat;
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
  autoPlay?: boolean;
  enableBackgroundMode?: boolean;
  maintainAudioFocus?: boolean;
  enableCache?: boolean;
  cacheSize?: number;
  cachePath?: string;
  logLevel?: LogLevel;
  headers?: Record<string, string>;
}
```

### PlaybackState

```typescript
enum PlaybackState {
  IDLE = 'idle',
  LOADING = 'loading',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
  COMPLETED = 'completed',
}
```

### PlaybackStats

```typescript
interface PlaybackStats {
  bufferedDuration: number;    // Seconds of buffered content
  playedDuration: number;      // Seconds played
  totalDuration: number;       // Total duration if known
  networkSpeed: number;        // KB/s
  latency: number;            // Network latency in ms
  bufferHealth: number;       // 0-100 percentage
  droppedFrames: number;      // Dropped audio frames
  bitRate: number;           // Actual bitrate in kbps
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    // Initialize audio stream
    AudioStream.initialize({
      enableBackgroundMode: true,
      enableCache: true,
      logLevel: LogLevel.INFO,
    });

    // Setup event listeners
    AudioStream.addEventListener('onStateChange', setState);
    AudioStream.addEventListener('onProgress', (data) => {
      setProgress({ current: data.currentTime, total: data.duration });
    });

    return () => {
      AudioStream.removeAllEventListeners();
      AudioStream.destroy();
    };
  }, []);

  const handlePlay = async () => {
    if (state === PlaybackState.IDLE) {
      await AudioStream.startStream('https://example.com/stream.mp3');
    } else {
      await AudioStream.play();
    }
  };

  return (
    <View>
      <Text>State: {state}</Text>
      <Text>Progress: {progress.current}s / {progress.total}s</Text>
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
    </View>
  );
}
```

## Examples and Demos

### 🎯 Interactive Buffer Demo
We've created a comprehensive demo app that showcases all features with real-time buffer visualization.

**[📁 View Buffer Demo Source Code](./examples/BufferDemo/)**

Features demonstrated:
- Real-time buffer visualization with animated progress bars
- Stream health monitoring (network speed, buffer health, latency)
- Multiple working stream URLs for testing
- Playback controls with seeking capability
- Volume control with slider
- Metadata display (artist, title, album)
- Cache management tools
- Comprehensive error handling

**[📖 View More Examples](./docs/EXAMPLES.md)** - Contains additional code examples for:
- Simple audio player
- Progress tracking
- Buffer monitoring
- Metadata display
- Error handling
- Stream statistics
- And more...

## Advanced Usage

### Custom HTTP Headers

```typescript
await AudioStream.startStream(url, {
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
});
```

### Network Retry Configuration

```typescript
await AudioStream.initialize({
  reconnectAttempts: 5,
  reconnectDelay: 2000,  // 2 seconds
  timeout: 30000,        // 30 seconds
});
```

### Background Mode Setup

iOS: Add audio background mode to `Info.plist`

Android: The library automatically handles background playback.

### Error Handling

```typescript
AudioStream.addEventListener('onError', (error) => {
  console.error(`Error Code: ${error.code}`);
  console.error(`Error Message: ${error.message}`);
  
  if (error.recoverable) {
    // Implement retry logic
    setTimeout(() => {
      AudioStream.startStream(currentUrl);
    }, 3000);
  }
});
```

## Troubleshooting

### iOS Build Issues

1. Clean build folder: `cd ios && xcodebuild clean`
2. Clear pods: `pod deintegrate && pod install`
3. Reset Metro cache: `npx react-native start --reset-cache`

### Android Build Issues

1. Clean gradle: `cd android && ./gradlew clean`
2. Ensure minSdkVersion >= 21
3. Check for conflicting audio libraries

### Common Issues

**Stream not starting:**
- Check network permissions
- Verify URL is accessible
- Check audio format compatibility

**Background playback not working:**
- iOS: Ensure background mode is enabled in Info.plist
- Android: Check battery optimization settings

**Memory issues:**
- Reduce buffer size
- Enable cache size limits
- Call `destroy()` when done

## Performance Tips

1. **Buffer Management**: Adjust `bufferSize` and `prebufferThreshold` based on network conditions
2. **Cache Strategy**: Enable caching for frequently accessed streams
3. **Memory Usage**: Monitor and limit cache size
4. **Network Optimization**: Use appropriate timeout and retry values

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- ☕ [Buy Me a Coffee](https://coff.ee/mustafakarali) - Support the development
- 📧 Email: mustafa@birharika.com
- 🐛 Issues: [GitHub Issues](https://github.com/mustafakarali/react-native-audio-stream/issues)

## Acknowledgments

- Built with ExoPlayer (Android) and AVAudioEngine (iOS)
- Inspired by various React Native audio libraries
- Thanks to all contributors

---

Made with ❤️ by the React Native community 