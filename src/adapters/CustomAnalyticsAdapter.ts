/**
 * CustomAnalyticsAdapter — Forward audio events to analytics platforms.
 * 
 * Provides a structured way to send playback events to external analytics
 * services (e.g., Firebase, Amplitude, Mixpanel, custom dashboards).
 * 
 * @example
 * ```ts
 * const analytics = new CustomAnalyticsAdapter({
 *   name: 'firebase-analytics',
 *   onEvent: (eventName, data) => {
 *     firebase.analytics().logEvent(eventName, data);
 *   },
 * });
 * analytics.register();
 * ```
 */

export interface AnalyticsEvent {
  /** Event name (e.g., 'play', 'pause', 'error', 'buffer') */
  name: string;
  /** Event timestamp */
  timestamp: number;
  /** Event properties */
  properties: Record<string, any>;
}

export interface AnalyticsConfig {
  /** Unique adapter name */
  name: string;
  /** Called for each analytics event */
  onEvent: (eventName: string, data: Record<string, any>) => void;
  /** Called to batch-send events (optional) */
  onFlush?: (events: AnalyticsEvent[]) => Promise<void>;
  /** Max events to buffer before auto-flush. Default: 50 */
  bufferSize?: number;
  /** Auto-flush interval in ms. Default: 30000 */
  flushInterval?: number;
}

export class CustomAnalyticsAdapter {
  private config: AnalyticsConfig;
  private isRegistered = false;
  private eventBuffer: AnalyticsEvent[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: AnalyticsConfig) {
    if (!config.name) throw new Error('Analytics adapter name is required');
    this.config = config;
  }

  /** Register this analytics adapter */
  register(): void {
    this.isRegistered = true;

    if (this.config.onFlush && this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /** Unregister this analytics adapter and flush remaining events */
  async unregister(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
    this.isRegistered = false;
  }

  /** Track an event */
  track(eventName: string, data: Record<string, any> = {}): void {
    if (!this.isRegistered) return;

    const event: AnalyticsEvent = {
      name: eventName,
      timestamp: Date.now(),
      properties: data,
    };

    this.config.onEvent(eventName, data);
    this.eventBuffer.push(event);

    const bufferSize = this.config.bufferSize ?? 50;
    if (this.eventBuffer.length >= bufferSize) {
      this.flush();
    }
  }

  /** Flush buffered events */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0 || !this.config.onFlush) return;
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    await this.config.onFlush(events);
  }

  get name(): string { return this.config.name; }
  get isActive(): boolean { return this.isRegistered; }
  get bufferedCount(): number { return this.eventBuffer.length; }
}
