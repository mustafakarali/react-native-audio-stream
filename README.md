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
- 🎨 **Multiple Formats** - MP3, AAC, WAV, OGG, FLAC, PCM support
- 🎬 **HLS/DASH Support** - Native adaptive bitrate streaming support
- ❌ **Cancel Stream** - Properly cancel ongoing streams
- 🎙️ **iOS Features (Future)** - AirPods high-quality recording, input device picker, spatial audio
- 🚀 **Enhanced Buffering** - AirPlay 2 enhanced buffering for better performance
- 📍 **AVQueuePlayer Support** - Enhanced playback capabilities with queue management

## Compatibility

| RN Audio Stream | React Native | iOS | Android | Expo SDK |
|-----------------|--------------|-----|---------|----------|
| 1.0.0+          | 0.64+        | 11+ | 21+     | 43+      |
| 1.4.x           | 0.71+        | 13+ | 23+     | 48+      |
| 1.5.x - 1.6.x   | 0.73+        | 13+ | 23+     | 49+      |

✅ Actively maintained
📱 React Native 0.76+ New Architecture support (default)
🏗️ React Native 0.80 supported

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

<!-- For iOS 26 intelligent AirPlay routing -->
<key>AVInitialRouteSharingPolicy</key>
<string>LongFormAudio</string>

<!-- AirPlay optimization policy -->
<key>AVAudioSessionRouteSharingPolicy</key>
<string>LongFormAudio</string>
```

**[📖 View Detailed iOS Setup Guide](./docs/IOS_SETUP.md)** - Includes troubleshooting, performance tips, and common issues.

### Android Setup

The library automatically handles Android configuration. However, ensure your `minSdkVersion` is at least 21 in `android/build.gradle`.

## Quick Start

```typescript
import AudioStream from '@mustafakarali/react-native-audio-stream';

// Initialize the audio stream (optional but recommended)
// If not called, default configuration will be used
await AudioStream.initialize({
  enableBackgroundMode: true,
  autoPlay: true,
});

// Start streaming
await AudioStream.startStream('https://your-audio-stream-url.mp3');

// Or start HLS/DASH streaming (automatically detected)
await AudioStream.startStream('https://example.com/playlist.m3u8');

// Add event listeners
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`Current time: ${progress.currentTime}s`);
});

AudioStream.addEventListener('onError', (error) => {
  console.error('Stream error:', error);
});

// Cancel stream if needed
await AudioStream.cancelStream();
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

#### `playFromData(base64Data: string, config?: AudioStreamConfig): Promise<void>`

Play audio from base64 encoded binary data. Useful for TTS services that return audio data directly.

```typescript
// Example with ElevenLabs TTS
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id', {
  method: 'POST',
  headers: {
    'xi-api-key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ text: 'Hello world' })
});

// Convert response to base64
const audioBlob = await response.blob();
const reader = new FileReader();
reader.readAsDataURL(audioBlob);
reader.onloadend = () => {
  const base64Data = reader.result.split(',')[1]; // Remove data:audio/mpeg;base64, prefix
  AudioStream.playFromData(base64Data, { autoPlay: true });
};
```

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
// Available presets
const presets = [
  { name: 'Flat', bands: [/* ... */] },      // Index 0
  { name: 'Bass Boost', bands: [/* ... */] }, // Index 1
  { name: 'Treble Boost', bands: [/* ... */] }, // Index 2
  { name: 'Vocal', bands: [/* ... */] },     // Index 3
  { name: 'Rock', bands: [/* ... */] },      // Index 4
  { name: 'Pop', bands: [/* ... */] },       // Index 5
  { name: 'Jazz', bands: [/* ... */] },      // Index 6
  { name: 'Dance', bands: [/* ... */] },     // Index 7
  { name: 'Classical', bands: [/* ... */] },  // Index 8
];

// Apply bass boost preset
await AudioStream.applyEqualizerPreset(1);

