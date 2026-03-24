/**
 * MockStreamAdapter — Test/development mock audio streams.
 * 
 * Generates predictable audio data for testing without requiring
 * a real audio server. Useful for unit tests, CI/CD, and development.
 * 
 * @example
 * ```ts
 * const mock = new MockStreamAdapter({
 *   sampleRate: 44100,
 *   channels: 1,
 *   durationSeconds: 10,
 *   pattern: 'sine',  // 440Hz sine wave
 * });
 * 
 * const chunk = mock.generateChunk(4096);
 * ```
 */

export type MockPattern = 'sine' | 'silence' | 'noise' | 'square';

export interface MockStreamConfig {
  /** Sample rate. Default: 44100 */
  sampleRate?: number;
  /** Channel count. Default: 1 */
  channels?: number;
  /** Total duration in seconds (0 for infinite). Default: 0 */
  durationSeconds?: number;
  /** Audio pattern to generate. Default: 'sine' */
  pattern?: MockPattern;
  /** Frequency for sine/square patterns in Hz. Default: 440 */
  frequency?: number;
  /** Amplitude (0.0-1.0). Default: 0.5 */
  amplitude?: number;
}

export class MockStreamAdapter {
  private config: Required<MockStreamConfig>;
  private position = 0;
  private isActive = false;

  constructor(config?: MockStreamConfig) {
    this.config = {
      sampleRate: config?.sampleRate ?? 44100,
      channels: config?.channels ?? 1,
      durationSeconds: config?.durationSeconds ?? 0,
      pattern: config?.pattern ?? 'sine',
      frequency: config?.frequency ?? 440,
      amplitude: config?.amplitude ?? 0.5,
    };
  }

  /** Start the mock stream */
  start(): void {
    this.position = 0;
    this.isActive = true;
  }

  /** Stop the mock stream */
  stop(): void {
    this.isActive = false;
  }

  /** Reset position to start */
  reset(): void {
    this.position = 0;
  }

  /** Generate a chunk of audio data (Float32Array) */
  generateChunk(frameCount: number): Float32Array {
    const data = new Float32Array(frameCount * this.config.channels);
    const { sampleRate, frequency, amplitude, pattern } = this.config;

    for (let i = 0; i < frameCount; i++) {
      let sample = 0;
      const t = (this.position + i) / sampleRate;

      switch (pattern) {
        case 'sine':
          sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          sample = amplitude * (Math.sin(2 * Math.PI * frequency * t) >= 0 ? 1 : -1);
          break;
        case 'noise':
          sample = amplitude * (Math.random() * 2 - 1);
          break;
        case 'silence':
          sample = 0;
          break;
      }

      for (let ch = 0; ch < this.config.channels; ch++) {
        data[i * this.config.channels + ch] = sample;
      }
    }

    this.position += frameCount;

    // Check if we've exceeded duration
    if (this.config.durationSeconds > 0) {
      const currentTime = this.position / sampleRate;
      if (currentTime >= this.config.durationSeconds) {
        this.isActive = false;
      }
    }

    return data;
  }

  /** Get current position in seconds */
  getCurrentTime(): number {
    return this.position / this.config.sampleRate;
  }

  /** Check if stream has ended (only for finite duration) */
  hasEnded(): boolean {
    if (this.config.durationSeconds <= 0) return false;
    return this.getCurrentTime() >= this.config.durationSeconds;
  }

  get running(): boolean { return this.isActive; }
  get sampleRate(): number { return this.config.sampleRate; }
  get channels(): number { return this.config.channels; }
}
