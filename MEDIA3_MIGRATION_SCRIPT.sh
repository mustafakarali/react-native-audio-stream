#!/bin/bash

# Script to migrate remaining ExoPlayer2 references to Media3
# Run this in the react-native-audio-stream directory

echo "Starting Media3 migration fixes..."

# Fix FileDataSource reference
sed -i 's/new com\.google\.android\.exoplayer2\.upstream\.FileDataSource\.Factory()/new FileDataSource.Factory()/g' android/src/main/java/com/audiostream/RNAudioStreamModule.java

# Fix MediaMetadata reference in getMetadata method
sed -i 's/com\.google\.android\.exoplayer2\.MediaMetadata mediaMetadata/MediaMetadata mediaMetadata/g' android/src/main/java/com/audiostream/RNAudioStreamModule.java

# Fix any remaining MediaMetadata references in onMediaMetadataChanged
sed -i 's/onMediaMetadataChanged(com\.google\.android\.exoplayer2\.MediaMetadata metadata)/onMediaMetadataChanged(MediaMetadata metadata)/g' android/src/main/java/com/audiostream/RNAudioStreamModule.java

# Additional safety: remove any remaining com.google.android.exoplayer2 prefixes
sed -i 's/com\.google\.android\.exoplayer2\.audio\.AudioAttributes/androidx.media3.common.AudioAttributes/g' android/src/main/java/com/audiostream/RNAudioStreamModule.java

echo "Migration fixes complete!" 