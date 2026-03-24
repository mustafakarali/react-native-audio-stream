# Setup & Platform Guide

`react-native-audio-stream` v2.0 — unified setup for iOS and Android.

## Requirements

| | iOS | Android |
|---|---|---|
| **Min Version** | 16.0 | API 24 (Android 7.0) |
| **Target** | Latest | API 36 |
| **React Native** | ≥ 0.76.0 (New Architecture) | ≥ 0.76.0 |
| **Expo** | SDK 55+ (config plugin included) | SDK 55+ |

## Installation

```bash
# npm
npm install @mustafakarali/react-native-audio-stream

# yarn
yarn add @mustafakarali/react-native-audio-stream
```

### iOS
```bash
cd ios && pod install
```

### Expo
No manual linking needed. The Expo config plugin handles native configuration automatically.

```json
// app.json
{
  "plugins": ["react-native-audio-stream"]
}
```

---

## Platform Configuration

### Background Audio

Both platforms support background audio playback. Enable via config:

```typescript
await audioStream.initialize({
  enableBackgroundMode: true,
});
```

| Platform | Mechanism |
|----------|-----------|
| **iOS** | `AVAudioSession` with `.playback` category + `UIBackgroundModes: audio` in Info.plist |
| **Android** | `ForegroundService` (`FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`) with persistent notification |

**iOS Info.plist** (auto-configured by Expo plugin):
```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

**Android Manifest** (included in library):
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<service android:name=".AudioStreamService"
         android:foregroundServiceType="mediaPlayback" />
```

### Lock Screen / Now Playing Controls

Both platforms have full lock screen control support:

| Feature | iOS | Android |
|---------|-----|---------|
| Play/Pause | `MPRemoteCommandCenter` | Notification actions |
| Seek | `MPRemoteCommandCenter` | Notification actions |
| Track info | `MPNowPlayingInfoCenter` | `MediaMetadata` |
| Artwork | ✅ | ✅ |

### Audio Session / Audio Focus

```typescript
await audioStream.initialize({
  maintainAudioFocus: true,   // Request exclusive audio focus
});
```

| Config | iOS (`AVAudioSession`) | Android (`AudioManager`) |
|--------|----------------------|------------------------|
| `maintainAudioFocus: true` | `.playback` category | `AUDIOFOCUS_GAIN` |
| `enableRecording: true` | `.playAndRecord` category | N/A (ignored) |
| `voiceProcessing: true` | Voice processing mode | N/A (ignored) |
| `spokenAudio: true` | `.spokenAudio` routing override | N/A (ignored) |
| `longFormAudio: true` | `.longFormAudio` routing override | N/A (ignored) |

> **Note**: iOS-specific fields are safely ignored on Android — no crashes, no errors.

### Network Monitoring

Real-time network state changes are monitored on both platforms:

| Platform | Implementation |
|----------|---------------|
| **iOS** | `NWPathMonitor` (Network.framework) |
| **Android** | `ConnectivityManager.NetworkCallback` |

Events emitted: `onNetworkStateChange({ isConnected: boolean, type: 'wifi' | 'cellular' | 'ethernet' | 'none' })`

---

## Streaming Types

All streaming types work identically on both platforms:

### URL Streaming (HTTP/HTTPS)

```typescript
// Auto-detects format from URL or Content-Type header
await audioStream.startStream('https://example.com/audio.mp3');

// Extension-less URLs are supported — Content-Type auto-detection via HTTP HEAD
await audioStream.startStream('https://api.example.com/stream/12345');
```

**Supported formats**: MP3, AAC, WAV, OGG, FLAC, HLS, DASH

| Platform | Player |
|----------|--------|
| **iOS** | `AVPlayer` |
| **Android** | Media3 `ExoPlayer` |

### Realtime PCM Streaming

Feed raw PCM audio data byte-by-byte for real-time playback (TTS, VoIP, AI audio, etc.):

```typescript
// Start realtime stream
await audioStream.startRealtimeStream({
  sampleRate: 24000,
  channels: 1,
  autoPlay: true,
});

// Feed PCM data (float32, base64 encoded)
await AudioStream.appendRealtimeData(base64AudioChunk);

// Signal end of stream
await AudioStream.completeRealtimeStream();

// Monitor stats
const stats = await AudioStream.getStreamingStats();
// { bytesWritten, bytesRead, isActive, isReady }
```

| Platform | Implementation |
|----------|---------------|
| **iOS** | `AVAudioEngine` + `AVAudioPlayerNode` → `scheduleBuffer()` |
| **Android** | `RealtimeStreamingDataSource` + `PipedInputStream` → Media3 `ProgressiveMediaSource` |

### WebSocket Streaming

Stream audio over WebSocket connections — supports binary audio frames and bi-directional text messaging. Ideal for VoIP, live conferencing, AI voice assistants.

