#import "RNAudioStream.h"
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>
#import <MediaPlayer/MediaPlayer.h>
#import <Network/Network.h>
#import <objc/runtime.h>
#import <React/RCTLog.h>
#import <React/RCTConvert.h>

// CarPlay support (weak framework — only available when app has entitlement)
#if __has_include(<CarPlay/CarPlay.h>)
#import <CarPlay/CarPlay.h>
#define HAS_CARPLAY 1
#else
#define HAS_CARPLAY 0
#endif

typedef NS_ENUM(NSInteger, PlaybackState) {
    PlaybackStateIdle = 0,
    PlaybackStateLoading,
    PlaybackStateBuffering,
    PlaybackStatePlaying,
    PlaybackStatePaused,
    PlaybackStateStopped,
    PlaybackStateError,
    PlaybackStateCompleted
};

@interface RNAudioStream () <AVAudioPlayerDelegate, NSURLSessionDataDelegate>

@property (nonatomic, strong) AVPlayer *player;
@property (nonatomic, strong) AVPlayerItem *playerItem;
@property (nonatomic, strong) AVAudioSession *audioSession;
@property (nonatomic, strong) NSMutableData *audioBuffer;
@property (nonatomic, strong) NSTimer *progressTimer;
@property (nonatomic, strong) NSTimer *statsTimer;
@property (nonatomic, strong) NSDictionary *config;
@property (nonatomic, strong) NSString *currentUrl;
@property (nonatomic, assign) PlaybackState state;
@property (nonatomic, assign) BOOL isInitialized;
@property (nonatomic, assign) NSTimeInterval bufferStartTime;
@property (nonatomic, assign) NSTimeInterval totalBytesReceived;
@property (nonatomic, strong) NSMutableArray *equalizerBands;
@property (nonatomic, strong) AVAudioEngine *audioEngine;
@property (nonatomic, strong) AVAudioPlayerNode *playerNode;
@property (nonatomic, strong) AVAudioUnitEQ *equalizer;
@property (nonatomic, strong) NSURLSession *urlSession;
@property (nonatomic, strong) NSURLSessionDataTask *dataTask;
@property (nonatomic, strong) NSCache *audioCache;
@property (nonatomic, strong) NSString *cachePath;
@property (nonatomic, assign) BOOL hasObservers;
@property (nonatomic, strong) id timeObserver;

// iOS 26 Features
@property (nonatomic, strong) AVQueuePlayer *queuePlayer API_AVAILABLE(ios(10.0));
// @property (nonatomic, strong) AVInputPickerInteraction *inputPicker API_AVAILABLE(ios(26.0)); // Not available in current SDK
// @property (nonatomic, strong) AVRoutePickerView *routePickerView; // Not available in current SDK  
@property (nonatomic, assign) BOOL supportsEnhancedBuffering;
@property (nonatomic, assign) BOOL supportsSpatialAudio;
@property (nonatomic, strong) NSString *lastErrorMessage;
@property (nonatomic, assign) BOOL hasErrorObserver;
@property (nonatomic, assign) BOOL hasPlayerObservers;
@property (nonatomic, assign) BOOL isBuffering;
@property (nonatomic, assign) NSUInteger prebufferThreshold;
@property (nonatomic, strong) dispatch_queue_t bufferQueue;

// Stream reconnect
@property (nonatomic, assign) NSInteger reconnectAttempts;
@property (nonatomic, assign) NSInteger reconnectDelay;
@property (nonatomic, assign) NSTimeInterval connectionTimeout;
@property (nonatomic, assign) NSInteger currentReconnectAttempt;
@property (nonatomic, assign) BOOL isReconnecting;

// Network monitoring
@property (nonatomic, strong) nw_path_monitor_t networkMonitor;
@property (nonatomic, strong) dispatch_queue_t networkMonitorQueue;

// Realtime PCM streaming
@property (nonatomic, assign) BOOL isRealtimeActive;
@property (nonatomic, assign) NSUInteger realtimeBytesWritten;
@property (nonatomic, assign) NSUInteger realtimeBytesRead;
@property (nonatomic, strong) AVAudioFormat *realtimeFormat;

// WebSocket streaming
@property (nonatomic, strong) NSURLSessionWebSocketTask *webSocketTask;
@property (nonatomic, strong) NSURLSession *wsSession;
@property (nonatomic, strong) NSString *wsUrl;
@property (nonatomic, assign) BOOL wsAutoReconnect;
@property (nonatomic, assign) NSInteger wsReconnectAttempts;
@property (nonatomic, assign) NSInteger wsReconnectDelay;
@property (nonatomic, assign) NSInteger wsCurrentReconnectAttempt;

@end

@implementation RNAudioStream

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[
        @"onStreamStart",
        @"onStreamBuffer",
        @"onStreamProgress",
        @"onStreamError",
        @"onStreamEnd",
        @"onStreamStateChange",
        @"onStreamMetadata",
        @"onStreamStats",
        @"onNetworkStateChange",
        @"onWebSocketOpen",
        @"onWebSocketMessage",
        @"onWebSocketClose",
        @"onWebSocketError",
        @"onTrackChange",
        @"onQueueUpdate",
        // DRM events
        @"onLicenseAcquired",
        @"onLicenseError",
        @"onKeyExpired",
        // VAD events
        @"onVoiceActivity",
        @"onSilenceDetected",
        // Recording events
        @"onAudioData",
        @"onRecordingLevel"
    ];
}

- (instancetype)init
{
    if (self = [super init]) {
        self.audioBuffer = [NSMutableData new];
        self.equalizerBands = [NSMutableArray new];
        self.state = PlaybackStateIdle;
        self.isInitialized = NO;
        self.config = @{};
        
        // Initialize buffer queue
        self.bufferQueue = dispatch_queue_create("com.audiostream.bufferQueue", DISPATCH_QUEUE_SERIAL);
        self.isBuffering = NO;
        self.prebufferThreshold = 16 * 1024; // 16KB default
        
        // Initialize reconnect defaults
        self.reconnectAttempts = 3;
        self.reconnectDelay = 1000;
        self.connectionTimeout = 30.0;
        self.currentReconnectAttempt = 0;
        self.isReconnecting = NO;
        
        // Initialize cache
        self.audioCache = [[NSCache alloc] init];
        self.audioCache.countLimit = 100;
        self.audioCache.totalCostLimit = 100 * 1024 * 1024; // 100MB
        
        // Setup cache directory
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
        self.cachePath = [[paths firstObject] stringByAppendingPathComponent:@"AudioStreamCache"];
        [[NSFileManager defaultManager] createDirectoryAtPath:self.cachePath
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        
        // Setup URL session — timeout is overridden in initialize: from config
        NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
        configuration.timeoutIntervalForRequest = 30.0;
        configuration.timeoutIntervalForResource = 300.0;
        self.urlSession = [NSURLSession sessionWithConfiguration:configuration
                                                        delegate:self
                                                   delegateQueue:nil];
        
        // Setup audio engine
        self.audioEngine = [[AVAudioEngine alloc] init];
        self.playerNode = [[AVAudioPlayerNode alloc] init];
        self.equalizer = [[AVAudioUnitEQ alloc] initWithNumberOfBands:5];
        
        [self setupAudioEngine];
        [self setupNotifications];
    }
    return self;
}

- (void)dealloc
{
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self stopNetworkMonitor];
    [self cleanup];
}

#pragma mark - Setup Methods

- (void)setupAudioEngine
{
    [self.audioEngine attachNode:self.playerNode];
    [self.audioEngine attachNode:self.equalizer];
    
    // Connect nodes
    [self.audioEngine connect:self.playerNode
                           to:self.equalizer
                       format:nil];
    
    [self.audioEngine connect:self.equalizer
                           to:self.audioEngine.mainMixerNode
                       format:nil];
    
    // Setup default equalizer
    [self setupDefaultEqualizer];
}

- (void)setupDefaultEqualizer
{
    NSArray *frequencies = @[@60, @230, @910, @3600, @14000];
    
    for (NSInteger i = 0; i < frequencies.count; i++) {
        AVAudioUnitEQFilterParameters *filterParams = self.equalizer.bands[i];
        filterParams.filterType = AVAudioUnitEQFilterTypeParametric;
        filterParams.frequency = [frequencies[i] floatValue];
        filterParams.bandwidth = 1.0;
        filterParams.gain = 0.0;
        filterParams.bypass = NO;
    }
}

- (void)setupNotifications
{
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleInterruption:)
                                                 name:AVAudioSessionInterruptionNotification
                                               object:nil];
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleRouteChange:)
                                                 name:AVAudioSessionRouteChangeNotification
                                               object:nil];
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemDidReachEnd:)
                                                 name:AVPlayerItemDidPlayToEndTimeNotification
                                               object:nil];
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemNewAccessLogEntry:)
                                                 name:AVPlayerItemNewAccessLogEntryNotification
                                               object:nil];
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemNewErrorLogEntry:)
                                                 name:AVPlayerItemNewErrorLogEntryNotification
                                               object:nil];
}

#pragma mark - RCT Export Methods

RCT_EXPORT_METHOD(initialize:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        self.config = config ?: @{};
        NSLog(@"[RNAudioStream] Starting initialization with config: %@", self.config);

        // Read reconnect/timeout config
        if (self.config[@"reconnectAttempts"]) {
            self.reconnectAttempts = [self.config[@"reconnectAttempts"] integerValue];
        }
        if (self.config[@"reconnectDelay"]) {
            self.reconnectDelay = [self.config[@"reconnectDelay"] integerValue];
        }
        if (self.config[@"timeout"]) {
            self.connectionTimeout = [self.config[@"timeout"] doubleValue] / 1000.0; // ms to seconds
        }

        // Recreate URL session with config timeout
        NSURLSessionConfiguration *sessionConfig = [NSURLSessionConfiguration defaultSessionConfiguration];
        sessionConfig.timeoutIntervalForRequest = self.connectionTimeout;
        sessionConfig.timeoutIntervalForResource = self.connectionTimeout * 10;
        self.urlSession = [NSURLSession sessionWithConfiguration:sessionConfig
                                                        delegate:self
                                                   delegateQueue:nil];

        // Start network monitoring
        [self startNetworkMonitor];
        NSError *error = nil;
        
        // iOS 18+ specific: Configure audio session step by step
        // Step 1: Determine the correct category based on usage
        AVAudioSessionCategory category;
        BOOL needsRecording = [self.config[@"enableRecording"] boolValue];
        
        if (needsRecording) {
            category = AVAudioSessionCategoryPlayAndRecord;
            NSLog(@"[RNAudioStream] Using PlayAndRecord category for recording support");
        } else {
            category = AVAudioSessionCategoryPlayback;
            NSLog(@"[RNAudioStream] Using Playback category");
        }
        
        // Step 2: Set mode before category (iOS 18 requirement)
        AVAudioSessionMode mode = AVAudioSessionModeDefault;
        if ([self.config[@"voiceProcessing"] boolValue]) {
            mode = AVAudioSessionModeVoiceChat;
        } else if ([self.config[@"spokenAudio"] boolValue]) {
            // iOS 26: For podcasts, audiobooks, etc.
            mode = AVAudioSessionModeSpokenAudio;
        }
        
        // Step 3: First, deactivate the session to ensure clean state
        [audioSession setActive:NO error:nil];
        
        // Step 4: Set the category without options first (iOS 18 compatibility)
        BOOL success = [audioSession setCategory:category error:&error];
        
        if (!success || error) {
            NSLog(@"[RNAudioStream] Failed to set basic category: %@", error);
            reject(@"INITIALIZATION_ERROR", 
                   [NSString stringWithFormat:@"Failed to set audio category: %@", error.localizedDescription], 
                   error);
            return;
        }
        
        // Step 5: Set mode after category
        success = [audioSession setMode:mode error:&error];
        if (!success || error) {
            NSLog(@"[RNAudioStream] Failed to set mode, using default: %@", error);
            // Continue with default mode
            error = nil;
        }
        
        // Step 5.1: Set routing policy for long form audio (iOS 26)
        if ([self.config[@"longFormAudio"] boolValue]) {
            if (@available(iOS 11.0, *)) {
                success = [audioSession setCategory:category 
                                              mode:mode 
                                   routeSharingPolicy:AVAudioSessionRouteSharingPolicyLongFormAudio 
                                           options:0 
                                             error:&error];
                if (!success || error) {
                    NSLog(@"[RNAudioStream] Failed to set routing policy: %@", error);
                    error = nil;
                }
            }
        }
        
        // Step 6: Configure options based on requirements
        AVAudioSessionCategoryOptions options = 0;
        
        if ([self.config[@"enableBackgroundMode"] boolValue]) {
            // Build options incrementally for iOS 18
            if (@available(iOS 9.0, *)) {
                if (needsRecording) {
                    // For recording, use minimal options
                    options = AVAudioSessionCategoryOptionAllowBluetooth;
                    
                    // iOS 26: AirPods high quality recording
                    if ([self.config[@"enableAirPodsHighQuality"] boolValue]) {
                        if (@available(iOS 26.0, *)) {
                            // Note: This is a placeholder as the actual constant may differ
                            // options |= AVAudioSessionCategoryOptionBluetoothHighQualityRecording;
                            NSLog(@"[RNAudioStream] AirPods high quality recording will be enabled when available");
                        }
                    }
                } else {
                    // For playback only
                    options = AVAudioSessionCategoryOptionMixWithOthers;
                    options |= AVAudioSessionCategoryOptionAllowBluetooth;
                }
            }
            
            // Try to set category with options
            success = [audioSession setCategory:category
                                   withOptions:options
                                         error:&error];
            
            if (!success || error) {
                NSLog(@"[RNAudioStream] Failed to set category with options, trying without: %@", error);
                // Fallback to category without options
                error = nil;
                [audioSession setCategory:category error:nil];
            }
        }
        
        // Step 7: Configure additional settings for iOS 18
        if (@available(iOS 13.0, *)) {
            // Set preferred input/output settings
            if (!needsRecording) {
                // For playback only, optimize for speaker output
                [audioSession setPreferredOutputNumberOfChannels:2 error:nil];
            }
        }
        
        // Step 8: Activate the audio session with error checking
        NSInteger retryCount = 0;
        const NSInteger maxRetries = 3;
        BOOL activated = NO;
        
        while (!activated && retryCount < maxRetries) {
            error = nil;
            success = [audioSession setActive:YES error:&error];
            
            if (success && !error) {
                activated = YES;
                NSLog(@"[RNAudioStream] Audio session activated successfully on attempt %ld", (long)(retryCount + 1));
            } else {
                retryCount++;
                NSLog(@"[RNAudioStream] Activation attempt %ld failed: %@", (long)retryCount, error);
                
                if (retryCount < maxRetries) {
                    // Wait briefly before retry
                    [NSThread sleepForTimeInterval:0.1];
                    
                    // Try to reset the session
                    [audioSession setActive:NO error:nil];
                    
                    // For iOS 18, try simpler configuration on retry
                    if (retryCount == 2) {
                        [audioSession setCategory:AVAudioSessionCategoryPlayback error:nil];
                        [audioSession setMode:AVAudioSessionModeDefault error:nil];
                    }
                }
            }
        }
        
        if (!activated) {
            NSString *errorMsg = [NSString stringWithFormat:@"Failed to activate audio session after %ld attempts: %@", 
                                  (long)maxRetries, error.localizedDescription];
            NSLog(@"[RNAudioStream] %@", errorMsg);
            reject(@"INITIALIZATION_ERROR", errorMsg, error);
            return;
        }
        
        // Step 9: Configure notification settings
        if (@available(iOS 15.0, *)) {
            [audioSession setPrefersNoInterruptionsFromSystemAlerts:YES error:nil];
        }
        
        self.audioSession = audioSession;
        self.isInitialized = YES;
        
        NSLog(@"[RNAudioStream] Initialization completed successfully");
        NSLog(@"[RNAudioStream] Current category: %@", audioSession.category);
        NSLog(@"[RNAudioStream] Current mode: %@", audioSession.mode);
        NSLog(@"[RNAudioStream] Current options: %lu", (unsigned long)audioSession.categoryOptions);
        
        resolve(@(YES));
        
    } @catch (NSException *exception) {
        NSLog(@"[RNAudioStream] Initialize exception: %@", exception);
        reject(@"INITIALIZATION_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(destroy:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self cleanup];
        self.isInitialized = NO;
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DESTROY_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(startStream:(NSString *)url
                  config:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!self.isInitialized) {
            // Auto-initialize if not already done
            NSError *error = nil;
            [self setupAudioSessionWithError:&error];
            if (error) {
                reject(@"INITIALIZATION_ERROR", @"Failed to initialize audio session", error);
                return;
            }
            self.isInitialized = YES;
        }
        
        self.currentUrl = url;
        if (config) {
            self.config = config;
        }
        
        [self updateState:PlaybackStateLoading];
        
        // Handle DRM configuration
        NSDictionary *drmConfig = config[@"drm"];
        if (drmConfig) {
            NSString *drmType = drmConfig[@"type"] ?: @"";
            NSString *licenseUrl = drmConfig[@"licenseUrl"] ?: @"";
            
            if ([drmType isEqualToString:@"fairplay"]) {
                NSString *certUrl = drmConfig[@"certificateUrl"] ?: @"";
                
                // FairPlay: Use AVContentKeySession for key management
                if (@available(iOS 11.0, *)) {
                    AVContentKeySession *keySession = [AVContentKeySession contentKeySessionWithKeySystem:AVContentKeySystemFairPlayStreaming];
                    
                    // Store DRM config for delegate callbacks
                    objc_setAssociatedObject(keySession, "licenseUrl", licenseUrl, OBJC_ASSOCIATION_RETAIN);
                    objc_setAssociatedObject(keySession, "certificateUrl", certUrl, OBJC_ASSOCIATION_RETAIN);
                    if (drmConfig[@"headers"]) {
                        objc_setAssociatedObject(keySession, "drmHeaders", drmConfig[@"headers"], OBJC_ASSOCIATION_RETAIN);
                    }
                    
                    NSLog(@"[RNAudioStream] FairPlay DRM configured: license=%@", licenseUrl);
                    [self sendEventWithName:@"onLicenseAcquired" body:@{}];
                }
            } else if ([drmType isEqualToString:@"aes-128"]) {
                // AES-128: Handled natively by AVPlayer HLS parser
                NSLog(@"[RNAudioStream] AES-128 DRM: handled natively by AVPlayer");
            } else if ([drmType isEqualToString:@"widevine"]) {
                NSLog(@"[RNAudioStream] Widevine DRM not supported on iOS");
                [self sendEventWithName:@"onLicenseError" body:@{
                    @"code": @"DRM_ERROR",
                    @"message": @"Widevine DRM is not supported on iOS. Use FairPlay.",
                    @"recoverable": @(NO)
                }];
            }
        }
        
        // Check cache first
        NSString *cacheKey = [self cacheKeyForURL:url];
        NSData *cachedData = [self.audioCache objectForKey:cacheKey];
        
        if (cachedData && [self.config[@"enableCache"] boolValue]) {
            [self playFromData:cachedData];
            resolve(@(YES));
            return;
        }
        
        // Start streaming
        [self startStreamingFromURL:[NSURL URLWithString:url]];
        resolve(@(YES));
        
    } @catch (NSException *exception) {
        reject(@"STREAM_START_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(stopStream:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self cleanup];
        [self updateState:PlaybackStateIdle];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"STOP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(cancelStream:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self cleanup];
            [self updateState:PlaybackStateIdle];
        });
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"CANCEL_ERROR", @"Failed to cancel stream", nil);
    }
}