// Custom equalizer (5 bands: 60Hz, 230Hz, 910Hz, 3600Hz, 14000Hz)
await AudioStream.setEqualizer([
  { frequency: 60, gain: 6 },    // Bass
  { frequency: 230, gain: 4 },   // Low-mid
  { frequency: 910, gain: 0 },   // Mid
  { frequency: 3600, gain: 2 },  // High-mid
  { frequency: 14000, gain: 4 }, // Treble
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
- `onMetadata` - Metadata received (title, artist, album)
- `onStats` - Statistics update
- `onNetworkStateChange` - Network connectivity changed

```typescript
// Progress tracking
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`${progress.currentTime}s / ${progress.duration}s`);
  console.log(`Buffered: ${progress.percentage}%`);
});

// Error handling with recovery
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

// Metadata display
AudioStream.addEventListener('onMetadata', (metadata) => {
  console.log(`Now playing: ${metadata.title} by ${metadata.artist}`);
  console.log(`Album: ${metadata.album}`);
});

// Network monitoring
AudioStream.addEventListener('onNetworkStateChange', (state) => {
  console.log(`Network connected: ${state.isConnected}`);
  console.log(`Connection type: ${state.type}`);
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Real-Time Chunk Streaming (NEW in v1.9.0!)
```typescript
// For true streaming without waiting for complete data
async function streamTTS(text: string) {
  // Start with empty stream
  await AudioStream.startStream('', { autoPlay: true });
  
  // Fetch TTS data
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  // Stream chunks as they arrive
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not available');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Convert chunk to base64
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    
    // Append to audio buffer - playback starts automatically when enough data is buffered
    await AudioStream.appendToBuffer(base64Chunk);
  }
}

// Usage
await streamTTS("This text will start playing as soon as enough data is buffered!");
```

#### Method 3: Binary Data Playback (Wait for Complete Data)
```typescript
// For TTS services that return complete binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Wait for complete data
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });
```

#### Real-World Examples

##### ElevenLabs Real-Time Streaming
```typescript
async function speakWithElevenLabsStreaming(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    // Initialize empty stream
    await AudioStream.startStream('', {
      autoPlay: true,
      enableBackgroundMode: true,
      bufferSize: 16, // Small buffer for low latency
    });

    // Start TTS request
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
          // Enable streaming optimizations
          optimize_streaming_latency: 3, // 0-4, higher = lower latency
          output_format: 'mp3_44100_128', // High quality streaming format
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Process stream in real-time
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');

    let firstChunkReceived = false;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        console.log(`First audio chunk received in ${Date.now() - startTime}ms`);
      }
      
      // Convert Uint8Array to base64
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
      
      // Append to buffer - audio starts playing automatically when ready
      await AudioStream.appendToBuffer(base64Chunk);
    }
    
    console.log('Streaming completed');
  } catch (error) {
    console.error('TTS Streaming Error:', error);
    await AudioStream.stop();
  }
}
```

##### Helper Functions
```typescript
// Convert blob to base64 (for non-streaming approach)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Stream with progress tracking
async function streamWithProgress(
  url: string, 
  onProgress?: (received: number, total?: number) => void
) {
  await AudioStream.startStream('', { autoPlay: true });
  
  const response = await fetch(url);
  const reader = response.body?.getReader();
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : undefined;
  
  if (!reader) throw new Error('Stream not available');
  
  let received = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    received += value.length;
    onProgress?.(received, total);
    
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    await AudioStream.appendToBuffer(base64Chunk);
  }
}
```

##### Deepgram Example
```typescript
// Deepgram with streaming
async function speakWithDeepgram(text: string) {
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en',
      encoding: 'mp3',
      // Streaming optimizations
      container: 'mp3',
      sample_rate: 44100,
    })
  });
  
  if (response.headers.get('Content-Type')?.includes('audio')) {
    // Direct streaming response
    await AudioStream.startStream('', { autoPlay: true });
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
      await AudioStream.appendToBuffer(base64Chunk);
    }
  } else {
    // URL response
    const { url } = await response.json();
    await AudioStream.startStream(url);
  }
}
```

#### Streaming Benefits

1. **Low Latency**: Audio starts playing within milliseconds of receiving first chunk
2. **Memory Efficient**: No need to load entire audio file into memory
3. **Real-time**: Perfect for live TTS applications
4. **Progressive**: Users hear speech as it's being generated

#### Streaming Configuration

```typescript
await AudioStream.initialize({
  // Optimize for streaming
  bufferSize: 16,        // Small buffer for low latency (KB)
  prebufferThreshold: 8, // Start playback with less data (KB)
  chunkSize: 4,          // Small chunks for smooth streaming (KB)
  
  // Network settings
  reconnectAttempts: 3,
  reconnectDelay: 1000,
  timeout: 30000,
});
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Real-Time Chunk Streaming (NEW in v1.9.0!)
```typescript
// For true streaming without waiting for complete data
async function streamTTS(text: string) {
  // Start with empty stream
  await AudioStream.startStream('', { autoPlay: true });
  
  // Fetch TTS data
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  // Stream chunks as they arrive
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not available');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Convert chunk to base64
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    
    // Append to audio buffer - playback starts automatically when enough data is buffered
    await AudioStream.appendToBuffer(base64Chunk);
  }
}

// Usage
await streamTTS("This text will start playing as soon as enough data is buffered!");
```

