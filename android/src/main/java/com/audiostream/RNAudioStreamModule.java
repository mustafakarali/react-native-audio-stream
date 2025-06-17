package com.audiostream;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.app.ActivityManager;
import android.app.Activity;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;

// AndroidX Media3 imports (replacing ExoPlayer2)
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.Timeline;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.Util;

import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.LoadControl;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.dash.DashMediaSource;
import androidx.media3.exoplayer.smoothstreaming.SsMediaSource;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultBandwidthMeter;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.datasource.FileDataSource;
import androidx.media3.datasource.ByteArrayDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.common.Metadata;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import android.util.Base64;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

import javax.annotation.Nullable;

import okhttp3.OkHttpClient;
import org.json.JSONException;
import org.json.JSONObject;

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

    // iOS 26 Feature Placeholders for Android
    private File streamingFile = null;
    private FileOutputStream streamingOutputStream = null;
    private boolean isPlaying = false;
    private long prebufferThreshold = 16 * 1024; // 16KB default
    
    // Memory streaming support - DISABLED FOR NOW
    // private boolean isMemoryStreaming = false;

    public RNAudioStreamModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
        this.mainHandler = new Handler(Looper.getMainLooper());
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
        
        // Ensure bandwidthMeter is initialized
        if (bandwidthMeter == null) {
            bandwidthMeter = new DefaultBandwidthMeter.Builder(reactContext).build();
        }

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
            androidx.media3.common.AudioAttributes audioAttributes = new androidx.media3.common.AudioAttributes.Builder()
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
                
                @Override
                public void onMediaMetadataChanged(MediaMetadata metadata) {
                    extractAndSendMetadata();
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
        try {
            currentUrl = url;
            this.config = config;

            mainHandler.post(() -> {
                try {
                    // Update configuration
                    boolean useCache = config != null && config.hasKey("enableCache") && config.getBoolean("enableCache");
                    
                    // Check if it's a file path
                    boolean isFilePath = url.startsWith("/") || url.startsWith("file://");
                    
                    // Determine if it's HLS/DASH
                    boolean isHLS = url.endsWith(".m3u8") || url.contains("playlist.m3u8");
                    boolean isDASH = url.endsWith(".mpd");
                    boolean isHTTP = url.startsWith("http://") || url.startsWith("https://");
                    
                    // Determine HTTP method
                    String httpMethod = "GET";
                    if (config != null && config.hasKey("method")) {
                        httpMethod = config.getString("method");
                    }
                    
                    MediaItem mediaItem;
                    
                    // Handle file paths FIRST
                    if (isFilePath) {
                        String filePath = url.startsWith("file://") ? url.substring(7) : url;
                        File file = new File(filePath);
                        
                        if (!file.exists()) {
                            promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath, (Throwable) null);
                            return;
                        }
                        
                        mediaItem = MediaItem.fromUri(Uri.fromFile(file));
                        
                        ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                            new FileDataSource.Factory()
                        ).createMediaSource(mediaItem);
                        
                        player.setMediaSource(mediaSource);
                    } else if (isHTTP && "POST".equals(httpMethod)) {
                        // POST requests are not fully supported by ExoPlayer
                        // Log warning and continue with normal flow
                        Log.w(TAG, "POST requests with body are not fully supported in Android. Consider using playFromData() for TTS services.");
                    }
                    
                    // For GET requests or if POST has no body, use normal approach
                    Map<String, String> headers = new HashMap<>();
                    if (config != null && config.hasKey("headers")) {
                        ReadableMap headersMap = config.getMap("headers");
                        if (headersMap != null) {
                            ReadableMapKeySetIterator iterator = headersMap.keySetIterator();
                            while (iterator.hasNextKey()) {
                                String key = iterator.nextKey();
                                headers.put(key, headersMap.getString(key));
                            }
                        }
                    }
                    
                    if (!isFilePath) {
                        if (isHLS) {
                            mediaItem = new MediaItem.Builder()
                                    .setUri(url)
                                    .setMimeType(MimeTypes.APPLICATION_M3U8)
                                    .setRequestMetadata(new MediaItem.RequestMetadata.Builder()
                                            .setExtras(Bundle.EMPTY)
                                            .build())
                                    .build();
                            
                            HlsMediaSource hlsMediaSource = new HlsMediaSource.Factory(
                                    useCache ? dataSourceFactory : new DefaultHttpDataSource.Factory()
                                            .setDefaultRequestProperties(headers)
                            ).createMediaSource(mediaItem);
                            
                            player.setMediaSource(hlsMediaSource);
                        } else if (isDASH) {
                            mediaItem = new MediaItem.Builder()
                                    .setUri(url)
                                    .setMimeType(MimeTypes.APPLICATION_MPD)
                                    .build();
                            
                            DashMediaSource dashMediaSource = new DashMediaSource.Factory(
                                    useCache ? dataSourceFactory : new DefaultHttpDataSource.Factory()
                                            .setDefaultRequestProperties(headers)
                            ).createMediaSource(mediaItem);
                            
                            player.setMediaSource(dashMediaSource);
                        } else {
                            // Regular HTTP/HTTPS stream
                            mediaItem = new MediaItem.Builder()
                                    .setUri(url)
                                    .setRequestMetadata(new MediaItem.RequestMetadata.Builder()
                                            .setExtras(Bundle.EMPTY)
                                            .build())
                                    .build();
                            
                            if (headers.size() > 0 || useCache) {
                                ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                                        useCache ? dataSourceFactory : new DefaultHttpDataSource.Factory()
                                                .setDefaultRequestProperties(headers)
                                ).createMediaSource(mediaItem);
                                
                                player.setMediaSource(mediaSource);
                            } else {
                                player.setMediaItem(mediaItem);
                            }
                        }
                    }
                    
                    player.prepare();
                    updateState(PlaybackState.LOADING);
                    sendEvent("onStreamStart", Arguments.createMap());
                    
                    if (config != null && config.hasKey("autoPlay") && config.getBoolean("autoPlay")) {
                        player.play();
                    }
                    
                    startProgressTimer();
                    startStatsTimer();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to start stream", e);
                    promise.reject("START_ERROR", "Failed to start stream", e);
                    return;
                }
            });

            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start stream", e);
            promise.reject("START_ERROR", "Failed to start stream", e);
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
            if (player != null) {
                long bufferedPosition = player.getBufferedPosition();
                long duration = player.getDuration();
                
                if (duration != C.TIME_UNSET && duration > 0) {
                    // Known duration - calculate percentage normally
                    percentage = (int) ((bufferedPosition * 100) / duration);
                } else {
                    // Live stream or unknown duration - use buffer size relative to current position
                    long currentPosition = player.getCurrentPosition();
                    if (bufferedPosition > currentPosition) {
                        // Show buffer ahead as percentage (max 100%)
                        long bufferAhead = bufferedPosition - currentPosition;
                        // Consider 30 seconds of buffer as 100%
                        percentage = Math.min(100, (int) ((bufferAhead * 100) / 30000));
                    }
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
                
                // Calculate buffered percentage
                int bufferedPercentage = 0;
                if (totalDuration > 0) {
                    // Known duration
                    bufferedPercentage = (int) ((player.getBufferedPosition() * 100) / player.getDuration());
                } else {
                    // Live stream - use buffer ahead
                    long bufferAhead = bufferedPosition - currentPosition;
                    if (bufferAhead > 0) {
                        // Consider 30 seconds as 100%
                        bufferedPercentage = Math.min(100, (int) ((bufferAhead * 100) / 30000));
                    }
                }
                
                stats.putInt("bufferedPercentage", bufferedPercentage);
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
                MediaMetadata mediaMetadata = player.getMediaMetadata();
                
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
            // Android 15 (API 35) audio focus restrictions
            if (Build.VERSION.SDK_INT >= 35) {
                // Check if app is in foreground or has active foreground service
                if (!isAppInForeground() && !hasActiveForegroundService()) {
                    promise.reject("AUDIO_FOCUS_ERROR", 
                        "Apps targeting Android 15 must be in foreground or have audio foreground service to request audio focus", 
                        (Throwable) null);
                    return;
                }
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(new AudioManager.OnAudioFocusChangeListener() {
                            @Override
                            public void onAudioFocusChange(int focusChange) {
                                handleAudioFocusChange(focusChange);
                            }
                        })
                        .build();
                
                int result = audioManager.requestAudioFocus(audioFocusRequest);
                promise.resolve(result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            } else {
                int result = audioManager.requestAudioFocus(
                    focusChange -> handleAudioFocusChange(focusChange),
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                );
                promise.resolve(result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to request audio focus", e);
            promise.reject("AUDIO_FOCUS_ERROR", "Failed to request audio focus", e);
        }
    }

    private boolean isAppInForeground() {
        // Check if app is in foreground
        // This is a simplified check - production apps should use ProcessLifecycleOwner
        ActivityManager.RunningAppProcessInfo appProcessInfo = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(appProcessInfo);
        return (appProcessInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND);
    }

    private boolean hasActiveForegroundService() {
        // Check if app has an active foreground service
        // This would need to be implemented based on your app's service architecture
        return false; // Placeholder - implement based on your app
    }

    private void handleAudioFocusChange(int focusChange) {
        WritableMap params = Arguments.createMap();
        
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_GAIN:
                params.putString("focusChange", "gain");
                if (player != null && currentState == PlaybackState.PAUSED) {
                    player.play();
                }
                break;
            case AudioManager.AUDIOFOCUS_LOSS:
                params.putString("focusChange", "loss");
                if (player != null) {
                    player.pause();
                }
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                params.putString("focusChange", "loss_transient");
                if (player != null) {
                    player.pause();
                }
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                params.putString("focusChange", "loss_transient_can_duck");
                if (player != null) {
                    player.setVolume(0.3f);
                }
                break;
        }
        
        sendEvent("onAudioFocusChange", params);
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
            mainHandler.post(() -> {
                if (player != null) {
                    player.stop();
                    player.clearMediaItems();
                }
                if (progressTimer != null) {
                    progressTimer.cancel();
                    progressTimer = null;
                }
                if (statsTimer != null) {
                    statsTimer.cancel();
                    statsTimer = null;
                }
            });
            updateState(PlaybackState.IDLE);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel stream", e);
            promise.reject("CANCEL_ERROR", "Failed to cancel stream", e);
        }
    }

    @ReactMethod
    public void playFromData(String base64Data, ReadableMap config, Promise promise) {
        try {
            if (!isInitialized) {
                promise.reject("NOT_INITIALIZED", "Audio stream is not initialized", (Throwable) null);
                return;
            }

            if (base64Data == null || base64Data.isEmpty()) {
                promise.reject("INVALID_DATA", "No audio data provided", (Throwable) null);
                return;
            }

            // Decode base64 to byte array
            byte[] audioData = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            if (audioData == null || audioData.length == 0) {
                promise.reject("DECODE_ERROR", "Failed to decode base64 data", (Throwable) null);
                return;
            }

            Log.i(TAG, "Playing audio data, size: " + audioData.length + " bytes");

            mainHandler.post(() -> {
                try {
                    // Create ByteArrayDataSource
                    ByteArrayDataSource dataSource = new ByteArrayDataSource(audioData);
                    
                    // Create media item
                    MediaItem mediaItem = new MediaItem.Builder()
                            .setUri(Uri.parse("data:audio/mp3;base64," + base64Data.substring(0, 50)))
                            .build();
                    
                    // Create media source
                    ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                            new DataSource.Factory() {
                                @Override
                                public DataSource createDataSource() {
                                    return dataSource;
                                }
                            }
                    ).createMediaSource(mediaItem);
                    
                    player.setMediaSource(mediaSource);
                    player.prepare();
                    
                    updateState(PlaybackState.LOADING);
                    sendEvent("onStreamStart", Arguments.createMap());
                    
                    if (config != null && config.hasKey("autoPlay") && config.getBoolean("autoPlay")) {
                        player.play();
                    }
                    
                    startProgressTimer();
                    startStatsTimer();
                    
                    promise.resolve(true);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to play audio data", e);
                    promise.reject("PLAYBACK_ERROR", "Failed to play audio data", e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to decode audio data", e);
            promise.reject("DECODE_ERROR", "Failed to decode audio data", e);
        }
    }

    @ReactMethod
    public void appendToBuffer(String base64Data, Promise promise) {
        try {
            if (base64Data == null || base64Data.isEmpty()) {
                promise.reject("INVALID_DATA", "No data provided", (Throwable) null);
                return;
            }

            // Decode base64 to byte array
            byte[] audioData = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            if (audioData == null || audioData.length == 0) {
                promise.reject("DECODE_ERROR", "Failed to decode base64 data", (Throwable) null);
                return;
            }

            Log.i(TAG, "Appending to buffer, size: " + audioData.length + " bytes");

            mainHandler.post(() -> {
                try {
                    // Initialize streaming components if not already
                    if (streamingFile == null) {
                        streamingFile = File.createTempFile("stream", ".mp3", reactContext.getCacheDir());
                        streamingFile.deleteOnExit();
                        streamingOutputStream = new FileOutputStream(streamingFile, true); // Append mode
                        
                        // Initialize player with progressive media source
                        if (player == null) {
                            initializePlayer();
                        }
                        
                        // Create progressive media source for streaming
                        Uri fileUri = Uri.fromFile(streamingFile);
                        MediaItem mediaItem = MediaItem.fromUri(fileUri);
                        ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                            new FileDataSource.Factory()
                        ).createMediaSource(mediaItem);
                        
                        player.setMediaSource(mediaSource);
                        player.prepare();
                        
                        updateState(PlaybackState.LOADING);
                        sendEvent("onStreamStart", Arguments.createMap());
                        
                        startProgressTimer();
                        startStatsTimer();
                    }
                    
                    // Append data to streaming file
                    streamingOutputStream.write(audioData);
                    streamingOutputStream.flush();
                    
                    // Check buffer level and start playback if ready
                    if (player != null && !isPlaying && streamingFile.length() >= prebufferThreshold) {
                        if (config != null && config.hasKey("autoPlay") && config.getBoolean("autoPlay")) {
                            player.play();
                            isPlaying = true;
                        }
                    }
                    
                    promise.resolve(true);
                } catch (IOException e) {
                    Log.e(TAG, "Failed to append to buffer", e);
                    promise.reject("APPEND_ERROR", "Failed to append to buffer", e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to append to buffer", e);
            promise.reject("APPEND_ERROR", "Failed to append to buffer", e);
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

    // iOS 26 Feature Placeholders for Android
    @ReactMethod
    public void showInputPicker(Promise promise) {
        // TODO: Implement when Android provides similar API
        promise.reject("UNSUPPORTED", "Input picker is not available on Android", (Throwable) null);
    }

    @ReactMethod
    public void getAvailableInputs(Promise promise) {
        try {
            // Android doesn't have direct API like iOS, but we can provide basic info
            WritableArray inputs = Arguments.createArray();
            
            // Check for built-in mic
            WritableMap builtInMic = Arguments.createMap();
            builtInMic.putString("portName", "Built-in Microphone");
            builtInMic.putString("portType", "builtin");
            builtInMic.putString("uid", "builtin-mic");
            builtInMic.putBoolean("hasHardwareVoiceCallProcessing", true);
            builtInMic.putInt("channels", 1);
            inputs.pushMap(builtInMic);
            
            // Check for wired headset
            if (audioManager.isWiredHeadsetOn()) {
                WritableMap wiredHeadset = Arguments.createMap();
                wiredHeadset.putString("portName", "Wired Headset");
                wiredHeadset.putString("portType", "wired");
                wiredHeadset.putString("uid", "wired-headset");
                wiredHeadset.putBoolean("hasHardwareVoiceCallProcessing", false);
                wiredHeadset.putInt("channels", 1);
                inputs.pushMap(wiredHeadset);
            }
            
            promise.resolve(inputs);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get available inputs", e);
            promise.reject("INPUT_ERROR", "Failed to get available inputs", e);
        }
    }

    @ReactMethod
    public void enableEnhancedBuffering(boolean enable, Promise promise) {
        try {
            // ExoPlayer already has advanced buffering, this is a no-op for compatibility
            Log.i(TAG, "Enhanced buffering is already enabled in ExoPlayer");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("BUFFER_ERROR", "Failed to enable enhanced buffering", e);
        }
    }

    @ReactMethod
    public void enableSpatialAudio(boolean enable, Promise promise) {
        // TODO: Implement when Android provides Spatial Audio API
        promise.reject("UNSUPPORTED", "Spatial audio is not available on Android", (Throwable) null);
    }

    @ReactMethod
    public void useQueuePlayer(boolean useQueue, Promise promise) {
        try {
            // ExoPlayer already handles playlists, this is for iOS compatibility
            Log.i(TAG, "Queue player functionality is built into ExoPlayer");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("QUEUE_ERROR", "Failed to use queue player", e);
        }
    }

    @ReactMethod
    public void createRoutePickerView(Promise promise) {
        // TODO: Implement audio route picker for Android
        promise.reject("UNSUPPORTED", "Route picker view is not available on Android", (Throwable) null);
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
        String errorCode = "PLAYER_ERROR";
        String errorMessage = error.getMessage() != null ? error.getMessage() : "Unknown error";
        
        // Determine error type
        if (error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
            error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT) {
            errorCode = "NETWORK_ERROR";
            errorMessage = "Network connection failed";
        } else if (error.errorCode == PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE ||
                   error.errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS) {
            errorCode = "HTTP_ERROR";
            errorMessage = "Invalid HTTP response";
        } else if (error.errorCode == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ||
                   error.errorCode == PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED) {
            errorCode = "PARSE_ERROR";
            errorMessage = "Invalid stream format";
        } else if (error.errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
                   error.errorCode == PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED) {
            errorCode = "DECODER_ERROR";
            errorMessage = "Audio decoder error";
        }
        
        errorParams.putString("code", errorCode);
        errorParams.putString("message", errorMessage);
        errorParams.putBoolean("recoverable", error.errorCode != PlaybackException.ERROR_CODE_DECODER_INIT_FAILED);
        
        WritableMap details = Arguments.createMap();
        details.putInt("errorCode", error.errorCode);
        details.putString("errorName", error.getErrorCodeName());
        if (error.getCause() != null) {
            details.putString("cause", error.getCause().toString());
        }
        errorParams.putMap("details", details);
        
        Log.e(TAG, "Playback error: " + errorMessage + " (code: " + error.errorCode + ")", error);
        
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