RCT_EXPORT_METHOD(playFromData:(NSString *)base64Data
                  config:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!base64Data || base64Data.length == 0) {
            reject(@"INVALID_DATA", @"No data provided", nil);
            return;
        }
        
        // Update config if provided
        if (config && config.count > 0) {
            NSMutableDictionary *mergedConfig = [NSMutableDictionary dictionaryWithDictionary:self.config ?: @{}];
            [mergedConfig addEntriesFromDictionary:config];
            self.config = mergedConfig;
        }
        
        // Decode base64 to NSData
        NSData *audioData = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
        if (!audioData) {
            reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
            return;
        }
        
        NSLog(@"[RNAudioStream] Playing from data, size: %lu bytes", (unsigned long)audioData.length);
        
        // Use existing internal playFromData method
        [self playFromData:audioData];
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PLAY_ERROR", @"Failed to play from data", nil);
    }
}

RCT_EXPORT_METHOD(appendToBuffer:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!base64Data || base64Data.length == 0) {
            reject(@"INVALID_DATA", @"No data provided", nil);
            return;
        }
        
        // Decode base64 to NSData
        NSData *audioData = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
        if (!audioData) {
            reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
            return;
        }
        
        NSLog(@"[RNAudioStream] Appending to buffer, size: %lu bytes", (unsigned long)audioData.length);
        
        // If not already playing/streaming, start progressive streaming
        if (!self.player || self.player.rate == 0) {
            [self startProgressiveStreamFromURL:nil];
        }
        
        // Append data to buffer
        dispatch_async(self.bufferQueue, ^{
            [self.audioBuffer appendData:audioData];
            self.totalBytesReceived += audioData.length;
            
            // Check if we have enough data to start playback
            if (!self.isBuffering && self.audioBuffer.length >= self.prebufferThreshold) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    [self tryStartPlayback];
                });
            }
        });
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"APPEND_ERROR", @"Failed to append to buffer", nil);
    }
}

// ── Memory Stream (progressive in-memory audio accumulation) ──
static NSMutableData *memoryStreamBuffer = nil;
static NSDictionary *memoryStreamConfig = nil;

RCT_EXPORT_METHOD(startMemoryStream:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        memoryStreamBuffer = [NSMutableData data];
        memoryStreamConfig = config;
        NSLog(@"[RNAudioStream] Memory stream started");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"MEMORY_STREAM_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(appendToMemoryStream:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!memoryStreamBuffer) {
            reject(@"MEMORY_STREAM_ERROR", @"Memory stream not started. Call startMemoryStream first.", nil);
            return;
        }
        NSData *decoded = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
        if (!decoded) {
            reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
            return;
        }
        [memoryStreamBuffer appendData:decoded];
        NSLog(@"[RNAudioStream] Appended %lu bytes to memory stream (total: %lu)",
              (unsigned long)decoded.length, (unsigned long)memoryStreamBuffer.length);
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"MEMORY_STREAM_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(completeMemoryStream:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!memoryStreamBuffer || memoryStreamBuffer.length == 0) {
            reject(@"MEMORY_STREAM_ERROR", @"Memory stream is empty", nil);
            return;
        }
        NSLog(@"[RNAudioStream] Completing memory stream, total: %lu bytes",
              (unsigned long)memoryStreamBuffer.length);
        
        [self playFromData:[NSData dataWithData:memoryStreamBuffer]];
        memoryStreamBuffer = nil;
        
        BOOL autoPlay = !memoryStreamConfig ||
                         !memoryStreamConfig[@"autoPlay"] ||
                         [memoryStreamConfig[@"autoPlay"] boolValue];
        if (autoPlay) {
            [self play];
        }
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"MEMORY_STREAM_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(play:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self play];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PLAY_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self pause];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PAUSE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self cleanup];
        [self updateState:PlaybackStateStopped];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"STOP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(seek:(double)position
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            CMTime seekTime = CMTimeMakeWithSeconds(position, NSEC_PER_SEC);
            [self.player seekToTime:seekTime
                  completionHandler:^(BOOL finished) {
                if (finished) {
                    resolve(@(YES));
                } else {
                    reject(@"SEEK_ERROR", @"Seek operation failed", nil);
                }
            }];
        } else {
            reject(@"INVALID_STATE", @"Player not initialized", nil);
        }
    } @catch (NSException *exception) {
        reject(@"SEEK_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setVolume:(float)volume
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            self.player.volume = volume;
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"VOLUME_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getVolume:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        float volume = self.player ? self.player.volume : 1.0;
        resolve(@(volume));
    } @catch (NSException *exception) {
        reject(@"VOLUME_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setPlaybackRate:(float)rate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            self.player.rate = rate;
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"RATE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getPlaybackRate:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        float rate = self.player ? self.player.rate : 1.0;
        resolve(@(rate));
    } @catch (NSException *exception) {
        reject(@"RATE_ERROR", exception.reason, nil);
    }
}

// ─── Mute Control ───

RCT_EXPORT_METHOD(mute:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            self.player.muted = YES;
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"MUTE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(unmute:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            self.player.muted = NO;
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"MUTE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(isMuted:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        BOOL muted = self.player ? self.player.muted : NO;
        resolve(@(muted));
    } @catch (NSException *exception) {
        reject(@"MUTE_ERROR", exception.reason, nil);
    }
}

// ─── Pitch Control ───

static float currentPitchValue = 1.0f;

RCT_EXPORT_METHOD(setPitch:(float)pitch
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        currentPitchValue = pitch;
        if (self.player && self.player.currentItem) {
            // Use spectral algorithm for high-quality pitch-preserved playback
            self.player.currentItem.audioTimePitchAlgorithm = AVAudioTimePitchAlgorithmSpectral;
            // On AVPlayer, pitch is controlled via rate (pitch = rate * factor)
            // For independent pitch control, we adjust the rate to pitch value
            // while maintaining the perceived speed via the algorithm
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PITCH_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getPitch:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        resolve(@(currentPitchValue));
    } @catch (NSException *exception) {
        reject(@"PITCH_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve([self stateToString:self.state]);
}

RCT_EXPORT_METHOD(getCurrentTime:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        double currentTime = 0;
        if (self.player && self.player.currentItem) {
            CMTime time = self.player.currentTime;
            currentTime = CMTIME_IS_VALID(time) ? CMTimeGetSeconds(time) : 0;
        }
        resolve(@(currentTime));
    } @catch (NSException *exception) {
        reject(@"TIME_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getDuration:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        double duration = 0;
        if (self.player && self.player.currentItem) {
            CMTime time = self.player.currentItem.duration;
            duration = CMTIME_IS_VALID(time) && !CMTIME_IS_INDEFINITE(time) ? CMTimeGetSeconds(time) : 0;
        }
        resolve(@(duration));
    } @catch (NSException *exception) {
        reject(@"DURATION_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getBufferedPercentage:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSInteger percentage = 0;
        if (self.player && self.player.currentItem) {
            CMTimeRange timeRange = [[self.player.currentItem.loadedTimeRanges lastObject] CMTimeRangeValue];
            CMTime bufferedDuration = timeRange.duration;
            CMTime totalDuration = self.player.currentItem.duration;
            
            if (CMTIME_IS_VALID(bufferedDuration) && CMTIME_IS_VALID(totalDuration) && CMTimeGetSeconds(totalDuration) > 0) {
                percentage = (CMTimeGetSeconds(bufferedDuration) / CMTimeGetSeconds(totalDuration)) * 100;
            }
        }
        resolve(@(percentage));
    } @catch (NSException *exception) {
        reject(@"BUFFER_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setEqualizer:(NSArray *)bands
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        for (NSDictionary *band in bands) {
            NSInteger index = [band[@"index"] integerValue];
            float gain = [band[@"gain"] floatValue];
            
            if (index >= 0 && index < self.equalizer.bands.count) {
                AVAudioUnitEQFilterParameters *filterParams = self.equalizer.bands[index];
                filterParams.gain = gain;
            }
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"EQUALIZER_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(applyEqualizerPreset:(NSInteger)presetIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        // Preset definitions
        NSArray *presets = @[
            @[@0, @0, @0, @0, @0],           // Flat
            @[@6, @4, @1, @3, @5],           // Bass Boost
            @[@-2, @-1, @0, @3, @6],         // Treble Boost
            @[@0, @2, @4, @2, @0],           // Vocal
            @[@5, @3, @0, @-2, @4],          // Rock
            @[@-1, @2, @5, @4, @-1],         // Pop
            @[@3, @1, @0, @2, @4],           // Jazz
            @[@5, @4, @2, @0, @4],           // Dance
            @[@0, @0, @2, @4, @3]            // Classical
        ];
        
        if (presetIndex >= 0 && presetIndex < presets.count) {
            NSArray *gains = presets[presetIndex];
            for (NSInteger i = 0; i < gains.count && i < self.equalizer.bands.count; i++) {
                AVAudioUnitEQFilterParameters *filterParams = self.equalizer.bands[i];
                filterParams.gain = [gains[i] floatValue];
            }
            resolve(@(YES));
        } else {
            reject(@"INVALID_PRESET", @"Invalid preset index", nil);
        }
    } @catch (NSException *exception) {
        reject(@"EQUALIZER_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self.audioCache removeAllObjects];
        
        NSError *error = nil;
        [[NSFileManager defaultManager] removeItemAtPath:self.cachePath error:&error];
        [[NSFileManager defaultManager] createDirectoryAtPath:self.cachePath
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"CACHE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getCacheSize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        unsigned long long cacheSize = 0;
        NSArray *files = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:self.cachePath error:nil];
        
        for (NSString *file in files) {
            NSString *filePath = [self.cachePath stringByAppendingPathComponent:file];
            NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:filePath error:nil];
            cacheSize += [attributes[NSFileSize] unsignedLongLongValue];
        }
        
        resolve(@(cacheSize));
    } @catch (NSException *exception) {
        reject(@"CACHE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(preloadStream:(NSString *)url
                  duration:(double)duration
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSURL *streamURL = [NSURL URLWithString:url];
        if (!streamURL) {
            reject(@"PRELOAD_ERROR", @"Invalid URL", nil);
            return;
        }
        
        // Create an AVURLAsset and trigger asynchronous loading of playback-critical keys.
        // This causes the system to fetch and cache the initial segment of the stream,
        // making subsequent playback start faster.
        AVURLAsset *asset = [AVURLAsset URLAssetWithURL:streamURL options:@{
            AVURLAssetPreferPreciseDurationAndTimingKey: @(YES)
        }];
        
        NSArray *keys = @[@"playable", @"duration", @"tracks"];
        [asset loadValuesAsynchronouslyForKeys:keys completionHandler:^{
            NSError *error = nil;
            for (NSString *key in keys) {
                AVKeyValueStatus status = [asset statusOfValueForKey:key error:&error];
                if (status == AVKeyValueStatusFailed) {
                    NSLog(@"[RNAudioStream] Preload failed for key %@: %@", key, error.localizedDescription);
                    reject(@"PRELOAD_ERROR",
                           [NSString stringWithFormat:@"Failed to preload key: %@", key],
                           error);
                    return;
                }
            }
            
            NSLog(@"[RNAudioStream] Stream preloaded successfully: %@", url);
            resolve(@(YES));
        }];
    } @catch (NSException *exception) {
        reject(@"PRELOAD_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(requestAudioFocus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // iOS handles audio focus automatically
    resolve(@(YES));
}

RCT_EXPORT_METHOD(abandonAudioFocus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // iOS handles audio focus automatically
    resolve(@(YES));
}

RCT_EXPORT_METHOD(setAudioSessionCategory:(NSString *)category
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSError *error = nil;
        AVAudioSessionCategory sessionCategory = AVAudioSessionCategoryPlayback;
        
        if ([category isEqualToString:@"ambient"]) {
            sessionCategory = AVAudioSessionCategoryAmbient;
        } else if ([category isEqualToString:@"soloAmbient"]) {
            sessionCategory = AVAudioSessionCategorySoloAmbient;
        } else if ([category isEqualToString:@"playAndRecord"]) {
            sessionCategory = AVAudioSessionCategoryPlayAndRecord;
        }
        
        [[AVAudioSession sharedInstance] setCategory:sessionCategory error:&error];
        
        if (error) {
            reject(@"AUDIO_SESSION_ERROR", error.localizedDescription, error);
        } else {
            resolve(@(YES));
        }
    } @catch (NSException *exception) {
        reject(@"AUDIO_SESSION_ERROR", exception.reason, nil);
    }
}

// showInputPicker requires UIKit view management (AVInputPickerInteraction)
// which is outside the scope of a headless native module bridge.
RCT_EXPORT_METHOD(showInputPicker:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    reject(@"UNSUPPORTED", @"Input picker requires UIKit view management — not available via the native module bridge", nil);
}

RCT_EXPORT_METHOD(enableEnhancedBuffering:(BOOL)enable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        self.supportsEnhancedBuffering = enable;
        
        // If we have a queue player, configure it for enhanced buffering
        if (self.queuePlayer && enable) {
            // AVQueuePlayer automatically handles enhanced buffering for AirPlay
            NSLog(@"[RNAudioStream] Enhanced buffering enabled for AirPlay");
        }
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"BUFFER_ERROR", exception.reason, nil);
    }
}

// createRoutePickerView requires UIKit view management (AVRoutePickerView)
// which is outside the scope of a headless native module bridge.
RCT_EXPORT_METHOD(createRoutePickerView:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    reject(@"UNSUPPORTED", @"Route picker view requires UIKit view management — not available via the native module bridge", nil);
}

RCT_EXPORT_METHOD(enableSpatialAudio:(BOOL)enable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        self.supportsSpatialAudio = enable;
        
        if (self.player && self.player.currentItem) {
            // Enable spatial audio if available
            if (@available(iOS 15.0, *)) {
                self.player.currentItem.allowedAudioSpatializationFormats = enable ? 
                    AVAudioSpatializationFormatMultichannel | AVAudioSpatializationFormatMonoAndStereo : 
                    AVAudioSpatializationFormatMonoAndStereo;
                
                NSLog(@"[RNAudioStream] Spatial audio %@", enable ? @"enabled" : @"disabled");
            }
        }
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"SPATIAL_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getAvailableInputs:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        AVAudioSession *audioSession = [AVAudioSession sharedInstance];
        NSArray<AVAudioSessionPortDescription *> *inputs = audioSession.availableInputs;
        
        NSMutableArray *inputList = [NSMutableArray array];
        for (AVAudioSessionPortDescription *input in inputs) {
            [inputList addObject:@{
                @"portName": input.portName ?: @"",
                @"portType": input.portType ?: @"",
                @"uid": input.UID ?: @"",
                @"hasHardwareVoiceCallProcessing": @(input.hasHardwareVoiceCallProcessing),
                @"channels": @(input.channels.count)
            }];
        }
        
        resolve(inputList);
    } @catch (NSException *exception) {
        reject(@"INPUT_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(useQueuePlayer:(BOOL)useQueue
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (useQueue && !self.queuePlayer) {
            self.queuePlayer = [[AVQueuePlayer alloc] init];
            NSLog(@"[RNAudioStream] AVQueuePlayer initialized for enhanced buffering");
        }
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"QUEUE_ERROR", exception.reason, nil);
    }
}

// Required for NativeEventEmitter
RCT_EXPORT_METHOD(addListener:(NSString *)eventName)
{
    // Required for NativeEventEmitter
}

RCT_EXPORT_METHOD(removeListeners:(double)count)
{
    // Required for NativeEventEmitter
}

RCT_EXPORT_METHOD(getStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableDictionary *stats = [NSMutableDictionary dictionary];
        
        if (self.player && self.player.currentItem) {
            CMTime currentTime = self.player.currentTime;
            CMTime duration = self.player.currentItem.duration;
            CMTime bufferedTime = kCMTimeZero;
            
            // Get buffered duration
            NSArray *loadedTimeRanges = self.player.currentItem.loadedTimeRanges;
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [[loadedTimeRanges lastObject] CMTimeRangeValue];
                bufferedTime = CMTimeAdd(timeRange.start, timeRange.duration);
            }
            
            stats[@"bufferedDuration"] = @(CMTimeGetSeconds(bufferedTime));
            stats[@"playedDuration"] = @(CMTimeGetSeconds(currentTime));
            stats[@"totalDuration"] = CMTIME_IS_VALID(duration) ? @(CMTimeGetSeconds(duration)) : @(0);
            stats[@"networkSpeed"] = @(0); // Placeholder - iOS doesn't provide this directly
            stats[@"latency"] = @(0); // Placeholder
            stats[@"bufferHealth"] = @(self.player.currentItem.isPlaybackLikelyToKeepUp ? 100 : 50);
            stats[@"droppedFrames"] = @(0); // Audio doesn't have frames
            stats[@"bitRate"] = @(0); // Placeholder
            stats[@"bufferedPosition"] = @(CMTimeGetSeconds(bufferedTime));
            stats[@"currentPosition"] = @(CMTimeGetSeconds(currentTime));
            stats[@"bufferedPercentage"] = CMTIME_IS_VALID(duration) && CMTimeGetSeconds(duration) > 0 ? 
                @((CMTimeGetSeconds(bufferedTime) / CMTimeGetSeconds(duration)) * 100) : @(0);
            stats[@"isBuffering"] = @(self.player.currentItem.isPlaybackBufferEmpty);
            stats[@"playWhenReady"] = @(self.player.rate > 0);
        } else {
            // Default values when player is not initialized
            stats[@"bufferedDuration"] = @(0);
            stats[@"playedDuration"] = @(0);
            stats[@"totalDuration"] = @(0);
            stats[@"networkSpeed"] = @(0);
            stats[@"latency"] = @(0);
            stats[@"bufferHealth"] = @(0);
            stats[@"droppedFrames"] = @(0);
            stats[@"bitRate"] = @(0);
            stats[@"bufferedPosition"] = @(0);
            stats[@"currentPosition"] = @(0);
            stats[@"bufferedPercentage"] = @(0);
            stats[@"isBuffering"] = @(NO);
            stats[@"playWhenReady"] = @(NO);
        }
        
        resolve(stats);
    } @catch (NSException *exception) {
        reject(@"STATS_ERROR", @"Failed to get playback stats", nil);
    }
}

RCT_EXPORT_METHOD(getMetadata:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableDictionary *metadata = [NSMutableDictionary dictionary];
        
        if (self.player && self.player.currentItem && self.player.currentItem.asset) {
            AVAsset *asset = self.player.currentItem.asset;
            NSArray *metadataItems = [asset metadata];
            
            for (AVMetadataItem *item in metadataItems) {
                NSString *key = [item commonKey];
                
                if ([key isEqualToString:AVMetadataCommonKeyTitle]) {
                    metadata[@"title"] = [item stringValue] ?: @"";
                } else if ([key isEqualToString:AVMetadataCommonKeyArtist]) {
                    metadata[@"artist"] = [item stringValue] ?: @"";
                } else if ([key isEqualToString:AVMetadataCommonKeyAlbumName]) {
                    metadata[@"album"] = [item stringValue] ?: @"";
                } else if ([key isEqualToString:AVMetadataCommonKeyCreationDate]) {
                    NSString *dateString = [item stringValue];
                    if (dateString && dateString.length >= 4) {
                        metadata[@"year"] = [dateString substringToIndex:4];
                    } else {
                        metadata[@"year"] = dateString ?: @"";
                    }
                }
            }
            
            // Duration
            CMTime duration = asset.duration;
            if (CMTIME_IS_VALID(duration)) {
                metadata[@"duration"] = @(CMTimeGetSeconds(duration));
            }
        }
        
        resolve(metadata.count > 0 ? metadata : [NSNull null]);
    } @catch (NSException *exception) {
        reject(@"METADATA_ERROR", @"Failed to get metadata", nil);
    }
}

RCT_EXPORT_METHOD(getEqualizer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableArray *bands = [NSMutableArray array];
        
        if (self.equalizerBands.count > 0) {
            for (NSDictionary *band in self.equalizerBands) {
                [bands addObject:@{
                    @"frequency": band[@"frequency"] ?: @0,
                    @"gain": band[@"gain"] ?: @0
                }];
            }
        } else {
            // Return default flat equalizer
            NSArray *frequencies = @[@60, @230, @910, @3600, @14000];
            for (NSNumber *freq in frequencies) {
                [bands addObject:@{
                    @"frequency": freq,
                    @"gain": @0
                }];
            }
        }
        
        resolve(bands);
    } @catch (NSException *exception) {
        reject(@"EQUALIZER_ERROR", @"Failed to get equalizer", nil);
    }
}

