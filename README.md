# React Native Audio Stream v2.0

A premium, world-class audio streaming library for React Native and Expo (SDK 52+). Built from the ground up for robustness, zero mock implementations, and uncompromising platform parity across **iOS 16.0+** and **Android 7.0+ (API 24+)**.

[![Version](https://img.shields.io/npm/v/react-native-audio-stream?style=flat-square)](https://www.npmjs.com/package/react-native-audio-stream)
[![Downloads](https://img.shields.io/npm/dt/react-native-audio-stream?style=flat-square)](https://www.npmjs.com/package/react-native-audio-stream)
[![License](https://img.shields.io/npm/l/react-native-audio-stream?style=flat-square)](https://github.com/mustafakarali/react-native-audio-stream/blob/main/LICENSE)


## 🚀 Features

- **Modern Architecture**: Fully supports the New Architecture (Fabric/TurboModules) automatically via `install_modules_dependencies`.
- **Media3 ExoPlayer**: Android backend is powered by Media3 `1.10.0` for unparalleled stability, HLS, DASH, and Progressive streams.
- **NSURLSession Streaming**: iOS backend explicitly handles infinite chunked data via native delegate patterns, solving historical `completionHandler` limitations for infinite radio streams.
- **Real Equalizer**: Hardware-accelerated 5-Band `android.media.audiofx.Equalizer` and `AVAudioUnitEQ`.
- **Preloading & Caching**: True `CacheWriter` based disk-level preloading on Android, and `AVURLAsset` async loading on iOS.
- **Auto Lock Screen Controls**: Hands-free integration with `MPNowPlayingInfoCenter` / `MPRemoteCommandCenter` on iOS and `MediaSessionService` on Android.
- **React Hooks**: Elegant UI management with `useAudioStream` and `useStreamProgress`.

## 📦 Installation

```bash
# Add the dependency
yarn add react-native-audio-stream
```

### Expo Configuration
If you're using Expo, add the config plugin to your `app.json` or `app.config.js`. It will handle all iOS Background Modes and Android Foreground Service permissions:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-stream",
        {
          "enableBackgroundAudio": true,
          "enableNotifications": true
        }
      ]
    ]
  }
}
```

Then rebuild: `npx expo prebuild --clean`

### iOS Bare React Native
You must manually add `UIBackgroundModes` for audio and ensure your deployment target is at least iOS 16.0.
```ruby
platform :ios, '16.0'
```
Add to `Info.plist`:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### Android Bare React Native
You must make sure your compilation settings match the strict requirements:
```gradle
// android/build.gradle
buildToolsVersion = "35.0.0"
minSdkVersion = 24
compileSdkVersion = 35
targetSdkVersion = 35
```

## 🎧 Usage: The Hooks Approach

Version 2.0 introduces React Hooks rendering imperative configuration obsolete. 

```tsx
import React, { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import { useAudioStream, useStreamProgress } from 'react-native-audio-stream';

export default function AudioPlayer() {
  const { startStream, play, pause, state, error, metadata } = useAudioStream({
    config: {
      autoPlay: true,
      bufferSize: 128,
      enableCache: true,
    }
  });

  const { currentTime, percentage, stats } = useStreamProgress({ interval: 500 });

  useEffect(() => {
    startStream('https://stream.radioparadise.com/aac-320');
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Status: {state}</Text>
      <Text>Title: {metadata?.title || 'Unknown'}</Text>
      
      <Text>Progress: {percentage.toFixed(1)}%</Text>
      <Text>BitRate: {stats?.bitRate} kbps</Text>
      <Text>Latency: {stats?.latency} ms</Text>

      {error && <Text style={{ color: 'red' }}>Error: {error.message}</Text>}

      <Button title="Play" onPress={play} />
      <Button title="Pause" onPress={pause} />
    </View>
  );
}
```

## Advanced Usage

For complete API overviews including the Hardware Equalizer, WebSocket streaming, or realtime PCM streaming, check out the documentation:

* [API Reference](docs/API.md)
* [Setup & Platform Guide](docs/SETUP.md)
* [Testing Guide](docs/TESTING.md)

## Contributing
See the [contributing guide](docs/CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License
MIT