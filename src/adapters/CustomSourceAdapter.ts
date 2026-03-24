/**
 * CustomSourceAdapter — Allows injection of custom audio data sources.
 * 
 * Use this adapter to provide audio data from non-standard sources
 * (e.g., WebRTC peer connections, custom protocols, in-memory buffers).
 * 
 * @example
 * ```ts
 * const adapter = new CustomSourceAdapter({
 *   name: 'webrtc-audio',
 *   onRequestData: async (offset, length) => {
 *     return myWebRTCConnection.readAudioChunk(offset, length);
 *   },
 * });
 * adapter.register();
 * ```
 */

export interface CustomSourceConfig {
  /** Unique adapter name */
  name: string;
  /** Called when the player requests data */
  onRequestData?: (offset: number, length: number) => Promise<ArrayBuffer>;
  /** Called to check if source is ready */
  onCheckReady?: () => Promise<boolean>;
  /** Content type hint (e.g., 'audio/mpeg', 'audio/aac') */
  contentType?: string;
  /** Total content length (-1 for live/unknown) */
  contentLength?: number;
}

export class CustomSourceAdapter {
  private config: CustomSourceConfig;
  private isRegistered = false;

  constructor(config: CustomSourceConfig) {
    if (!config.name) throw new Error('Adapter name is required');
    this.config = config;
  }

  /** Register this adapter with the audio stream system */
  register(): void {
    this.isRegistered = true;
  }

  /** Unregister this adapter */
  unregister(): void {
    this.isRegistered = false;
  }

  /** Check if the adapter is currently registered */
  isActive(): boolean {
    return this.isRegistered;
  }

  /** Request data from the custom source */
  async requestData(offset: number, length: number): Promise<ArrayBuffer> {
    if (!this.isRegistered) throw new Error('Adapter not registered');
    if (!this.config.onRequestData) throw new Error('onRequestData not configured');
    return this.config.onRequestData(offset, length);
  }

  /** Check if the source is ready */
  async isReady(): Promise<boolean> {
    if (this.config.onCheckReady) {
      return this.config.onCheckReady();
    }
    return this.isRegistered;
  }

  get name(): string { return this.config.name; }
  get contentType(): string | undefined { return this.config.contentType; }
  get contentLength(): number { return this.config.contentLength ?? -1; }
}