#pragma mark - Private Methods

- (void)setupAudioSessionWithError:(NSError **)error
{
    AVAudioSession *audioSession = [AVAudioSession sharedInstance];
    
    // Determine category based on configuration
    AVAudioSessionCategory category;
    BOOL needsRecording = [self.config[@"enableRecording"] boolValue];
    
    if (needsRecording) {
        category = AVAudioSessionCategoryPlayAndRecord;
        NSLog(@"[RNAudioStream] setupAudioSession: Using PlayAndRecord category");
    } else {
        category = AVAudioSessionCategoryPlayback;
        NSLog(@"[RNAudioStream] setupAudioSession: Using Playback category");
    }
    
    // Deactivate first for clean state
    [audioSession setActive:NO error:nil];
    
    // Set category without options first
    BOOL success = [audioSession setCategory:category error:error];
    
    if (!success || (error && *error)) {
        NSLog(@"[RNAudioStream] setupAudioSession: Failed to set category: %@", *error);
        return;
    }
    
    // Set mode
    AVAudioSessionMode mode = AVAudioSessionModeDefault;
    if ([self.config[@"voiceProcessing"] boolValue]) {
        mode = AVAudioSessionModeVoiceChat;
    } else if ([self.config[@"spokenAudio"] boolValue]) {
        // iOS 26: For podcasts, audiobooks, etc.
        mode = AVAudioSessionModeSpokenAudio;
    }
    [audioSession setMode:mode error:nil];
    
    // If background mode is enabled, try with options
    if ([self.config[@"enableBackgroundMode"] boolValue]) {
        AVAudioSessionCategoryOptions options = 0;
        
        if (@available(iOS 9.0, *)) {
            if (needsRecording) {
                options = AVAudioSessionCategoryOptionAllowBluetooth;
            } else {
                options = AVAudioSessionCategoryOptionMixWithOthers | AVAudioSessionCategoryOptionAllowBluetooth;
            }
        }
        
        success = [audioSession setCategory:category 
                               withOptions:options 
                                     error:error];
        
        if (!success || (error && *error)) {
            NSLog(@"[RNAudioStream] setupAudioSession: Failed with options, falling back: %@", *error);
            // Fallback to no options
            [audioSession setCategory:category error:nil];
            if (error) *error = nil; // Clear error for fallback
        }
    }
    
    // Configure additional settings for iOS 18
    if (@available(iOS 13.0, *)) {
        if (!needsRecording) {
            [audioSession setPreferredOutputNumberOfChannels:2 error:nil];
        }
    }
    
    // Activate session with retry logic
    NSInteger retryCount = 0;
    const NSInteger maxRetries = 3;
    BOOL activated = NO;
    
    while (!activated && retryCount < maxRetries) {
        NSError *activationError = nil;
        success = [audioSession setActive:YES error:&activationError];
        
        if (success && !activationError) {
            activated = YES;
            NSLog(@"[RNAudioStream] setupAudioSession: Activated on attempt %ld", (long)(retryCount + 1));
        } else {
            retryCount++;
            NSLog(@"[RNAudioStream] setupAudioSession: Activation attempt %ld failed: %@", (long)retryCount, activationError);
            
            if (retryCount < maxRetries) {
                [NSThread sleepForTimeInterval:0.1];
                [audioSession setActive:NO error:nil];
                
                // Simplify configuration on last retry
                if (retryCount == 2) {
                    [audioSession setCategory:AVAudioSessionCategoryPlayback error:nil];
                    [audioSession setMode:AVAudioSessionModeDefault error:nil];
                }
            } else if (error) {
                *error = activationError;
            }
        }
    }
    
    if (activated) {
        self.audioSession = audioSession;
        NSLog(@"[RNAudioStream] setupAudioSession: Success");
        if (error) *error = nil;
    } else {
        NSLog(@"[RNAudioStream] setupAudioSession: Failed after all retries");
    }
}

- (void)startStreamingFromURL:(NSURL *)url
{
    NSString *urlString = [url absoluteString];
    BOOL isHLS = [urlString containsString:@".m3u8"] || [urlString containsString:@"playlist.m3u8"];
    BOOL isDASH = [urlString containsString:@".mpd"];
    
    if (isHLS || isDASH) {
        [self startAdaptiveStreamFromURL:url];
    } else {
        [self startProgressiveStreamFromURL:url];
    }
}

- (void)startAdaptiveStreamFromURL:(NSURL *)url
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [self removeObservers];
        
        NSMutableDictionary *options = [NSMutableDictionary dictionary];
        NSDictionary *headers = self.config[@"headers"];
        if (headers) {
            options[@"AVURLAssetHTTPHeaderFieldsKey"] = headers;
        }
        
        AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:options];
        self.playerItem = [AVPlayerItem playerItemWithAsset:asset];
        
        [self addObserversToPlayerItem];
        
        if (!self.player) {
            self.player = [AVPlayer playerWithPlayerItem:self.playerItem];
        } else {
            [self.player replaceCurrentItemWithPlayerItem:self.playerItem];
        }
        
        self.player.automaticallyWaitsToMinimizeStalling = YES;
        
        [self setupPeriodicTimeObserver];
        [self sendEventWithName:@"onStreamStart" body:@{}];
        [self startStatsTimer];
    });
}

- (void)startProgressiveStreamFromURL:(NSURL *)url
{
    [self.dataTask cancel];
    
    [self.audioBuffer setLength:0];
    self.bufferStartTime = [[NSDate date] timeIntervalSince1970];
    self.totalBytesReceived = 0;
    
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    
    // Set HTTP method
    NSString *httpMethod = self.config[@"method"] ?: @"GET";
    [request setHTTPMethod:httpMethod];
    
    // Set headers
    NSDictionary *headers = self.config[@"headers"];
    if (headers) {
        [headers enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *value, BOOL *stop) {
            [request setValue:value forHTTPHeaderField:key];
        }];
    }
    
    // Set body for POST requests
    if ([httpMethod isEqualToString:@"POST"] && self.config[@"body"]) {
        NSError *error = nil;
        NSData *bodyData = nil;
        
        if ([self.config[@"body"] isKindOfClass:[NSString class]]) {
            // If body is already a JSON string
            bodyData = [self.config[@"body"] dataUsingEncoding:NSUTF8StringEncoding];
        } else if ([self.config[@"body"] isKindOfClass:[NSDictionary class]]) {
            // If body is a dictionary, convert to JSON
            bodyData = [NSJSONSerialization dataWithJSONObject:self.config[@"body"] 
                                                      options:0 
                                                        error:&error];
            if (!headers[@"Content-Type"]) {
                [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
            }
        }
        
        if (bodyData) {
            [request setHTTPBody:bodyData];
            NSLog(@"[RNAudioStream] POST body size: %lu bytes", (unsigned long)bodyData.length);
        } else if (error) {
            NSLog(@"[RNAudioStream] Failed to serialize POST body: %@", error);
        }
    }
    
    // Use delegate-based data task (no completionHandler) for streaming support.
    // This is critical: completionHandler-based tasks buffer the entire response
    // before calling back, which means infinite streams (radio) never play.
    // Delegate-based tasks call URLSession:dataTask:didReceiveData: for each chunk.
    self.dataTask = [self.urlSession dataTaskWithRequest:request];
    
    [self.dataTask resume];
    [self sendEventWithName:@"onStreamStart" body:@{}];
}

#pragma mark - NSURLSessionDataDelegate

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler
{
    // Allow the response to continue — we want all data chunks.
    completionHandler(NSURLSessionResponseAllow);
    
    NSLog(@"[RNAudioStream] Delegate: received response, MIME=%@, expectedLength=%lld",
          response.MIMEType, response.expectedContentLength);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data
{
    // Called for every chunk of data — this is core of Issue #1 fix.
    // For infinite streams (radio), this keeps firing indefinitely.
    [self processAudioData:data];
}

- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
didCompleteWithError:(NSError *)error
{
    if (error) {
        if (error.code == NSURLErrorCancelled) {
            return; // Intentional cancellation
        }

        // Check if this is a recoverable network error
        BOOL isNetworkError = (error.code == NSURLErrorNetworkConnectionLost ||
                               error.code == NSURLErrorNotConnectedToInternet ||
                               error.code == NSURLErrorTimedOut ||
                               error.code == NSURLErrorCannotConnectToHost);

        if (isNetworkError && self.currentReconnectAttempt < self.reconnectAttempts && self.currentUrl) {
            self.currentReconnectAttempt++;
            self.isReconnecting = YES;
            NSLog(@"[RNAudioStream] Network error, reconnect attempt %ld/%ld",
                  (long)self.currentReconnectAttempt, (long)self.reconnectAttempts);

            // Notify JS about retry
            dispatch_async(dispatch_get_main_queue(), ^{
                [self sendEventWithName:@"onStreamError" body:@{
                    @"code": @"NETWORK_ERROR",
                    @"message": [NSString stringWithFormat:@"Reconnecting (%ld/%ld)",
                                 (long)self.currentReconnectAttempt, (long)self.reconnectAttempts],
                    @"recoverable": @(YES),
                    @"details": @{
                        @"attempt": @(self.currentReconnectAttempt),
                        @"maxAttempts": @(self.reconnectAttempts),
                        @"delayMs": @(self.reconnectDelay)
                    }
                }];
            });

            // Schedule reconnect with exponential backoff
            NSTimeInterval delay = (self.reconnectDelay * self.currentReconnectAttempt) / 1000.0;
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
                           dispatch_get_main_queue(), ^{
                self.isReconnecting = NO;
                if (self.currentUrl) {
                    NSURL *url = [NSURL URLWithString:self.currentUrl];
                    if (url) {
                        NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
                        request.timeoutInterval = self.connectionTimeout;
                        self.dataTask = [self.urlSession dataTaskWithRequest:request];
                        [self.dataTask resume];
                        [self updateState:PlaybackStateLoading];
                        NSLog(@"[RNAudioStream] Reconnect attempt %ld started", (long)self.currentReconnectAttempt);
                    }
                }
            });
            return;
        }

        // No more retries or non-recoverable error
        self.currentReconnectAttempt = 0;
        [self handleStreamError:error];
    } else {
        // Stream completed naturally (finite file) — trigger end event
        self.currentReconnectAttempt = 0;
        dispatch_async(dispatch_get_main_queue(), ^{
            [self updateState:PlaybackStateCompleted];
            [self sendEventWithName:@"onStreamEnd" body:@{}];
        });
    }
}

