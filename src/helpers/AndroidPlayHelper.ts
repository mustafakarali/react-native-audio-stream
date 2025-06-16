import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import AudioStream from '../index';

/**
 * Helper for playing base64 audio on Android
 * Works around ExoPlayer limitations with ByteArrayDataSource
 */
export class AndroidPlayHelper {
  /**
   * Play base64 audio data on Android by saving to temp file
   * @param base64Data - Base64 encoded audio data
   * @param config - Configuration object
   * @returns Promise<void>
   */
  static async playBase64Audio(base64Data: string, config?: any): Promise<void> {
    if (Platform.OS !== 'android') {
      // Use normal playFromData for iOS
      return AudioStream.playFromData(base64Data, config);
    }

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `temp_audio_${timestamp}.mp3`;
      const filepath = `${RNFS.CachesDirectoryPath}/${filename}`;

      // Save base64 to file
      await RNFS.writeFile(filepath, base64Data, 'base64');

      // Play using file path (not file:// URL)
      await AudioStream.startStream(filepath, config);
    } catch (error) {
      console.error('Error playing base64 audio on Android:', error);
      throw error;
    }
  }

  /**
   * Clean up temporary audio files
   */
  static async cleanupTempFiles(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const files = await RNFS.readDir(RNFS.CachesDirectoryPath);
      const tempFiles = files.filter(file => 
        file.name.startsWith('temp_audio_') && file.name.endsWith('.mp3')
      );

      for (const file of tempFiles) {
        await RNFS.unlink(file.path);
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
} 