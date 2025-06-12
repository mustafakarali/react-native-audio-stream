// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  RN.NativeModules.RNAudioStream = {
    initialize: jest.fn(() => Promise.resolve(true)),
    destroy: jest.fn(() => Promise.resolve(true)),
    startStream: jest.fn(() => Promise.resolve(true)),
    stopStream: jest.fn(() => Promise.resolve(true)),
    play: jest.fn(() => Promise.resolve(true)),
    pause: jest.fn(() => Promise.resolve(true)),
    stop: jest.fn(() => Promise.resolve(true)),
    seek: jest.fn(() => Promise.resolve(true)),
    setVolume: jest.fn(() => Promise.resolve(true)),
    getVolume: jest.fn(() => Promise.resolve(1.0)),
    setPlaybackRate: jest.fn(() => Promise.resolve(true)),
    getPlaybackRate: jest.fn(() => Promise.resolve(1.0)),
    getState: jest.fn(() => Promise.resolve('idle')),
    getCurrentTime: jest.fn(() => Promise.resolve(0)),
    getDuration: jest.fn(() => Promise.resolve(0)),
    getBufferedPercentage: jest.fn(() => Promise.resolve(0)),
    getStats: jest.fn(() => Promise.resolve({})),
    getMetadata: jest.fn(() => Promise.resolve(null)),
    setEqualizer: jest.fn(() => Promise.resolve(true)),
    getEqualizer: jest.fn(() => Promise.resolve([])),
    clearCache: jest.fn(() => Promise.resolve(true)),
    getCacheSize: jest.fn(() => Promise.resolve(0)),
    preloadStream: jest.fn(() => Promise.resolve(true)),
    setNetworkPriority: jest.fn(() => Promise.resolve(true)),
    requestAudioFocus: jest.fn(() => Promise.resolve(true)),
    abandonAudioFocus: jest.fn(() => Promise.resolve(true)),
    setAudioSessionCategory: jest.fn(() => Promise.resolve(true)),
  };
  
  RN.NativeEventEmitter = jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
    removeSubscription: jest.fn(),
  }));
  
  return RN;
}); 