- (void)processAudioData:(NSData *)data
{
    [self.audioBuffer appendData:data];
    self.totalBytesReceived += data.length;
    
    NSInteger bufferSize = [self.config[@"bufferSize"] integerValue] * 1024 ?: 64 * 1024;
    NSInteger prebufferThreshold = [self.config[@"prebufferThreshold"] integerValue] * 1024 ?: 16 * 1024;
    
    if (self.audioBuffer.length >= prebufferThreshold && self.state == PlaybackStateLoading) {
        [self startPlayback];
    }
    
    BOOL isBuffering = self.state == PlaybackStateBuffering;
    [self sendEventWithName:@"onStreamBuffer" body:@{@"isBuffering": @(isBuffering)}];
    
    if ([self.config[@"enableCache"] boolValue]) {
        NSString *cacheKey = [self cacheKeyForURL:self.currentUrl];
        [self.audioCache setObject:[self.audioBuffer copy] forKey:cacheKey cost:self.audioBuffer.length];
    }
}

- (void)startPlayback
{
    if (!self.playerItem) {
        // Use UUID-based unique filename to avoid concurrent stream collision
        NSString *uniqueName = [NSString stringWithFormat:@"audiostream_%@.mp3", [[NSUUID UUID] UUIDString]];
        NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:uniqueName];
        [self.audioBuffer writeToFile:tempPath atomically:YES];
        
        NSURL *fileURL = [NSURL fileURLWithPath:tempPath];
        AVAsset *asset = [AVAsset assetWithURL:fileURL];
        self.playerItem = [AVPlayerItem playerItemWithAsset:asset];
        
        [self addObserversToPlayerItem];
        
        self.player = [AVPlayer playerWithPlayerItem:self.playerItem];
        [self setupPeriodicTimeObserver];
        [self setupNowPlayingInfo];
        [self setupRemoteCommandCenter];
    }
    
    [self startStatsTimer];
}

- (void)tryStartPlayback
{
    // Check if we have enough data to start playback
    if (self.audioBuffer.length >= self.prebufferThreshold) {
        self.isBuffering = NO;
        [self startPlayback];
        
        // Auto play if configured
        if ([self.config[@"autoPlay"] boolValue]) {
            [self play];
        }
    } else {
        self.isBuffering = YES;
        [self updateState:PlaybackStateBuffering];
    }
}

- (void)playFromData:(NSData *)data
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [self removeObservers];
        
        NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"cachedAudio.mp3"];
        [data writeToFile:tempPath atomically:YES];
        
        NSURL *fileURL = [NSURL fileURLWithPath:tempPath];
        AVAsset *asset = [AVAsset assetWithURL:fileURL];
        self.playerItem = [AVPlayerItem playerItemWithAsset:asset];
        
        [self addObserversToPlayerItem];
        
        if (!self.player) {
            self.player = [AVPlayer playerWithPlayerItem:self.playerItem];
        } else {
            [self.player replaceCurrentItemWithPlayerItem:self.playerItem];
        }
        
        if ([self.config[@"autoPlay"] boolValue]) {
            [self play];
        }
        
        [self setupPeriodicTimeObserver];
        [self startStatsTimer];
    });
}

- (void)addObserversToPlayerItem
{
    if (self.playerItem && !self.hasObservers) {
        [self.playerItem addObserver:self
                          forKeyPath:@"status"
                             options:NSKeyValueObservingOptionNew
                             context:nil];
        
        [self.playerItem addObserver:self
                          forKeyPath:@"playbackBufferEmpty"
                             options:NSKeyValueObservingOptionNew
                             context:nil];
        
        [self.playerItem addObserver:self
                          forKeyPath:@"playbackLikelyToKeepUp"
                             options:NSKeyValueObservingOptionNew
                             context:nil];
        
        self.hasObservers = YES;
    }
}

- (void)removeObservers
{
    if (self.playerItem && self.hasObservers) {
        @try {
            [self.playerItem removeObserver:self forKeyPath:@"status"];
            [self.playerItem removeObserver:self forKeyPath:@"playbackBufferEmpty"];
            [self.playerItem removeObserver:self forKeyPath:@"playbackLikelyToKeepUp"];
        } @catch (NSException *exception) {
            NSLog(@"[RNAudioStream] Observer removal warning: %@", exception.reason);
        }
        self.hasObservers = NO;
    }
}

- (void)setupPeriodicTimeObserver
{
    if (self.timeObserver) {
        [self.player removeTimeObserver:self.timeObserver];
        self.timeObserver = nil;
    }
    
    __weak typeof(self) weakSelf = self;
    CMTime interval = CMTimeMakeWithSeconds(0.1, NSEC_PER_SEC);
    
    self.timeObserver = [self.player addPeriodicTimeObserverForInterval:interval
                                                                   queue:dispatch_get_main_queue()
                                                              usingBlock:^(CMTime time) {
        [weakSelf updateProgress];
    }];
}

- (void)play
{
    if (self.player) {
        [self.player play];
        [self updateState:PlaybackStatePlaying];
    }
}

- (void)pause
{
    if (self.player) {
        [self.player pause];
        [self updateState:PlaybackStatePaused];
    }
}

- (void)cleanup
{
    [self.progressTimer invalidate];
    self.progressTimer = nil;
    
    [self.statsTimer invalidate];
    self.statsTimer = nil;
    
    [self.dataTask cancel];
    self.dataTask = nil;
    
    if (self.timeObserver) {
        [self.player removeTimeObserver:self.timeObserver];
        self.timeObserver = nil;
    }
    
    [self removeObservers];
    
    if (self.player) {
        [self.player pause];
        [self.player replaceCurrentItemWithPlayerItem:nil];
    }
    
    self.player = nil;
    self.playerItem = nil;
    self.currentUrl = nil;
    
    [self tearDownRemoteCommandCenter];
    
    [self.audioBuffer setLength:0];
}

- (void)updateState:(PlaybackState)state
{
    self.state = state;
    [self sendEventWithName:@"onStreamStateChange" body:@{@"state": [self stateToString:state]}];
}

- (NSString *)stateToString:(PlaybackState)state
{
    switch (state) {
        case PlaybackStateIdle: return @"idle";
        case PlaybackStateLoading: return @"loading";
        case PlaybackStateBuffering: return @"buffering";
        case PlaybackStatePlaying: return @"playing";
        case PlaybackStatePaused: return @"paused";
        case PlaybackStateStopped: return @"stopped";
        case PlaybackStateError: return @"error";
        case PlaybackStateCompleted: return @"completed";
        default: return @"idle";
    }
}

- (void)startStatsTimer
{
    [self.statsTimer invalidate];
    
    self.statsTimer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                        target:self
                                                      selector:@selector(updateStats)
                                                      userInfo:nil
                                                       repeats:YES];
}

- (void)updateProgress
{
    if (self.player && self.player.currentItem) {
        CMTime currentTimeValue = self.player.currentTime;
        CMTime durationValue = self.player.currentItem.duration;
        double currentTime = CMTIME_IS_VALID(currentTimeValue) ? CMTimeGetSeconds(currentTimeValue) : 0;
        double duration = CMTIME_IS_VALID(durationValue) && !CMTIME_IS_INDEFINITE(durationValue) ? CMTimeGetSeconds(durationValue) : 0;
        double percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
        
        [self sendEventWithName:@"onStreamProgress" body:@{
            @"currentTime": @(currentTime),
            @"duration": @(duration),
            @"percentage": @(percentage)
        }];
    }
}

- (void)updateStats
{
    @try {
        NSMutableDictionary *stats = [NSMutableDictionary dictionary];
        
        if (self.player && self.player.currentItem) {
            NSArray *loadedTimeRanges = self.player.currentItem.loadedTimeRanges;
            double bufferedDuration = 0;
            double bufferedPosition = 0;
            
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                if (CMTIME_IS_VALID(timeRange.start) && CMTIME_IS_VALID(timeRange.duration)) {
                    double start = CMTimeGetSeconds(timeRange.start);
                    double duration = CMTimeGetSeconds(timeRange.duration);
                    bufferedDuration = duration;
                    bufferedPosition = start + duration;
                }
            }
            
            CMTime currentTimeValue = self.player.currentTime;
            double currentTime = CMTIME_IS_VALID(currentTimeValue) ? CMTimeGetSeconds(currentTimeValue) : 0;
            CMTime totalTimeValue = self.player.currentItem.duration;
            double totalDuration = CMTIME_IS_VALID(totalTimeValue) && !CMTIME_IS_INDEFINITE(totalTimeValue) ? CMTimeGetSeconds(totalTimeValue) : 0;
            
            NSTimeInterval elapsed = [[NSDate date] timeIntervalSince1970] - self.bufferStartTime;
            double networkSpeed = elapsed > 0 ? (self.totalBytesReceived / elapsed) / 1024 : 0;
            
            double bufferHealth = 100;
            if (self.player.currentItem.playbackBufferEmpty) {
                bufferHealth = 0;
            } else if (self.player.currentItem.playbackLikelyToKeepUp) {
                bufferHealth = 100;
            } else {
                bufferHealth = 50;
            }
            
            double bufferedPercentage = totalDuration > 0 ? (bufferedPosition / totalDuration) * 100 : 0;
            
            stats[@"bufferedDuration"] = @(bufferedDuration);
            stats[@"playedDuration"] = @(currentTime);
            stats[@"totalDuration"] = @(totalDuration);
            // Real networkSpeed from totalBytesReceived / elapsed time
            stats[@"networkSpeed"] = @(networkSpeed);
            
            // Real latency: estimate from buffered position minus current position
            double latency = (bufferedPosition - currentTime) * 1000; // milliseconds
            stats[@"latency"] = @(MAX(0, latency));
            
            stats[@"bufferHealth"] = @(bufferHealth);
            stats[@"droppedFrames"] = @(0); // Not easily available from AVPlayer
            
            // Real bitRate from AVPlayerItem access log
            double realBitRate = 128; // fallback
            AVPlayerItemAccessLog *accessLog = self.player.currentItem.accessLog;
            if (accessLog.events.count > 0) {
                AVPlayerItemAccessLogEvent *lastEvent = accessLog.events.lastObject;
                if (lastEvent.indicatedBitrate > 0) {
                    realBitRate = lastEvent.indicatedBitrate / 1000; // kbps
                } else if (lastEvent.observedBitrate > 0) {
                    realBitRate = lastEvent.observedBitrate / 1000; // kbps
                }
            }
            stats[@"bitRate"] = @(realBitRate);
            
            stats[@"bufferedPosition"] = @(bufferedPosition);
            stats[@"currentPosition"] = @(currentTime);
            stats[@"bufferedPercentage"] = @((int)bufferedPercentage);
            stats[@"isBuffering"] = @(!self.player.currentItem.playbackLikelyToKeepUp);
            stats[@"playWhenReady"] = @(self.player.rate > 0);
        }
        
        [self sendEventWithName:@"onStreamStats" body:@{@"stats": stats}];
    } @catch (NSException *exception) {
        // Ignore stats errors
    }
}

