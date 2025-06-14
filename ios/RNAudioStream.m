#import "RNAudioStream.h"
#import <AVFoundation/AVFoundation.h>
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
    [self cleanup];
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

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
}

#pragma mark - RCT Methods

RCT_EXPORT_METHOD(initialize:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        self.config = config;
        
        // Configure audio session
        self.audioSession = [AVAudioSession sharedInstance];
        NSError *error = nil;
        
        AVAudioSessionCategory category = AVAudioSessionCategoryPlayback;
        AVAudioSessionCategoryOptions options = AVAudioSessionCategoryOptionMixWithOthers;
        
        if ([config[@"enableBackgroundMode"] boolValue]) {
            options |= AVAudioSessionCategoryOptionAllowAirPlay;
            options |= AVAudioSessionCategoryOptionAllowBluetooth;
            options |= AVAudioSessionCategoryOptionAllowBluetoothA2DP;
        }
        
        [self.audioSession setCategory:category
                           withOptions:options
                                 error:&error];
        
        if (error) {
            reject(@"INITIALIZATION_ERROR", @"Failed to configure audio session", error);
            return;
        }
        
        [self.audioSession setActive:YES error:&error];
        
        if (error) {
            reject(@"INITIALIZATION_ERROR", @"Failed to activate audio session", error);
            return;
        }
        
        self.isInitialized = YES;
        resolve(@(YES));
    } @catch (NSException *exception) {
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
            reject(@"INVALID_STATE", @"AudioStream not initialized", nil);
            return;
        }
        
        self.currentUrl = url;
        self.config = config ?: self.config;
        
        [self updateState:PlaybackStateLoading];
        
        // Check cache first
        NSString *cacheKey = [self cacheKeyForURL:url];
        NSData *cachedData = [self.audioCache objectForKey:cacheKey];
        
        if (cachedData && [config[@"enableCache"] boolValue]) {
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

- (void)startStreamingFromURL:(NSURL *)url
{
    // Cancel any existing task
    [self.dataTask cancel];
    
    // Reset buffer
    [self.audioBuffer setLength:0];
    self.bufferStartTime = [[NSDate date] timeIntervalSince1970];
    self.totalBytesReceived = 0;
    
    // Create request with headers
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
    
    // Emit buffer event
    BOOL isBuffering = self.state == PlaybackStateBuffering;
    [self sendEventWithName:@"onStreamBuffer" body:@{@"isBuffering": @(isBuffering)}];
    
    // Cache if enabled
    if ([self.config[@"enableCache"] boolValue]) {
        NSString *cacheKey = [self cacheKeyForURL:self.currentUrl];
        [self.audioCache setObject:[self.audioBuffer copy] forKey:cacheKey cost:self.audioBuffer.length];
    }
}

- (void)startPlayback
{
    if (!self.playerItem) {
        // Create AVAsset from buffer
        NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"tempAudio.mp3"];
        [self.audioBuffer writeToFile:tempPath atomically:YES];
        
        NSURL *fileURL = [NSURL fileURLWithPath:tempPath];
        AVAsset *asset = [AVAsset assetWithURL:fileURL];
        self.playerItem = [AVPlayerItem playerItemWithAsset:asset];
        
        // Add observers
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
        
        // Create player
        self.player = [AVPlayer playerWithPlayerItem:self.playerItem];
        
        if ([self.config[@"autoPlay"] boolValue]) {
            [self play];
        }
    }
    
    [self updateState:PlaybackStatePlaying];
    [self startProgressTimer];
    [self startStatsTimer];
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
        [self cleanup];
        [self updateState:PlaybackStateIdle];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"CANCEL_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(play:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            [self.player play];
            [self updateState:PlaybackStatePlaying];
        }
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PLAY_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (self.player) {
            [self.player pause];
            [self updateState:PlaybackStatePaused];
        }
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
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                double startSeconds = CMTIME_IS_VALID(timeRange.start) ? CMTimeGetSeconds(timeRange.start) : 0;
                double durationSeconds = CMTIME_IS_VALID(timeRange.duration) ? CMTimeGetSeconds(timeRange.duration) : 0;
                CMTime totalTime = self.player.currentItem.duration;
                double totalDuration = CMTIME_IS_VALID(totalTime) && !CMTIME_IS_INDEFINITE(totalTime) ? CMTimeGetSeconds(totalTime) : 0;
                
                if (totalDuration > 0) {
                    percentage = ((startSeconds + durationSeconds) / totalDuration) * 100;
                }
            }
        }
        resolve(@(percentage));
    } @catch (NSException *exception) {
        reject(@"BUFFER_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableDictionary *stats = [NSMutableDictionary dictionary];
        
        if (self.player && self.player.currentItem) {
            // Buffered duration
            NSArray *loadedTimeRanges = self.player.currentItem.loadedTimeRanges;
            double bufferedDuration = 0;
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                if (CMTIME_IS_VALID(timeRange.duration)) {
                    bufferedDuration = CMTimeGetSeconds(timeRange.duration);
                }
            }
            
            // Current and total duration
            CMTime currentTimeValue = self.player.currentTime;
            double currentTime = CMTIME_IS_VALID(currentTimeValue) ? CMTimeGetSeconds(currentTimeValue) : 0;
            CMTime totalTimeValue = self.player.currentItem.duration;
            double totalDuration = CMTIME_IS_VALID(totalTimeValue) && !CMTIME_IS_INDEFINITE(totalTimeValue) ? CMTimeGetSeconds(totalTimeValue) : 0;
            
            // Network speed calculation
            NSTimeInterval elapsed = [[NSDate date] timeIntervalSince1970] - self.bufferStartTime;
            double networkSpeed = elapsed > 0 ? (self.totalBytesReceived / elapsed) / 1024 : 0; // KB/s
            
            // Buffer health (0-100)
            double bufferHealth = 100;
            if (self.player.currentItem.playbackBufferEmpty) {
                bufferHealth = 0;
            } else if (self.player.currentItem.playbackLikelyToKeepUp) {
                bufferHealth = 100;
            } else {
                bufferHealth = 50;
            }
            
            // Calculate buffer percentage
            double bufferedPercentage = 0;
            double bufferedPosition = 0;
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                double start = CMTIME_IS_VALID(timeRange.start) ? CMTimeGetSeconds(timeRange.start) : 0;
                double duration = CMTIME_IS_VALID(timeRange.duration) ? CMTimeGetSeconds(timeRange.duration) : 0;
                bufferedPosition = start + duration;
                
                if (totalDuration > 0) {
                    // Known duration
                    bufferedPercentage = (bufferedPosition / totalDuration) * 100;
                } else {
                    // Live stream - use buffer ahead
                    double bufferAhead = bufferedPosition - currentTime;
                    if (bufferAhead > 0) {
                        // Consider 30 seconds as 100%
                        bufferedPercentage = MIN(100, (bufferAhead * 100) / 30);
                    }
                }
            }
            
            stats[@"bufferedDuration"] = @(bufferedDuration);
            stats[@"playedDuration"] = @(currentTime);
            stats[@"totalDuration"] = @(totalDuration);
            stats[@"networkSpeed"] = @(networkSpeed);
            stats[@"latency"] = @(0); // Would need ping implementation
            stats[@"bufferHealth"] = @(bufferHealth);
            stats[@"droppedFrames"] = @(0); // Not applicable for audio
            stats[@"bitRate"] = @(128); // Would need to extract from stream
            
            // Additional buffer information
            stats[@"bufferedPosition"] = @(bufferedPosition);
            stats[@"currentPosition"] = @(currentTime);
            stats[@"bufferedPercentage"] = @((int)bufferedPercentage);
            stats[@"isBuffering"] = @(self.state == PlaybackStateBuffering);
            stats[@"playWhenReady"] = @(self.player.rate > 0);
        }
        
        resolve(stats);
    } @catch (NSException *exception) {
        reject(@"STATS_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getMetadata:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableDictionary *metadata = [NSMutableDictionary dictionary];
        
        if (self.player && self.player.currentItem) {
            AVAsset *asset = self.player.currentItem.asset;
            NSArray *metadataItems = [asset commonMetadata];
            
            for (AVMetadataItem *item in metadataItems) {
                NSString *key = [item commonKey];
                id value = [item value];
                
                if ([key isEqualToString:AVMetadataCommonKeyTitle]) {
                    metadata[@"title"] = value;
                } else if ([key isEqualToString:AVMetadataCommonKeyArtist]) {
                    metadata[@"artist"] = value;
                } else if ([key isEqualToString:AVMetadataCommonKeyAlbumName]) {
                    metadata[@"album"] = value;
                } else if ([key isEqualToString:AVMetadataCommonKeyCreationDate]) {
                    metadata[@"year"] = value;
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
        
        resolve(metadata.count > 0 ? metadata : [NSNull null]);
    } @catch (NSException *exception) {
        reject(@"METADATA_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setEqualizer:(NSArray *)bands
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        for (NSInteger i = 0; i < bands.count && i < self.equalizer.bands.count; i++) {
            NSDictionary *band = bands[i];
            AVAudioUnitEQFilterParameters *filterParams = self.equalizer.bands[i];
            
            filterParams.frequency = [band[@"frequency"] floatValue];
            filterParams.gain = [band[@"gain"] floatValue];
            filterParams.bypass = NO;
        }
        
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"EQUALIZER_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getEqualizer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSMutableArray *bands = [NSMutableArray array];
        
        for (AVAudioUnitEQFilterParameters *filterParams in self.equalizer.bands) {
            [bands addObject:@{
                @"frequency": @(filterParams.frequency),
                @"gain": @(filterParams.gain)
            }];
        }
        
        resolve(bands);
    } @catch (NSException *exception) {
        reject(@"EQUALIZER_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        [self.audioCache removeAllObjects];
        
        // Clear file cache
        NSError *error;
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
        NSUInteger size = 0;
        
        // Calculate file cache size
        NSArray *files = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:self.cachePath error:nil];
        for (NSString *file in files) {
            NSString *filePath = [self.cachePath stringByAppendingPathComponent:file];
            NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:filePath error:nil];
            size += [attributes[NSFileSize] unsignedIntegerValue];
        }
        
        resolve(@(size));
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
        // Implementation would download and cache the specified duration
        // For now, just resolve
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"PRELOAD_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setNetworkPriority:(NSString *)priority
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        // Implementation would adjust network priority
        // For now, just resolve
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"NETWORK_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(requestAudioFocus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSError *error;
        BOOL success = [self.audioSession setActive:YES error:&error];
        resolve(@(success));
    } @catch (NSException *exception) {
        reject(@"AUDIO_FOCUS_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(abandonAudioFocus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSError *error;
        [self.audioSession setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
        resolve(@(YES));
    } @catch (NSException *exception) {
        reject(@"AUDIO_FOCUS_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setAudioSessionCategory:(NSString *)category
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSError *error;
        [self.audioSession setCategory:category error:&error];
        
        if (error) {
            reject(@"AUDIO_SESSION_ERROR", error.localizedDescription, error);
        } else {
            resolve(@(YES));
        }
    } @catch (NSException *exception) {
        reject(@"AUDIO_SESSION_ERROR", exception.reason, nil);
    }
}

// These methods are required for NativeEventEmitter
RCT_EXPORT_METHOD(addListener:(NSString *)eventName)
{
    // Required for NativeEventEmitter
}

RCT_EXPORT_METHOD(removeListeners:(double)count)
{
    // Required for NativeEventEmitter
}

#pragma mark - Helper Methods

- (void)cleanup
{
    [self.progressTimer invalidate];
    self.progressTimer = nil;
    
    [self.statsTimer invalidate];
    self.statsTimer = nil;
    
    [self.dataTask cancel];
    self.dataTask = nil;
    
    if (self.playerItem && self.hasObservers) {
        @try {
            [self.playerItem removeObserver:self forKeyPath:@"status"];
            [self.playerItem removeObserver:self forKeyPath:@"playbackBufferEmpty"];
            [self.playerItem removeObserver:self forKeyPath:@"playbackLikelyToKeepUp"];
        } @catch (NSException *exception) {
            // Ignore if observer was already removed
        }
        self.hasObservers = NO;
    }
    
    [self.player pause];
    self.player = nil;
    self.playerItem = nil;
    
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

- (void)startProgressTimer
{
    [self.progressTimer invalidate];
    
    self.progressTimer = [NSTimer scheduledTimerWithTimeInterval:0.1
                                                          target:self
                                                        selector:@selector(updateProgress)
                                                        userInfo:nil
                                                         repeats:YES];
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
            // Buffered duration
            NSArray *loadedTimeRanges = self.player.currentItem.loadedTimeRanges;
            double bufferedDuration = 0;
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                if (CMTIME_IS_VALID(timeRange.duration)) {
                    bufferedDuration = CMTimeGetSeconds(timeRange.duration);
                }
            }
            
            // Current and total duration
            CMTime currentTimeValue = self.player.currentTime;
            double currentTime = CMTIME_IS_VALID(currentTimeValue) ? CMTimeGetSeconds(currentTimeValue) : 0;
            CMTime totalTimeValue = self.player.currentItem.duration;
            double totalDuration = CMTIME_IS_VALID(totalTimeValue) && !CMTIME_IS_INDEFINITE(totalTimeValue) ? CMTimeGetSeconds(totalTimeValue) : 0;
            
            // Network speed calculation
            NSTimeInterval elapsed = [[NSDate date] timeIntervalSince1970] - self.bufferStartTime;
            double networkSpeed = elapsed > 0 ? (self.totalBytesReceived / elapsed) / 1024 : 0; // KB/s
            
            // Buffer health (0-100)
            double bufferHealth = 100;
            if (self.player.currentItem.playbackBufferEmpty) {
                bufferHealth = 0;
            } else if (self.player.currentItem.playbackLikelyToKeepUp) {
                bufferHealth = 100;
            } else {
                bufferHealth = 50;
            }
            
            // Calculate buffer percentage
            double bufferedPercentage = 0;
            if (totalDuration > 0 && loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                double startSeconds = CMTIME_IS_VALID(timeRange.start) ? CMTimeGetSeconds(timeRange.start) : 0;
                double durationSeconds = CMTIME_IS_VALID(timeRange.duration) ? CMTimeGetSeconds(timeRange.duration) : 0;
                bufferedPercentage = ((startSeconds + durationSeconds) / totalDuration) * 100;
            }
            
            stats[@"bufferedDuration"] = @(bufferedDuration);
            stats[@"playedDuration"] = @(currentTime);
            stats[@"totalDuration"] = @(totalDuration);
            stats[@"networkSpeed"] = @(networkSpeed);
            stats[@"latency"] = @(0); // Would need ping implementation
            stats[@"bufferHealth"] = @(bufferHealth);
            stats[@"droppedFrames"] = @(0); // Not applicable for audio
            stats[@"bitRate"] = @(128); // Would need to extract from stream
            
            // Additional buffer information
            double bufferedPosition = 0;
            if (loadedTimeRanges.count > 0) {
                CMTimeRange timeRange = [loadedTimeRanges.firstObject CMTimeRangeValue];
                double start = CMTIME_IS_VALID(timeRange.start) ? CMTimeGetSeconds(timeRange.start) : 0;
                double duration = CMTIME_IS_VALID(timeRange.duration) ? CMTimeGetSeconds(timeRange.duration) : 0;
                bufferedPosition = start + duration;
            }
            
            stats[@"bufferedPosition"] = @(bufferedPosition);
            stats[@"currentPosition"] = @(currentTime);
            stats[@"bufferedPercentage"] = @((int)bufferedPercentage);
            stats[@"isBuffering"] = @(!self.player.currentItem.playbackLikelyToKeepUp);
            stats[@"playWhenReady"] = @(self.player.rate > 0);
        }
        
        [self sendEventWithName:@"onStreamStats" body:@{@"stats": stats}];
    } @catch (NSException *exception) {
        // Ignore errors for stats
    }
}

- (NSString *)cacheKeyForURL:(NSString *)url
{
    return [[url dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0];
}

- (void)playFromData:(NSData *)data
{
    NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"cachedAudio.mp3"];
    [data writeToFile:tempPath atomically:YES];
    
    NSURL *fileURL = [NSURL fileURLWithPath:tempPath];
    AVAsset *asset = [AVAsset assetWithURL:fileURL];
    self.playerItem = [AVPlayerItem playerItemWithAsset:asset];
    
    // Add observers
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
    
    self.player = [AVPlayer playerWithPlayerItem:self.playerItem];
    
    if ([self.config[@"autoPlay"] boolValue]) {
        [self play];
    }
    
    [self updateState:PlaybackStatePlaying];
    [self startProgressTimer];
    [self startStatsTimer];
}

- (void)handleStreamError:(NSError *)error
{
    [self updateState:PlaybackStateError];
    
    NSDictionary *errorBody = @{
        @"code": @"NETWORK_ERROR",
        @"message": error.localizedDescription,
        @"details": error.userInfo ?: @{},
        @"recoverable": @(YES)
    };
    
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
                if ([self.config[@"autoPlay"] boolValue] && self.state != PlaybackStatePlaying) {
                    [self play];
                }
                break;
                
            case AVPlayerItemStatusFailed:
                [self handleStreamError:self.playerItem.error];
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
            [self updateState:PlaybackStatePlaying];
            [self sendEventWithName:@"onStreamBuffer" body:@{@"isBuffering": @(NO)}];
        }
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

@end 