#### Method 3: Binary Data Playback (Wait for Complete Data)
```typescript
// For TTS services that return complete binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Wait for complete data
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });
```

#### Real-World Examples

##### ElevenLabs Real-Time Streaming
```typescript
async function speakWithElevenLabsStreaming(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    // Initialize empty stream
    await AudioStream.startStream('', {
      autoPlay: true,
      enableBackgroundMode: true,
      bufferSize: 16, // Small buffer for low latency
    });

    // Start TTS request
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
          // Enable streaming optimizations
          optimize_streaming_latency: 3, // 0-4, higher = lower latency
          output_format: 'mp3_44100_128', // High quality streaming format
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Process stream in real-time
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');

    let firstChunkReceived = false;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        console.log(`First audio chunk received in ${Date.now() - startTime}ms`);
      }
      
      // Convert Uint8Array to base64
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
      
      // Append to buffer - audio starts playing automatically when ready
      await AudioStream.appendToBuffer(base64Chunk);
    }
    
    console.log('Streaming completed');
  } catch (error) {
    console.error('TTS Streaming Error:', error);
    await AudioStream.stop();
  }
}
```

##### Helper Functions
```typescript
// Convert blob to base64 (for non-streaming approach)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Stream with progress tracking
async function streamWithProgress(
  url: string, 
  onProgress?: (received: number, total?: number) => void
) {
  await AudioStream.startStream('', { autoPlay: true });
  
  const response = await fetch(url);
  const reader = response.body?.getReader();
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : undefined;
  
  if (!reader) throw new Error('Stream not available');
  
  let received = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    received += value.length;
    onProgress?.(received, total);
    
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    await AudioStream.appendToBuffer(base64Chunk);
  }
}
```

##### Deepgram Example
```typescript
// Deepgram with streaming
async function speakWithDeepgram(text: string) {
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en',
      encoding: 'mp3',
      // Streaming optimizations
      container: 'mp3',
      sample_rate: 44100,
    })
  });
  
  if (response.headers.get('Content-Type')?.includes('audio')) {
    // Direct streaming response
    await AudioStream.startStream('', { autoPlay: true });
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
      await AudioStream.appendToBuffer(base64Chunk);
    }
  } else {
    // URL response
    const { url } = await response.json();
    await AudioStream.startStream(url);
  }
}
```

#### Streaming Benefits

1. **Low Latency**: Audio starts playing within milliseconds of receiving first chunk
2. **Memory Efficient**: No need to load entire audio file into memory
3. **Real-time**: Perfect for live TTS applications
4. **Progressive**: Users hear speech as it's being generated

#### Streaming Configuration