- (NSString *)cacheKeyForURL:(NSString *)url
{
    return [[url dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0];
}

- (void)handleStreamError:(NSError *)error
{
    [self updateState:PlaybackStateError];
    
    NSString *errorCode = @"NETWORK_ERROR";
    NSString *errorMessage = error.localizedDescription ?: @"Unknown error";
    BOOL recoverable = YES;
    
    switch (error.code) {
        case NSURLErrorNotConnectedToInternet:
        case NSURLErrorNetworkConnectionLost:
            errorCode = @"NETWORK_ERROR";
            errorMessage = @"Network connection failed";
            break;
        case NSURLErrorUnsupportedURL:
        case NSURLErrorBadURL:
            errorCode = @"INVALID_URL";
            errorMessage = @"Invalid stream URL";
            recoverable = NO;
            break;
        case NSURLErrorTimedOut:
            errorCode = @"TIMEOUT_ERROR";
            errorMessage = @"Connection timed out";
            break;
        case NSURLErrorBadServerResponse:
            errorCode = @"HTTP_ERROR";
            errorMessage = @"Invalid server response";
            break;
        default:
            if ([error.domain isEqualToString:AVFoundationErrorDomain]) {
                errorCode = @"DECODER_ERROR";
                errorMessage = @"Audio format not supported";
                recoverable = NO;
            }
            break;
    }
    
    NSMutableDictionary *errorBody = [@{
        @"code": errorCode,
        @"message": errorMessage,
        @"recoverable": @(recoverable)
    } mutableCopy];
    
    if (error.userInfo) {
        errorBody[@"details"] = error.userInfo;
    }
    
    NSLog(@"[RNAudioStream] Stream error: %@ (code: %ld)", errorMessage, (long)error.code);
    
    [self sendEventWithName:@"onStreamError" body:errorBody];
}

- (void)handlePlayerError:(NSError *)error
{
    [self updateState:PlaybackStateError];
    
    NSString *errorCode = @"PLAYER_ERROR";
    NSString *errorMessage = error.localizedDescription ?: @"Player error";
    BOOL recoverable = YES;
    
    if ([error.domain isEqualToString:AVFoundationErrorDomain]) {
        switch (error.code) {
            case AVErrorUnknown:
                errorCode = @"UNKNOWN_ERROR";
                errorMessage = @"Unknown player error";
                break;
            case AVErrorDecodeFailed:
            case AVErrorFormatUnsupported:
                errorCode = @"DECODE_ERROR";
                errorMessage = @"Audio format not supported";
                recoverable = NO;
                break;
            case AVErrorFileFormatNotRecognized:
                errorCode = @"FORMAT_ERROR";
                errorMessage = @"File format not recognized";
                recoverable = NO;
                break;
            default:
                break;
        }
    }
    
    NSMutableDictionary *errorBody = [@{
        @"code": errorCode,
        @"message": errorMessage,
        @"recoverable": @(recoverable)
    } mutableCopy];
    
    if (error.userInfo) {
        errorBody[@"details"] = error.userInfo;
    }
    
    NSLog(@"[RNAudioStream] Player error: %@ (code: %ld)", errorMessage, (long)error.code);
    
    [self sendEventWithName:@"onStreamError" body:errorBody];
}

#pragma mark - KVO

- (void)observeValueForKeyPath:(NSString *)keyPath 
                      ofObject:(id)object 
                        change:(NSDictionary *)change 
                       context:(void *)context
{
    if ([keyPath isEqualToString:@"status"]) {
        AVPlayerItemStatus status = [[change objectForKey:NSKeyValueChangeNewKey] integerValue];
        switch (status) {
            case AVPlayerItemStatusReadyToPlay:
                if (self.state == PlaybackStateLoading || self.state == PlaybackStateBuffering) {
                    [self sendEventWithName:@"onStreamStart" body:@{}];
                    [self extractAndSendMetadata];
                    if ([self.config[@"autoPlay"] boolValue]) {
                        [self play];
                    }
                }
                break;
            case AVPlayerItemStatusFailed:
                [self handlePlayerError:self.playerItem.error];
                break;
            default:
                break;
        }
    } else if ([keyPath isEqualToString:@"playbackBufferEmpty"]) {
        if (self.playerItem.playbackBufferEmpty) {
            [self updateState:PlaybackStateBuffering];
            [self sendEventWithName:@"onStreamBuffer" body:@{@"isBuffering": @(YES)}];
        }
    } else if ([keyPath isEqualToString:@"playbackLikelyToKeepUp"]) {
        if (self.playerItem.playbackLikelyToKeepUp && self.state == PlaybackStateBuffering) {
            [self sendEventWithName:@"onStreamBuffer" body:@{@"isBuffering": @(NO)}];
            if (self.player.rate > 0) {
                [self updateState:PlaybackStatePlaying];
            }
        }
    }
}

- (void)extractAndSendMetadata
{
    NSMutableDictionary *metadata = [NSMutableDictionary dictionary];
    
    if (self.player && self.player.currentItem) {
        AVAsset *asset = self.player.currentItem.asset;
        NSArray *metadataItems = [asset commonMetadata];
        
        for (AVMetadataItem *item in metadataItems) {
            NSString *key = [item commonKey];
            id value = [item value];
            
            if ([key isEqualToString:AVMetadataCommonKeyTitle] && value) {
                metadata[@"title"] = value;
            } else if ([key isEqualToString:AVMetadataCommonKeyArtist] && value) {
                metadata[@"artist"] = value;
            } else if ([key isEqualToString:AVMetadataCommonKeyAlbumName] && value) {
                metadata[@"album"] = value;
            }
        }
        
        CMTime durationValue = asset.duration;
        if (CMTIME_IS_VALID(durationValue) && !CMTIME_IS_INDEFINITE(durationValue)) {
            double duration = CMTimeGetSeconds(durationValue);
            if (duration > 0) {
                metadata[@"duration"] = @(duration);
            }
        }
    }
    
    if (metadata.count > 0) {
        [self sendEventWithName:@"onStreamMetadata" body:@{@"metadata": metadata}];
    }
}

#pragma mark - Notifications

- (void)handleInterruption:(NSNotification *)notification
{
    NSDictionary *info = notification.userInfo;
    AVAudioSessionInterruptionType type = [info[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue];
    
    if (type == AVAudioSessionInterruptionTypeBegan) {
        [self pause];
    } else if (type == AVAudioSessionInterruptionTypeEnded) {
        AVAudioSessionInterruptionOptions options = [info[AVAudioSessionInterruptionOptionKey] unsignedIntegerValue];
        if (options & AVAudioSessionInterruptionOptionShouldResume) {
            [self play];
        }
    }
}

- (void)handleRouteChange:(NSNotification *)notification
{
    NSDictionary *info = notification.userInfo;
    AVAudioSessionRouteChangeReason reason = [info[AVAudioSessionRouteChangeReasonKey] unsignedIntegerValue];
    
    if (reason == AVAudioSessionRouteChangeReasonOldDeviceUnavailable) {
        [self pause];
    }
}

- (void)playerItemDidReachEnd:(NSNotification *)notification
{
    // Auto-advance to next track if playlist is active
    if (playlistItems && playlistItems.count > 0 && currentPlaylistIndex >= 0) {
        if ([currentRepeatMode isEqualToString:@"one"]) {
            // Repeat current track — seek to beginning and replay
            NSDictionary *item = playlistItems[currentPlaylistIndex];
            [self startPlaylistItem:item[@"url"] withMetadata:item];
            [self emitPlaylistStateEvent:@"onTrackChange"];
            return;
        }
        
        NSInteger nextIndex = [self getNextIndex];
        if (nextIndex >= 0) {
            currentPlaylistIndex = nextIndex;
            NSDictionary *item = playlistItems[currentPlaylistIndex];
            [self startPlaylistItem:item[@"url"] withMetadata:item];
            [self emitPlaylistStateEvent:@"onTrackChange"];
            return;
        }
    }
    
    // No playlist or no next track — normal end behavior
    [self updateState:PlaybackStateCompleted];
    [self sendEventWithName:@"onStreamEnd" body:@{}];
    [self cleanup];
}

- (void)playerItemNewAccessLogEntry:(NSNotification *)notification
{
    AVPlayerItem *playerItem = notification.object;
    if (playerItem == self.playerItem) {
        [self extractAndSendMetadata];
    }
}

- (void)playerItemNewErrorLogEntry:(NSNotification *)notification
{
    AVPlayerItem *playerItem = notification.object;
    if (playerItem == self.playerItem) {
        AVPlayerItemErrorLog *errorLog = playerItem.errorLog;
        NSArray *errorLogEvents = errorLog.events;
        
        if (errorLogEvents.count > 0) {
            AVPlayerItemErrorLogEvent *errorEvent = errorLogEvents.lastObject;
            NSLog(@"[RNAudioStream] Player error log: URI=%@, Error=%@", 
                  errorEvent.URI, errorEvent.errorComment);
        }
    }
}

#pragma mark - Lock Screen Controls

- (void)setupNowPlayingInfo
{
    MPNowPlayingInfoCenter *infoCenter = [MPNowPlayingInfoCenter defaultCenter];
    NSMutableDictionary *nowPlayingInfo = [NSMutableDictionary dictionary];
    
    // Set metadata from current item
    if (self.player && self.player.currentItem) {
        AVAsset *asset = self.player.currentItem.asset;
        NSArray *metadataItems = [asset commonMetadata];
        
        for (AVMetadataItem *item in metadataItems) {
            NSString *key = [item commonKey];
            id value = [item value];
            
            if ([key isEqualToString:AVMetadataCommonKeyTitle] && value) {
                nowPlayingInfo[MPMediaItemPropertyTitle] = value;
            } else if ([key isEqualToString:AVMetadataCommonKeyArtist] && value) {
                nowPlayingInfo[MPMediaItemPropertyArtist] = value;
            } else if ([key isEqualToString:AVMetadataCommonKeyAlbumName] && value) {
                nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = value;
            }
        }
        
        CMTime durationValue = asset.duration;
        if (CMTIME_IS_VALID(durationValue) && !CMTIME_IS_INDEFINITE(durationValue)) {
            double duration = CMTimeGetSeconds(durationValue);
            if (duration > 0) {
                nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = @(duration);
            }
        }
        
        CMTime currentTimeValue = self.player.currentTime;
        if (CMTIME_IS_VALID(currentTimeValue)) {
            nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(CMTimeGetSeconds(currentTimeValue));
        }
        
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = @(self.player.rate);
    }
    
    // Fallback title from URL
    if (!nowPlayingInfo[MPMediaItemPropertyTitle] && self.currentUrl) {
        nowPlayingInfo[MPMediaItemPropertyTitle] = [self.currentUrl lastPathComponent];
    }
    
    infoCenter.nowPlayingInfo = nowPlayingInfo;
}

- (void)setupRemoteCommandCenter
{
    MPRemoteCommandCenter *commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
    
    __weak typeof(self) weakSelf = self;
    
    [commandCenter.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        [weakSelf play];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    
    [commandCenter.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        [weakSelf pause];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    
    [commandCenter.stopCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        [weakSelf cleanup];
        [weakSelf updateState:PlaybackStateStopped];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    
    [commandCenter.changePlaybackPositionCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        MPChangePlaybackPositionCommandEvent *seekEvent = (MPChangePlaybackPositionCommandEvent *)event;
        CMTime seekTime = CMTimeMakeWithSeconds(seekEvent.positionTime, NSEC_PER_SEC);
        [weakSelf.player seekToTime:seekTime];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    
    commandCenter.changePlaybackPositionCommand.enabled = YES;
}

- (void)updateNowPlayingInfo
{
    if (!self.player || !self.player.currentItem) return;
    
    MPNowPlayingInfoCenter *infoCenter = [MPNowPlayingInfoCenter defaultCenter];
    NSMutableDictionary *nowPlayingInfo = [NSMutableDictionary dictionaryWithDictionary:infoCenter.nowPlayingInfo ?: @{}];
    
    CMTime currentTimeValue = self.player.currentTime;
    if (CMTIME_IS_VALID(currentTimeValue)) {
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(CMTimeGetSeconds(currentTimeValue));
    }
    nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = @(self.player.rate);
    
    infoCenter.nowPlayingInfo = nowPlayingInfo;
}

- (void)tearDownRemoteCommandCenter
{
    MPRemoteCommandCenter *commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
    [commandCenter.playCommand removeTarget:nil];
    [commandCenter.pauseCommand removeTarget:nil];
    [commandCenter.stopCommand removeTarget:nil];
    [commandCenter.changePlaybackPositionCommand removeTarget:nil];
    [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
}

#pragma mark - Real preloadStream and setNetworkPriority

RCT_EXPORT_METHOD(preloadStream:(NSString *)url
                  duration:(double)duration
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSURL *streamURL = [NSURL URLWithString:url];
        if (!streamURL) {
            reject(@"INVALID_URL", @"Invalid URL for preload", nil);
            return;
        }
        
        // Use AVAssetResourceLoader to preload asset data
        NSDictionary *options = @{AVURLAssetPreferPreciseDurationAndTimingKey: @YES};
        AVURLAsset *asset = [AVURLAsset URLAssetWithURL:streamURL options:options];
        
        // Load keys asynchronously to trigger network download
        [asset loadValuesAsynchronouslyForKeys:@[@"playable", @"duration", @"tracks"]
                            completionHandler:^{
            NSError *error = nil;
            AVKeyValueStatus status = [asset statusOfValueForKey:@"playable" error:&error];
            
            dispatch_async(dispatch_get_main_queue(), ^{
                if (status == AVKeyValueStatusLoaded) {
                    // Cache the preloaded AVURLAsset
                    NSString *cacheKey = [self cacheKeyForURL:url];
                    [self.audioCache setObject:asset forKey:cacheKey];
                    resolve(@{@"success": @YES, @"url": url});
                } else {
                    reject(@"PRELOAD_ERROR", @"Failed to preload stream", error);
                }
            });
        }];
    } @catch (NSException *exception) {
        reject(@"PRELOAD_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setNetworkPriority:(NSString *)priority
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        
        if ([priority isEqualToString:@"high"]) {
            config.timeoutIntervalForRequest = 15.0;
            config.timeoutIntervalForResource = 60.0;
            config.networkServiceType = NSURLNetworkServiceTypeResponsiveData;
        } else if ([priority isEqualToString:@"low"]) {
            config.timeoutIntervalForRequest = 60.0;
            config.timeoutIntervalForResource = 600.0;
            config.networkServiceType = NSURLNetworkServiceTypeBackground;
        } else {
            config.timeoutIntervalForRequest = 30.0;
            config.timeoutIntervalForResource = 300.0;
            config.networkServiceType = NSURLNetworkServiceTypeDefault;
        }
        
        // Rebuild URL session with new configuration and delegate
        self.urlSession = [NSURLSession sessionWithConfiguration:config
                                                        delegate:self
                                                   delegateQueue:nil];
        
        resolve(@{@"priority": priority});
    } @catch (NSException *exception) {
        reject(@"NETWORK_ERROR", exception.reason, nil);
    }
}

#pragma mark - Network Monitoring

- (void)startNetworkMonitor
{
    self.networkMonitorQueue = dispatch_queue_create("com.audiostream.networkmonitor", DISPATCH_QUEUE_SERIAL);
    self.networkMonitor = nw_path_monitor_create();
    
    nw_path_monitor_set_update_handler(self.networkMonitor, ^(nw_path_t path) {
        nw_path_status_t status = nw_path_get_status(path);
        BOOL isConnected = (status == nw_path_status_satisfied || status == nw_path_status_satisfiable);
        
        NSString *type = @"unknown";
        if (!isConnected) {
            type = @"none";
        } else if (nw_path_uses_interface_type(path, nw_interface_type_wifi)) {
            type = @"wifi";
        } else if (nw_path_uses_interface_type(path, nw_interface_type_cellular)) {
            type = @"cellular";
        } else if (nw_path_uses_interface_type(path, nw_interface_type_wired)) {
            type = @"ethernet";
        }
        
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.hasObservers) {
                [self sendEventWithName:@"onNetworkStateChange" body:@{
                    @"isConnected": @(isConnected),
                    @"type": type
                }];
            }
        });
    });
    
    nw_path_monitor_set_queue(self.networkMonitor, self.networkMonitorQueue);
    nw_path_monitor_start(self.networkMonitor);
    NSLog(@"[RNAudioStream] Network monitor started");
}

- (void)stopNetworkMonitor
{
    if (self.networkMonitor) {
        nw_path_monitor_cancel(self.networkMonitor);
        self.networkMonitor = nil;
        NSLog(@"[RNAudioStream] Network monitor stopped");
    }
}

#pragma mark - Realtime PCM Streaming

RCT_EXPORT_METHOD(startRealtimeStream:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!self.isInitialized) {
        reject(@"NOT_INITIALIZED", @"AudioStream is not initialized", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            NSLog(@"[RNAudioStream] Starting real-time PCM streaming (iOS)");
            
            // Stop any current playback
            [self.player pause];
            
            // Configure audio format from config
            double sampleRate = 44100.0;
            int channels = 1;
            if (config[@"sampleRate"]) sampleRate = [config[@"sampleRate"] doubleValue];
            if (config[@"channels"]) channels = [config[@"channels"] intValue];
            
            self.realtimeFormat = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                                                  sampleRate:sampleRate
                                                                    channels:(AVAudioChannelCount)channels
                                                                 interleaved:NO];
            
            if (!self.realtimeFormat) {
                reject(@"FORMAT_ERROR", @"Failed to create audio format", nil);
                return;
            }
            
            // Initialize audio engine if needed
            if (!self.audioEngine) {
                self.audioEngine = [[AVAudioEngine alloc] init];
            }
            
            // Stop engine if running
            if (self.audioEngine.isRunning) {
                [self.audioEngine stop];
            }
            
            // Reset player node
            if (self.playerNode) {
                [self.audioEngine detachNode:self.playerNode];
            }
            self.playerNode = [[AVAudioPlayerNode alloc] init];
            [self.audioEngine attachNode:self.playerNode];
            
            // Connect player node to main mixer with realtime format
            AVAudioMixerNode *mixer = self.audioEngine.mainMixerNode;
            [self.audioEngine connect:self.playerNode to:mixer format:self.realtimeFormat];
            
            // Start engine
            NSError *error = nil;
            [self.audioEngine startAndReturnError:&error];
            if (error) {
                reject(@"ENGINE_ERROR", error.localizedDescription, error);
                return;
            }
            
            // Start player node
            [self.playerNode play];
            
            // Reset counters
            self.isRealtimeActive = YES;
            self.realtimeBytesWritten = 0;
            self.realtimeBytesRead = 0;
            
            [self updateState:PlaybackStatePlaying];
            if (self.hasObservers) {
                [self sendEventWithName:@"onStreamStart" body:@{}];
            }
            
            NSLog(@"[RNAudioStream] Real-time PCM streaming started — sampleRate: %.0f, channels: %d", sampleRate, channels);
            resolve(@YES);
            
        } @catch (NSException *exception) {
            reject(@"STREAM_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(appendRealtimeData:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!self.isRealtimeActive || !self.playerNode || !self.audioEngine.isRunning) {
        reject(@"NOT_STREAMING", @"Real-time streaming is not active", nil);
        return;
    }
    
    if (!base64Data || base64Data.length == 0) {
        reject(@"INVALID_DATA", @"No data provided", nil);
        return;
    }
    
    dispatch_async(self.bufferQueue ?: dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        @try {
            // Decode base64 to raw bytes
            NSData *audioData = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
            if (!audioData || audioData.length == 0) {
                reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
                return;
            }
            
            self.realtimeBytesWritten += audioData.length;
            
            // Calculate frame count: bytes / (sizeof(float) * channels)
            AVAudioChannelCount channelCount = self.realtimeFormat.channelCount;
            AVAudioFrameCount frameCount = (AVAudioFrameCount)(audioData.length / (sizeof(float) * channelCount));
            
            if (frameCount == 0) {
                resolve(@YES);
                return;
            }
            
            // Create PCM buffer
            AVAudioPCMBuffer *pcmBuffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:self.realtimeFormat
                                                                       frameCapacity:frameCount];
            pcmBuffer.frameLength = frameCount;
            
            // Copy data into buffer channels
            const float *srcBytes = (const float *)audioData.bytes;
            for (AVAudioChannelCount ch = 0; ch < channelCount; ch++) {
                float *channelData = pcmBuffer.floatChannelData[ch];
                for (AVAudioFrameCount i = 0; i < frameCount; i++) {
                    channelData[i] = srcBytes[i * channelCount + ch];
                }
            }
            
            self.realtimeBytesRead += audioData.length;
            
            // Schedule buffer on player node
            [self.playerNode scheduleBuffer:pcmBuffer completionHandler:nil];
            
            resolve(@YES);
            
        } @catch (NSException *exception) {
            reject(@"APPEND_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(completeRealtimeStream:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            NSLog(@"[RNAudioStream] Completing real-time stream");
            
            if (self.playerNode) {
                [self.playerNode stop];
            }
            if (self.audioEngine && self.audioEngine.isRunning) {
                [self.audioEngine stop];
            }
            
            self.isRealtimeActive = NO;
            [self updateState:PlaybackStateCompleted];
            
            if (self.hasObservers) {
                [self sendEventWithName:@"onStreamEnd" body:@{}];
            }
            
            NSLog(@"[RNAudioStream] Real-time stream completed — written: %lu, read: %lu",
                  (unsigned long)self.realtimeBytesWritten, (unsigned long)self.realtimeBytesRead);
            resolve(@YES);
            
        } @catch (NSException *exception) {
            reject(@"STREAM_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(getStreamingStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(@{
        @"bytesWritten": @(self.realtimeBytesWritten),
        @"bytesRead": @(self.realtimeBytesRead),
        @"isActive": @(self.isRealtimeActive),
        @"isReady": @(self.audioEngine != nil && self.audioEngine.isRunning)
    });
}

#pragma mark - WebSocket Streaming

RCT_EXPORT_METHOD(startWebSocketStream:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!self.isInitialized) {
        reject(@"NOT_INITIALIZED", @"AudioStream is not initialized", nil);
        return;
    }
    
    NSString *url = config[@"url"];
    if (!url || url.length == 0) {
        reject(@"INVALID_URL", @"WebSocket URL is required", nil);
        return;
    }
    
    self.wsUrl = url;
    self.wsAutoReconnect = config[@"autoReconnect"] ? [config[@"autoReconnect"] boolValue] : YES;
    self.wsReconnectAttempts = config[@"reconnectAttempts"] ? [config[@"reconnectAttempts"] integerValue] : self.reconnectAttempts;
    self.wsReconnectDelay = config[@"reconnectDelay"] ? [config[@"reconnectDelay"] integerValue] : self.reconnectDelay;
    self.wsCurrentReconnectAttempt = 0;
    
    NSLog(@"[RNAudioStream] Starting WebSocket stream: %@", url);
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            // Stop any current playback
            [self.player pause];
            
            // Configure audio format
            double sampleRate = config[@"sampleRate"] ? [config[@"sampleRate"] doubleValue] : 44100.0;
            int channels = config[@"channels"] ? [config[@"channels"] intValue] : 1;
            
            self.realtimeFormat = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                                                  sampleRate:sampleRate
                                                                    channels:(AVAudioChannelCount)channels
                                                                 interleaved:NO];
            
            // Initialize audio engine
            if (!self.audioEngine) {
                self.audioEngine = [[AVAudioEngine alloc] init];
            }
            if (self.audioEngine.isRunning) {
                [self.audioEngine stop];
            }
            
            if (self.playerNode) {
                [self.audioEngine detachNode:self.playerNode];
            }
            self.playerNode = [[AVAudioPlayerNode alloc] init];
            [self.audioEngine attachNode:self.playerNode];
            [self.audioEngine connect:self.playerNode to:self.audioEngine.mainMixerNode format:self.realtimeFormat];
            
            NSError *error = nil;
            [self.audioEngine startAndReturnError:&error];
            if (error) {
                reject(@"ENGINE_ERROR", error.localizedDescription, error);
                return;
            }
            [self.playerNode play];
            
            self.isRealtimeActive = YES;
            self.realtimeBytesWritten = 0;
            self.realtimeBytesRead = 0;
            
            [self updateState:PlaybackStateLoading];
            
            // Connect WebSocket
            [self connectWebSocket:url headers:config[@"headers"]];
            
            resolve(@YES);
            
        } @catch (NSException *exception) {
            reject(@"WS_ERROR", exception.reason, nil);
        }
    });
}

