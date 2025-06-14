#import "RNAudioStream.h"
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>
#import <MediaPlayer/MediaPlayer.h>
#import <React/RCTLog.h>
#import <React/RCTConvert.h>

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

@interface RNAudioStream () <AVAudioPlayerDelegate>

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
        @"onNetworkStateChange"
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
        
        // Setup URL session
        NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
        configuration.timeoutIntervalForRequest = 30.0;
        configuration.timeoutIntervalForResource = 300.0;
        self.urlSession = [NSURLSession sessionWithConfiguration:configuration
                                                        delegate:nil
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
        
        // Get audio session instance
        AVAudioSession *audioSession = [AVAudioSession sharedInstance];
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
        
        // Step 6: Configure options based on requirements
        AVAudioSessionCategoryOptions options = 0;
        
        if ([self.config[@"enableBackgroundMode"] boolValue]) {
            // Build options incrementally for iOS 18
            if (@available(iOS 9.0, *)) {
                if (needsRecording) {
                    // For recording, use minimal options
                    options = AVAudioSessionCategoryOptionAllowBluetooth;
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
            [self.player pause];
            [self.player replaceCurrentItemWithPlayerItem:nil];
            
            [self.progressTimer invalidate];
            self.progressTimer = nil;
            
            [self.statsTimer invalidate];
            self.statsTimer = nil;
            
            [self.dataTask cancel];
            self.dataTask = nil;
            
            self.currentUrl = nil;
            [self updateState:PlaybackStateIdle];
        });
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"CANCEL_ERROR", @"Failed to cancel stream", nil);
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
        double percentage = 0;
        if (self.player && self.player.currentItem) {
            NSArray *loadedTimeRanges = self.player.currentItem.loadedTimeRanges;
            CMTime duration = self.player.currentItem.duration;
            
            if (loadedTimeRanges.count > 0 && CMTIME_IS_VALID(duration) && !CMTIME_IS_INDEFINITE(duration)) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                double bufferedDuration = CMTimeGetSeconds(CMTimeAdd(timeRange.start, timeRange.duration));
                double totalDuration = CMTimeGetSeconds(duration);
                percentage = totalDuration > 0 ? (bufferedDuration / totalDuration) * 100 : 0;
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
    // TODO: Implement preloading logic
    resolve(@(YES));
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

// Required for NativeEventEmitter
RCT_EXPORT_METHOD(addListener:(NSString *)eventName)
{
    // Required for NativeEventEmitter
}

RCT_EXPORT_METHOD(removeListeners:(double)count)
{
    // Required for NativeEventEmitter
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
    NSDictionary *headers = self.config[@"headers"];
    if (headers) {
        [headers enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *value, BOOL *stop) {
            [request setValue:value forHTTPHeaderField:key];
        }];
    }
    
    __weak typeof(self) weakSelf = self;
    
    self.dataTask = [self.urlSession dataTaskWithRequest:request
                                        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
            [weakSelf handleStreamError:error];
            return;
        }
        
        if (data) {
            [weakSelf processAudioData:data];
        }
    }];
    
    [self.dataTask resume];
    [self sendEventWithName:@"onStreamStart" body:@{}];
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
        NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"tempAudio.mp3"];
        [self.audioBuffer writeToFile:tempPath atomically:YES];
        
        NSURL *fileURL = [NSURL fileURLWithPath:tempPath];
        AVAsset *asset = [AVAsset assetWithURL:fileURL];
        self.playerItem = [AVPlayerItem playerItemWithAsset:asset];
        
        [self addObserversToPlayerItem];
        
        self.player = [AVPlayer playerWithPlayerItem:self.playerItem];
        [self setupPeriodicTimeObserver];
    }
    
    [self startStatsTimer];
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
            stats[@"networkSpeed"] = @(networkSpeed);
            stats[@"latency"] = @(0);
            stats[@"bufferHealth"] = @(bufferHealth);
            stats[@"droppedFrames"] = @(0);
            stats[@"bitRate"] = @(128);
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

@end 