```typescript
await AudioStream.initialize({
  // Optimize for streaming
  bufferSize: 16,        // Small buffer for low latency (KB)
  prebufferThreshold: 8, // Start playback with less data (KB)
  chunkSize: 4,          // Small chunks for smooth streaming (KB)
  
  // Network settings
  reconnectAttempts: 3,
  reconnectDelay: 1000,
  timeout: 30000,
});
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Real-Time Chunk Streaming (NEW in v1.9.0!)
```typescript
// For true streaming without waiting for complete data
async function streamTTS(text: string) {
  // Start with empty stream
  await AudioStream.startStream('', { autoPlay: true });
  
  // Fetch TTS data
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  // Stream chunks as they arrive
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not available');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Convert chunk to base64
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    
    // Append to audio buffer - playback starts automatically when enough data is buffered
    await AudioStream.appendToBuffer(base64Chunk);
  }
}

// Usage
await streamTTS("This text will start playing as soon as enough data is buffered!");
```

#### Method 3: Binary Data Playback (Wait for Complete Data)
```typescript
// For TTS services that return complete binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Wait for complete data
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });
```

#### Real-World Examples

##### ElevenLabs Real-Time Streaming
```typescript
async function speakWithElevenLabsStreaming(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    // Initialize empty stream
    await AudioStream.startStream('', {
      autoPlay: true,
      enableBackgroundMode: true,
      bufferSize: 16, // Small buffer for low latency
    });

    // Start TTS request
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
          // Enable streaming optimizations
          optimize_streaming_latency: 3, // 0-4, higher = lower latency
          output_format: 'mp3_44100_128', // High quality streaming format
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Process stream in real-time
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');

    let firstChunkReceived = false;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        console.log(`First audio chunk received in ${Date.now() - startTime}ms`);
      }
      
      // Convert Uint8Array to base64
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
      
      // Append to buffer - audio starts playing automatically when ready
      await AudioStream.appendToBuffer(base64Chunk);
    }
    
    console.log('Streaming completed');
  } catch (error) {
    console.error('TTS Streaming Error:', error);
    await AudioStream.stop();
  }
}
```

##### Helper Functions
```typescript
// Convert blob to base64 (for non-streaming approach)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Stream with progress tracking
async function streamWithProgress(
  url: string, 
  onProgress?: (received: number, total?: number) => void
) {
  await AudioStream.startStream('', { autoPlay: true });
  
  const response = await fetch(url);
  const reader = response.body?.getReader();
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : undefined;
  
  if (!reader) throw new Error('Stream not available');
  
  let received = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    received += value.length;
    onProgress?.(received, total);
    
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    await AudioStream.appendToBuffer(base64Chunk);
  }
}
```

##### Deepgram Example
```typescript
// Deepgram with streaming
async function speakWithDeepgram(text: string) {
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en',
      encoding: 'mp3',
      // Streaming optimizations
      container: 'mp3',
      sample_rate: 44100,
    })
  });
  
  if (response.headers.get('Content-Type')?.includes('audio')) {
    // Direct streaming response
    await AudioStream.startStream('', { autoPlay: true });
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
      await AudioStream.appendToBuffer(base64Chunk);
    }
  } else {
    // URL response
    const { url } = await response.json();
    await AudioStream.startStream(url);
  }
}
```

#### Streaming Benefits

1. **Low Latency**: Audio starts playing within milliseconds of receiving first chunk
2. **Memory Efficient**: No need to load entire audio file into memory
3. **Real-time**: Perfect for live TTS applications
4. **Progressive**: Users hear speech as it's being generated

#### Streaming Configuration

```typescript
await AudioStream.initialize({
  // Optimize for streaming
  bufferSize: 16,        // Small buffer for low latency (KB)
  prebufferThreshold: 8, // Start playback with less data (KB)
  chunkSize: 4,          // Small chunks for smooth streaming (KB)
  
  // Network settings
  reconnectAttempts: 3,
  reconnectDelay: 1000,
  timeout: 30000,
});
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Real-Time Chunk Streaming (NEW in v1.9.0!)
```typescript
// For true streaming without waiting for complete data
async function streamTTS(text: string) {
  // Start with empty stream
  await AudioStream.startStream('', { autoPlay: true });
  
  // Fetch TTS data
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  // Stream chunks as they arrive
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not available');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Convert chunk to base64
    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
    
    // Append to audio buffer - playback starts automatically when enough data is buffered
    await AudioStream.appendToBuffer(base64Chunk);
  }
}

// Usage
await streamTTS("This text will start playing as soon as enough data is buffered!");
```