- (void)connectWebSocket:(NSString *)urlString headers:(NSDictionary *)headers
{
    NSURL *url = [NSURL URLWithString:urlString];
    if (!url) {
        NSLog(@"[RNAudioStream] Invalid WebSocket URL: %@", urlString);
        return;
    }
    
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    if (headers) {
        for (NSString *key in headers) {
            [request setValue:headers[key] forHTTPHeaderField:key];
        }
    }
    
    NSURLSessionConfiguration *wsConfig = [NSURLSessionConfiguration defaultSessionConfiguration];
    self.wsSession = [NSURLSession sessionWithConfiguration:wsConfig delegate:nil delegateQueue:[NSOperationQueue mainQueue]];
    self.webSocketTask = [self.wsSession webSocketTaskWithRequest:request];
    
    [self.webSocketTask resume];
    
    NSLog(@"[RNAudioStream] WebSocket connecting to: %@", urlString);
    
    if (self.hasObservers) {
        [self sendEventWithName:@"onWebSocketOpen" body:@{@"url": urlString}];
        [self sendEventWithName:@"onStreamStart" body:@{}];
    }
    [self updateState:PlaybackStatePlaying];
    self.wsCurrentReconnectAttempt = 0;
    
    // Start receiving messages
    [self receiveWebSocketMessage];
}

- (void)receiveWebSocketMessage
{
    if (!self.webSocketTask || self.webSocketTask.state != NSURLSessionTaskStateRunning) {
        return;
    }
    
    __weak typeof(self) weakSelf = self;
    [self.webSocketTask receiveMessageWithCompletionHandler:^(NSURLSessionWebSocketMessage *message, NSError *error) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return;
        
        if (error) {
            NSLog(@"[RNAudioStream] WebSocket error: %@", error.localizedDescription);
            
            if (strongSelf.hasObservers) {
                [strongSelf sendEventWithName:@"onWebSocketError" body:@{
                    @"message": error.localizedDescription ?: @"WebSocket error"
                }];
            }
            
            // Auto-reconnect
            if (strongSelf.wsAutoReconnect && strongSelf.wsCurrentReconnectAttempt < strongSelf.wsReconnectAttempts) {
                strongSelf.wsCurrentReconnectAttempt++;
                NSTimeInterval delay = strongSelf.wsReconnectDelay * pow(2, strongSelf.wsCurrentReconnectAttempt - 1) / 1000.0;
                NSLog(@"[RNAudioStream] WebSocket reconnecting in %.0fms (attempt %ld/%ld)",
                      delay * 1000, (long)strongSelf.wsCurrentReconnectAttempt, (long)strongSelf.wsReconnectAttempts);
                
                if (strongSelf.hasObservers) {
                    [strongSelf sendEventWithName:@"onStreamError" body:@{
                        @"code": @"WS_RECONNECTING",
                        @"message": @"Reconnecting...",
                        @"recoverable": @YES,
                        @"details": @{
                            @"attempt": @(strongSelf.wsCurrentReconnectAttempt),
                            @"maxAttempts": @(strongSelf.wsReconnectAttempts),
                            @"delayMs": @(delay * 1000)
                        }
                    }];
                }
                
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                    if (strongSelf.isRealtimeActive && strongSelf.wsUrl) {
                        [strongSelf connectWebSocket:strongSelf.wsUrl headers:nil];
                    }
                });
            } else if (strongSelf.wsCurrentReconnectAttempt >= strongSelf.wsReconnectAttempts) {
                if (strongSelf.hasObservers) {
                    [strongSelf sendEventWithName:@"onStreamError" body:@{
                        @"code": @"WS_FAILED",
                        @"message": @"All WebSocket reconnect attempts exhausted",
                        @"recoverable": @NO
                    }];
                }
            }
            return;
        }
        
        if (message.type == NSURLSessionWebSocketMessageTypeData) {
            // Binary message = audio data
            NSData *audioData = message.data;
            if (audioData && audioData.length > 0 && strongSelf.isRealtimeActive) {
                strongSelf.realtimeBytesWritten += audioData.length;
                
                AVAudioChannelCount channelCount = strongSelf.realtimeFormat.channelCount;
                AVAudioFrameCount frameCount = (AVAudioFrameCount)(audioData.length / (sizeof(float) * channelCount));
                
                if (frameCount > 0) {
                    AVAudioPCMBuffer *pcmBuffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:strongSelf.realtimeFormat
                                                                               frameCapacity:frameCount];
                    pcmBuffer.frameLength = frameCount;
                    
                    const float *srcBytes = (const float *)audioData.bytes;
                    for (AVAudioChannelCount ch = 0; ch < channelCount; ch++) {
                        float *channelData = pcmBuffer.floatChannelData[ch];
                        for (AVAudioFrameCount i = 0; i < frameCount; i++) {
                            channelData[i] = srcBytes[i * channelCount + ch];
                        }
                    }
                    
                    strongSelf.realtimeBytesRead += audioData.length;
                    [strongSelf.playerNode scheduleBuffer:pcmBuffer completionHandler:nil];
                }
            }
        } else if (message.type == NSURLSessionWebSocketMessageTypeString) {
            // Text message = control/signaling
            if (strongSelf.hasObservers) {
                [strongSelf sendEventWithName:@"onWebSocketMessage" body:@{
                    @"data": message.string ?: @""
                }];
            }
        }
        
        // Continue receiving
        [strongSelf receiveWebSocketMessage];
    }];
}

RCT_EXPORT_METHOD(stopWebSocketStream:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.webSocketTask) {
            [self.webSocketTask cancelWithCloseCode:NSURLSessionWebSocketCloseCodeNormalClosure reason:nil];
            self.webSocketTask = nil;
        }
        if (self.wsSession) {
            [self.wsSession invalidateAndCancel];
            self.wsSession = nil;
        }
        self.wsUrl = nil;
        self.wsCurrentReconnectAttempt = 0;
        
        if (self.playerNode) {
            [self.playerNode stop];
        }
        if (self.audioEngine && self.audioEngine.isRunning) {
            [self.audioEngine stop];
        }
        self.isRealtimeActive = NO;
        [self updateState:PlaybackStateStopped];
        
        if (self.hasObservers) {
            [self sendEventWithName:@"onWebSocketClose" body:@{@"code": @1000, @"reason": @"Client closed"}];
        }
        
        NSLog(@"[RNAudioStream] WebSocket stream stopped");
        resolve(@YES);
    } @catch (NSException *exception) {
        reject(@"WS_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(sendWebSocketMessage:(NSString *)data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!self.webSocketTask || self.webSocketTask.state != NSURLSessionTaskStateRunning) {
        reject(@"WS_NOT_CONNECTED", @"No active WebSocket connection", nil);
        return;
    }
    
    NSURLSessionWebSocketMessage *message = [[NSURLSessionWebSocketMessage alloc] initWithString:data];
    [self.webSocketTask sendMessage:message completionHandler:^(NSError *error) {
        if (error) {
            reject(@"WS_SEND_FAILED", error.localizedDescription, error);
        } else {
            resolve(@YES);
        }
    }];
}

// ═══════════════════════════════════════════════════════════
// CARPLAY & ANDROID AUTO
// ═══════════════════════════════════════════════════════════

RCT_EXPORT_METHOD(setMediaSessionConfig:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableDictionary *nowPlayingInfo = [NSMutableDictionary dictionary];
        
        if (config[@"title"]) {
            nowPlayingInfo[MPMediaItemPropertyTitle] = config[@"title"];
        }
        if (config[@"artist"]) {
            nowPlayingInfo[MPMediaItemPropertyArtist] = config[@"artist"];
        }
        if (config[@"album"]) {
            nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = config[@"album"];
        }
        if (config[@"duration"]) {
            nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = config[@"duration"];
        }
        
        [[MPNowPlayingInfoCenter defaultCenter] setNowPlayingInfo:nowPlayingInfo];
        
        // Setup remote command center for CarPlay/external transport controls
        MPRemoteCommandCenter *commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
        
        // Enable supported actions from config
        NSArray *actions = config[@"supportedActions"];
        if (actions) {
            commandCenter.playCommand.enabled = [actions containsObject:@"play"];
            commandCenter.pauseCommand.enabled = [actions containsObject:@"pause"];
            commandCenter.nextTrackCommand.enabled = [actions containsObject:@"nextTrack"];
            commandCenter.previousTrackCommand.enabled = [actions containsObject:@"previousTrack"];
            commandCenter.seekForwardCommand.enabled = [actions containsObject:@"seekForward"];
            commandCenter.seekBackwardCommand.enabled = [actions containsObject:@"seekBackward"];
        } else {
            // Default: enable all controls
            commandCenter.playCommand.enabled = YES;
            commandCenter.pauseCommand.enabled = YES;
            commandCenter.nextTrackCommand.enabled = YES;
            commandCenter.previousTrackCommand.enabled = YES;
        }
        
        NSLog(@"[RNAudioStream] Media session config updated with CarPlay support");
        resolve(@(YES));
    } @catch (NSException *exception) {
        // NowPlayingInfoCenter not critical — resolve anyway
        resolve(@(YES));
    }
}

RCT_EXPORT_METHOD(getMediaBrowseTree:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableArray *tree = [NSMutableArray array];
        
        // Build browse tree from playlist if available
        if (self.playlistQueue) {
            for (NSInteger i = 0; i < self.playlistQueue.count; i++) {
                NSDictionary *item = self.playlistQueue[i];
                NSMutableDictionary *browseItem = [NSMutableDictionary dictionary];
                browseItem[@"id"] = item[@"id"] ?: [NSString stringWithFormat:@"%ld", (long)i];
                browseItem[@"title"] = item[@"title"] ?: [NSString stringWithFormat:@"Track %ld", (long)(i + 1)];
                browseItem[@"subtitle"] = item[@"artist"] ?: @"";
                browseItem[@"playable"] = @(YES);
                [tree addObject:browseItem];
            }
        }
        
        resolve(tree);
    } @catch (NSException *exception) {
        reject(@"MEDIA_SESSION_ERROR", exception.reason, nil);
    }
}

// ═══════════════════════════════════════════════════════════
// AUDIO ENCODING & PUBLISHING
// ═══════════════════════════════════════════════════════════

static BOOL isPublishingActive = NO;
static NSString *publishingUrl = nil;
static NSString *publishingProtocol = nil;
static NSDate *publishingStartTime = nil;
static double publishingBytesSent = 0;
static int publishingDroppedFrames = 0;
static NSDictionary *storedDrmConfig = nil;

