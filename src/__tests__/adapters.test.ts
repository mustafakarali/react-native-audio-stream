import { CustomSourceAdapter } from '../adapters/CustomSourceAdapter';
import { CustomDecoderBridge } from '../adapters/CustomDecoderBridge';
import { CustomAnalyticsAdapter } from '../adapters/CustomAnalyticsAdapter';
import { MockStreamAdapter } from '../adapters/MockStreamAdapter';

describe('CustomSourceAdapter', () => {
  it('should create with valid config', () => {
    const adapter = new CustomSourceAdapter({ name: 'test-source' });
    expect(adapter.name).toBe('test-source');
    expect(adapter.isActive()).toBe(false);
  });

  it('should register and unregister', () => {
    const adapter = new CustomSourceAdapter({ name: 'reg-test' });
    adapter.register();
    expect(adapter.isActive()).toBe(true);
    adapter.unregister();
    expect(adapter.isActive()).toBe(false);
  });

  it('should request data from custom source', async () => {
    const mockData = new ArrayBuffer(1024);
    const adapter = new CustomSourceAdapter({
      name: 'data-source',
      onRequestData: async () => mockData,
    });
    adapter.register();
    const data = await adapter.requestData(0, 1024);
    expect(data).toBe(mockData);
  });

  it('should throw if not registered', async () => {
    const adapter = new CustomSourceAdapter({
      name: 'unreg',
      onRequestData: async () => new ArrayBuffer(0),
    });
    await expect(adapter.requestData(0, 100)).rejects.toThrow('Adapter not registered');
  });

  it('should throw if name is empty', () => {
    expect(() => new CustomSourceAdapter({ name: '' })).toThrow('Adapter name is required');
  });
});

describe('CustomDecoderBridge', () => {
  it('should create with valid config', () => {
    const decoder = new CustomDecoderBridge({
      name: 'opus',
      supportedFormats: ['audio/opus'],
      decode: async (data) => data,
    });
    expect(decoder.name).toBe('opus');
    expect(decoder.supportedFormats).toEqual(['audio/opus']);
  });

  it('should register and call initialize', async () => {
    const initFn = jest.fn();
    const decoder = new CustomDecoderBridge({
      name: 'init-test',
      supportedFormats: ['audio/test'],
      decode: async (d) => d,
      initialize: initFn,
    });
    await decoder.register();
    expect(initFn).toHaveBeenCalled();
  });

  it('should check format support', () => {
    const decoder = new CustomDecoderBridge({
      name: 'multi',
      supportedFormats: ['audio/opus', 'audio/ogg'],
      decode: async (d) => d,
    });
    expect(decoder.supports('audio/opus')).toBe(true);
    expect(decoder.supports('audio/mp3')).toBe(false);
  });

  it('should throw if no formats specified', () => {
    expect(() => new CustomDecoderBridge({
      name: 'bad',
      supportedFormats: [],
      decode: async (d) => d,
    })).toThrow('At least one supported format');
  });
});

describe('CustomAnalyticsAdapter', () => {
  it('should track events', () => {
    const eventFn = jest.fn();
    const adapter = new CustomAnalyticsAdapter({ name: 'analytics', onEvent: eventFn });
    adapter.register();
    adapter.track('play', { url: 'test.mp3' });
    expect(eventFn).toHaveBeenCalledWith('play', { url: 'test.mp3' });
  });

  it('should not track when unregistered', () => {
    const eventFn = jest.fn();
    const adapter = new CustomAnalyticsAdapter({ name: 'inactive', onEvent: eventFn });
    adapter.track('play');
    expect(eventFn).not.toHaveBeenCalled();
  });

  it('should auto-flush when buffer is full', async () => {
    const flushFn = jest.fn();
    const adapter = new CustomAnalyticsAdapter({
      name: 'flush-test',
      onEvent: jest.fn(),
      onFlush: flushFn,
      bufferSize: 3,
    });
    adapter.register();
    adapter.track('a');
    adapter.track('b');
    adapter.track('c'); // This should trigger flush
    expect(flushFn).toHaveBeenCalledTimes(1);
    expect(flushFn.mock.calls[0][0]).toHaveLength(3);
  });
});

describe('MockStreamAdapter', () => {
  it('should generate sine wave chunks', () => {
    const mock = new MockStreamAdapter({ pattern: 'sine', frequency: 440 });
    mock.start();
    const chunk = mock.generateChunk(1024);
    expect(chunk).toBeInstanceOf(Float32Array);
    expect(chunk.length).toBe(1024);
    // Sine wave should have values between -1 and 1
    expect(Math.max(...Array.from(chunk))).toBeLessThanOrEqual(1);
    expect(Math.min(...Array.from(chunk))).toBeGreaterThanOrEqual(-1);
  });

  it('should generate silence', () => {
    const mock = new MockStreamAdapter({ pattern: 'silence' });
    mock.start();
    const chunk = mock.generateChunk(512);
    const allZeros = chunk.every(v => v === 0);
    expect(allZeros).toBe(true);
  });

  it('should track position', () => {
    const mock = new MockStreamAdapter({ sampleRate: 44100 });
    mock.start();
    mock.generateChunk(44100); // 1 second
    expect(mock.getCurrentTime()).toBeCloseTo(1.0, 1);
  });

  it('should end after duration', () => {
    const mock = new MockStreamAdapter({ sampleRate: 100, durationSeconds: 1 });
    mock.start();
    expect(mock.hasEnded()).toBe(false);
    mock.generateChunk(100); // exactly 1 second
    expect(mock.hasEnded()).toBe(true);
  });

  it('should support stereo', () => {
    const mock = new MockStreamAdapter({ channels: 2 });
    mock.start();
    const chunk = mock.generateChunk(256);
    expect(chunk.length).toBe(512); // 256 frames * 2 channels
  });
});