#### Method 3: Binary Data Playback (Wait for Complete Data)
```typescript
// For TTS services that return complete binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Wait for complete data
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });
```

#### Real-World Examples

##### ElevenLabs Real-Time Streaming
```typescript
async function speakWithElevenLabsStreaming(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    // Initialize empty stream
    await AudioStream.startStream('', {
      autoPlay: true,
      enableBackgroundMode: true,
      bufferSize: 16, // Small buffer for low latency
    });

    // Start TTS request
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
          // Enable streaming optimizations
          optimize_streaming_latency: 3, // 0-4, higher = lower latency
          output_format: 'mp3_44100_128', // High quality streaming format
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Process stream in real-time
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');

    let firstChunkReceived = false;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (!firstChunkReceived) {
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
- 🎨 **Multiple Formats** - MP3, AAC, WAV, OGG, FLAC, PCM support
- 🎬 **HLS/DASH Support** - Native adaptive bitrate streaming support
- ❌ **Cancel Stream** - Properly cancel ongoing streams
- 🎙️ **iOS Features (Future)** - AirPods high-quality recording, input device picker, spatial audio
- 🚀 **Enhanced Buffering** - AirPlay 2 enhanced buffering for better performance
- 📍 **AVQueuePlayer Support** - Enhanced playback capabilities with queue management

## Compatibility

| RN Audio Stream | React Native | iOS | Android | Expo SDK |
|-----------------|--------------|-----|---------|----------|
| 1.0.0+          | 0.64+        | 11+ | 21+     | 43+      |
| 1.4.x           | 0.71+        | 13+ | 23+     | 48+      |
| 1.5.x - 1.6.x   | 0.73+        | 13+ | 23+     | 49+      |

✅ Actively maintained
📱 React Native 0.76+ New Architecture support (default)
🏗️ React Native 0.80 supported

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

<!-- For iOS 26 intelligent AirPlay routing -->
<key>AVInitialRouteSharingPolicy</key>
<string>LongFormAudio</string>

<!-- AirPlay optimization policy -->
<key>AVAudioSessionRouteSharingPolicy</key>
<string>LongFormAudio</string>
```

**[📖 View Detailed iOS Setup Guide](./docs/IOS_SETUP.md)** - Includes troubleshooting, performance tips, and common issues.

### Android Setup

The library automatically handles Android configuration. However, ensure your `minSdkVersion` is at least 21 in `android/build.gradle`.

## Quick Start

```typescript
import AudioStream from '@mustafakarali/react-native-audio-stream';

// Initialize the audio stream (optional but recommended)
// If not called, default configuration will be used
await AudioStream.initialize({
  enableBackgroundMode: true,
  autoPlay: true,
});

// Start streaming
await AudioStream.startStream('https://your-audio-stream-url.mp3');

// Or start HLS/DASH streaming (automatically detected)
await AudioStream.startStream('https://example.com/playlist.m3u8');

// Add event listeners
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`Current time: ${progress.currentTime}s`);
});

AudioStream.addEventListener('onError', (error) => {
  console.error('Stream error:', error);
});

// Cancel stream if needed
await AudioStream.cancelStream();
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

#### `playFromData(base64Data: string, config?: AudioStreamConfig): Promise<void>`

Play audio from base64 encoded binary data. Useful for TTS services that return audio data directly.

```typescript
// Example with ElevenLabs TTS
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id', {
  method: 'POST',
  headers: {
    'xi-api-key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ text: 'Hello world' })
});

