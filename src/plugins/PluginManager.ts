/**
 * PluginManager — Extensibility system for react-native-audio-stream.
 * 
 * Allows registration of custom plugins that receive lifecycle callbacks
 * for audio events. Useful for analytics, custom decoders, and integrations.
 * 
 * @example
 * ```ts
 * import { PluginManager } from 'react-native-audio-stream';
 * 
 * PluginManager.register({
 *   name: 'analytics',
 *   onPlay: (url) => trackEvent('play', { url }),
 *   onStop: () => trackEvent('stop'),
 *   onError: (error) => reportError(error),
 * });
 * ```
 */

export interface AudioStreamPlugin {
  /** Unique plugin name */
  name: string;
  /** Called when plugin is registered */
  initialize?(): void | Promise<void>;
  /** Called when a stream starts playing */
  onPlay?(url: string): void;
  /** Called when playback stops */
  onStop?(): void;
  /** Called when playback pauses */
  onPause?(): void;
  /** Called on playback error */
  onError?(error: Error): void;
  /** Called when audio metadata is received */
  onMetadata?(metadata: Record<string, any>): void;
  /** Called when a recording starts */
  onRecordingStart?(config: Record<string, any>): void;
  /** Called when a recording stops */
  onRecordingStop?(filePath: string): void;
  /** Called when publishing starts */
  onPublishingStart?(url: string): void;
  /** Called when publishing stops */
  onPublishingStop?(): void;
  /** Called when the plugin is unregistered */
  destroy?(): void | Promise<void>;
}

class PluginManagerImpl {
  private plugins: Map<string, AudioStreamPlugin> = new Map();

  /**
   * Register a plugin. If a plugin with the same name exists, it will be replaced.
   */
  async register(plugin: AudioStreamPlugin): Promise<void> {
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }

    // Unregister existing plugin with same name
    if (this.plugins.has(plugin.name)) {
      await this.unregister(plugin.name);
    }

    this.plugins.set(plugin.name, plugin);

    if (plugin.initialize) {
      await plugin.initialize();
    }
  }

  /**
   * Unregister a plugin by name.
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
      if (plugin.destroy) {
        await plugin.destroy();
      }
      this.plugins.delete(name);
    }
  }

  /**
   * Get a registered plugin by name.
   */
  getPlugin(name: string): AudioStreamPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugin names.
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Notify all plugins of an event.
   */
  notify(
    event: keyof Omit<AudioStreamPlugin, 'name' | 'initialize' | 'destroy'>,
    ...args: any[]
  ): void {
    for (const plugin of this.plugins.values()) {
      try {
        const handler = plugin[event] as ((...a: any[]) => void) | undefined;
        if (handler) {
          handler.apply(plugin, args);
        }
      } catch (error) {
        console.warn(`[PluginManager] Error in plugin "${plugin.name}" handler "${event}":`, error);
      }
    }
  }

  /**
   * Unregister all plugins.
   */
  async clear(): Promise<void> {
    for (const name of Array.from(this.plugins.keys())) {
      await this.unregister(name);
    }
  }
}

/** Singleton PluginManager instance */
export const PluginManager = new PluginManagerImpl();
