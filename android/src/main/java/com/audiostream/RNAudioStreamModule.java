package com.audiostream;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.Timeline;
import com.google.android.exoplayer2.ext.okhttp.OkHttpDataSource;
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory;
import com.google.android.exoplayer2.source.MediaSource;
import com.google.android.exoplayer2.source.ProgressiveMediaSource;
import com.google.android.exoplayer2.source.hls.HlsMediaSource;
import com.google.android.exoplayer2.trackselection.DefaultTrackSelector;
import com.google.android.exoplayer2.upstream.DataSource;
import com.google.android.exoplayer2.upstream.DefaultBandwidthMeter;
import com.google.android.exoplayer2.upstream.DefaultDataSource;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.upstream.cache.CacheDataSource;
import com.google.android.exoplayer2.upstream.cache.LeastRecentlyUsedCacheEvictor;
import com.google.android.exoplayer2.upstream.cache.SimpleCache;
import com.google.android.exoplayer2.util.Util;
import com.google.android.exoplayer2.DefaultLoadControl;
import com.google.android.exoplayer2.LoadControl;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

import javax.annotation.Nullable;

import okhttp3.OkHttpClient;

public class RNAudioStreamModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RNAudioStream";
    private static final String MODULE_NAME = "RNAudioStream";

    private final ReactApplicationContext reactContext;
    private ExoPlayer player;
    private AudioManager audioManager;
    private SimpleCache cache;
    private DataSource.Factory dataSourceFactory;
    private Handler mainHandler;
    private Timer progressTimer;
    private Timer statsTimer;
    
    private boolean isInitialized = false;
    private String currentUrl = null;
    private ReadableMap config;
    private long totalBytesReceived = 0;
    private long bufferStartTime = 0;
    private DefaultBandwidthMeter bandwidthMeter;
    private AudioFocusRequest audioFocusRequest; // Store for later abandon

    // Playback states
    private enum PlaybackState {
        IDLE("idle"),
        LOADING("loading"),
        BUFFERING("buffering"),
        PLAYING("playing"),
        PAUSED("paused"),
        STOPPED("stopped"),
        ERROR("error"),
        COMPLETED("completed");

        private final String state;

        PlaybackState(String state) {
            this.state = state;
        }

        public String toString() {
            return state;
        }
    }

    private PlaybackState currentState = PlaybackState.IDLE;

    public RNAudioStreamModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void initialize(ReadableMap config, Promise promise) {
        try {
            this.config = config;
            
            // Initialize bandwidth meter for network speed monitoring
            bandwidthMeter = new DefaultBandwidthMeter.Builder(reactContext).build();
            
            // Setup cache if enabled
            if (config.hasKey("enableCache") && config.getBoolean("enableCache")) {
                setupCache(config);
            }
            
            // Setup data source factory
            setupDataSourceFactory();
            
            // Initialize player
            initializePlayer();
            
            isInitialized = true;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize", e);
            promise.reject("INITIALIZATION_ERROR", "Failed to initialize audio stream", e);
        }
    }

    private void setupCache(ReadableMap config) {
        int cacheSize = config.hasKey("cacheSize") ? config.getInt("cacheSize") * 1024 * 1024 : 100 * 1024 * 1024;
        File cacheDir = new File(reactContext.getCacheDir(), "audio_cache");
        cache = new SimpleCache(cacheDir, new LeastRecentlyUsedCacheEvictor(cacheSize));
    }

    private void setupDataSourceFactory() {
        OkHttpClient okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build();

        DataSource.Factory httpDataSourceFactory = new OkHttpDataSource.Factory(okHttpClient)
                .setUserAgent(Util.getUserAgent(reactContext, "RNAudioStream"))
                .setTransferListener(bandwidthMeter);

        if (cache != null) {
            dataSourceFactory = new CacheDataSource.Factory()
                    .setCache(cache)
                    .setUpstreamDataSourceFactory(httpDataSourceFactory)
                    .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
        } else {
            dataSourceFactory = httpDataSourceFactory;
        }
    }

    private void initializePlayer() {
        mainHandler.post(() -> {
            DefaultTrackSelector trackSelector = new DefaultTrackSelector(reactContext);
            
            // Configure load control for better buffering
            LoadControl loadControl = new DefaultLoadControl.Builder()
                    .setBufferDurationsMs(
                        15000,  // Min buffer 15 seconds
                        60000,  // Max buffer 60 seconds
                        2500,   // Playback buffer 2.5 seconds
                        5000    // Rebuffer 5 seconds
                    )
                    .setPrioritizeTimeOverSizeThresholds(false)
                    .build();
            
            player = new ExoPlayer.Builder(reactContext)
                    .setTrackSelector(trackSelector)
                    .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSourceFactory))
                    .setBandwidthMeter(bandwidthMeter)
                    .setLoadControl(loadControl)
                    .build();

            // Setup audio attributes
            com.google.android.exoplayer2.audio.AudioAttributes audioAttributes = new com.google.android.exoplayer2.audio.AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build();
            
            player.setAudioAttributes(audioAttributes, true);
            
            // Add player listener
            player.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int playbackState) {
                    handlePlaybackStateChange(playbackState);
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    handlePlayerError(error);
                }

                @Override
                public void onIsPlayingChanged(boolean isPlaying) {
                    if (isPlaying) {
                        updateState(PlaybackState.PLAYING);
                    }
                }

                @Override
                public void onTimelineChanged(Timeline timeline, int reason) {
                    if (timeline.getWindowCount() > 0) {
                        extractAndSendMetadata();
                    }
                }
            });
        });
    }

    @ReactMethod
    public void destroy(Promise promise) {
        try {
            cleanup();
            isInitialized = false;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to destroy", e);
            promise.reject("DESTROY_ERROR", "Failed to destroy audio stream", e);
        }
    }

    @ReactMethod
    public void startStream(String url, ReadableMap config, Promise promise) {
        if (!isInitialized) {
            promise.reject("INVALID_STATE", "AudioStream not initialized");
            return;
        }

        try {
            currentUrl = url;
            if (config != null) {
                this.config = config;
            }

            updateState(PlaybackState.LOADING);
            bufferStartTime = System.currentTimeMillis();
            totalBytesReceived = 0;

            mainHandler.post(() -> {
                try {
                    // Build media item with headers if provided
                    MediaItem.Builder mediaItemBuilder = new MediaItem.Builder()
                            .setUri(Uri.parse(url));

                    if (this.config.hasKey("headers")) {
                        Map<String, String> headers = new HashMap<>();
                        ReadableMap headersMap = this.config.getMap("headers");
                        if (headersMap != null) {
                            com.facebook.react.bridge.ReadableMapKeySetIterator iterator = headersMap.keySetIterator();
                            while (iterator.hasNextKey()) {
                                String key = iterator.nextKey();
                                headers.put(key, headersMap.getString(key));
                            }
                        }
                        mediaItemBuilder.setRequestMetadata(
                            new MediaItem.RequestMetadata.Builder()
                                .setExtras(null)
                                .build()
                        );
                    }

                    MediaItem mediaItem = mediaItemBuilder.build();
                    player.setMediaItem(mediaItem);
                    player.prepare();

                    if (this.config.hasKey("autoPlay") && this.config.getBoolean("autoPlay")) {
                        player.play();
                    }

                    sendEvent("onStreamStart", Arguments.createMap());
                    startProgressTimer();
                    startStatsTimer();

                } catch (Exception e) {
                    Log.e(TAG, "Failed to start stream", e);
                    updateState(PlaybackState.ERROR);
                }
            });

            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start stream", e);
            promise.reject("STREAM_START_ERROR", "Failed to start stream", e);
        }
    }

    @ReactMethod
    public void stopStream(Promise promise) {
        try {
            cleanup();
            updateState(PlaybackState.IDLE); // Change to IDLE instead of STOPPED
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop stream", e);
            promise.reject("STOP_ERROR", "Failed to stop stream", e);
        }
    }

    @ReactMethod
    public void play(Promise promise) {
        try {
            mainHandler.post(() -> {
                if (player != null) {
                    player.play();
                    updateState(PlaybackState.PLAYING);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to play", e);
            promise.reject("PLAY_ERROR", "Failed to play", e);
        }
    }

    @ReactMethod
    public void pause(Promise promise) {
        try {
            mainHandler.post(() -> {
                if (player != null) {
                    player.pause();
                    updateState(PlaybackState.PAUSED);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to pause", e);
            promise.reject("PAUSE_ERROR", "Failed to pause", e);
        }
    }

    @ReactMethod
    public void stop(Promise promise) {
        try {
            mainHandler.post(() -> {
                if (player != null) {
                    player.stop();
                    player.clearMediaItems();
                    updateState(PlaybackState.STOPPED);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop", e);
            promise.reject("STOP_ERROR", "Failed to stop", e);
        }
    }

    @ReactMethod
    public void seek(double position, Promise promise) {
        try {
            mainHandler.post(() -> {
                if (player != null) {
                    player.seekTo((long) (position * 1000));
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to seek", e);
            promise.reject("SEEK_ERROR", "Failed to seek", e);
        }
    }

    @ReactMethod
    public void setVolume(float volume, Promise promise) {
        try {
            mainHandler.post(() -> {
                if (player != null) {
                    player.setVolume(volume);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set volume", e);
            promise.reject("VOLUME_ERROR", "Failed to set volume", e);
        }
    }

    @ReactMethod
    public void getVolume(Promise promise) {
        try {
            float volume = player != null ? player.getVolume() : 1.0f;
            promise.resolve(volume);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get volume", e);
            promise.reject("VOLUME_ERROR", "Failed to get volume", e);
        }
    }

    @ReactMethod
    public void setPlaybackRate(float rate, Promise promise) {
        try {
            mainHandler.post(() -> {
                if (player != null) {
                    player.setPlaybackSpeed(rate);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set playback rate", e);
            promise.reject("RATE_ERROR", "Failed to set playback rate", e);
        }
    }

    @ReactMethod
    public void getPlaybackRate(Promise promise) {
        try {
            float rate = player != null ? player.getPlaybackParameters().speed : 1.0f;
            promise.resolve(rate);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get playback rate", e);
            promise.reject("RATE_ERROR", "Failed to get playback rate", e);
        }
    }

    @ReactMethod
    public void getState(Promise promise) {
        promise.resolve(currentState.toString());
    }

    @ReactMethod
    public void getCurrentTime(Promise promise) {
        try {
            double currentTime = 0;
            if (player != null) {
                currentTime = player.getCurrentPosition() / 1000.0;
            }
            promise.resolve(currentTime);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get current time", e);
            promise.reject("TIME_ERROR", "Failed to get current time", e);
        }
    }

    @ReactMethod
    public void getDuration(Promise promise) {
        try {
            double duration = 0;
            if (player != null && player.getDuration() != C.TIME_UNSET) {
                duration = player.getDuration() / 1000.0;
            }
            promise.resolve(duration);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get duration", e);
            promise.reject("DURATION_ERROR", "Failed to get duration", e);
        }
    }

    @ReactMethod
    public void getBufferedPercentage(Promise promise) {
        try {
            int percentage = 0;
            if (player != null && player.getDuration() != C.TIME_UNSET) {
                long bufferedPosition = player.getBufferedPosition();
                long duration = player.getDuration();
                if (duration > 0) {
                    percentage = (int) ((bufferedPosition * 100) / duration);
                }
            }
            promise.resolve(percentage);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get buffered percentage", e);
            promise.reject("BUFFER_ERROR", "Failed to get buffered percentage", e);
        }
    }

    @ReactMethod
    public void getStats(Promise promise) {
        try {
            WritableMap stats = Arguments.createMap();
            
            if (player != null) {
                // Buffered duration
                long bufferedPosition = player.getBufferedPosition();
                long currentPosition = player.getCurrentPosition();
                double bufferedDuration = (bufferedPosition - currentPosition) / 1000.0;
                
                // Current and total duration
                double playedDuration = currentPosition / 1000.0;
                double totalDuration = player.getDuration() != C.TIME_UNSET ? player.getDuration() / 1000.0 : 0;
                
                // Network speed
                long elapsedTime = System.currentTimeMillis() - bufferStartTime;
                double networkSpeed = elapsedTime > 0 ? (totalBytesReceived / elapsedTime) : 0; // KB/s
                
                // Buffer health
                int bufferHealth = 100;
                if (player.getPlaybackState() == Player.STATE_BUFFERING) {
                    bufferHealth = 0;
                } else if (player.getPlayWhenReady() && player.getPlaybackState() == Player.STATE_READY) {
                    bufferHealth = 100;
                } else {
                    bufferHealth = 50;
                }
                
                stats.putDouble("bufferedDuration", bufferedDuration);
                stats.putDouble("playedDuration", playedDuration);
                stats.putDouble("totalDuration", totalDuration);
                stats.putDouble("networkSpeed", networkSpeed);
                stats.putDouble("latency", 0); // Would need ping implementation
                stats.putDouble("bufferHealth", bufferHealth);
                stats.putDouble("droppedFrames", 0); // Not applicable for audio
                stats.putDouble("bitRate", bandwidthMeter.getBitrateEstimate() / 1000); // Convert to kbps
                
                // Additional buffer information
                stats.putDouble("bufferedPosition", player.getBufferedPosition() / 1000.0);
                stats.putDouble("currentPosition", currentPosition / 1000.0);
                stats.putInt("bufferedPercentage", player.getDuration() > 0 ? 
                    (int) ((player.getBufferedPosition() * 100) / player.getDuration()) : 0);
                stats.putBoolean("isBuffering", player.getPlaybackState() == Player.STATE_BUFFERING);
                stats.putBoolean("playWhenReady", player.getPlayWhenReady());
            }
            
            promise.resolve(stats);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get stats", e);
            promise.reject("STATS_ERROR", "Failed to get stats", e);
        }
    }

    @ReactMethod
    public void getMetadata(Promise promise) {
        try {
            WritableMap metadata = Arguments.createMap();
            
            if (player != null && player.getMediaMetadata() != null) {
                com.google.android.exoplayer2.MediaMetadata mediaMetadata = player.getMediaMetadata();
                
                if (mediaMetadata.title != null) {
                    metadata.putString("title", mediaMetadata.title.toString());
                }
                if (mediaMetadata.artist != null) {
                    metadata.putString("artist", mediaMetadata.artist.toString());
                }
                if (mediaMetadata.albumTitle != null) {
                    metadata.putString("album", mediaMetadata.albumTitle.toString());
                }
                
                double duration = player.getDuration() != C.TIME_UNSET ? player.getDuration() / 1000.0 : 0;
                if (duration > 0) {
                    metadata.putDouble("duration", duration);
                }
            }
            
            promise.resolve(metadata);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get metadata", e);
            promise.reject("METADATA_ERROR", "Failed to get metadata", e);
        }
    }

    @ReactMethod
    public void setEqualizer(ReadableArray bands, Promise promise) {
        // ExoPlayer doesn't have built-in equalizer support
        // Would need to implement with AudioEffect API
        promise.resolve(true);
    }

    @ReactMethod
    public void getEqualizer(Promise promise) {
        WritableArray bands = Arguments.createArray();
        // Return default flat equalizer
        int[] frequencies = {60, 230, 910, 3600, 14000};
        for (int freq : frequencies) {
            WritableMap band = Arguments.createMap();
            band.putInt("frequency", freq);
            band.putDouble("gain", 0);
            bands.pushMap(band);
        }
        promise.resolve(bands);
    }

    @ReactMethod
    public void clearCache(Promise promise) {
        try {
            if (cache != null) {
                cache.release();
                File cacheDir = new File(reactContext.getCacheDir(), "audio_cache");
                deleteRecursive(cacheDir);
                setupCache(config);
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to clear cache", e);
            promise.reject("CACHE_ERROR", "Failed to clear cache", e);
        }
    }

    @ReactMethod
    public void getCacheSize(Promise promise) {
        try {
            long size = 0;
            if (cache != null) {
                // Get actual cache size used, not available space
                File cacheDir = new File(reactContext.getCacheDir(), "audio_cache");
                if (cacheDir.exists()) {
                    size = getFolderSize(cacheDir);
                }
            }
            promise.resolve((double) size);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get cache size", e);
            promise.reject("CACHE_ERROR", "Failed to get cache size", e);
        }
    }
    
    private long getFolderSize(File folder) {
        long size = 0;
        if (folder.exists()) {
            File[] files = folder.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isFile()) {
                        size += file.length();
                    } else {
                        size += getFolderSize(file);
                    }
                }
            }
        }
        return size;
    }

    @ReactMethod
    public void preloadStream(String url, double duration, Promise promise) {
        // Implementation would download and cache the specified duration
        promise.resolve(true);
    }

    @ReactMethod
    public void setNetworkPriority(String priority, Promise promise) {
        // Implementation would adjust network priority
        promise.resolve(true);
    }

    @ReactMethod
    public void requestAudioFocus(Promise promise) {
        try {
            int result;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                android.media.AudioAttributes playbackAttributes = new android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(playbackAttributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(new AudioManager.OnAudioFocusChangeListener() {
                            @Override
                            public void onAudioFocusChange(int focusChange) {
                                // Handle focus changes
                            }
                        })
                        .build();
                result = audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                result = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                );
            }
            promise.resolve(result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        } catch (Exception e) {
            Log.e(TAG, "Failed to request audio focus", e);
            promise.reject("AUDIO_FOCUS_ERROR", "Failed to request audio focus", e);
        }
    }

    @ReactMethod
    public void abandonAudioFocus(Promise promise) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                // For API 26+, use abandonAudioFocusRequest
                if (audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                }
            } else {
                audioManager.abandonAudioFocus(null);
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to abandon audio focus", e);
            promise.reject("AUDIO_FOCUS_ERROR", "Failed to abandon audio focus", e);
        }
    }

    @ReactMethod
    public void setAudioSessionCategory(String category, Promise promise) {
        // iOS specific - not applicable for Android
        promise.resolve(true);
    }

    @ReactMethod
    public void cancelStream(Promise promise) {
        try {
            cleanup();
            updateState(PlaybackState.IDLE);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel stream", e);
            promise.reject("CANCEL_ERROR", "Failed to cancel stream", e);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for NativeEventEmitter
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Keep: Required for NativeEventEmitter
    }

    // Helper methods

    private void cleanup() {
        if (progressTimer != null) {
            progressTimer.cancel();
            progressTimer = null;
        }
        
        if (statsTimer != null) {
            statsTimer.cancel();
            statsTimer = null;
        }

        mainHandler.post(() -> {
            if (player != null) {
                player.release();
                player = null;
            }
        });

        currentUrl = null;
    }

    private void updateState(PlaybackState state) {
        currentState = state;
        WritableMap params = Arguments.createMap();
        params.putString("state", state.toString());
        sendEvent("onStreamStateChange", params);
    }

    private void handlePlaybackStateChange(int playbackState) {
        switch (playbackState) {
            case Player.STATE_IDLE:
                updateState(PlaybackState.IDLE);
                break;
            case Player.STATE_BUFFERING:
                updateState(PlaybackState.BUFFERING);
                WritableMap bufferParams = Arguments.createMap();
                bufferParams.putBoolean("isBuffering", true);
                sendEvent("onStreamBuffer", bufferParams);
                break;
            case Player.STATE_READY:
                if (currentState == PlaybackState.BUFFERING) {
                    WritableMap bufferParams2 = Arguments.createMap();
                    bufferParams2.putBoolean("isBuffering", false);
                    sendEvent("onStreamBuffer", bufferParams2);
                }
                if (player.getPlayWhenReady()) {
                    updateState(PlaybackState.PLAYING);
                }
                break;
            case Player.STATE_ENDED:
                updateState(PlaybackState.COMPLETED);
                sendEvent("onStreamEnd", Arguments.createMap());
                cleanup();
                break;
        }
    }

    private void handlePlayerError(PlaybackException error) {
        updateState(PlaybackState.ERROR);
        
        WritableMap errorParams = Arguments.createMap();
        errorParams.putString("code", "PLAYER_ERROR");
        errorParams.putString("message", error.getMessage());
        errorParams.putBoolean("recoverable", true);
        
        WritableMap details = Arguments.createMap();
        details.putInt("errorCode", error.errorCode);
        errorParams.putMap("details", details);
        
        sendEvent("onStreamError", errorParams);
    }

    private void startProgressTimer() {
        if (progressTimer != null) {
            progressTimer.cancel();
        }

        progressTimer = new Timer();
        progressTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                updateProgress();
            }
        }, 0, 100);
    }

    private void startStatsTimer() {
        if (statsTimer != null) {
            statsTimer.cancel();
        }

        statsTimer = new Timer();
        statsTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                updateStats();
            }
        }, 0, 1000);
    }

    private void updateProgress() {
        mainHandler.post(() -> {
            if (player != null) {
                double currentTime = player.getCurrentPosition() / 1000.0;
                double duration = player.getDuration() != C.TIME_UNSET ? player.getDuration() / 1000.0 : 0;
                double percentage = duration > 0 ? (currentTime / duration) * 100 : 0;

                WritableMap params = Arguments.createMap();
                params.putDouble("currentTime", currentTime);
                params.putDouble("duration", duration);
                params.putDouble("percentage", percentage);

                sendEvent("onStreamProgress", params);
            }
        });
    }

    private void updateStats() {
        mainHandler.post(() -> {
            getStats(new Promise() {
                @Override
                public void resolve(@Nullable Object value) {
                    if (value instanceof WritableMap) {
                        WritableMap params = Arguments.createMap();
                        params.putMap("stats", (WritableMap) value);
                        sendEvent("onStreamStats", params);
                    }
                }

                @Override
                public void reject(String code, String message) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String code, Throwable throwable) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String code, String message, Throwable throwable) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(Throwable throwable) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String code, WritableMap userInfo) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String code, String message, WritableMap userInfo) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String code, Throwable throwable, WritableMap userInfo) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String code, String message, Throwable throwable, WritableMap userInfo) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(String message) {
                    // Ignore errors for stats
                }

                @Override
                public void reject(Throwable throwable, WritableMap userInfo) {
                    // Ignore errors for stats
                }
            });
        });
    }

    private void extractAndSendMetadata() {
        getMetadata(new Promise() {
            @Override
            public void resolve(@Nullable Object value) {
                if (value instanceof WritableMap) {
                    WritableMap params = Arguments.createMap();
                    params.putMap("metadata", (WritableMap) value);
                    sendEvent("onStreamMetadata", params);
                }
            }

            @Override
            public void reject(String code, String message) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String code, Throwable throwable) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String code, String message, Throwable throwable) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(Throwable throwable) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String code, WritableMap userInfo) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String code, String message, WritableMap userInfo) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String code, Throwable throwable, WritableMap userInfo) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String code, String message, Throwable throwable, WritableMap userInfo) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(String message) {
                // Ignore errors for metadata
            }

            @Override
            public void reject(Throwable throwable, WritableMap userInfo) {
                // Ignore errors for metadata
            }
        });
    }

    private void sendEvent(String eventName, WritableMap params) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            for (File child : fileOrDirectory.listFiles()) {
                deleteRecursive(child);
            }
        }
        fileOrDirectory.delete();
    }
} 