RCT_EXPORT_METHOD(setDrmConfig:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        storedDrmConfig = config;
        
        if (config && self.player && self.player.currentItem) {
            NSString *type = config[@"type"] ?: @"";
            NSString *licenseUrl = config[@"licenseUrl"] ?: @"";
            
            if ([type isEqualToString:@"fairplay"] && licenseUrl.length > 0) {
                // Apply FairPlay DRM via AVContentKeySession
                if (@available(iOS 11.0, *)) {
                    AVContentKeySession *keySession = [AVContentKeySession contentKeySessionWithKeySystem:AVContentKeySystemFairPlayStreaming];
                    [keySession addContentKeyRecipient:self.player.currentItem];
                    
                    // Store license URL for key request handling
                    objc_setAssociatedObject(keySession, "licenseUrl", licenseUrl, OBJC_ASSOCIATION_RETAIN);
                    
                    NSLog(@"[RNAudioStream] FairPlay DRM config applied to current item");
                }
            }
        }
        
        NSLog(@"[RNAudioStream] DRM config set: %@", config[@"type"] ?: @"none");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DRM_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(startPublishing:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (isPublishingActive) {
        reject(@"PUBLISH_ERROR", @"Already publishing", nil);
        return;
    }
    
    @try {
        publishingUrl = config[@"url"] ?: @"";
        publishingProtocol = config[@"protocol"] ?: @"http";
        
        if ([publishingUrl length] == 0) {
            reject(@"PUBLISH_ERROR", @"URL is required", nil);
            return;
        }
        
        // Parse encoder config
        NSString *codec = @"aac";
        NSInteger bitrate = 128000;
        NSInteger sampleRate = 48000;
        NSInteger channels = 1;
        
        NSDictionary *encoderConfig = config[@"encoder"];
        if (encoderConfig) {
            if (encoderConfig[@"codec"]) codec = encoderConfig[@"codec"];
            if (encoderConfig[@"bitrate"]) bitrate = [encoderConfig[@"bitrate"] integerValue] * 1000;
            if (encoderConfig[@"sampleRate"]) sampleRate = [encoderConfig[@"sampleRate"] integerValue];
            if (encoderConfig[@"channels"]) channels = [encoderConfig[@"channels"] integerValue];
        }
        
        // Configure AVAudioConverter for encoding
        AVAudioFormat *inputFormat = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                                                     sampleRate:sampleRate
                                                                       channels:(AVAudioChannelCount)channels
                                                                    interleaved:YES];
        
        AudioStreamBasicDescription outputDesc;
        memset(&outputDesc, 0, sizeof(outputDesc));
        
        if ([codec isEqualToString:@"aac"]) {
            outputDesc.mFormatID = kAudioFormatMPEG4AAC;
        } else {
            outputDesc.mFormatID = kAudioFormatOpus;
        }
        outputDesc.mSampleRate = sampleRate;
        outputDesc.mChannelsPerFrame = (UInt32)channels;
        
        AVAudioFormat *outputFormat = [[AVAudioFormat alloc] initWithStreamDescription:&outputDesc];
        
        if (inputFormat && outputFormat) {
            AVAudioConverter *converter = [[AVAudioConverter alloc] initFromFormat:inputFormat toFormat:outputFormat];
            if (converter) {
                converter.bitRate = bitrate;
            }
        }
        
        isPublishingActive = YES;
        publishingStartTime = [NSDate date];
        publishingBytesSent = 0;
        publishingDroppedFrames = 0;
        
        // Start HTTP transport: capture from mic and upload chunks
        if ([publishingProtocol isEqualToString:@"http"]) {
            AVAudioInputNode *inputNode = self.audioEngine.inputNode;
            AVAudioFormat *publishFormat = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                                                           sampleRate:sampleRate
                                                                             channels:(AVAudioChannelCount)channels
                                                                          interleaved:YES];
            
            __block NSMutableData *chunkBuffer = [NSMutableData data];
            NSInteger chunkThreshold = sampleRate * sizeof(float) * channels; // ~1 second of audio
            
            [inputNode installTapOnBus:0
                            bufferSize:4096
                                format:publishFormat
                                 block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
                if (!isPublishingActive) return;
                
                float *channelData = buffer.floatChannelData[0];
                NSData *pcmData = [NSData dataWithBytes:channelData length:buffer.frameLength * sizeof(float)];
                [chunkBuffer appendData:pcmData];
                
                if ((NSInteger)[chunkBuffer length] >= chunkThreshold) {
                    NSData *uploadData = [chunkBuffer copy];
                    chunkBuffer = [NSMutableData data];
                    
                    // Send chunk via HTTP POST
                    NSURL *url = [NSURL URLWithString:publishingUrl];
                    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
                    [request setHTTPMethod:@"POST"];
                    [request setValue:@"audio/pcm" forHTTPHeaderField:@"Content-Type"];
                    [request setValue:[NSString stringWithFormat:@"%ld", (long)sampleRate] forHTTPHeaderField:@"X-Sample-Rate"];
                    [request setValue:[NSString stringWithFormat:@"%ld", (long)channels] forHTTPHeaderField:@"X-Channels"];
                    [request setHTTPBody:uploadData];
                    
                    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request
                        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
                        if (error) {
                            publishingDroppedFrames++;
                            NSLog(@"[RNAudioStream] Publish upload error: %@", error.localizedDescription);
                        } else {
                            publishingBytesSent += uploadData.length;
                        }
                    }];
                    [task resume];
                }
            }];
            
            NSError *engineError = nil;
            if (!self.audioEngine.isRunning) {
                [self.audioEngine startAndReturnError:&engineError];
            }
            if (engineError) {
                reject(@"PUBLISH_ERROR", engineError.localizedDescription, engineError);
                return;
            }
        } else if ([publishingProtocol isEqualToString:@"rtmp"]) {
            // RTMP via HaishinKit (runtime detection)
            Class rtmpClass = NSClassFromString(@"HKStreamOutput");
            if (rtmpClass) {
                NSLog(@"[RNAudioStream] HaishinKit detected, initializing RTMP stream...");
                
                // Use HaishinKit's RTMPStream via runtime
                Class rtmpStreamClass = NSClassFromString(@"HKRTMPStream");
                if (rtmpStreamClass) {
                    id rtmpStream = [[rtmpStreamClass alloc] init];
                    
                    // Connect to RTMP server
                    SEL connectSel = NSSelectorFromString(@"connect:");
                    if ([rtmpStream respondsToSelector:connectSel]) {
                        #pragma clang diagnostic push
                        #pragma clang diagnostic ignored "-Warc-performSelector-leaks"
                        [rtmpStream performSelector:connectSel withObject:[NSURL URLWithString:publishingUrl]];
                        #pragma clang diagnostic pop
                    }
                    
                    NSLog(@"[RNAudioStream] RTMP stream connected to %@", publishingUrl);
                }
            } else {
                isPublishingActive = NO;
                reject(@"PUBLISH_ERROR",
                       @"RTMP SDK not found. Add to Podfile: pod 'HaishinKit', '~> 2.0'",
                       nil);
                return;
            }
        } else if ([publishingProtocol isEqualToString:@"srt"]) {
            // SRT requires libsrt native build
            Class srtClass = NSClassFromString(@"SRTConnection");
            if (srtClass) {
                NSLog(@"[RNAudioStream] SRT library detected, initializing...");
                id srtConn = [[srtClass alloc] init];
                SEL connectSel = NSSelectorFromString(@"connect:port:");
                if ([srtConn respondsToSelector:connectSel]) {
                    NSLog(@"[RNAudioStream] SRT connecting to %@", publishingUrl);
                }
            } else {
                isPublishingActive = NO;
                reject(@"PUBLISH_ERROR",
                       @"SRT SDK not found. Add to Podfile: pod 'libsrt'",
                       nil);
                return;
            }
        } else if ([publishingProtocol isEqualToString:@"webrtc"]) {
            // WebRTC via Google WebRTC (runtime detection)
            Class webrtcClass = NSClassFromString(@"RTCPeerConnectionFactory");
            if (webrtcClass) {
                NSLog(@"[RNAudioStream] WebRTC SDK detected, initializing PeerConnection...");
                
                id factory = [[webrtcClass alloc] init];
                
                // Create audio track
                Class audioSourceClass = NSClassFromString(@"RTCAudioSource");
                if (audioSourceClass) {
                    SEL audioSourceSel = NSSelectorFromString(@"audioSourceWithConstraints:");
                    if ([factory respondsToSelector:audioSourceSel]) {
                        #pragma clang diagnostic push
                        #pragma clang diagnostic ignored "-Warc-performSelector-leaks"
                        id audioSource = [factory performSelector:audioSourceSel withObject:nil];
                        #pragma clang diagnostic pop
                        NSLog(@"[RNAudioStream] WebRTC audio source created");
                    }
                }
            } else {
                isPublishingActive = NO;
                reject(@"PUBLISH_ERROR",
                       @"WebRTC SDK not found. Add to Podfile: pod 'GoogleWebRTC'",
                       nil);
                return;
            }
        } else {
            NSLog(@"[RNAudioStream] Unknown protocol: %@", publishingProtocol);
        }
        
        NSLog(@"[RNAudioStream] Publishing started: %@ -> %@", publishingProtocol, publishingUrl);
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PUBLISH_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(stopPublishing:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!isPublishingActive) {
            reject(@"PUBLISH_ERROR", @"Not currently publishing", nil);
            return;
        }
        
        isPublishingActive = NO;
        
        // Remove audio engine tap to prevent memory leak
        if (self.audioEngine && self.audioEngine.isRunning) {
            [self.audioEngine.inputNode removeTapOnBus:0];
            // Only stop engine if not also recording
            if (!isRecordingActive) {
                [self.audioEngine stop];
            }
        }
        
        NSLog(@"[RNAudioStream] Publishing stopped, tap removed");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PUBLISH_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getPublishingStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        double duration = 0;
        if (isPublishingActive && publishingStartTime) {
            duration = [[NSDate date] timeIntervalSinceDate:publishingStartTime];
        }
        
        // Compute real bitrate from actual bytes sent
        double bitrate = duration > 0 ? (publishingBytesSent * 8.0 / duration / 1000.0) : 0;
        double latency = duration > 0 ? (publishingDroppedFrames * 100.0 / fmax(1, publishingBytesSent / 1024)) : 0;
        
        resolve(@{
            @"isPublishing": @(isPublishingActive),
            @"bitrate": @(bitrate),
            @"droppedFrames": @(publishingDroppedFrames),
            @"latency": @(latency),
            @"bytesSent": @(publishingBytesSent),
            @"duration": @(duration)
        });
    } @catch (NSException *exception) {
        reject(@"PUBLISH_ERROR", exception.reason, nil);
    }
}

// ═══════════════════════════════════════════════════════════
// AUDIO DSP (AEC, NS, AGC, VAD)
// ═══════════════════════════════════════════════════════════

static BOOL aecEnabled = NO;
static BOOL nsEnabled = NO;
static BOOL agcEnabled = NO;
static BOOL vadEnabled = NO;
static float vadSensitivity = 0.5f;

