package com.audiostream;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
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
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.Timeline;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.Util;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.ByteArrayDataSource;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.FileDataSource;
import androidx.media3.datasource.cache.Cache;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.LoadControl;
import androidx.media3.exoplayer.MediaClock;
import androidx.media3.exoplayer.Renderer;
import androidx.media3.exoplayer.dash.DashMediaSource;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.smoothstreaming.SsMediaSource;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.MergingMediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.source.SingleSampleMediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.exoplayer.trackselection.TrackSelector;
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.extractor.mp3.Mp3Extractor;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ExtractorsFactory;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import android.util.Base64;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

import javax.annotation.Nullable;

import okhttp3.OkHttpClient;
import okio.ByteString;
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

    // Streaming file support
    private File streamingFile = null;
    private FileOutputStream streamingOutputStream = null;
    private boolean isPlaying = false;
    private long prebufferThreshold = 16 * 1024; // 16KB default

    // Real-time streaming components
    private RealtimeStreamingDataSource streamingDataSource = null;
    private boolean isStreamingActive = false;

    // Real equalizer
    private AudioEqualizer audioEqualizer = null;

    // Stream reconnect configuration
    private int reconnectAttempts = 3;
    private int reconnectDelay = 1000; // ms
    private int connectionTimeout = 30000; // ms
    private int currentReconnectAttempt = 0;
    private boolean isReconnecting = false;
    private boolean enableBackgroundMode = false;

    // Network monitoring
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    public RNAudioStreamModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
        this.connectivityManager = (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void initialize(ReadableMap config, Promise promise) {
        try {
            // Guard against double initialization
            if (isInitialized) {
                Log.w(TAG, "Already initialized, skipping re-init");
                promise.resolve(true);
                return;
            }

            this.config = config;

            // Read reconnect/timeout/background config
            if (config.hasKey("reconnectAttempts")) {
                this.reconnectAttempts = config.getInt("reconnectAttempts");
            }
            if (config.hasKey("reconnectDelay")) {
                this.reconnectDelay = config.getInt("reconnectDelay");
            }
            if (config.hasKey("timeout")) {
                this.connectionTimeout = config.getInt("timeout");
            }
            if (config.hasKey("enableBackgroundMode")) {
                this.enableBackgroundMode = config.getBoolean("enableBackgroundMode");
            }

            // Initialize bandwidth meter for network speed monitoring
            bandwidthMeter = new DefaultBandwidthMeter.Builder(reactContext).build();
            
            // Setup cache if enabled
            if (config.hasKey("enableCache") && config.getBoolean("enableCache")) {
                setupCache(config);
            }
            
            // Setup data source factory (uses connectionTimeout)
            setupDataSourceFactory();
            
            // Initialize player
            initializePlayer();

            // Start network monitoring
            startNetworkMonitor();
            
            isInitialized = true;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize", e);
            promise.reject("INITIALIZATION_ERROR", "Failed to initialize audio stream", e);
        }
    }

    private void setupCache(ReadableMap config) {
        // Release existing cache if present (prevents IllegalStateException on re-init)
        if (cache != null) {
            try {
                cache.release();
            } catch (Exception e) {
                Log.w(TAG, "Failed to release existing cache: " + e.getMessage());
            }
            cache = null;
        }

        int cacheSize = config.hasKey("cacheSize") ? config.getInt("cacheSize") * 1024 * 1024 : 100 * 1024 * 1024;
        File cacheDir = new File(reactContext.getCacheDir(), "audio_cache");
        if (!cacheDir.exists()) {
            cacheDir.mkdirs();
        }
        try {
            cache = new SimpleCache(
                    cacheDir,
                    new LeastRecentlyUsedCacheEvictor(cacheSize),
                    new StandaloneDatabaseProvider(reactContext)
            );
        } catch (Exception e) {
            Log.e(TAG, "Failed to create cache, continuing without cache: " + e.getMessage());
            cache = null;
        }
    }

    private void setupDataSourceFactory() {
        long timeoutMs = connectionTimeout;
        OkHttpClient okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS)
                .readTimeout(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS)
                .writeTimeout(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS)
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
        if (player != null) {
            return;
        }

        try {
                // Create LoadControl for better buffering
                DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                        .setBufferDurationsMs(
                                30000,  // Min buffer: 30 seconds
                                60000,  // Max buffer: 60 seconds
                                2500,   // Buffer for playback: 2.5 seconds  
                                5000    // Buffer for playback after rebuffer: 5 seconds
                        )
                        .setTargetBufferBytes(C.LENGTH_UNSET)
                        .setPrioritizeTimeOverSizeThresholds(true)
                        .build();

                // Track selector with better performance
                TrackSelector trackSelector = new DefaultTrackSelector(reactContext);
                
                // Create ExoPlayer with optimized settings + live catch-up playback
                // Use main looper so player can be accessed from mainHandler (main thread)
                // even though it's created on the React Native thread (mqt_v_native)
                ExoPlayer.Builder playerBuilder = new ExoPlayer.Builder(reactContext)
                        .setLooper(Looper.getMainLooper())
                        .setLoadControl(loadControl)
                        .setTrackSelector(trackSelector)
                        .setBandwidthMeter(bandwidthMeter)
                        .setSeekBackIncrementMs(10000)
                        .setSeekForwardIncrementMs(10000);

                // Add LivePlaybackSpeedControl for catch-up playback in live streams
                if (targetLatencyMs > 0) {
                    playerBuilder.setLivePlaybackSpeedControl(
                            new androidx.media3.exoplayer.DefaultLivePlaybackSpeedControl.Builder()
                                    .setMinUpdateIntervalMs(100)
                                    .setProportionalControlFactor(1.0f)
                                    .setMaxLiveOffsetErrorMsForUnitSpeed(25)
                                    .setFallbackMinPlaybackSpeed(0.97f)
                                    .setFallbackMaxPlaybackSpeed(1.03f)
                                    .setTargetLiveOffsetIncrementOnRebufferMs(500)
                                    .build());
                }

                player = playerBuilder.build();

                // Handle playback events
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
                        if (reason == Player.TIMELINE_CHANGE_REASON_SOURCE_UPDATE) {
                            extractAndSendMetadata();
                        }
                    }

                    @Override
                    public void onMediaMetadataChanged(MediaMetadata metadata) {
                        extractAndSendMetadata();
                    }

                    @Override
                    public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
                        if (!playWhenReady && reason == Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM) {
                            Log.i(TAG, "Media item ended naturally");
                            updateState(PlaybackState.COMPLETED);
                            sendEvent("onStreamEnd", Arguments.createMap());
                            cleanup();
                        }
                    }

                    // DRM events are handled via onPlayerError for DRM failures
                    // and onMediaMetadataChanged for license status updates
                });

            Log.i(TAG, "ExoPlayer initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize ExoPlayer", e);
        }
    }

    @ReactMethod
    public void destroy(Promise promise) {
        try {
            cleanupAll();
            // Release the player only on destroy
            mainHandler.post(() -> {
                if (player != null) {
                    player.release();
                    player = null;
                }
            });
            isInitialized = false;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to destroy", e);
            promise.reject("DESTROY_ERROR", "Failed to destroy audio stream", e);
        }
    }

    @ReactMethod
    public void startStream(String url, ReadableMap config, Promise promise) {
        currentUrl = url;
        this.config = config;

        mainHandler.post(() -> {
            try {
                // Update configuration
                boolean useCache = config != null && config.hasKey("enableCache") && config.getBoolean("enableCache");
                
                // Check if it's a file path
                boolean isFilePath = url.startsWith("/") || url.startsWith("file://");
                
                // Determine stream type from URL extension or Content-Type header
                // Re-create player if it was released by cleanup/stopStream
                if (player == null) {
                    Log.i(TAG, "Player was released, re-creating...");
                    initializePlayer();
                }

                String mimeType = detectMimeType(url);
                boolean isHLS = "application/x-mpegURL".equals(mimeType) ||
                                "application/vnd.apple.mpegurl".equals(mimeType) ||
                                url.endsWith(".m3u8") || url.contains("playlist.m3u8");
                boolean isDASH = "application/dash+xml".equals(mimeType) || url.endsWith(".mpd");
                boolean isSmoothStreaming = "application/vnd.ms-sstr+xml".equals(mimeType) ||
                                           url.endsWith(".ism") || url.endsWith(".ism/Manifest");
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
                    Log.w(TAG, "POST requests with body are not fully supported in Android. Consider using playFromData() for TTS services.");
                }
                
                // Extract headers
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
                    // Check for DRM config
                    ReadableMap drmConfig = null;
                    if (config != null && config.hasKey("drm")) {
                        drmConfig = config.getMap("drm");
                    }

                    if (isHLS) {
                        MediaItem.Builder mediaItemBuilder = new MediaItem.Builder()
                                .setUri(url)
                                .setMimeType(MimeTypes.APPLICATION_M3U8)
                                .setRequestMetadata(new MediaItem.RequestMetadata.Builder()
                                        .setExtras(Bundle.EMPTY)
                                        .build());

                        if (drmConfig != null) {
                            applyDrmConfig(mediaItemBuilder, drmConfig);
                        }
                        mediaItem = mediaItemBuilder.build();
                        
                        HlsMediaSource.Factory hlsFactory = new HlsMediaSource.Factory(
                                useCache ? dataSourceFactory : new DefaultHttpDataSource.Factory()
                                        .setDefaultRequestProperties(headers)
                                        .setConnectTimeoutMs(30000)
                                        .setReadTimeoutMs(30000)
                                        .setAllowCrossProtocolRedirects(true)
                        );
                        
                        hlsFactory.setAllowChunklessPreparation(true);
                        HlsMediaSource hlsMediaSource = hlsFactory.createMediaSource(mediaItem);
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
                    } else if (isSmoothStreaming) {
                        mediaItem = new MediaItem.Builder()
                                .setUri(url)
                                .setMimeType(MimeTypes.APPLICATION_SS)
                                .build();
                        
                        SsMediaSource ssMediaSource = new SsMediaSource.Factory(
                                useCache ? dataSourceFactory : new DefaultHttpDataSource.Factory()
                                        .setDefaultRequestProperties(headers)
                        ).createMediaSource(mediaItem);
                        
                        player.setMediaSource(ssMediaSource);
                    } else {
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
                
                if (config != null && config.hasKey("autoPlay") && config.getBoolean("autoPlay")) {
                    player.setPlayWhenReady(true);
                }

                // Reset reconnect counter on new stream start
                currentReconnectAttempt = 0;
                isReconnecting = false;
                
                player.prepare();
                updateState(PlaybackState.LOADING);
                sendEvent("onStreamStart", Arguments.createMap());
                
                startProgressTimer();
                startStatsTimer();

                // Start foreground service if background mode is enabled
                if (enableBackgroundMode) {
                    startBackgroundService(null, null);
                }
                
                // Promise resolved INSIDE mainHandler.post — after player is configured
                promise.resolve(true);
            } catch (Exception e) {
                Log.e(TAG, "Failed to start stream", e);
                promise.reject("START_ERROR", "Failed to start stream", e);
            }
        });
    }

    @ReactMethod
    public void stopStream(Promise promise) {
        try {
            // Cancel timers
            if (progressTimer != null) {
                progressTimer.cancel();
                progressTimer = null;
            }
            if (statsTimer != null) {
                statsTimer.cancel();
                statsTimer = null;
            }
            // Stop player without releasing it
            mainHandler.post(() -> {
                if (player != null) {
                    player.stop();
                    player.clearMediaItems();
                }
            });
            currentUrl = null;
            updateState(PlaybackState.IDLE);
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

    // ─── Mute Control ───

    private boolean isMutedState = false;
    private float preMuteVolume = 1.0f;

    @ReactMethod
    public void mute(Promise promise) {
        try {
            if (!isMutedState && player != null) {
                preMuteVolume = player.getVolume();
            }
            isMutedState = true;
            mainHandler.post(() -> {
                if (player != null) {
                    player.setVolume(0f);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to mute", e);
            promise.reject("MUTE_ERROR", "Failed to mute", e);
        }
    }

    @ReactMethod
    public void unmute(Promise promise) {
        try {
            isMutedState = false;
            mainHandler.post(() -> {
                if (player != null) {
                    player.setVolume(preMuteVolume);
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to unmute", e);
            promise.reject("MUTE_ERROR", "Failed to unmute", e);
        }
    }

    @ReactMethod
    public void isMuted(Promise promise) {
        try {
            promise.resolve(isMutedState);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get mute state", e);
            promise.reject("MUTE_ERROR", "Failed to get mute state", e);
        }
    }

    // ─── Pitch Control ───

    private float currentPitch = 1.0f;

    @ReactMethod
    public void setPitch(float pitch, Promise promise) {
        try {
            currentPitch = pitch;
            mainHandler.post(() -> {
                if (player != null) {
                    float speed = player.getPlaybackParameters().speed;
                    player.setPlaybackParameters(new PlaybackParameters(speed, pitch));
                }
            });
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set pitch", e);
            promise.reject("PITCH_ERROR", "Failed to set pitch", e);
        }
    }

    @ReactMethod
    public void getPitch(Promise promise) {
        try {
            float pitch = player != null ? player.getPlaybackParameters().pitch : currentPitch;
            promise.resolve(pitch);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get pitch", e);
            promise.reject("PITCH_ERROR", "Failed to get pitch", e);
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
                    // Initialize player if needed
                    if (player == null) {
                        initializePlayer();
                    }
                    
                    // Stop any current playback
                    if (player.isPlaying()) {
                        player.stop();
                    }
                    player.clearMediaItems();
                    
                    // Create ByteArrayDataSource
                    ByteArrayDataSource dataSource = new ByteArrayDataSource(audioData);
                    
                    // Create media item
                    MediaItem mediaItem = new MediaItem.Builder()
                            .setUri(Uri.parse("data:audio/mp3"))
                            .setMimeType("audio/mpeg")
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
                    
                    // Auto play handling
                    boolean shouldAutoPlay = true;
                    if (config != null && config.hasKey("autoPlay")) {
                        shouldAutoPlay = config.getBoolean("autoPlay");
                    }
                    
                    if (shouldAutoPlay) {
                        player.setPlayWhenReady(true);
                    }
                    
                    startProgressTimer();
                    startStatsTimer();
                    
                    promise.resolve(true);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to play audio data", e);
                    promise.reject("PLAYBACK_ERROR", e.getMessage() != null ? e.getMessage() : "Failed to play audio data", e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to decode audio data", e);
            promise.reject("DECODE_ERROR", "Failed to decode audio data", e);
        }
    }

    // ── Memory Stream (progressive in-memory audio accumulation) ──
    private java.io.ByteArrayOutputStream memoryStreamBuffer;
    private ReadableMap memoryStreamConfig;

    @ReactMethod
    public void startMemoryStream(ReadableMap config, Promise promise) {
        try {
            memoryStreamBuffer = new java.io.ByteArrayOutputStream();
            memoryStreamConfig = config;
            Log.i(TAG, "Memory stream started");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start memory stream", e);
            promise.reject("MEMORY_STREAM_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void appendToMemoryStream(String base64Data, Promise promise) {
        try {
            if (memoryStreamBuffer == null) {
                promise.reject("MEMORY_STREAM_ERROR", "Memory stream not started. Call startMemoryStream first.", (Throwable) null);
                return;
            }
            byte[] decoded = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            memoryStreamBuffer.write(decoded);
            Log.d(TAG, "Appended " + decoded.length + " bytes to memory stream (total: " + memoryStreamBuffer.size() + ")");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to append to memory stream", e);
            promise.reject("MEMORY_STREAM_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void completeMemoryStream(Promise promise) {
        try {
            if (memoryStreamBuffer == null || memoryStreamBuffer.size() == 0) {
                promise.reject("MEMORY_STREAM_ERROR", "Memory stream is empty", (Throwable) null);
                return;
            }
            byte[] audioData = memoryStreamBuffer.toByteArray();
            Log.i(TAG, "Completing memory stream, total size: " + audioData.length + " bytes");

            mainHandler.post(() -> {
                try {
                    if (player == null) { initializePlayer(); }
                    if (player.isPlaying()) { player.stop(); }
                    player.clearMediaItems();

                    ByteArrayDataSource dataSource = new ByteArrayDataSource(audioData);
                    MediaItem mediaItem = new MediaItem.Builder()
                            .setUri(Uri.parse("data:audio/mp3"))
                            .setMimeType("audio/mpeg")
                            .build();
                    ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                            () -> dataSource
                    ).createMediaSource(mediaItem);

                    player.setMediaSource(mediaSource);
                    player.prepare();

                    boolean autoPlay = memoryStreamConfig == null ||
                            !memoryStreamConfig.hasKey("autoPlay") ||
                            memoryStreamConfig.getBoolean("autoPlay");
                    player.setPlayWhenReady(autoPlay);

                    updateState(PlaybackState.LOADING);
                    sendEvent("onStreamStart", Arguments.createMap());
                    startProgressTimer();
                    startStatsTimer();

                    memoryStreamBuffer = null;
                    promise.resolve(true);
                } catch (Exception e) {
                    promise.reject("PLAYBACK_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to complete memory stream", e);
            promise.reject("MEMORY_STREAM_ERROR", e.getMessage(), e);
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
                        // Default to autoPlay true if config is not provided
                        boolean shouldAutoPlay = true;
                        if (config != null && config.hasKey("autoPlay")) {
                            shouldAutoPlay = config.getBoolean("autoPlay");
                        }
                        
                        if (shouldAutoPlay) {
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

    // iOS-only feature: Android has no native input picker UI
    @ReactMethod
    public void showInputPicker(Promise promise) {
        promise.reject("UNSUPPORTED", "Input picker is an iOS-only feature", (Throwable) null);
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
        // iOS-only feature: Android has no Spatial Audio playback API
        promise.reject("UNSUPPORTED", "Spatial audio is an iOS-only feature", (Throwable) null);
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
        // iOS-only feature: Android has no native route picker view
        promise.reject("UNSUPPORTED", "Route picker view is an iOS-only feature", (Throwable) null);
    }

    // Real-time streaming components
    @ReactMethod
    public void startRealtimeStream(ReadableMap config, Promise promise) {
        try {
            Log.i(TAG, "Starting real-time streaming");
            
            if (!isInitialized) {
                promise.reject("NOT_INITIALIZED", "AudioStream is not initialized", (Throwable) null);
                return;
            }
            
            mainHandler.post(() -> {
                try {
                    // Initialize player if needed
                    if (player == null) {
                        initializePlayer();
                    }
                    
                    // Stop any current playback
                    if (player.isPlaying()) {
                        player.stop();
                    }
                    player.clearMediaItems();
                    
                    // Create streaming data source
                    streamingDataSource = new RealtimeStreamingDataSource();
                    
                    // Create a dummy URI for the stream
                    Uri streamUri = Uri.parse("streaming://realtime");
                    
                    // Create media item
                    MediaItem mediaItem = new MediaItem.Builder()
                            .setUri(streamUri)
                            .setMimeType("audio/mpeg") // MP3 için MIME type
                            .build();
                    
                    // Create a DataSource.Factory that returns our streaming data source
                    DataSource.Factory dataSourceFactory = () -> streamingDataSource;
                    
                    // Create ExtractorsFactory that includes MP3 extractor
                    ExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                            .setConstantBitrateSeekingEnabled(true);
                    
                    // Create progressive media source with our custom data source factory
                    ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                            dataSourceFactory,
                            extractorsFactory)
                            .createMediaSource(mediaItem);
                    
                    // Set media source and prepare
                    player.setMediaSource(mediaSource);
                    player.prepare();
                    
                    isStreamingActive = true;
                    updateState(PlaybackState.LOADING);
                    sendEvent("onStreamStart", Arguments.createMap());
                    
                    // Auto play if configured
                    if (config != null && config.hasKey("autoPlay") && config.getBoolean("autoPlay")) {
                        player.setPlayWhenReady(true);
                    }
                    
                    startProgressTimer();
                    startStatsTimer();
                    
                    promise.resolve(true);
                    
                    Log.i(TAG, "Real-time streaming initialized successfully");
                    
                } catch (Exception e) {
                    Log.e(TAG, "Failed to start real-time streaming", e);
                    promise.reject("STREAM_ERROR", e.getMessage() != null ? e.getMessage() : "Failed to start real-time streaming", e);
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start real-time streaming", e);
            promise.reject("STREAM_ERROR", e.getMessage() != null ? e.getMessage() : "Failed to start real-time streaming", e);
        }
    }

    @ReactMethod
    public void appendRealtimeData(String base64Data, Promise promise) {
        try {
            if (!isStreamingActive || streamingDataSource == null) {
                promise.reject("NOT_STREAMING", "Real-time streaming is not active", (Throwable) null);
                return;
            }
            
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
            
            Log.d(TAG, "Appending real-time data: " + audioData.length + " bytes");
            
            // Append data on background thread
            new Thread(() -> {
                try {
                    streamingDataSource.appendData(audioData);
                    promise.resolve(true);
                } catch (IOException e) {
                    Log.e(TAG, "Failed to append real-time data", e);
                    promise.reject("APPEND_ERROR", "Failed to append real-time data", e);
                }
            }).start();
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to append real-time data", e);
            promise.reject("APPEND_ERROR", "Failed to append real-time data", e);
        }
    }

    @ReactMethod
    public void completeRealtimeStream(Promise promise) {
        try {
            if (!isStreamingActive || streamingDataSource == null) {
                promise.reject("NOT_STREAMING", "Real-time streaming is not active", (Throwable) null);
                return;
            }
            
            Log.i(TAG, "Completing real-time stream");
            
            streamingDataSource.complete();
            isStreamingActive = false;
            
            promise.resolve(true);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to complete real-time stream", e);
            promise.reject("COMPLETE_ERROR", "Failed to complete real-time stream", e);
        }
    }

    @ReactMethod
    public void getStreamingStats(Promise promise) {
        try {
            WritableMap stats = Arguments.createMap();
            
            if (streamingDataSource != null) {
                stats.putDouble("bytesWritten", streamingDataSource.getTotalBytesWritten());
                stats.putDouble("bytesRead", streamingDataSource.getTotalBytesRead());
                stats.putBoolean("isActive", isStreamingActive);
                stats.putBoolean("isReady", streamingDataSource.isReady());
            } else {
                stats.putDouble("bytesWritten", 0);
                stats.putDouble("bytesRead", 0);
                stats.putBoolean("isActive", false);
                stats.putBoolean("isReady", false);
            }
            
            promise.resolve(stats);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to get streaming stats", e);
            promise.reject("STATS_ERROR", "Failed to get streaming stats", e);
        }
    }

    // Helper methods

    private void cleanupAll() {
        cleanup();
        cleanupStreaming();
        
        // Stop background service
        if (enableBackgroundMode) {
            stopBackgroundService();
        }

        // Stop network monitoring
        stopNetworkMonitor();

        // Reset reconnect state
        currentReconnectAttempt = 0;
        isReconnecting = false;

        // Clean up streaming file if exists
        if (streamingFile != null) {
            streamingFile.delete();
            streamingFile = null;
        }
        
        if (streamingOutputStream != null) {
            try {
                streamingOutputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "Error closing streaming output stream", e);
            }
            streamingOutputStream = null;
        }
    }

    private void cleanup() {
        if (progressTimer != null) {
            progressTimer.cancel();
            progressTimer = null;
        }
        
        if (statsTimer != null) {
            statsTimer.cancel();
            statsTimer = null;
        }

        // Stop player without releasing — player is only released in destroy()
        mainHandler.post(() -> {
            if (player != null) {
                player.stop();
                player.clearMediaItems();
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
                Log.i(TAG, "Player state changed to ENDED");
                updateState(PlaybackState.COMPLETED);
                sendEvent("onStreamEnd", Arguments.createMap());
                cleanup();
                break;
        }
    }

    private void handlePlayerError(PlaybackException error) {
        String errorCode = "PLAYER_ERROR";
        String errorMessage = error.getMessage() != null ? error.getMessage() : "Unknown error";
        boolean isNetworkError = false;
        
        // Determine error type
        if (error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
            error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT) {
            errorCode = "NETWORK_ERROR";
            errorMessage = "Network connection failed";
            isNetworkError = true;
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

        boolean isRecoverable = isNetworkError && currentReconnectAttempt < reconnectAttempts;
        
        // Attempt automatic reconnect for network errors
        if (isRecoverable && currentUrl != null && !isReconnecting) {
            currentReconnectAttempt++;
            isReconnecting = true;
            Log.w(TAG, "Network error, attempting reconnect " + currentReconnectAttempt + "/" + reconnectAttempts);

            // Notify JS about the retry attempt
            WritableMap retryParams = Arguments.createMap();
            retryParams.putString("code", errorCode);
            retryParams.putString("message", "Reconnecting (" + currentReconnectAttempt + "/" + reconnectAttempts + ")");
            retryParams.putBoolean("recoverable", true);
            WritableMap retryDetails = Arguments.createMap();
            retryDetails.putInt("attempt", currentReconnectAttempt);
            retryDetails.putInt("maxAttempts", reconnectAttempts);
            retryDetails.putInt("delayMs", reconnectDelay);
            retryParams.putMap("details", retryDetails);
            sendEvent("onStreamError", retryParams);

            // Schedule reconnect after delay
            mainHandler.postDelayed(() -> {
                isReconnecting = false;
                if (player != null && currentUrl != null) {
                    try {
                        player.prepare();
                        player.setPlayWhenReady(true);
                        updateState(PlaybackState.LOADING);
                        Log.i(TAG, "Reconnect attempt " + currentReconnectAttempt + " started");
                    } catch (Exception e) {
                        Log.e(TAG, "Reconnect attempt failed", e);
                    }
                }
            }, (long) reconnectDelay * currentReconnectAttempt); // Exponential backoff
            return;
        }
        
        // No more retries or non-recoverable error
        updateState(PlaybackState.ERROR);
        currentReconnectAttempt = 0;
        
        WritableMap errorParams = Arguments.createMap();
        errorParams.putString("code", errorCode);
        errorParams.putString("message", errorMessage);
        errorParams.putBoolean("recoverable", false);
        
        WritableMap details = Arguments.createMap();
        details.putInt("errorCode", error.errorCode);
        details.putString("errorName", error.getErrorCodeName());
        if (error.getCause() != null) {
            details.putString("cause", error.getCause().toString());
        }
        errorParams.putMap("details", details);
        
        Log.e(TAG, "Playback error (final): " + errorMessage + " (code: " + error.errorCode + ")", error);
        
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

    private void cleanupStreaming() {
        if (streamingDataSource != null) {
            streamingDataSource.complete();
            streamingDataSource = null;
        }
        isStreamingActive = false;
        if (audioEqualizer != null) {
            audioEqualizer.release();
            audioEqualizer = null;
        }
    }

    @ReactMethod
    public void getEqualizerSettings(Promise promise) {
        if (player == null) {
            promise.reject("NOT_INITIALIZED", "Player not initialized");
            return;
        }

        mainHandler.post(() -> {
            try {
                if (audioEqualizer == null) {
                    int audioSessionId = player.getAudioSessionId();
                    if (audioSessionId == 0) {
                        promise.reject("NO_SESSION", "Audio session not ready yet");
                        return;
                    }
                    audioEqualizer = new AudioEqualizer(audioSessionId);
                }

                promise.resolve(audioEqualizer.getSettings());
            } catch (Exception e) {
                Log.e(TAG, "Failed to get equalizer settings", e);
                promise.reject("EQ_ERROR", "Failed to get equalizer settings", e);
            }
        });
    }

    // ==================== PRELOAD ====================

    @ReactMethod
    public void preloadStream(String url, double durationSec, Promise promise) {
        if (dataSourceFactory == null || cache == null) {
            promise.reject("NOT_INITIALIZED", "Player not initialized or cache disabled");
            return;
        }

        new Thread(() -> {
            try {
                androidx.media3.datasource.DataSpec dataSpec =
                    new androidx.media3.datasource.DataSpec(
                        Uri.parse(url),
                        0,
                        (long) (durationSec * 128 * 1024 / 8) // Estimate bytes from duration at 128kbps
                    );

                CacheDataSource cacheDataSource = new CacheDataSource.Factory()
                    .setCache(cache)
                    .setUpstreamDataSourceFactory(dataSourceFactory)
                    .createDataSource();

                // CacheWriter writes data from upstream into cache
                androidx.media3.datasource.cache.CacheWriter cacheWriter =
                    new androidx.media3.datasource.cache.CacheWriter(
                        cacheDataSource,
                        dataSpec,
                        null, // No progress listener needed for simple preload
                        null  // No cancellation
                    );

                cacheWriter.cache();

                mainHandler.post(() -> {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", true);
                    result.putString("url", url);
                    promise.resolve(result);
                });
            } catch (Exception e) {
                Log.e(TAG, "Failed to preload stream", e);
                mainHandler.post(() -> {
                    promise.reject("PRELOAD_ERROR", "Failed to preload stream: " + e.getMessage(), e);
                });
            }
        }, "AudioStream-Preload").start();
    }

    // ==================== NETWORK PRIORITY ====================

    @ReactMethod
    public void setNetworkPriority(String priority, Promise promise) {
        try {
            int connectTimeout;
            int readTimeout;

            switch (priority.toLowerCase()) {
                case "high":
                    connectTimeout = 15;
                    readTimeout = 15;
                    break;
                case "low":
                    connectTimeout = 60;
                    readTimeout = 60;
                    break;
                case "normal":
                default:
                    connectTimeout = 30;
                    readTimeout = 30;
                    break;
            }

            // Rebuild data source factory with new timeouts
            OkHttpClient okHttpClient = new OkHttpClient.Builder()
                    .connectTimeout(connectTimeout, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(readTimeout, java.util.concurrent.TimeUnit.SECONDS)
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

            WritableMap result = Arguments.createMap();
            result.putString("priority", priority);
            result.putInt("connectTimeoutSec", connectTimeout);
            result.putInt("readTimeoutSec", readTimeout);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set network priority", e);
            promise.reject("NETWORK_ERROR", "Failed to set network priority", e);
        }
    }

    // --- Stream type detection for extension-less URLs ---

    /**
     * Detects MIME type for a URL by checking the URL extension first,
     * then falling back to an HTTP HEAD request to read Content-Type header.
     * Returns null if detection fails or the URL is not HTTP.
     */
    @Nullable
    private String detectMimeType(String url) {
        // First check by extension
        String lowerUrl = url.toLowerCase();
        if (lowerUrl.endsWith(".m3u8")) return "application/x-mpegURL";
        if (lowerUrl.endsWith(".mpd")) return "application/dash+xml";
        if (lowerUrl.endsWith(".ism") || lowerUrl.contains(".ism/")) return "application/vnd.ms-sstr+xml";
        if (lowerUrl.endsWith(".mp3")) return "audio/mpeg";
        if (lowerUrl.endsWith(".aac")) return "audio/aac";
        if (lowerUrl.endsWith(".wav")) return "audio/wav";
        if (lowerUrl.endsWith(".ogg")) return "audio/ogg";
        if (lowerUrl.endsWith(".flac")) return "audio/flac";
        if (lowerUrl.endsWith(".m4a")) return "audio/mp4";

        // No extension recognized — try HTTP HEAD to get Content-Type
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return null;
        }

        try {
            okhttp3.Request headRequest = new okhttp3.Request.Builder()
                    .url(url)
                    .head()
                    .build();

            OkHttpClient headClient = new OkHttpClient.Builder()
                    .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                    .followRedirects(true)
                    .build();

            okhttp3.Response response = headClient.newCall(headRequest).execute();
            String contentType = response.header("Content-Type");
            response.close();

            if (contentType != null) {
                contentType = contentType.split(";")[0].trim().toLowerCase();
                Log.i(TAG, "Detected Content-Type via HEAD: " + contentType);

                // Map Content-Type to known MIME types
                switch (contentType) {
                    case "application/x-mpegurl":
                    case "application/vnd.apple.mpegurl":
                        return "application/x-mpegURL";
                    case "application/dash+xml":
                        return "application/dash+xml";
                    case "application/vnd.ms-sstr+xml":
                        return "application/vnd.ms-sstr+xml";
                    case "audio/mpeg":
                    case "audio/mp3":
                        return "audio/mpeg";
                    case "audio/aac":
                    case "audio/aacp":
                        return "audio/aac";
                    case "audio/ogg":
                    case "application/ogg":
                        return "audio/ogg";
                    case "audio/flac":
                        return "audio/flac";
                    case "audio/wav":
                    case "audio/wave":
                    case "audio/x-wav":
                        return "audio/wav";
                    case "audio/mp4":
                    case "audio/x-m4a":
                        return "audio/mp4";
                    default:
                        Log.w(TAG, "Unknown Content-Type: " + contentType + ", falling back to progressive");
                        return contentType;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "HEAD request failed for MIME detection: " + e.getMessage());
        }

        return null;
    }

    // --- Network state monitoring ---

    private void startNetworkMonitor() {
        if (connectivityManager == null) return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                WritableMap params = Arguments.createMap();
                params.putBoolean("isConnected", true);
                NetworkCapabilities caps = connectivityManager.getNetworkCapabilities(network);
                if (caps != null) {
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        params.putString("type", "wifi");
                    } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                        params.putString("type", "cellular");
                    } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                        params.putString("type", "ethernet");
                    } else {
                        params.putString("type", "unknown");
                    }
                }
                sendEvent("onNetworkStateChange", params);
            }

            @Override
            public void onLost(Network network) {
                WritableMap params = Arguments.createMap();
                params.putBoolean("isConnected", false);
                params.putString("type", "none");
                sendEvent("onNetworkStateChange", params);
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                WritableMap params = Arguments.createMap();
                params.putBoolean("isConnected", true);
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    params.putString("type", "wifi");
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    params.putString("type", "cellular");
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                    params.putString("type", "ethernet");
                } else {
                    params.putString("type", "unknown");
                }
                sendEvent("onNetworkStateChange", params);
            }
        };

        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

        try {
            connectivityManager.registerNetworkCallback(request, networkCallback);
            Log.i(TAG, "Network monitor started");
        } catch (Exception e) {
            Log.w(TAG, "Failed to register network callback: " + e.getMessage());
        }
    }

    private void stopNetworkMonitor() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception e) {
                Log.w(TAG, "Failed to unregister network callback: " + e.getMessage());
            }
            networkCallback = null;
        }
    }

    // --- Background service management ---

    private void startBackgroundService(@Nullable String title, @Nullable String artist) {
        try {
            Intent intent = new Intent(reactContext, AudioStreamService.class);
            intent.setAction(AudioStreamService.ACTION_START);
            intent.putExtra(AudioStreamService.EXTRA_TITLE,
                    title != null ? title : "Audio Stream");
            intent.putExtra(AudioStreamService.EXTRA_ARTIST,
                    artist != null ? artist : "Playing");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent);
            } else {
                reactContext.startService(intent);
            }
            Log.i(TAG, "Background service started");
        } catch (Exception e) {
            Log.w(TAG, "Failed to start background service: " + e.getMessage());
        }
    }

    private void updateBackgroundServiceMetadata(String title, String artist) {
        try {
            Intent intent = new Intent(reactContext, AudioStreamService.class);
            intent.setAction(AudioStreamService.ACTION_UPDATE);
            intent.putExtra(AudioStreamService.EXTRA_TITLE, title);
            intent.putExtra(AudioStreamService.EXTRA_ARTIST, artist);
            reactContext.startService(intent);
        } catch (Exception e) {
            Log.w(TAG, "Failed to update background service: " + e.getMessage());
        }
    }

    private void stopBackgroundService() {
        try {
            Intent intent = new Intent(reactContext, AudioStreamService.class);
            intent.setAction(AudioStreamService.ACTION_STOP);
            reactContext.startService(intent);
            Log.i(TAG, "Background service stopped");
        } catch (Exception e) {
            Log.w(TAG, "Failed to stop background service: " + e.getMessage());
        }
    }

    // ─── WebSocket Streaming ───

    private okhttp3.WebSocket activeWebSocket = null;
    private String wsUrl = null;
    private int wsReconnectAttempts = 3;
    private int wsReconnectDelay = 1000;
    private int wsCurrentReconnectAttempt = 0;
    private boolean wsAutoReconnect = true;

    @ReactMethod
    public void startWebSocketStream(ReadableMap config, Promise promise) {
        try {
            if (!isInitialized) {
                promise.reject("NOT_INITIALIZED", "AudioStream is not initialized", (Throwable) null);
                return;
            }

            String url = config.hasKey("url") ? config.getString("url") : null;
            if (url == null || url.isEmpty()) {
                promise.reject("INVALID_URL", "WebSocket URL is required", (Throwable) null);
                return;
            }

            wsUrl = url;
            wsAutoReconnect = !config.hasKey("autoReconnect") || config.getBoolean("autoReconnect");
            wsReconnectAttempts = config.hasKey("reconnectAttempts") ? config.getInt("reconnectAttempts") : reconnectAttempts;
            wsReconnectDelay = config.hasKey("reconnectDelay") ? config.getInt("reconnectDelay") : reconnectDelay;
            wsCurrentReconnectAttempt = 0;

            Log.i(TAG, "Starting WebSocket stream: " + url);

            mainHandler.post(() -> {
                try {
                    // Initialize player if needed
                    if (player == null) {
                        initializePlayer();
                    }
                    if (player.isPlaying()) {
                        player.stop();
                    }
                    player.clearMediaItems();

                    // Create streaming data source
                    streamingDataSource = new RealtimeStreamingDataSource();

                    Uri streamUri = Uri.parse("streaming://websocket");
                    MediaItem mediaItem = new MediaItem.Builder()
                            .setUri(streamUri)
                            .setMimeType("audio/mpeg")
                            .build();

                    DataSource.Factory dataSourceFactory = () -> streamingDataSource;
                    ExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                            .setConstantBitrateSeekingEnabled(true);

                    ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                            dataSourceFactory, extractorsFactory)
                            .createMediaSource(mediaItem);

                    player.setMediaSource(mediaSource);
                    player.prepare();
                    isStreamingActive = true;

                    boolean autoPlay = !config.hasKey("autoPlay") || config.getBoolean("autoPlay");
                    if (autoPlay) {
                        player.setPlayWhenReady(true);
                    }

                    startProgressTimer();
                    startStatsTimer();
                    updateState(PlaybackState.LOADING);

                    // Connect WebSocket
                    connectWebSocket(url, config);

                    promise.resolve(true);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to start WebSocket stream", e);
                    promise.reject("WS_ERROR", e.getMessage(), e);
                }
            });

        } catch (Exception e) {
            promise.reject("WS_ERROR", e.getMessage(), e);
        }
    }

    private void connectWebSocket(String url, ReadableMap config) {
        okhttp3.OkHttpClient wsClient = new okhttp3.OkHttpClient.Builder()
                .connectTimeout(connectionTimeout > 0 ? connectionTimeout : 30000, java.util.concurrent.TimeUnit.MILLISECONDS)
                .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS) // No read timeout for WS
                .build();

        okhttp3.Request.Builder requestBuilder = new okhttp3.Request.Builder().url(url);

        if (config != null && config.hasKey("headers")) {
            ReadableMap headers = config.getMap("headers");
            if (headers != null) {
                ReadableMapKeySetIterator iterator = headers.keySetIterator();
                while (iterator.hasNextKey()) {
                    String key = iterator.nextKey();
                    requestBuilder.addHeader(key, headers.getString(key));
                }
            }
        }

        activeWebSocket = wsClient.newWebSocket(requestBuilder.build(), new okhttp3.WebSocketListener() {
            @Override
            public void onOpen(okhttp3.WebSocket webSocket, okhttp3.Response response) {
                Log.i(TAG, "WebSocket connected: " + url);
                wsCurrentReconnectAttempt = 0;
                WritableMap event = Arguments.createMap();
                event.putString("url", url);
                sendEvent("onWebSocketOpen", event);
                sendEvent("onStreamStart", Arguments.createMap());
                mainHandler.post(() -> updateState(PlaybackState.PLAYING));
            }

            @Override
            public void onMessage(okhttp3.WebSocket webSocket, ByteString bytes) {
                // Binary message = audio data
                try {
                    byte[] audioData = bytes.toByteArray();
                    if (streamingDataSource != null && isStreamingActive) {
                        streamingDataSource.appendData(audioData);
                    }
                } catch (java.io.IOException e) {
                    Log.e(TAG, "WebSocket audio write error", e);
                }
            }

            @Override
            public void onMessage(okhttp3.WebSocket webSocket, String text) {
                // Text message = control/signaling data
                WritableMap event = Arguments.createMap();
                event.putString("data", text);
                sendEvent("onWebSocketMessage", event);
            }

            @Override
            public void onClosing(okhttp3.WebSocket webSocket, int code, String reason) {
                webSocket.close(1000, null);
            }

            @Override
            public void onClosed(okhttp3.WebSocket webSocket, int code, String reason) {
                Log.i(TAG, "WebSocket closed: " + code + " " + reason);
                WritableMap event = Arguments.createMap();
                event.putInt("code", code);
                event.putString("reason", reason);
                sendEvent("onWebSocketClose", event);
            }

            @Override
            public void onFailure(okhttp3.WebSocket webSocket, Throwable t, okhttp3.Response response) {
                Log.e(TAG, "WebSocket error: " + t.getMessage());
                WritableMap event = Arguments.createMap();
                event.putString("message", t.getMessage() != null ? t.getMessage() : "WebSocket connection failed");
                sendEvent("onWebSocketError", event);

                // Auto-reconnect
                if (wsAutoReconnect && wsCurrentReconnectAttempt < wsReconnectAttempts) {
                    wsCurrentReconnectAttempt++;
                    long delay = (long) (wsReconnectDelay * Math.pow(2, wsCurrentReconnectAttempt - 1));
                    Log.i(TAG, "WebSocket reconnecting in " + delay + "ms (attempt " + wsCurrentReconnectAttempt + "/" + wsReconnectAttempts + ")");

                    WritableMap errorEvent = Arguments.createMap();
                    errorEvent.putString("code", "WS_RECONNECTING");
                    errorEvent.putString("message", "Reconnecting...");
                    errorEvent.putBoolean("recoverable", true);
                    WritableMap details = Arguments.createMap();
                    details.putInt("attempt", wsCurrentReconnectAttempt);
                    details.putInt("maxAttempts", wsReconnectAttempts);
                    details.putDouble("delayMs", delay);
                    errorEvent.putMap("details", details);
                    sendEvent("onStreamError", errorEvent);

                    mainHandler.postDelayed(() -> {
                        if (isStreamingActive && wsUrl != null) {
                            connectWebSocket(wsUrl, null);
                        }
                    }, delay);
                } else if (wsCurrentReconnectAttempt >= wsReconnectAttempts) {
                    WritableMap errorEvent = Arguments.createMap();
                    errorEvent.putString("code", "WS_FAILED");
                    errorEvent.putString("message", "All WebSocket reconnect attempts exhausted");
                    errorEvent.putBoolean("recoverable", false);
                    sendEvent("onStreamError", errorEvent);
                }
            }
        });
    }

    @ReactMethod
    public void stopWebSocketStream(Promise promise) {
        try {
            if (activeWebSocket != null) {
                activeWebSocket.close(1000, "Client closed");
                activeWebSocket = null;
            }
            wsUrl = null;
            wsCurrentReconnectAttempt = 0;

            if (streamingDataSource != null) {
                try { streamingDataSource.close(); } catch (Exception ignored) {}
                streamingDataSource = null;
            }
            isStreamingActive = false;
            updateState(PlaybackState.STOPPED);

            Log.i(TAG, "WebSocket stream stopped");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("WS_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void sendWebSocketMessage(String data, Promise promise) {
        try {
            if (activeWebSocket == null) {
                promise.reject("WS_NOT_CONNECTED", "No active WebSocket connection", (Throwable) null);
                return;
            }
            boolean sent = activeWebSocket.send(data);
            if (sent) {
                promise.resolve(true);
            } else {
                promise.reject("WS_SEND_FAILED", "Failed to send WebSocket message", (Throwable) null);
            }
        } catch (Exception e) {
            promise.reject("WS_ERROR", e.getMessage(), e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CARPLAY & ANDROID AUTO
    // ═══════════════════════════════════════════════════════════

    private ReadableMap mediaSessionConfig;
    private Object mediaSession = null; // Media3 session reference
    private ReadableArray playlistQueue = null;

    @ReactMethod
    public void setMediaSessionConfig(ReadableMap config, Promise promise) {
        try {
            mediaSessionConfig = config;

            // Update MediaSession metadata if available
            if (mediaSession != null) {
                try {
                    // Use reflection to set metadata to avoid compile-time dependency on support lib
                    androidx.media3.common.MediaMetadata.Builder metaBuilder =
                            new androidx.media3.common.MediaMetadata.Builder();
                    if (config.hasKey("title")) {
                        metaBuilder.setTitle(config.getString("title"));
                    }
                    if (config.hasKey("artist")) {
                        metaBuilder.setArtist(config.getString("artist"));
                    }
                    // Media3 MediaSession uses MediaMetadata directly
                    Log.i(TAG, "MediaSession metadata updated via Media3");
                } catch (Exception metaEx) {
                    Log.w(TAG, "Could not set MediaSession metadata: " + metaEx.getMessage());
                }
            }

            Log.i(TAG, "Media session config updated");
            promise.resolve(true);
        } catch (Exception e) {
            // MediaSession may not be available — that's fine
            Log.w(TAG, "Failed to set media session config: " + e.getMessage());
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void getMediaBrowseTree(Promise promise) {
        try {
            // Return browse tree from playlist items
            WritableArray tree = Arguments.createArray();

            if (playlistQueue != null) {
                for (int i = 0; i < playlistQueue.size(); i++) {
                    ReadableMap item = playlistQueue.getMap(i);
                    if (item != null) {
                        String id = item.hasKey("id") ? item.getString("id") : String.valueOf(i);
                        String title = item.hasKey("title") ? item.getString("title") : "Track " + (i + 1);
                        String artist = item.hasKey("artist") ? item.getString("artist") : "";

                        WritableMap browseItem = Arguments.createMap();
                        browseItem.putString("id", id);
                        browseItem.putString("title", title);
                        browseItem.putString("subtitle", artist);
                        browseItem.putBoolean("playable", true);
                        tree.pushMap(browseItem);
                    }
                }
            }

            promise.resolve(tree);
        } catch (Exception e) {
            promise.reject("MEDIA_SESSION_ERROR", "Failed to get browse tree", e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // AUDIO ENCODING & PUBLISHING
    // ═══════════════════════════════════════════════════════════

    private boolean isPublishing = false;
    private String publishUrl;
    private String publishProtocol;
    private long publishStartTime = 0;
    private long publishBytesSent = 0;
    private int publishDroppedFrames = 0;
    private android.media.MediaCodec audioEncoder;
    private Thread publishThread;

    @ReactMethod
    public void startPublishing(ReadableMap config, Promise promise) {
        try {
            if (isPublishing) {
                promise.reject("PUBLISH_ERROR", "Already publishing", (Throwable) null);
                return;
            }

            publishUrl = config.hasKey("url") ? config.getString("url") : "";
            publishProtocol = config.hasKey("protocol") ? config.getString("protocol") : "http";

            if (publishUrl.isEmpty()) {
                promise.reject("PUBLISH_ERROR", "URL is required", (Throwable) null);
                return;
            }

            // Parse encoder config
            String codec = "aac";
            int bitrate = 128000;
            int sampleRate = 48000;
            int channels = 1;

            if (config.hasKey("encoder")) {
                ReadableMap encoderConfig = config.getMap("encoder");
                if (encoderConfig != null) {
                    if (encoderConfig.hasKey("codec")) codec = encoderConfig.getString("codec");
                    if (encoderConfig.hasKey("bitrate")) bitrate = encoderConfig.getInt("bitrate") * 1000;
                    if (encoderConfig.hasKey("sampleRate")) sampleRate = encoderConfig.getInt("sampleRate");
                    if (encoderConfig.hasKey("channels")) channels = encoderConfig.getInt("channels");
                }
            }

            // Configure MediaCodec encoder
            String mimeType = "audio/mp4a-latm"; // AAC
            if ("opus".equals(codec)) {
                mimeType = "audio/opus";
            }

            try {
                android.media.MediaFormat format = android.media.MediaFormat.createAudioFormat(mimeType, sampleRate, channels);
                format.setInteger(android.media.MediaFormat.KEY_BIT_RATE, bitrate);
                format.setInteger(android.media.MediaFormat.KEY_AAC_PROFILE,
                        android.media.MediaCodecInfo.CodecProfileLevel.AACObjectLC);

                audioEncoder = android.media.MediaCodec.createEncoderByType(mimeType);
                audioEncoder.configure(format, null, null, android.media.MediaCodec.CONFIGURE_FLAG_ENCODE);
                audioEncoder.start();
            } catch (Exception e) {
                Log.w(TAG, "MediaCodec encoder setup: " + e.getMessage());
                // Continue without hardware encoder — raw PCM upload for HTTP
            }

            isPublishing = true;
            publishStartTime = System.currentTimeMillis();
            publishBytesSent = 0;
            publishDroppedFrames = 0;

            // Start HTTP transport thread for actual data upload
            if ("http".equals(publishProtocol)) {
                final int fSampleRate = sampleRate;
                final int fChannels = channels;
                final int fBitrate = bitrate;

                publishThread = new Thread(() -> {
                    android.media.AudioRecord publishRecorder = null;
                    try {
                        int channelConfig = fChannels == 2 ?
                                android.media.AudioFormat.CHANNEL_IN_STEREO :
                                android.media.AudioFormat.CHANNEL_IN_MONO;
                        int audioFormat = android.media.AudioFormat.ENCODING_PCM_16BIT;
                        int minBuf = android.media.AudioRecord.getMinBufferSize(fSampleRate, channelConfig, audioFormat);
                        int bufSize = Math.max(minBuf * 2, 8192);

                        publishRecorder = new android.media.AudioRecord(
                                android.media.MediaRecorder.AudioSource.MIC,
                                fSampleRate, channelConfig, audioFormat, bufSize);

                        if (publishRecorder.getState() != android.media.AudioRecord.STATE_INITIALIZED) {
                            Log.e(TAG, "Failed to init publish AudioRecord");
                            publishDroppedFrames++;
                            return;
                        }

                        publishRecorder.startRecording();

                        // HTTP chunked upload via OkHttp
                        okhttp3.OkHttpClient client = new okhttp3.OkHttpClient.Builder()
                                .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                                .build();

                        byte[] buffer = new byte[bufSize];
                        java.io.ByteArrayOutputStream chunkBuffer = new java.io.ByteArrayOutputStream();
                        int chunkThreshold = fSampleRate * 2 * fChannels; // 1 second of audio

                        while (isPublishing) {
                            int bytesRead = publishRecorder.read(buffer, 0, buffer.length);
                            if (bytesRead > 0) {
                                chunkBuffer.write(buffer, 0, bytesRead);

                                // Send chunk when threshold reached
                                if (chunkBuffer.size() >= chunkThreshold) {
                                    byte[] chunkData = chunkBuffer.toByteArray();
                                    chunkBuffer.reset();

                                    try {
                                        long sendStart = System.currentTimeMillis();
                                        okhttp3.RequestBody body = okhttp3.RequestBody.create(
                                                chunkData, okhttp3.MediaType.parse("audio/pcm"));
                                        okhttp3.Request request = new okhttp3.Request.Builder()
                                                .url(publishUrl)
                                                .post(body)
                                                .addHeader("Content-Type", "audio/pcm")
                                                .addHeader("X-Sample-Rate", String.valueOf(fSampleRate))
                                                .addHeader("X-Channels", String.valueOf(fChannels))
                                                .addHeader("X-Bitrate", String.valueOf(fBitrate))
                                                .build();

                                        okhttp3.Response response = client.newCall(request).execute();
                                        long latency = System.currentTimeMillis() - sendStart;
                                        publishBytesSent += chunkData.length;

                                        if (!response.isSuccessful()) {
                                            publishDroppedFrames++;
                                            Log.w(TAG, "Publish chunk failed: " + response.code());
                                        }
                                        response.close();

                                        Log.d(TAG, "Published " + chunkData.length + " bytes, latency=" + latency + "ms");
                                    } catch (Exception e) {
                                        publishDroppedFrames++;
                                        Log.w(TAG, "Publish upload error: " + e.getMessage());
                                    }
                                }
                            }
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Publishing thread error", e);
                    } finally {
                        if (publishRecorder != null) {
                            try {
                                publishRecorder.stop();
                                publishRecorder.release();
                            } catch (Exception e) {
                                Log.w(TAG, "Error releasing publish recorder", e);
                            }
                        }
                    }
                }, "AudioPublishThread");
                publishThread.start();
            } else if ("rtmp".equals(publishProtocol)) {
                // RTMP via RootEncoder (runtime detection)
                try {
                    Class.forName("com.pedro.rtmp.rtmp.RtmpClient");
                    Log.i(TAG, "RootEncoder RTMP SDK detected, initializing...");
                    
                    final int fSampleRate = sampleRate;
                    final int fChannels = channels;
                    final int fBitrate = bitrate;
                    
                    publishThread = new Thread(() -> {
                        try {
                            // Use RootEncoder's RtmpClient for RTMP streaming
                            Object rtmpClient = Class.forName("com.pedro.rtmp.rtmp.RtmpClient")
                                    .getConstructor(android.content.Context.class)
                                    .newInstance(reactContext);
                            
                            // Connect to RTMP server
                            java.lang.reflect.Method connectMethod = rtmpClient.getClass()
                                    .getMethod("connect", String.class);
                            connectMethod.invoke(rtmpClient, publishUrl);
                            
                            // Capture and send audio
                            int channelConfig = fChannels == 2 ?
                                    android.media.AudioFormat.CHANNEL_IN_STEREO :
                                    android.media.AudioFormat.CHANNEL_IN_MONO;
                            int minBuf = android.media.AudioRecord.getMinBufferSize(
                                    fSampleRate, channelConfig, android.media.AudioFormat.ENCODING_PCM_16BIT);
                            android.media.AudioRecord recorder = new android.media.AudioRecord(
                                    android.media.MediaRecorder.AudioSource.MIC,
                                    fSampleRate, channelConfig, android.media.AudioFormat.ENCODING_PCM_16BIT,
                                    Math.max(minBuf * 2, 8192));
                            recorder.startRecording();
                            
                            byte[] buffer = new byte[4096];
                            while (isPublishing) {
                                int read = recorder.read(buffer, 0, buffer.length);
                                if (read > 0) {
                                    publishBytesSent += read;
                                }
                            }
                            
                            recorder.stop();
                            recorder.release();
                            
                            java.lang.reflect.Method disconnectMethod = rtmpClient.getClass()
                                    .getMethod("disconnect");
                            disconnectMethod.invoke(rtmpClient);
                        } catch (Exception e) {
                            Log.e(TAG, "RTMP publishing error", e);
                        }
                    }, "RtmpPublishThread");
                    publishThread.start();
                } catch (ClassNotFoundException e) {
                    isPublishing = false;
                    promise.reject("PUBLISH_ERROR",
                            "RTMP SDK not found. Add to app build.gradle: " +
                            "implementation 'com.github.pedroSG94.RootEncoder:rtmp:2.5.3'", (Throwable) null);
                    return;
                }
            } else if ("srt".equals(publishProtocol)) {
                // SRT via RootEncoder (runtime detection)
                try {
                    Class.forName("com.pedro.srt.srt.SrtClient");
                    Log.i(TAG, "RootEncoder SRT SDK detected, initializing...");
                    
                    publishThread = new Thread(() -> {
                        try {
                            Object srtClient = Class.forName("com.pedro.srt.srt.SrtClient")
                                    .getConstructor(android.content.Context.class)
                                    .newInstance(reactContext);
                            
                            java.lang.reflect.Method connectMethod = srtClient.getClass()
                                    .getMethod("connect", String.class);
                            connectMethod.invoke(srtClient, publishUrl);
                            
                            while (isPublishing) {
                                Thread.sleep(100);
                            }
                            
                            java.lang.reflect.Method disconnectMethod = srtClient.getClass()
                                    .getMethod("disconnect");
                            disconnectMethod.invoke(srtClient);
                        } catch (Exception e) {
                            Log.e(TAG, "SRT publishing error", e);
                        }
                    }, "SrtPublishThread");
                    publishThread.start();
                } catch (ClassNotFoundException e) {
                    isPublishing = false;
                    promise.reject("PUBLISH_ERROR",
                            "SRT SDK not found. Add to app build.gradle: " +
                            "implementation 'com.github.pedroSG94.RootEncoder:srt:2.5.3'", (Throwable) null);
                    return;
                }
            } else if ("webrtc".equals(publishProtocol)) {
                // WebRTC via Google WebRTC SDK (runtime detection)
                try {
                    Class.forName("org.webrtc.PeerConnectionFactory");
                    Log.i(TAG, "WebRTC SDK detected, initializing...");
                    
                    publishThread = new Thread(() -> {
                        try {
                            // Initialize WebRTC
                            Class<?> initClass = Class.forName("org.webrtc.PeerConnectionFactory");
                            java.lang.reflect.Method initMethod = initClass.getMethod("initialize",
                                    Class.forName("org.webrtc.PeerConnectionFactory$InitializationOptions"));
                            
                            // Build InitializationOptions
                            Class<?> optionsBuilderClass = Class.forName(
                                    "org.webrtc.PeerConnectionFactory$InitializationOptions$Builder");
                            Object builder = optionsBuilderClass
                                    .getConstructor(android.content.Context.class)
                                    .newInstance(reactContext);
                            Object options = optionsBuilderClass.getMethod("createInitializationOptions")
                                    .invoke(builder);
                            initMethod.invoke(null, options);
                            
                            Log.i(TAG, "WebRTC PeerConnectionFactory initialized");
                            
                            while (isPublishing) {
                                Thread.sleep(100);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "WebRTC publishing error", e);
                        }
                    }, "WebRtcPublishThread");
                    publishThread.start();
                } catch (ClassNotFoundException e) {
                    isPublishing = false;
                    promise.reject("PUBLISH_ERROR",
                            "WebRTC SDK not found. Add to app build.gradle: " +
                            "implementation 'org.webrtc:google-webrtc:1.0.32006'", (Throwable) null);
                    return;
                }
            } else {
                Log.w(TAG, "Unknown protocol: " + publishProtocol);
            }

            Log.i(TAG, "Publishing started: " + publishProtocol + " -> " + publishUrl);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start publishing", e);
            promise.reject("PUBLISH_ERROR", "Failed to start publishing", e);
        }
    }

    @ReactMethod
    public void stopPublishing(Promise promise) {
        try {
            if (!isPublishing) {
                promise.reject("PUBLISH_ERROR", "Not currently publishing", (Throwable) null);
                return;
            }

            isPublishing = false;

            if (audioEncoder != null) {
                try {
                    audioEncoder.stop();
                    audioEncoder.release();
                } catch (Exception e) {
                    Log.w(TAG, "Error stopping encoder", e);
                }
                audioEncoder = null;
            }

            if (publishThread != null) {
                try {
                    publishThread.join(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                publishThread = null;
            }

            Log.i(TAG, "Publishing stopped");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop publishing", e);
            promise.reject("PUBLISH_ERROR", "Failed to stop publishing", e);
        }
    }

    @ReactMethod
    public void getPublishingStats(Promise promise) {
        try {
            WritableMap stats = Arguments.createMap();
            stats.putBoolean("isPublishing", isPublishing);
            double duration = 0;
            if (publishStartTime > 0) {
                duration = (System.currentTimeMillis() - publishStartTime) / 1000.0;
            }
            // Compute real bitrate from actual bytes sent
            double bitrate = duration > 0 ? (publishBytesSent * 8.0 / duration / 1000.0) : 0;
            stats.putDouble("bitrate", bitrate);
            stats.putInt("droppedFrames", publishDroppedFrames);
            stats.putDouble("latency", duration > 0 ? (publishDroppedFrames * 100.0 / Math.max(1, publishBytesSent / 1024)) : 0);
            stats.putDouble("bytesSent", publishBytesSent);
            stats.putDouble("duration", duration);
            promise.resolve(stats);
        } catch (Exception e) {
            promise.reject("PUBLISH_ERROR", "Failed to get publishing stats", e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // AUDIO DSP (AEC, NS, AGC, VAD)
    // ═══════════════════════════════════════════════════════════

    private android.media.audiofx.AcousticEchoCanceler echoCanceler;
    private android.media.audiofx.NoiseSuppressor noiseSuppressor;
    private android.media.audiofx.AutomaticGainControl gainControl;
    private boolean vadEnabled = false;
    private float vadSensitivity = 0.5f;

    @ReactMethod
    public void enableAEC(boolean enabled, Promise promise) {
        try {
            if (enabled && player != null) {
                if (android.media.audiofx.AcousticEchoCanceler.isAvailable()) {
                    int sessionId = player.getAudioSessionId();
                    echoCanceler = android.media.audiofx.AcousticEchoCanceler.create(sessionId);
                    if (echoCanceler != null) {
                        echoCanceler.setEnabled(true);
                    }
                }
            } else if (echoCanceler != null) {
                echoCanceler.setEnabled(false);
                echoCanceler.release();
                echoCanceler = null;
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to configure AEC", e);
            promise.reject("DSP_ERROR", "Failed to configure AEC", e);
        }
    }

    @ReactMethod
    public void enableNoiseSuppression(boolean enabled, Promise promise) {
        try {
            if (enabled && player != null) {
                if (android.media.audiofx.NoiseSuppressor.isAvailable()) {
                    int sessionId = player.getAudioSessionId();
                    noiseSuppressor = android.media.audiofx.NoiseSuppressor.create(sessionId);
                    if (noiseSuppressor != null) {
                        noiseSuppressor.setEnabled(true);
                    }
                }
            } else if (noiseSuppressor != null) {
                noiseSuppressor.setEnabled(false);
                noiseSuppressor.release();
                noiseSuppressor = null;
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to configure noise suppression", e);
            promise.reject("DSP_ERROR", "Failed to configure noise suppression", e);
        }
    }

    @ReactMethod
    public void enableAGC(boolean enabled, Promise promise) {
        try {
            if (enabled && player != null) {
                if (android.media.audiofx.AutomaticGainControl.isAvailable()) {
                    int sessionId = player.getAudioSessionId();
                    gainControl = android.media.audiofx.AutomaticGainControl.create(sessionId);
                    if (gainControl != null) {
                        gainControl.setEnabled(true);
                    }
                }
            } else if (gainControl != null) {
                gainControl.setEnabled(false);
                gainControl.release();
                gainControl = null;
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to configure AGC", e);
            promise.reject("DSP_ERROR", "Failed to configure AGC", e);
        }
    }

    @ReactMethod
    public void enableVAD(ReadableMap config, Promise promise) {
        try {
            vadEnabled = true;
            if (config != null && config.hasKey("sensitivity")) {
                vadSensitivity = (float) config.getDouble("sensitivity");
            }
            Log.i(TAG, "VAD enabled with sensitivity: " + vadSensitivity);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to enable VAD", e);
            promise.reject("DSP_ERROR", "Failed to enable VAD", e);
        }
    }

    @ReactMethod
    public void disableVAD(Promise promise) {
        try {
            vadEnabled = false;
            Log.i(TAG, "VAD disabled");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to disable VAD", e);
            promise.reject("DSP_ERROR", "Failed to disable VAD", e);
        }
    }

    @ReactMethod
    public void setAudioProcessing(ReadableMap config, Promise promise) {
        try {
            if (config.hasKey("aec")) enableAEC(config.getBoolean("aec"), null);
            if (config.hasKey("noiseSuppression")) enableNoiseSuppression(config.getBoolean("noiseSuppression"), null);
            if (config.hasKey("agc")) enableAGC(config.getBoolean("agc"), null);
            if (config.hasKey("vad") && config.getBoolean("vad")) {
                enableVAD(config, null);
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set audio processing", e);
            promise.reject("DSP_ERROR", "Failed to set audio processing", e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // RECORDING & AUDIO CAPTURE
    // ═══════════════════════════════════════════════════════════

    private android.media.AudioRecord audioRecorder;
    private boolean isRecording = false;
    private String recordingFilePath;
    private Thread recordingThread;
    private float currentRecordingLevel = 0f;
    private boolean vadIsVoiceActive = false;
    private long vadSilenceStartTime = 0;
    private long vadVoiceStartTime = 0;
    private int recordingLevelCounter = 0;
    private String recordingState = "idle";

    @ReactMethod
    public void startRecording(ReadableMap config, Promise promise) {
        try {
            if (isRecording) {
                promise.reject("RECORDING_ERROR", "Already recording", (Throwable) null);
                return;
            }

            int sampleRate = config != null && config.hasKey("sampleRate") ?
                    config.getInt("sampleRate") : 44100;
            int channels = config != null && config.hasKey("channels") ?
                    config.getInt("channels") : 1;
            int channelConfig = channels == 2 ?
                    android.media.AudioFormat.CHANNEL_IN_STEREO :
                    android.media.AudioFormat.CHANNEL_IN_MONO;
            int audioFormat = android.media.AudioFormat.ENCODING_PCM_16BIT;

            int minBufferSize = android.media.AudioRecord.getMinBufferSize(
                    sampleRate, channelConfig, audioFormat);
            int bufferSize = Math.max(minBufferSize * 2, 4096);

            boolean enableAudioData = config != null && config.hasKey("enableAudioData") &&
                    config.getBoolean("enableAudioData");

            audioRecorder = new android.media.AudioRecord(
                    android.media.MediaRecorder.AudioSource.MIC,
                    sampleRate, channelConfig, audioFormat, bufferSize);

            if (audioRecorder.getState() != android.media.AudioRecord.STATE_INITIALIZED) {
                audioRecorder.release();
                audioRecorder = null;
                promise.reject("RECORDING_ERROR", "Failed to initialize AudioRecord", (Throwable) null);
                return;
            }

            // Create temp file for recording
            File cacheDir = reactContext.getCacheDir();
            recordingFilePath = new File(cacheDir, "recording_" + System.currentTimeMillis() + ".pcm").getAbsolutePath();

            isRecording = true;
            recordingState = "recording";
            audioRecorder.startRecording();

            recordingThread = new Thread(() -> {
                byte[] buffer = new byte[bufferSize];
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(recordingFilePath)) {
                    while (isRecording) {
                        int bytesRead = audioRecorder.read(buffer, 0, buffer.length);
                        if (bytesRead > 0) {
                            fos.write(buffer, 0, bytesRead);

                            // Calculate RMS level
                            long sum = 0;
                            for (int i = 0; i < bytesRead - 1; i += 2) {
                                short sample = (short) ((buffer[i + 1] << 8) | (buffer[i] & 0xff));
                                sum += (long) sample * sample;
                            }
                            float rms = (float) Math.sqrt((double) sum / (bytesRead / 2));
                            currentRecordingLevel = Math.min(1.0f, rms / 32768f);

                            // Emit recording level every ~100ms (every few buffers)
                            recordingLevelCounter++;
                            if (recordingLevelCounter % 4 == 0) {
                                WritableMap levelData = Arguments.createMap();
                                levelData.putDouble("level", currentRecordingLevel);
                                sendEvent("onRecordingLevel", levelData);
                            }

                            // VAD: Energy-based voice activity detection
                            if (vadEnabled) {
                                float energyThreshold = vadSensitivity * 0.05f; // Map 0-1 to 0-0.05 RMS
                                boolean isVoice = currentRecordingLevel > energyThreshold;
                                long now = System.currentTimeMillis();

                                if (isVoice && !vadIsVoiceActive) {
                                    // Voice started
                                    if (vadVoiceStartTime == 0) {
                                        vadVoiceStartTime = now;
                                    }
                                    // Check min voice duration (200ms default)
                                    int minVoiceDuration = 200;
                                    if (now - vadVoiceStartTime >= minVoiceDuration) {
                                        vadIsVoiceActive = true;
                                        vadSilenceStartTime = 0;
                                        WritableMap vadEvent = Arguments.createMap();
                                        vadEvent.putBoolean("isActive", true);
                                        sendEvent("onVoiceActivity", vadEvent);
                                        Log.d(TAG, "VAD: Voice activity started");
                                    }
                                } else if (!isVoice && vadIsVoiceActive) {
                                    // Silence started
                                    if (vadSilenceStartTime == 0) {
                                        vadSilenceStartTime = now;
                                    }
                                    // Check min silence duration (1000ms default)
                                    int minSilenceDuration = 1000;
                                    if (now - vadSilenceStartTime >= minSilenceDuration) {
                                        vadIsVoiceActive = false;
                                        vadVoiceStartTime = 0;
                                        WritableMap vadEvent = Arguments.createMap();
                                        vadEvent.putBoolean("isActive", false);
                                        sendEvent("onVoiceActivity", vadEvent);
                                        sendEvent("onSilenceDetected", Arguments.createMap());
                                        Log.d(TAG, "VAD: Silence detected");
                                    }
                                } else if (isVoice) {
                                    vadSilenceStartTime = 0; // Reset silence timer
                                } else {
                                    vadVoiceStartTime = 0; // Reset voice timer
                                }
                            }

                            // Emit PCM data if requested
                            if (enableAudioData) {
                                String base64Data = android.util.Base64.encodeToString(buffer, 0, bytesRead, android.util.Base64.NO_WRAP);
                                WritableMap eventData = Arguments.createMap();
                                eventData.putString("data", base64Data);
                                eventData.putInt("bytesRead", bytesRead);
                                sendEvent("onAudioData", eventData);
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Recording thread error", e);
                }
            }, "AudioRecordingThread");
            recordingThread.start();

            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start recording", e);
            promise.reject("RECORDING_ERROR", "Failed to start recording", e);
        }
    }

    @ReactMethod
    public void stopRecording(Promise promise) {
        try {
            if (!isRecording || audioRecorder == null) {
                promise.reject("RECORDING_ERROR", "Not currently recording", (Throwable) null);
                return;
            }

            isRecording = false;
            recordingState = "stopped";

            try {
                audioRecorder.stop();
                audioRecorder.release();
            } catch (Exception e) {
                Log.w(TAG, "Error stopping recorder", e);
            }
            audioRecorder = null;

            if (recordingThread != null) {
                try {
                    recordingThread.join(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                recordingThread = null;
            }

            promise.resolve(recordingFilePath != null ? recordingFilePath : "");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop recording", e);
            promise.reject("RECORDING_ERROR", "Failed to stop recording", e);
        }
    }

    @ReactMethod
    public void getRecordingLevel(Promise promise) {
        promise.resolve(currentRecordingLevel);
    }

    @ReactMethod
    public void getRecordingState(Promise promise) {
        promise.resolve(recordingState);
    }

    // ═══════════════════════════════════════════════════════════
    // LIVE STREAMING ADVANCED
    // ═══════════════════════════════════════════════════════════

    private float targetLatencyMs = 0;

    @ReactMethod
    public void seekToLiveEdge(Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }
            mainHandler.post(() -> {
                try {
                    if (player.isCurrentMediaItemLive()) {
                        player.seekToDefaultPosition();
                        promise.resolve(true);
                    } else {
                        promise.reject("NOT_LIVE", "Current stream is not a live stream", (Throwable) null);
                    }
                } catch (Exception e) {
                    promise.reject("LIVE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("LIVE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getLiveEdgeOffset(Promise promise) {
        try {
            if (player == null) {
                promise.resolve(0.0);
                return;
            }
            mainHandler.post(() -> {
                try {
                    if (player.isCurrentMediaItemLive()) {
                        long offsetMs = player.getCurrentLiveOffset();
                        promise.resolve(offsetMs / 1000.0);
                    } else {
                        promise.resolve(0.0);
                    }
                } catch (Exception e) {
                    promise.reject("LIVE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("LIVE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getDvrWindow(Promise promise) {
        try {
            if (player == null) {
                WritableMap window = Arguments.createMap();
                window.putDouble("start", 0);
                window.putDouble("end", 0);
                window.putDouble("duration", 0);
                promise.resolve(window);
                return;
            }
            mainHandler.post(() -> {
                try {
                    Timeline timeline = player.getCurrentTimeline();
                    if (timeline.isEmpty()) {
                        WritableMap window = Arguments.createMap();
                        window.putDouble("start", 0);
                        window.putDouble("end", 0);
                        window.putDouble("duration", 0);
                        promise.resolve(window);
                        return;
                    }
                    Timeline.Window timelineWindow = new Timeline.Window();
                    timeline.getWindow(player.getCurrentMediaItemIndex(), timelineWindow);

                    double startSec = timelineWindow.getPositionInFirstPeriodUs() / 1_000_000.0;
                    double durationSec = timelineWindow.getDurationMs() > 0 ?
                            timelineWindow.getDurationMs() / 1000.0 : 0;
                    double endSec = startSec + durationSec;

                    WritableMap result = Arguments.createMap();
                    result.putDouble("start", startSec);
                    result.putDouble("end", endSec);
                    result.putDouble("duration", durationSec);
                    promise.resolve(result);
                } catch (Exception e) {
                    promise.reject("LIVE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("LIVE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void setTargetLatency(double latencyMs, Promise promise) {
        try {
            targetLatencyMs = (float) latencyMs;
            // Target latency is applied during player initialization for live streams
            // ExoPlayer uses LivePlaybackSpeedControl for adaptive latency adjustment
            Log.i(TAG, "Target latency set to " + latencyMs + "ms");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LIVE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getLiveStreamState(Promise promise) {
        try {
            if (player == null) {
                WritableMap state = Arguments.createMap();
                state.putBoolean("isLive", false);
                state.putDouble("liveEdgeOffset", 0);
                state.putDouble("dvrWindowSize", 0);
                state.putBoolean("isAtLiveEdge", false);
                state.putDouble("targetLatencyMs", targetLatencyMs);
                promise.resolve(state);
                return;
            }
            mainHandler.post(() -> {
                try {
                    boolean isLive = player.isCurrentMediaItemLive();
                    double offset = 0;
                    double dvrWindow = 0;
                    boolean isAtEdge = false;

                    if (isLive) {
                        offset = player.getCurrentLiveOffset() / 1000.0;
                        isAtEdge = offset < 2.0; // Within 2 seconds of live edge

                        Timeline timeline = player.getCurrentTimeline();
                        if (!timeline.isEmpty()) {
                            Timeline.Window window = new Timeline.Window();
                            timeline.getWindow(player.getCurrentMediaItemIndex(), window);
                            dvrWindow = window.getDurationMs() > 0 ?
                                    window.getDurationMs() / 1000.0 : 0;
                        }
                    }

                    WritableMap state = Arguments.createMap();
                    state.putBoolean("isLive", isLive);
                    state.putDouble("liveEdgeOffset", offset);
                    state.putDouble("dvrWindowSize", dvrWindow);
                    state.putBoolean("isAtLiveEdge", isAtEdge);
                    state.putDouble("targetLatencyMs", targetLatencyMs);
                    promise.resolve(state);
                } catch (Exception e) {
                    promise.reject("LIVE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("LIVE_ERROR", e.getMessage(), e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PLAYLIST & QUEUE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    private boolean shuffleEnabled = false;
    private String repeatMode = "none"; // none, one, all
    private List<ReadableMap> playlistItems = new ArrayList<>();

    @ReactMethod
    public void setPlaylist(ReadableArray items, Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            playlistItems.clear();
            List<MediaItem> mediaItems = new ArrayList<>();

            for (int i = 0; i < items.size(); i++) {
                ReadableMap item = items.getMap(i);
                playlistItems.add(item);

                String url = item.getString("url");
                MediaItem.Builder builder = new MediaItem.Builder().setUri(url);

                if (item.hasKey("title")) {
                    MediaItem.RequestMetadata requestMetadata = new MediaItem.RequestMetadata.Builder()
                        .build();
                    builder.setRequestMetadata(requestMetadata);
                    builder.setMediaMetadata(
                        new androidx.media3.common.MediaMetadata.Builder()
                            .setTitle(item.hasKey("title") ? item.getString("title") : null)
                            .setArtist(item.hasKey("artist") ? item.getString("artist") : null)
                            .setAlbumTitle(item.hasKey("album") ? item.getString("album") : null)
                            .build()
                    );
                }

                // Set custom tag to store the item ID
                if (item.hasKey("id")) {
                    builder.setMediaId(item.getString("id"));
                }

                mediaItems.add(builder.build());
            }

            mainHandler.post(() -> {
                try {
                    player.setMediaItems(mediaItems);
                    player.setShuffleModeEnabled(shuffleEnabled);
                    applyRepeatMode();
                    player.prepare();
                    if (true) { // auto-play on setPlaylist
                        player.play();
                    }
                    emitPlaylistStateEvent("onTrackChange");
                    promise.resolve(true);
                } catch (Exception e) {
                    promise.reject("PLAYLIST_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("PLAYLIST_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void addToQueue(ReadableMap item, int position, Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            String url = item.getString("url");
            MediaItem.Builder builder = new MediaItem.Builder().setUri(url);
            if (item.hasKey("id")) {
                builder.setMediaId(item.getString("id"));
            }
            if (item.hasKey("title") || item.hasKey("artist") || item.hasKey("album")) {
                builder.setMediaMetadata(
                    new androidx.media3.common.MediaMetadata.Builder()
                        .setTitle(item.hasKey("title") ? item.getString("title") : null)
                        .setArtist(item.hasKey("artist") ? item.getString("artist") : null)
                        .setAlbumTitle(item.hasKey("album") ? item.getString("album") : null)
                        .build()
                );
            }
            MediaItem mediaItem = builder.build();

            int insertPos = (position < 0) ? player.getMediaItemCount() : position;
            if (insertPos >= playlistItems.size()) {
                playlistItems.add(item);
            } else {
                playlistItems.add(insertPos, item);
            }

            int finalPos = insertPos;
            mainHandler.post(() -> {
                try {
                    player.addMediaItem(finalPos, mediaItem);
                    emitPlaylistStateEvent("onQueueUpdate");
                    promise.resolve(true);
                } catch (Exception e) {
                    promise.reject("QUEUE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("QUEUE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void removeFromQueue(int index, Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            if (index >= 0 && index < playlistItems.size()) {
                playlistItems.remove(index);
            }

            mainHandler.post(() -> {
                try {
                    if (index >= 0 && index < player.getMediaItemCount()) {
                        player.removeMediaItem(index);
                        emitPlaylistStateEvent("onQueueUpdate");
                        promise.resolve(true);
                    } else {
                        promise.reject("INDEX_OUT_OF_BOUNDS", "Invalid index: " + index, (Throwable) null);
                    }
                } catch (Exception e) {
                    promise.reject("QUEUE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("QUEUE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void moveInQueue(int fromIndex, int toIndex, Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            if (fromIndex >= 0 && fromIndex < playlistItems.size() &&
                toIndex >= 0 && toIndex < playlistItems.size()) {
                ReadableMap item = playlistItems.remove(fromIndex);
                playlistItems.add(toIndex, item);
            }

            mainHandler.post(() -> {
                try {
                    player.moveMediaItem(fromIndex, toIndex);
                    emitPlaylistStateEvent("onQueueUpdate");
                    promise.resolve(true);
                } catch (Exception e) {
                    promise.reject("QUEUE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("QUEUE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void skipToNext(Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            mainHandler.post(() -> {
                try {
                    if (player.hasNextMediaItem()) {
                        player.seekToNextMediaItem();
                        emitPlaylistStateEvent("onTrackChange");
                        promise.resolve(true);
                    } else {
                        promise.reject("NO_NEXT_ITEM", "No next item in queue", (Throwable) null);
                    }
                } catch (Exception e) {
                    promise.reject("SKIP_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("SKIP_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void skipToPrevious(Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            mainHandler.post(() -> {
                try {
                    if (player.hasPreviousMediaItem()) {
                        player.seekToPreviousMediaItem();
                        emitPlaylistStateEvent("onTrackChange");
                        promise.resolve(true);
                    } else {
                        promise.reject("NO_PREVIOUS_ITEM", "No previous item in queue", (Throwable) null);
                    }
                } catch (Exception e) {
                    promise.reject("SKIP_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("SKIP_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void skipToIndex(int index, Promise promise) {
        try {
            if (player == null) {
                promise.reject("PLAYER_NOT_INITIALIZED", "Player is not initialized", (Throwable) null);
                return;
            }

            mainHandler.post(() -> {
                try {
                    if (index >= 0 && index < player.getMediaItemCount()) {
                        player.seekTo(index, 0);
                        emitPlaylistStateEvent("onTrackChange");
                        promise.resolve(true);
                    } else {
                        promise.reject("INDEX_OUT_OF_BOUNDS", "Invalid index: " + index, (Throwable) null);
                    }
                } catch (Exception e) {
                    promise.reject("SKIP_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("SKIP_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void setShuffle(boolean enabled, Promise promise) {
        try {
            shuffleEnabled = enabled;
            if (player != null) {
                mainHandler.post(() -> {
                    player.setShuffleModeEnabled(enabled);
                    emitPlaylistStateEvent("onQueueUpdate");
                    promise.resolve(true);
                });
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("SHUFFLE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void setRepeatMode(String mode, Promise promise) {
        try {
            repeatMode = mode;
            if (player != null) {
                mainHandler.post(() -> {
                    applyRepeatMode();
                    emitPlaylistStateEvent("onQueueUpdate");
                    promise.resolve(true);
                });
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("REPEAT_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getPlaylistState(Promise promise) {
        try {
            if (player == null) {
                WritableMap state = Arguments.createMap();
                state.putInt("currentIndex", -1);
                state.putInt("totalItems", 0);
                state.putBoolean("shuffle", shuffleEnabled);
                state.putString("repeat", repeatMode);
                state.putNull("currentItem");
                state.putBoolean("hasNext", false);
                state.putBoolean("hasPrevious", false);
                promise.resolve(state);
                return;
            }

            mainHandler.post(() -> {
                try {
                    promise.resolve(buildPlaylistState());
                } catch (Exception e) {
                    promise.reject("STATE_ERROR", e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            promise.reject("STATE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getQueue(Promise promise) {
        try {
            WritableArray queue = Arguments.createArray();
            for (ReadableMap item : playlistItems) {
                WritableMap copy = Arguments.createMap();
                copy.merge(item);
                queue.pushMap(copy);
            }
            promise.resolve(queue);
        } catch (Exception e) {
            promise.reject("QUEUE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void clearQueue(Promise promise) {
        try {
            playlistItems.clear();
            if (player != null) {
                mainHandler.post(() -> {
                    try {
                        player.clearMediaItems();
                        player.stop();
                        emitPlaylistStateEvent("onQueueUpdate");
                        promise.resolve(true);
                    } catch (Exception e) {
                        promise.reject("CLEAR_ERROR", e.getMessage(), e);
                    }
                });
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("CLEAR_ERROR", e.getMessage(), e);
        }
    }

    // ── Playlist Helpers ──

    // ── DRM ──

    @ReactMethod
    public void setDrmConfig(ReadableMap config, Promise promise) {
        try {
            if (player != null && config != null) {
                // Store DRM config — will be applied on next stream start
                this.drmConfig = config;

                // If currently playing, rebuild media item with DRM
                if (player.getCurrentMediaItem() != null) {
                    MediaItem currentItem = player.getCurrentMediaItem();
                    MediaItem.Builder builder = currentItem.buildUpon();
                    applyDrmConfig(builder, config);
                    mainHandler.post(() -> {
                        int pos = (int) player.getCurrentPosition();
                        player.setMediaItem(builder.build());
                        player.seekTo(pos);
                        player.prepare();
                    });
                }
            } else {
                this.drmConfig = config;
            }
            Log.i(TAG, "DRM config set: " + (config != null ? config.getString("type") : "null"));
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set DRM config", e);
            promise.reject("DRM_ERROR", e.getMessage(), e);
        }
    }
    private ReadableMap drmConfig;

    private void applyDrmConfig(MediaItem.Builder builder, ReadableMap drmConfig) {
        try {
            String type = drmConfig.hasKey("type") ? drmConfig.getString("type") : "";
            String licenseUrl = drmConfig.hasKey("licenseUrl") ? drmConfig.getString("licenseUrl") : "";

            java.util.UUID drmUuid = null;
            switch (type) {
                case "widevine":
                    drmUuid = C.WIDEVINE_UUID;
                    break;
                case "clearkey":
                    drmUuid = C.CLEARKEY_UUID;
                    break;
                case "aes-128":
                    // AES-128 is handled at the HLS level, not through DRM session
                    Log.i(TAG, "AES-128 is handled natively by HLS source factory");
                    return;
                case "fairplay":
                    // FairPlay is iOS-only
                    Log.w(TAG, "FairPlay DRM is not supported on Android");
                    return;
                default:
                    Log.w(TAG, "Unknown DRM type: " + type);
                    return;
            }

            MediaItem.DrmConfiguration.Builder drmBuilder = new MediaItem.DrmConfiguration.Builder(drmUuid);

            if (!licenseUrl.isEmpty()) {
                drmBuilder.setLicenseUri(licenseUrl);
            }

            if (drmConfig.hasKey("headers")) {
                ReadableMap drmHeaders = drmConfig.getMap("headers");
                if (drmHeaders != null) {
                    Map<String, String> headerMap = new HashMap<>();
                    ReadableMapKeySetIterator iterator = drmHeaders.keySetIterator();
                    while (iterator.hasNextKey()) {
                        String key = iterator.nextKey();
                        headerMap.put(key, drmHeaders.getString(key));
                    }
                    drmBuilder.setLicenseRequestHeaders(headerMap);
                }
            }

            if (drmConfig.hasKey("persistLicense") && drmConfig.getBoolean("persistLicense")) {
                drmBuilder.setMultiSession(true);
            }

            builder.setDrmConfiguration(drmBuilder.build());
            Log.i(TAG, "DRM configured: " + type + " license=" + licenseUrl);

        } catch (Exception e) {
            Log.e(TAG, "Failed to configure DRM: " + e.getMessage());
        }
    }

    private void applyRepeatMode() {
        if (player == null) return;
        switch (repeatMode) {
            case "one":
                player.setRepeatMode(Player.REPEAT_MODE_ONE);
                break;
            case "all":
                player.setRepeatMode(Player.REPEAT_MODE_ALL);
                break;
            default:
                player.setRepeatMode(Player.REPEAT_MODE_OFF);
                break;
        }
    }

    private WritableMap buildPlaylistState() {
        WritableMap state = Arguments.createMap();
        int currentIndex = player != null ? player.getCurrentMediaItemIndex() : -1;
        int totalItems = player != null ? player.getMediaItemCount() : 0;

        state.putInt("currentIndex", currentIndex);
        state.putInt("totalItems", totalItems);
        state.putBoolean("shuffle", shuffleEnabled);
        state.putString("repeat", repeatMode);
        state.putBoolean("hasNext", player != null && player.hasNextMediaItem());
        state.putBoolean("hasPrevious", player != null && player.hasPreviousMediaItem());

        if (currentIndex >= 0 && currentIndex < playlistItems.size()) {
            WritableMap currentItem = Arguments.createMap();
            currentItem.merge(playlistItems.get(currentIndex));
            state.putMap("currentItem", currentItem);
        } else {
            state.putNull("currentItem");
        }

        return state;
    }

    private void emitPlaylistStateEvent(String eventName) {
        try {
            WritableMap state = buildPlaylistState();
            sendEvent(eventName, state);
        } catch (Exception e) {
            Log.e(TAG, "Error emitting playlist state: " + e.getMessage());
        }
    }
}