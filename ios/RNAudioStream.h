#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Support both legacy bridge and TurboModule (New Architecture)
#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTTurboModule.h>
@interface RNAudioStream : RCTEventEmitter <RCTBridgeModule, RCTTurboModule>
#else
@interface RNAudioStream : RCTEventEmitter <RCTBridgeModule>
#endif

@end