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
// Apply bass boost preset
await AudioStream.applyEqualizerPreset(EqualizerPreset.BASS_BOOST);

// Or set custom bands
await AudioStream.setEqualizer([
  { frequency: 60, gain: 6.0, q: 1.0 },   // Bass
  { frequency: 1000, gain: 0.0, q: 1.0 }, // Mid
  { frequency: 8000, gain: 3.0, q: 1.0 }, // Treble
]);
```

### Event Listeners

#### `addEventListener(event: AudioStreamEvent, listener: Function): void`
Add an event listener.

#### `removeEventListener(event: AudioStreamEvent, listener: Function): void`
Remove an event listener.

```typescript
// Progress updates
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`Progress: ${progress.currentTime}/${progress.duration}`);
});

// State changes
AudioStream.addEventListener('onStateChange', (state) => {
  console.log(`State changed to: ${state}`);
});

// Errors
AudioStream.addEventListener('onError', (error) => {
  console.error('Audio stream error:', error);
});

// Playback ended
AudioStream.addEventListener('onEnd', () => {
  console.log('Playback completed');
});
```

## TTS Integration Examples

### ElevenLabs Integration

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
```

### Google Cloud TTS Integration

```typescript
async function speakWithGoogleTTS(text: string) {
  const apiKey = 'your-google-api-key';
  
  try {
    await AudioStream.startStream(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          input: { text: text },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-A',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
          },
        },
        autoPlay: true,
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
  }
}
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Initialize audio stream
    AudioStream.initialize({
      enableBackgroundMode: true,
      autoPlay: true,
    });

    // Add event listeners
    AudioStream.addEventListener('onProgress', (progress) => {
      setCurrentTime(progress.currentTime);
      setDuration(progress.duration);
    });

    AudioStream.addEventListener('onStateChange', (state) => {
      setIsPlaying(state === 'playing');
    });

    AudioStream.addEventListener('onEnd', () => {
      setIsPlaying(false);
    });

    return () => {
      // Cleanup
      AudioStream.stopStream();
    };
  }, []);

  const startStream = async () => {
    try {
      await AudioStream.startStream('https://example.com/audio.mp3');
    } catch (error) {
      console.error('Stream error:', error);
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await AudioStream.pause();
    } else {
      await AudioStream.play();
    }
  };

  const stopPlayback = async () => {
    await AudioStream.stop();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audio Stream Demo</Text>
      
      <View style={styles.controls}>
        <Button title="Start Stream" onPress={startStream} />
        <Button 
          title={isPlaying ? "Pause" : "Play"} 
          onPress={togglePlayback} 
        />
        <Button title="Stop" onPress={stopPlayback} />
      </View>
      
      <Text style={styles.progress}>
        {Math.floor(currentTime)}s / {Math.floor(duration)}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  progress: {
    fontSize: 16,
    color: '#666',
  },
});
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

## Documentation

- **[📖 API Documentation](./docs/API.md)** - Complete API reference
- **[📖 Examples](./docs/EXAMPLES.md)** - Usage examples and patterns
- **[📖 iOS Setup Guide](./docs/IOS_SETUP.md)** - Detailed iOS configuration
- **[📖 Testing Guide](./TESTING.md)** - Testing requirements and known limitations

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find this library helpful, please consider supporting the development:

- ☕ [Buy Me a Coffee](https://coff.ee/mustafakarali) - Support the development
- ⭐ Star this repository
- 🐛 Report bugs and issues
- 💡 Suggest new features 