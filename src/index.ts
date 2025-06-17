export { AudioStream } from './AudioStream';
export * from './types';
export { logger } from './logger';

// Default export for convenience - singleton instance
import { AudioStream } from './AudioStream';
export default AudioStream.getInstance(); 