// Convert response to base64
const audioBlob = await response.blob();
const reader = new FileReader();
reader.readAsDataURL(audioBlob);
reader.onloadend = () => {
  const base64Data = reader.result.split(',')[1]; // Remove data:audio/mpeg;base64, prefix
  AudioStream.playFromData(base64Data, { autoPlay: true });
};
```

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
// Available presets
const presets = [
  { name: 'Flat', bands: [/* ... */] },      // Index 0
  { name: 'Bass Boost', bands: [/* ... */] }, // Index 1
  { name: 'Treble Boost', bands: [/* ... */] }, // Index 2
  { name: 'Vocal', bands: [/* ... */] },     // Index 3
  { name: 'Rock', bands: [/* ... */] },      // Index 4
  { name: 'Pop', bands: [/* ... */] },       // Index 5
  { name: 'Jazz', bands: [/* ... */] },      // Index 6
  { name: 'Dance', bands: [/* ... */] },     // Index 7
  { name: 'Classical', bands: [/* ... */] },  // Index 8
];

// Apply bass boost preset
await AudioStream.applyEqualizerPreset(1);

// Custom equalizer (5 bands: 60Hz, 230Hz, 910Hz, 3600Hz, 14000Hz)
await AudioStream.setEqualizer([
  { frequency: 60, gain: 6 },    // Bass
  { frequency: 230, gain: 4 },   // Low-mid
  { frequency: 910, gain: 0 },   // Mid
  { frequency: 3600, gain: 2 },  // High-mid
  { frequency: 14000, gain: 4 }, // Treble
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
- `onMetadata` - Metadata received (title, artist, album)
- `onStats` - Statistics update
- `onNetworkStateChange` - Network connectivity changed

```typescript
// Progress tracking
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`${progress.currentTime}s / ${progress.duration}s`);
  console.log(`Buffered: ${progress.percentage}%`);
});

// Error handling with recovery
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

// Metadata display
AudioStream.addEventListener('onMetadata', (metadata) => {
  console.log(`Now playing: ${metadata.title} by ${metadata.artist}`);
  console.log(`Album: ${metadata.album}`);
});