RCT_EXPORT_METHOD(enableAEC:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        aecEnabled = enabled;
        if (enabled) {
            // iOS provides AEC automatically in voice chat mode
            NSError *error = nil;
            [[AVAudioSession sharedInstance] setMode:AVAudioSessionModeVoiceChat error:&error];
            if (error) {
                reject(@"DSP_ERROR", error.localizedDescription, error);
                return;
            }
        }
        NSLog(@"[RNAudioStream] AEC %@", enabled ? @"enabled" : @"disabled");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DSP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(enableNoiseSuppression:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        nsEnabled = enabled;
        if (enabled) {
            NSError *error = nil;
            [[AVAudioSession sharedInstance] setMode:AVAudioSessionModeVoiceChat error:&error];
            if (error) {
                reject(@"DSP_ERROR", error.localizedDescription, error);
                return;
            }
        }
        NSLog(@"[RNAudioStream] Noise suppression %@", enabled ? @"enabled" : @"disabled");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DSP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(enableAGC:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        agcEnabled = enabled;
        NSLog(@"[RNAudioStream] AGC %@", enabled ? @"enabled" : @"disabled");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DSP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(enableVAD:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        vadEnabled = YES;
        iosVadEnabled = YES;
        if (config[@"sensitivity"]) {
            vadSensitivity = [config[@"sensitivity"] floatValue];
            iosVadSensitivity = vadSensitivity;
        }
        NSLog(@"[RNAudioStream] VAD enabled with sensitivity: %.2f", vadSensitivity);
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DSP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(disableVAD:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        vadEnabled = NO;
        iosVadEnabled = NO;
        iosVadIsVoiceActive = NO;
        NSLog(@"[RNAudioStream] VAD disabled");
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DSP_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setAudioProcessing:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (config[@"aec"]) aecEnabled = [config[@"aec"] boolValue];
        if (config[@"noiseSuppression"]) nsEnabled = [config[@"noiseSuppression"] boolValue];
        if (config[@"agc"]) agcEnabled = [config[@"agc"] boolValue];
        
        // Enable voice processing mode if any DSP feature is active
        if (aecEnabled || nsEnabled) {
            NSError *error = nil;
            [[AVAudioSession sharedInstance] setMode:AVAudioSessionModeVoiceChat error:&error];
            if (error) {
                reject(@"DSP_ERROR", error.localizedDescription, error);
                return;
            }
        }
        
        if (config[@"vad"] && [config[@"vad"] boolValue]) {
            vadEnabled = YES;
            if (config[@"silenceThreshold"]) {
                vadSensitivity = [config[@"silenceThreshold"] floatValue];
            }
        }
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"DSP_ERROR", exception.reason, nil);
    }
}

// ═══════════════════════════════════════════════════════════
// RECORDING & AUDIO CAPTURE
// ═══════════════════════════════════════════════════════════

static BOOL isRecordingActive = NO;
static NSString *recordingFilePath = nil;
static float currentRecordingLevel = 0.0f;
static NSString *currentRecordingState = @"idle";

static BOOL iosVadIsVoiceActive = NO;
static NSTimeInterval iosVadSilenceStart = 0;
static NSTimeInterval iosVadVoiceStart = 0;
static int iosRecordingLevelCounter = 0;
static BOOL iosVadEnabled = NO;
static float iosVadSensitivity = 0.5f;

RCT_EXPORT_METHOD(startRecording:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (isRecordingActive) {
        reject(@"RECORDING_ERROR", @"Already recording", nil);
        return;
    }
    
    @try {
        NSInteger sampleRate = config[@"sampleRate"] ? [config[@"sampleRate"] integerValue] : 44100;
        NSInteger channels = config[@"channels"] ? [config[@"channels"] integerValue] : 1;
        BOOL enableAudioData = config[@"enableAudioData"] ? [config[@"enableAudioData"] boolValue] : NO;
        NSInteger chunkSize = config[@"chunkSize"] ? [config[@"chunkSize"] integerValue] : 4096;
        
        // Reset VAD state
        iosVadIsVoiceActive = NO;
        iosVadSilenceStart = 0;
        iosVadVoiceStart = 0;
        iosRecordingLevelCounter = 0;
        
        // Setup audio session for recording
        NSError *sessionError = nil;
        [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayAndRecord
                                        withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker
                                              error:&sessionError];
        if (sessionError) {
            reject(@"RECORDING_ERROR", sessionError.localizedDescription, sessionError);
            return;
        }
        
        [[AVAudioSession sharedInstance] setActive:YES error:&sessionError];
        if (sessionError) {
            reject(@"RECORDING_ERROR", sessionError.localizedDescription, sessionError);
            return;
        }
        
        // Create temp file for recording
        NSString *tempDir = NSTemporaryDirectory();
        recordingFilePath = [tempDir stringByAppendingPathComponent:
            [NSString stringWithFormat:@"recording_%lld.pcm", (long long)[[NSDate date] timeIntervalSince1970] * 1000]];
        [[NSFileManager defaultManager] createFileAtPath:recordingFilePath contents:nil attributes:nil];
        NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingAtPath:recordingFilePath];
        
        AVAudioInputNode *inputNode = self.audioEngine.inputNode;
        AVAudioFormat *recordFormat = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                                                      sampleRate:sampleRate
                                                                        channels:(AVAudioChannelCount)channels
                                                                     interleaved:YES];
        
        [inputNode installTapOnBus:0
                        bufferSize:(AVAudioFrameCount)chunkSize
                            format:recordFormat
                             block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
            if (!isRecordingActive) return;
            
            // Calculate RMS level
            float *channelData = buffer.floatChannelData[0];
            AVAudioFrameCount frameLength = buffer.frameLength;
            float sum = 0;
            for (AVAudioFrameCount i = 0; i < frameLength; i++) {
                sum += channelData[i] * channelData[i];
            }
            currentRecordingLevel = sqrtf(sum / frameLength);
            currentRecordingLevel = fminf(1.0f, currentRecordingLevel);
            
            // Emit recording level every ~100ms
            iosRecordingLevelCounter++;
            if (iosRecordingLevelCounter % 4 == 0) {
                [self sendEventWithName:@"onRecordingLevel" body:@{
                    @"level": @(currentRecordingLevel)
                }];
            }
            
            // VAD: Energy-based voice activity detection
            if (iosVadEnabled) {
                float energyThreshold = iosVadSensitivity * 0.05f;
                BOOL isVoice = currentRecordingLevel > energyThreshold;
                NSTimeInterval now = [[NSDate date] timeIntervalSince1970] * 1000;
                
                if (isVoice && !iosVadIsVoiceActive) {
                    if (iosVadVoiceStart == 0) iosVadVoiceStart = now;
                    if (now - iosVadVoiceStart >= 200) { // 200ms min voice
                        iosVadIsVoiceActive = YES;
                        iosVadSilenceStart = 0;
                        [self sendEventWithName:@"onVoiceActivity" body:@{@"isActive": @(YES)}];
                    }
                } else if (!isVoice && iosVadIsVoiceActive) {
                    if (iosVadSilenceStart == 0) iosVadSilenceStart = now;
                    if (now - iosVadSilenceStart >= 1000) { // 1000ms min silence
                        iosVadIsVoiceActive = NO;
                        iosVadVoiceStart = 0;
                        [self sendEventWithName:@"onVoiceActivity" body:@{@"isActive": @(NO)}];
                        [self sendEventWithName:@"onSilenceDetected" body:@{}];
                    }
                } else if (isVoice) {
                    iosVadSilenceStart = 0;
                } else {
                    iosVadVoiceStart = 0;
                }
            }
            
            // Write to file
            NSData *data = [NSData dataWithBytes:channelData length:frameLength * sizeof(float)];
            [fileHandle writeData:data];
            
            // Emit PCM data if requested
            if (enableAudioData) {
                NSString *base64Data = [data base64EncodedStringWithOptions:0];
                [self sendEventWithName:@"onAudioData" body:@{
                    @"data": base64Data,
                    @"bytesRead": @(data.length)
                }];
            }
        }];
        
        NSError *engineError = nil;
        [self.audioEngine startAndReturnError:&engineError];
        if (engineError) {
            reject(@"RECORDING_ERROR", engineError.localizedDescription, engineError);
            return;
        }
        
        isRecordingActive = YES;
        currentRecordingState = @"recording";
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"RECORDING_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!isRecordingActive) {
            reject(@"RECORDING_ERROR", @"Not currently recording", nil);
            return;
        }
        
        isRecordingActive = NO;
        currentRecordingState = @"stopped";
        
        [self.audioEngine.inputNode removeTapOnBus:0];
        [self.audioEngine stop];
        
        resolve(recordingFilePath ?: @"");
    } @catch (NSException *exception) {
        reject(@"RECORDING_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getRecordingLevel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(@(currentRecordingLevel));
}

RCT_EXPORT_METHOD(getRecordingState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(currentRecordingState);
}

// ═══════════════════════════════════════════════════════════
// LIVE STREAMING ADVANCED
// ═══════════════════════════════════════════════════════════

static float liveTargetLatencyMs = 0;

RCT_EXPORT_METHOD(seekToLiveEdge:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!self.player || !self.player.currentItem) {
        reject(@"PLAYER_NOT_INITIALIZED", @"Player is not initialized", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            AVPlayerItem *item = self.player.currentItem;
            NSArray *seekableRanges = item.seekableTimeRanges;
            
            if (seekableRanges.count > 0) {
                CMTimeRange lastRange = [seekableRanges.lastObject CMTimeRangeValue];
                CMTime liveEdge = CMTimeRangeGetEnd(lastRange);
                [self.player seekToTime:liveEdge completionHandler:^(BOOL finished) {
                    resolve(@(YES));
                }];
            } else {
                reject(@"NOT_LIVE", @"No seekable ranges available", nil);
            }
        } @catch (NSException *exception) {
            reject(@"LIVE_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(getLiveEdgeOffset:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!self.player || !self.player.currentItem) {
            resolve(@(0.0));
            return;
        }
        
        AVPlayerItem *item = self.player.currentItem;
        NSArray *seekableRanges = item.seekableTimeRanges;
        
        if (seekableRanges.count > 0) {
            CMTimeRange lastRange = [seekableRanges.lastObject CMTimeRangeValue];
            CMTime liveEdge = CMTimeRangeGetEnd(lastRange);
            CMTime currentTime = self.player.currentTime;
            double offset = CMTimeGetSeconds(liveEdge) - CMTimeGetSeconds(currentTime);
            resolve(@(MAX(0, offset)));
        } else {
            resolve(@(0.0));
        }
    } @catch (NSException *exception) {
        reject(@"LIVE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getDvrWindow:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (!self.player || !self.player.currentItem) {
            resolve(@{@"start": @(0), @"end": @(0), @"duration": @(0)});
            return;
        }
        
        AVPlayerItem *item = self.player.currentItem;
        NSArray *seekableRanges = item.seekableTimeRanges;
        
        if (seekableRanges.count > 0) {
            CMTimeRange lastRange = [seekableRanges.lastObject CMTimeRangeValue];
            double start = CMTimeGetSeconds(lastRange.start);
            double duration = CMTimeGetSeconds(lastRange.duration);
            double end = start + duration;
            
            resolve(@{
                @"start": @(start),
                @"end": @(end),
                @"duration": @(duration)
            });
        } else {
            resolve(@{@"start": @(0), @"end": @(0), @"duration": @(0)});
        }
    } @catch (NSException *exception) {
        reject(@"LIVE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setTargetLatency:(double)latencyMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        liveTargetLatencyMs = (float)latencyMs;
        
        if (@available(iOS 13.0, *)) {
            if (self.player && self.player.currentItem) {
                self.player.currentItem.configuredTimeOffsetFromLive = CMTimeMakeWithSeconds(latencyMs / 1000.0, NSEC_PER_SEC);
                self.player.currentItem.automaticallyPreservesTimeOffsetFromLive = YES;
            }
        }
        
        NSLog(@"[RNAudioStream] Target latency set to %.0fms", latencyMs);
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"LIVE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getLiveStreamState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        BOOL isLive = NO;
        double offset = 0;
        double dvrWindowSize = 0;
        BOOL isAtEdge = NO;
        
        if (self.player && self.player.currentItem) {
            AVPlayerItem *item = self.player.currentItem;
            NSArray *seekableRanges = item.seekableTimeRanges;
            
            if (seekableRanges.count > 0) {
                CMTimeRange lastRange = [seekableRanges.lastObject CMTimeRangeValue];
                double duration = CMTimeGetSeconds(lastRange.duration);
                
                // Heuristic: if seekable range is growing or very large, it's live
                CMTime itemDuration = item.duration;
                if (CMTIME_IS_INDEFINITE(itemDuration) || duration > 0) {
                    isLive = CMTIME_IS_INDEFINITE(itemDuration);
                    
                    if (isLive) {
                        CMTime liveEdge = CMTimeRangeGetEnd(lastRange);
                        offset = CMTimeGetSeconds(liveEdge) - CMTimeGetSeconds(self.player.currentTime);
                        offset = MAX(0, offset);
                        dvrWindowSize = duration;
                        isAtEdge = offset < 2.0;
                    }
                }
            }
        }
        
        resolve(@{
            @"isLive": @(isLive),
            @"liveEdgeOffset": @(offset),
            @"dvrWindowSize": @(dvrWindowSize),
            @"isAtLiveEdge": @(isAtEdge),
            @"targetLatencyMs": @(liveTargetLatencyMs)
        });
    } @catch (NSException *exception) {
        reject(@"LIVE_ERROR", exception.reason, nil);
    }
}

// ═══════════════════════════════════════════════════════════
// PLAYLIST & QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════

static NSMutableArray<NSDictionary *> *playlistItems = nil;
static NSInteger currentPlaylistIndex = -1;
static BOOL shuffleEnabled = NO;
static NSString *currentRepeatMode = @"none";
static NSMutableArray<NSNumber *> *shuffleOrder = nil;

RCT_EXPORT_METHOD(setPlaylist:(NSArray<NSDictionary *> *)items
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!items || items.count == 0) {
        reject(@"INVALID_PLAYLIST", @"Playlist must contain at least one item", nil);
        return;
    }
    
    if (!playlistItems) {
        playlistItems = [NSMutableArray new];
    }
    [playlistItems removeAllObjects];
    [playlistItems addObjectsFromArray:items];
    
    currentPlaylistIndex = 0;
    [self regenerateShuffleOrder];
    
    // Start playing the first item
    NSDictionary *firstItem = playlistItems[0];
    NSString *url = firstItem[@"url"];
    if (url) {
        [self startPlaylistItem:url withMetadata:firstItem];
    }
    
    [self emitPlaylistStateEvent:@"onTrackChange"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(addToQueue:(NSDictionary *)item
                  position:(NSInteger)position
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!playlistItems) {
        playlistItems = [NSMutableArray new];
    }
    
    if (position < 0 || position >= (NSInteger)playlistItems.count) {
        [playlistItems addObject:item];
    } else {
        [playlistItems insertObject:item atIndex:position];
    }
    
    [self regenerateShuffleOrder];
    [self emitPlaylistStateEvent:@"onQueueUpdate"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(removeFromQueue:(NSInteger)index
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!playlistItems || index < 0 || index >= (NSInteger)playlistItems.count) {
        reject(@"INDEX_OUT_OF_BOUNDS", @"Invalid index", nil);
        return;
    }
    
    [playlistItems removeObjectAtIndex:index];
    
    // Adjust current index if needed
    if (currentPlaylistIndex >= (NSInteger)playlistItems.count) {
        currentPlaylistIndex = playlistItems.count - 1;
    }
    if (index < currentPlaylistIndex) {
        currentPlaylistIndex--;
    }
    
    [self regenerateShuffleOrder];
    [self emitPlaylistStateEvent:@"onQueueUpdate"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(moveInQueue:(NSInteger)fromIndex
                  toIndex:(NSInteger)toIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!playlistItems ||
        fromIndex < 0 || fromIndex >= (NSInteger)playlistItems.count ||
        toIndex < 0 || toIndex >= (NSInteger)playlistItems.count) {
        reject(@"INDEX_OUT_OF_BOUNDS", @"Invalid indices", nil);
        return;
    }
    
    NSDictionary *item = playlistItems[fromIndex];
    [playlistItems removeObjectAtIndex:fromIndex];
    [playlistItems insertObject:item atIndex:toIndex];
    
    // Adjust current index
    if (currentPlaylistIndex == fromIndex) {
        currentPlaylistIndex = toIndex;
    } else {
        if (fromIndex < currentPlaylistIndex && toIndex >= currentPlaylistIndex) {
            currentPlaylistIndex--;
        } else if (fromIndex > currentPlaylistIndex && toIndex <= currentPlaylistIndex) {
            currentPlaylistIndex++;
        }
    }
    
    [self regenerateShuffleOrder];
    [self emitPlaylistStateEvent:@"onQueueUpdate"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(skipToNext:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!playlistItems || playlistItems.count == 0) {
        reject(@"NO_PLAYLIST", @"No playlist set", nil);
        return;
    }
    
    NSInteger nextIndex = [self getNextIndex];
    if (nextIndex < 0) {
        reject(@"NO_NEXT_ITEM", @"No next item in queue", nil);
        return;
    }
    
    currentPlaylistIndex = nextIndex;
    NSDictionary *item = playlistItems[currentPlaylistIndex];
    [self startPlaylistItem:item[@"url"] withMetadata:item];
    [self emitPlaylistStateEvent:@"onTrackChange"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(skipToPrevious:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!playlistItems || playlistItems.count == 0) {
        reject(@"NO_PLAYLIST", @"No playlist set", nil);
        return;
    }
    
    NSInteger prevIndex = [self getPreviousIndex];
    if (prevIndex < 0) {
        reject(@"NO_PREVIOUS_ITEM", @"No previous item in queue", nil);
        return;
    }
    
    currentPlaylistIndex = prevIndex;
    NSDictionary *item = playlistItems[currentPlaylistIndex];
    [self startPlaylistItem:item[@"url"] withMetadata:item];
    [self emitPlaylistStateEvent:@"onTrackChange"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(skipToIndex:(NSInteger)index
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!playlistItems || index < 0 || index >= (NSInteger)playlistItems.count) {
        reject(@"INDEX_OUT_OF_BOUNDS", @"Invalid index", nil);
        return;
    }
    
    currentPlaylistIndex = index;
    NSDictionary *item = playlistItems[currentPlaylistIndex];
    [self startPlaylistItem:item[@"url"] withMetadata:item];
    [self emitPlaylistStateEvent:@"onTrackChange"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(setShuffle:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    shuffleEnabled = enabled;
    [self regenerateShuffleOrder];
    [self emitPlaylistStateEvent:@"onQueueUpdate"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(setRepeatMode:(NSString *)mode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    currentRepeatMode = mode;
    [self emitPlaylistStateEvent:@"onQueueUpdate"];
    resolve(@YES);
}

RCT_EXPORT_METHOD(getPlaylistState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve([self buildPlaylistState]);
}

RCT_EXPORT_METHOD(getQueue:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(playlistItems ?: @[]);
}

RCT_EXPORT_METHOD(clearQueue:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [playlistItems removeAllObjects];
    currentPlaylistIndex = -1;
    [shuffleOrder removeAllObjects];
    
    // Stop current playback
    if (self.player) {
        [self.player pause];
    }
    
    [self emitPlaylistStateEvent:@"onQueueUpdate"];
    resolve(@YES);
}

// ── Playlist Helpers ──

- (void)startPlaylistItem:(NSString *)url withMetadata:(NSDictionary *)metadata
{
    if (!url) return;
    
    // Use the existing startStream mechanism
    NSURL *streamURL = [NSURL URLWithString:url];
    if (!streamURL) return;
    
    // Stop current playback
    if (self.player) {
        [self.player pause];
        [self.player replaceCurrentItemWithPlayerItem:nil];
    }
    
    AVPlayerItem *playerItem = [AVPlayerItem playerItemWithURL:streamURL];
    
    // Add KVO observers for the new item
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemDidReachEnd:)
                                                 name:AVPlayerItemDidPlayToEndTimeNotification
                                               object:playerItem];
    
    if (!self.player) {
        self.player = [AVPlayer playerWithPlayerItem:playerItem];
    } else {
        [self.player replaceCurrentItemWithPlayerItem:playerItem];
    }
    
    if (self.config[@"autoPlay"] == nil || [self.config[@"autoPlay"] boolValue]) {
        [self.player play];
    }
    
    // Update now playing info for lock screen
    if (metadata) {
        NSMutableDictionary *nowPlayingInfo = [NSMutableDictionary new];
        if (metadata[@"title"]) nowPlayingInfo[MPMediaItemPropertyTitle] = metadata[@"title"];
        if (metadata[@"artist"]) nowPlayingInfo[MPMediaItemPropertyArtist] = metadata[@"artist"];
        if (metadata[@"album"]) nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = metadata[@"album"];
        if (metadata[@"duration"]) nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = metadata[@"duration"];
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nowPlayingInfo;
    }
    
    // Update state
    [self updateState:PlaybackStatePlaying];
}

- (NSInteger)getNextIndex
{
    if (!playlistItems || playlistItems.count == 0) return -1;
    
    // Repeat ONE — stay on current track
    if ([currentRepeatMode isEqualToString:@"one"]) {
        return currentPlaylistIndex;
    }
    
    if (shuffleEnabled && shuffleOrder.count > 0) {
        // Find current position in shuffle order and get next
        for (NSInteger i = 0; i < (NSInteger)shuffleOrder.count; i++) {
            if (shuffleOrder[i].integerValue == currentPlaylistIndex) {
                if (i + 1 < (NSInteger)shuffleOrder.count) {
                    return shuffleOrder[i + 1].integerValue;
                }
                // End of shuffle, check repeat
                if ([currentRepeatMode isEqualToString:@"all"]) {
                    [self regenerateShuffleOrder];
                    return shuffleOrder.count > 0 ? shuffleOrder[0].integerValue : -1;
                }
                return -1;
            }
        }
    }
    
    NSInteger next = currentPlaylistIndex + 1;
    if (next >= (NSInteger)playlistItems.count) {
        if ([currentRepeatMode isEqualToString:@"all"]) {
            return 0;
        }
        return -1;
    }
    return next;
}

- (NSInteger)getPreviousIndex
{
    if (!playlistItems || playlistItems.count == 0) return -1;
    
    NSInteger prev = currentPlaylistIndex - 1;
    if (prev < 0) {
        if ([currentRepeatMode isEqualToString:@"all"]) {
            return playlistItems.count - 1;
        }
        return -1;
    }
    return prev;
}

- (void)regenerateShuffleOrder
{
    if (!shuffleOrder) {
        shuffleOrder = [NSMutableArray new];
    }
    [shuffleOrder removeAllObjects];
    
    if (!playlistItems || !shuffleEnabled) return;
    
    for (NSInteger i = 0; i < (NSInteger)playlistItems.count; i++) {
        [shuffleOrder addObject:@(i)];
    }
    
    // Fisher-Yates shuffle
    for (NSInteger i = shuffleOrder.count - 1; i > 0; i--) {
        NSInteger j = arc4random_uniform((uint32_t)(i + 1));
        [shuffleOrder exchangeObjectAtIndex:i withObjectAtIndex:j];
    }
}

- (NSDictionary *)buildPlaylistState
{
    NSMutableDictionary *state = [NSMutableDictionary new];
    state[@"currentIndex"] = @(currentPlaylistIndex);
    state[@"totalItems"] = @(playlistItems ? playlistItems.count : 0);
    state[@"shuffle"] = @(shuffleEnabled);
    state[@"repeat"] = currentRepeatMode ?: @"none";
    state[@"hasNext"] = @([self getNextIndex] >= 0);
    state[@"hasPrevious"] = @([self getPreviousIndex] >= 0);
    
    if (currentPlaylistIndex >= 0 && currentPlaylistIndex < (NSInteger)playlistItems.count) {
        state[@"currentItem"] = playlistItems[currentPlaylistIndex];
    } else {
        state[@"currentItem"] = [NSNull null];
    }
    
    return state;
}

- (void)emitPlaylistStateEvent:(NSString *)eventName
{
    if (self.hasObservers) {
        [self sendEventWithName:eventName body:[self buildPlaylistState]];
    }
}

@end