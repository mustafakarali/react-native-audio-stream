import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { PluginManager, AudioStreamPlugin } from '../plugins/PluginManager';

const RNAudioStream = NativeModules.RNAudioStream;

describe('CarPlay & Android Auto', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  describe('setMediaSessionConfig', () => {
    it('should call native setMediaSessionConfig', async () => {
      await audioStream.setMediaSessionConfig({
        enabled: true,
        title: 'My Podcast',
        artist: 'Author Name',
        supportedActions: ['play', 'pause', 'skipNext'],
      });
      expect(RNAudioStream.setMediaSessionConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Podcast',
          artist: 'Author Name',
        })
      );
    });
  });

  describe('getMediaBrowseTree', () => {
    it('should return empty tree by default', async () => {
      const tree = await audioStream.getMediaBrowseTree();
      expect(tree).toEqual([]);
    });

    it('should return browse tree from native', async () => {
      RNAudioStream.getMediaBrowseTree.mockResolvedValueOnce([
        { id: '1', title: 'Track 1', playable: true },
        { id: '2', title: 'Track 2', playable: true },
      ]);
      const tree = await audioStream.getMediaBrowseTree();
      expect(tree).toHaveLength(2);
      expect(tree[0].title).toBe('Track 1');
    });
  });
});

describe('Plugin Manager', () => {
  beforeEach(async () => {
    await PluginManager.clear();
  });

  describe('register', () => {
    it('should register a plugin', async () => {
      const plugin: AudioStreamPlugin = { name: 'test-plugin' };
      await PluginManager.register(plugin);
      expect(PluginManager.getPluginNames()).toEqual(['test-plugin']);
    });

    it('should call initialize on register', async () => {
      const initFn = jest.fn();
      await PluginManager.register({ name: 'init-test', initialize: initFn });
      expect(initFn).toHaveBeenCalled();
    });

    it('should replace existing plugin with same name', async () => {
      const destroyFn = jest.fn();
      await PluginManager.register({ name: 'dup', destroy: destroyFn });
      await PluginManager.register({ name: 'dup' });
      expect(destroyFn).toHaveBeenCalled();
      expect(PluginManager.getPluginNames()).toEqual(['dup']);
    });

    it('should throw if name is empty', async () => {
      await expect(PluginManager.register({ name: '' })).rejects.toThrow('Plugin must have a name');
    });
  });

  describe('unregister', () => {
    it('should remove a plugin', async () => {
      await PluginManager.register({ name: 'to-remove' });
      await PluginManager.unregister('to-remove');
      expect(PluginManager.getPluginNames()).toEqual([]);
    });

    it('should call destroy on unregister', async () => {
      const destroyFn = jest.fn();
      await PluginManager.register({ name: 'destroy-test', destroy: destroyFn });
      await PluginManager.unregister('destroy-test');
      expect(destroyFn).toHaveBeenCalled();
    });
  });

  describe('notify', () => {
    it('should notify all plugins of events', async () => {
      const onPlayFn = jest.fn();
      const onStopFn = jest.fn();
      await PluginManager.register({ name: 'listener', onPlay: onPlayFn, onStop: onStopFn });

      PluginManager.notify('onPlay', 'https://example.com/audio.mp3');
      expect(onPlayFn).toHaveBeenCalledWith('https://example.com/audio.mp3');

      PluginManager.notify('onStop');
      expect(onStopFn).toHaveBeenCalled();
    });

    it('should not throw if plugin handler throws', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await PluginManager.register({
        name: 'bad-plugin',
        onPlay: () => { throw new Error('plugin error'); },
      });
      expect(() => PluginManager.notify('onPlay', 'url')).not.toThrow();
      consoleSpy.mockRestore();
    });

    it('should notify multiple plugins', async () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      await PluginManager.register({ name: 'p1', onError: fn1 });
      await PluginManager.register({ name: 'p2', onError: fn2 });

      const err = new Error('test');
      PluginManager.notify('onError', err);
      expect(fn1).toHaveBeenCalledWith(err);
      expect(fn2).toHaveBeenCalledWith(err);
    });
  });

  describe('getPlugin', () => {
    it('should return registered plugin', async () => {
      const plugin = { name: 'findme' };
      await PluginManager.register(plugin);
      expect(PluginManager.getPlugin('findme')).toBe(plugin);
    });

    it('should return undefined for unregistered plugin', () => {
      expect(PluginManager.getPlugin('nonexistent')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all plugins', async () => {
      await PluginManager.register({ name: 'a' });
      await PluginManager.register({ name: 'b' });
      await PluginManager.clear();
      expect(PluginManager.getPluginNames()).toEqual([]);
    });
  });
});
