/**
 * CustomDecoderBridge — Register custom audio decoders.
 * 
 * Allows integration of third-party or custom audio decoders
 * for formats not natively supported (e.g., Opus on iOS, MIDI, MOD).
 * 
 * @example
 * ```ts
 * const decoder = new CustomDecoderBridge({
 *   name: 'opus-decoder',
 *   supportedFormats: ['audio/opus', 'audio/ogg; codecs=opus'],
 *   decode: async (encodedData) => {
 *     return myOpusDecoder.decode(encodedData);
 *   },
 * });
 * decoder.register();
 * ```
 */

export interface DecoderConfig {
  /** Unique decoder name */
  name: string;
  /** MIME types this decoder can handle */
  supportedFormats: string[];
  /** Decode encoded audio data to PCM */
  decode: (encodedData: ArrayBuffer) => Promise<ArrayBuffer>;
  /** Initialize the decoder (called on register) */
  initialize?: () => Promise<void>;
  /** Cleanup the decoder (called on unregister) */
  destroy?: () => Promise<void>;
  /** Output sample rate */
  outputSampleRate?: number;
  /** Output channel count */
  outputChannels?: number;
}

export class CustomDecoderBridge {
  private config: DecoderConfig;
  private isRegistered = false;

  constructor(config: DecoderConfig) {
    if (!config.name) throw new Error('Decoder name is required');
    if (!config.supportedFormats?.length) throw new Error('At least one supported format is required');
    this.config = config;
  }

  /** Register this decoder */
  async register(): Promise<void> {
    if (this.config.initialize) {
      await this.config.initialize();
    }
    this.isRegistered = true;
  }

  /** Unregister this decoder */
  async unregister(): Promise<void> {
    if (this.config.destroy) {
      await this.config.destroy();
    }
    this.isRegistered = false;
  }

  /** Decode audio data */
  async decode(encodedData: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.isRegistered) throw new Error('Decoder not registered');
    return this.config.decode(encodedData);
  }

  /** Check if this decoder supports a given MIME type */
  supports(mimeType: string): boolean {
    return this.config.supportedFormats.includes(mimeType);
  }

  get name(): string { return this.config.name; }
  get supportedFormats(): string[] { return [...this.config.supportedFormats]; }
  get outputSampleRate(): number { return this.config.outputSampleRate ?? 44100; }
  get outputChannels(): number { return this.config.outputChannels ?? 1; }
}