```typescript
await audioStream.startWebSocketStream({
  url: 'wss://voice.example.com/stream',
  headers: { 'Authorization': 'Bearer token' },
  protocols: ['audio-stream'],
  audioFormat: AudioFormat.PCM,
  sampleRate: 24000,
  channels: 1,
  autoPlay: true,
  autoReconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
});

// Send control messages (signaling, VoIP commands, etc.)
await audioStream.sendWebSocketMessage(JSON.stringify({
  type: 'start_recording',
  language: 'en',
}));

// Stop WebSocket stream
await audioStream.stopWebSocketStream();
```

| Platform | Implementation |
|----------|---------------|
| **iOS** | `NSURLSessionWebSocketTask` → binary frames → `AVAudioPlayerNode.scheduleBuffer()` |
| **Android** | OkHttp `WebSocket` → binary frames → `RealtimeStreamingDataSource` → ExoPlayer |

**WebSocket Events**:
- `onWebSocketOpen` — connection established
- `onWebSocketMessage` — text message received (signaling/control)
- `onWebSocketClose` — connection closed
- `onWebSocketError` — connection error
- `onStreamError` — reconnect progress (recoverable) or failure (non-recoverable)

### Memory Streaming (Android)

```typescript
// Android-only: in-memory buffer streaming
await AudioStream.startMemoryStream({ autoPlay: true });
await AudioStream.appendToMemoryStream(base64Data);
await AudioStream.completeMemoryStream();
```

---

## Reconnection & Resilience

Automatic reconnection with **exponential backoff** is built into all streaming types (URL, WebSocket, realtime):

```typescript
await audioStream.initialize({
  reconnectAttempts: 5,     // Max retry attempts (default: 3)
  reconnectDelay: 1000,     // Base delay in ms (default: 1000)
  timeout: 30000,           // Connection timeout in ms (default: 30000)
});
```

**Backoff pattern**: `delay * 2^(attempt - 1)` → 1s, 2s, 4s, 8s, 16s

Error events include recoverable status:
```typescript
audioStream.on('onError', (error) => {
  if (error.recoverable) {
    // Reconnect in progress
    console.log(`Retry ${error.details.attempt}/${error.details.maxAttempts}`);
  } else {
    // All attempts exhausted
    console.error('Connection permanently lost');
  }
});
```

---

## Equalizer

5-band hardware equalizer on both platforms:

| Platform | Implementation |
|----------|---------------|
| **iOS** | `AVAudioUnitEQ` (5-band) |
| **Android** | `android.media.audiofx.Equalizer` |

```typescript
// Manual bands
await audioStream.setEqualizer([
  { frequency: 60, gain: 3 },
  { frequency: 230, gain: 1 },
  { frequency: 910, gain: 0 },
  { frequency: 3600, gain: -1 },
  { frequency: 14000, gain: 2 },
]);

// Presets: Flat, Rock, Pop, Jazz, Classical, Bass Boost, Treble Boost, Vocal
await audioStream.applyEqualizerPreset('Rock');
```

---

## Stream Type Auto-Detection

Extension-less URLs are fully supported. The library detects stream type via:

1. **File extension** (`.mp3`, `.aac`, `.m3u8`, etc.)
2. **Content-Type HTTP HEAD** (Android: `OkHttpClient` HEAD request; iOS: `NSURLSession`)
3. **Fallback**: Progressive MP3

---

## Platform-Specific Limitations

| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| `showInputPicker` | ✅ | ❌ | UIKit view management required |
| `createRoutePickerView` | ✅ | ❌ | UIKit view management required |
| `enableSpatialAudio` | ✅ | ❌ | No Android equivalent |
| `startMemoryStream` | ❌ | ✅ | In-memory buffer streaming |
| Opus codec | ❌ | ✅ | iOS limitation |
| Gapless playback | ❌ | ❌ | Not supported on either |

> Methods called on unsupported platforms reject with `UNSUPPORTED` error — no crashes.

---

## Troubleshooting

### No Audio on iOS Simulator
iOS Simulator has limited audio support. Test on real devices.

### "Malformed URL" on Realtime Stream
Do not pass a URL to `startRealtimeStream()` — the method handles the data source internally.

### WebSocket Connection Refused
Ensure `wss://` for secure WebSocket. Check server CORS headers if connecting from a different origin.

### Android: Audio Stops in Background
Ensure `enableBackgroundMode: true` is set. The library starts a `ForegroundService` automatically.

### High Latency on Realtime/WebSocket
- Use smaller chunks (2-8KB)
- Reduce sample rate if quality is acceptable
- Monitor with `getStreamingStats()` to track buffer levels

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| AndroidX Media3 | 1.10.0 | ExoPlayer, DataSource, ProgressiveMediaSource |
| OkHttp | ≥ 4.x | HTTP requests, WebSocket (Android) |
| AVFoundation | System | AVPlayer, AVAudioEngine (iOS) |
| Network.framework | System | NWPathMonitor (iOS) |
| MediaPlayer | System | Lock screen controls (iOS) |
