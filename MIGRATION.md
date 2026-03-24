# react-native-audio-stream v2.0 Migration Guide

Welcome to v2.0 of `react-native-audio-stream`! This release represents a complete overhaul of the library designed to meet the strict standards of 2026. It brings true platform parity, eliminates all mock implementations, fixes critical streaming bugs, and relies on the most modern architectural patterns for both Android and iOS.

## Breaking Changes

### 1. Peer Dependencies Required
The core framework dependencies have been updated:
- **React Native:** `>=0.76.0` (Updated from 0.72+)
- **React:** `>=18.3.0 || >=19.0.0`
- **TypeScript:** The API relies on ES2022 targets; ensure your TS setup supports modern features.

### 2. iOS Native Architecture
- iOS deployment target is now **`16.0`**.
- Manual architecture definitions in your `Podfile` are no longer required. `install_modules_dependencies(s)` is used to properly handle New Architecture bridging if enabled.

### 3. Android Native Architecture
- Uses **Media3 `1.10.0`** (No longer ExoPlayer `1.2.0`).
- Minimum SDK Version is now **`24`** (Android 7.0).
- Java 17 is required for compilation.
- `StreamingDataSource.java` has been removed. Use `RealtimeStreamingDataSource` equivalent or memory streams via the JS core API instead.

### 4. API Changes
- **`stopStream` Event Handling:** Previously, calling `stopStream()` silently removed all event listeners registered with the `AudioStream` static instance. **This is no longer the case.** It stops the stream but leaves your listeners intact. Call `removeAllEventListeners()` manually if you wish to wipe handlers.
- **`playFromData` & `startRealtimeStream` Leak Fixes:** Previously registered multiple duplicate native listener bindings on consecutive calls. Native bindings now live safely in the constructor, preventing memory/event leakage.

### 5. `preloadStream` and `setNetworkPriority` Are Now Real
These methods are no longer placebo/mock functions:
- On Android, `preloadStream` utilizes Media3 `CacheWriter`.
- On iOS, `preloadStream` triggers early asynchronous AVURLAsset loading.
If you were passing invalid arguments to these and assuming they did nothing, they will now throw actual errors. 

### 6. Equalizer Is Now Real (Android)
- `setEqualizer` previously returned a successful mock on Android. It now invokes `android.media.audiofx.Equalizer`. If the host device does not support hardware equalizers, the promise will properly reject with `EQ_UNAVAILABLE`.

### 7. File Structure
- `scripts/bootstrap.js` removed — rely purely on Yarn workspaces.
- `examples` has been completely merged into `example`. 

## New Features
- **Hooks:** Two brand-new hooks, `useAudioStream` and `useStreamProgress`, enable clean, declarative React interactions without managing static listeners manually.
- **Expo Support:** A robust Config Plugin is now included out-of-the-box (`app.plugin.js`) for pain-free config generation.

## How to Upgrade

1. Update the version in package.json:
```bash
yarn add react-native-audio-stream@^2.0.0
```

2. If you do not use Expo, ensure your `ios/Podfile` minimum deployment target is 16.0:
```ruby
platform :ios, '16.0'
```

3. If you do not use Expo, ensure your `android/build.gradle` defines Java 17 and `compileSdkVersion` 35:
```gradle
buildToolsVersion = "35.0.0"
minSdkVersion = 24
compileSdkVersion = 35
targetSdkVersion = 35
```

4. We highly suggest swapping your imperative AudioStream method calls to the new hooks:
```tsx
import { useAudioStream, useStreamProgress } from 'react-native-audio-stream';

// Instead of:
// useEffect(() => { AudioStream.getInstance().startStream(...) }, [])

// Do:
const { startStream, play, pause, state } = useAudioStream();
const { currentTime, percentage } = useStreamProgress();
```