// Network monitoring
AudioStream.addEventListener('onNetworkStateChange', (state) => {
  console.log(`Network connected: ${state.isConnected}`);
  console.log(`Connection type: ${state.type}`);
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
  method: 'POST',
  headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
  body: JSON.stringify({ 
      text: text,
      model: 'aura-asteria-en'
  })
});

  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
        method: 'POST',
        headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
    body: {
          text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
  method: 'POST',
  headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
  body: JSON.stringify({ 
      text: text,
      model: 'aura-asteria-en'
  })
});

  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
        method: 'POST',
        headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
    body: {
          text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
  method: 'POST',
  headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
  body: JSON.stringify({ 
      text: text,
      model: 'aura-asteria-en'
  })
});

  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
        method: 'POST',
        headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
    body: {
          text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream, { PlaybackState, LogLevel } from '@mustafakarali/react-native-audio-stream';

export default function AudioPlayer() {
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [metadata, setMetadata] = useState({ title: '', artist: '' });

  useEffect(() => {
    // Initialize audio stream (optional)
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
    AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata({ title: data.title || '', artist: data.artist || '' });
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
      <Text>Progress: {progress.current.toFixed(1)}s / {progress.total.toFixed(1)}s</Text>
      {metadata.title ? (
        <Text>Now Playing: {metadata.title} - {metadata.artist}</Text>
      ) : null}
      <Button title="Play" onPress={handlePlay} />
      <Button title="Pause" onPress={() => AudioStream.pause()} />
      <Button title="Stop" onPress={() => AudioStream.stop()} />
      <Button title="Cancel" onPress={() => AudioStream.cancelStream()} />
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

### HLS/DASH Streaming

The library automatically detects and handles HLS (.m3u8) and DASH (.mpd) streams using native platform players.

```typescript
// HLS streaming
await AudioStream.startStream('https://example.com/playlist.m3u8');

// DASH streaming  
await AudioStream.startStream('https://example.com/manifest.mpd');

// With authentication
await AudioStream.startStream('https://example.com/playlist.m3u8', {
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

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

#### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `NETWORK_ERROR` | Network connection failed | ✅ Yes |
| `TIMEOUT_ERROR` | Request timed out | ✅ Yes |
| `HTTP_ERROR` | HTTP error (4xx, 5xx) | ❓ Depends |
| `PARSE_ERROR` | Unable to parse stream | ❌ No |
| `DECODER_ERROR` | Audio codec not supported | ❌ No |
| `INVALID_URL` | Malformed URL | ❌ No |
| `INVALID_STATE` | Invalid player state | ❌ No |
| `UNKNOWN_ERROR` | Unknown error occurred | ❓ Depends |

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

### iOS Features (Future)

The library includes support for upcoming iOS audio features:

#### Input Device Selection

Show the native iOS input device picker with live sound level metering (when available):

```typescript
// Show input device picker (Future iOS feature)
await AudioStream.showInputPicker();

// Get list of available input devices
const inputs = await AudioStream.getAvailableInputs();
console.log(inputs);
// [
//   {
//     portName: "iPhone Microphone",
//     portType: "MicrophoneBuiltIn",
//     uid: "Built-In Microphone",
//     hasHardwareVoiceCallProcessing: true,
//     channels: 1
//   },
//   {
//     portName: "AirPods Pro",
//     portType: "BluetoothHFP",
//     uid: "00:00:00:00:00:00",
//     hasHardwareVoiceCallProcessing: false,
//     channels: 1
//   }
// ]
```

#### Enhanced Audio Configuration

```typescript
await AudioStream.initialize({
  // iOS Features (Future)
  enableRecording: true,           // Enable recording support
  voiceProcessing: true,           // Enable voice processing
  spokenAudio: true,              // Optimize for podcasts/audiobooks
  longFormAudio: true,            // Enable long-form audio routing
  enableAirPodsHighQuality: true, // AirPods high-quality recording (when available)
  enableEnhancedBuffering: true,  // AirPlay 2 enhanced buffering
  enableSpatialAudio: true,       // Spatial audio support (when available)
});
```

#### Enhanced Buffering and Spatial Audio

```typescript
// Enable AirPlay 2 enhanced buffering
await AudioStream.enableEnhancedBuffering(true);

// Enable spatial audio with head tracking
await AudioStream.enableSpatialAudio(true);

// Use AVQueuePlayer for enhanced features
await AudioStream.useQueuePlayer(true);

// Create a route picker view (returns view tag for React Native)
const routePickerTag = await AudioStream.createRoutePickerView();
```

### Text-to-Speech (TTS) Integration

The library fully supports TTS services like ElevenLabs, Deepgram, and Minimax with multiple integration methods:

#### Method 1: Direct Streaming with POST (NEW in v1.8.0!)
```typescript
// ElevenLabs direct streaming with POST body
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': ELEVEN_LABS_KEY,
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0,
      use_speaker_boost: true,
    },
  },
  autoPlay: true,
});
```

#### Method 2: Binary Data Playback
```typescript
// For TTS services that return binary audio data
const response = await fetch('https://api.tts-service.com/synthesize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({ 
    text: 'Hello world',
    voice: 'en-US-Neural2-A'
  })
});

// Convert to base64 and play
const audioBlob = await response.blob();
const base64 = await blobToBase64(audioBlob);
await AudioStream.playFromData(base64, { autoPlay: true });

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Real-World Examples

##### ElevenLabs Complete Example
```typescript
async function speakWithElevenLabs(text: string) {
  const voiceId = 'your-voice-id';
  const apiKey = 'your-api-key';
  
  try {
    await AudioStream.startStream(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        autoPlay: true,
        enableBackgroundMode: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}

// Usage
await speakWithElevenLabs("Hello, this is a test message!");
```

##### Deepgram Example
```typescript
// Deepgram supports both URL response and streaming
async function speakWithDeepgram(text: string) {
  // Option 1: Get URL and stream
  const response = await fetch('https://api.deepgram.com/v1/speak', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model: 'aura-asteria-en'
    })
  });
  
  const { url } = await response.json();
  await AudioStream.startStream(url);
  
  // Option 2: Direct streaming (if supported)
  await AudioStream.startStream('https://api.deepgram.com/v1/speak/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      text: text,
      model: 'aura-asteria-en',
    },
  });
}
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
  bufferedPosition: number;   // End position of buffer in seconds
  currentPosition: number;    // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean;       // Currently buffering
  playWhenReady: boolean;     // Will play when buffer is ready
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import