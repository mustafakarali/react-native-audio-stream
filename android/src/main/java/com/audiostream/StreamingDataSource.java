package com.audiostream;

import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.TransferListener;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Custom DataSource for real-time byte streaming
 * This allows us to feed audio data chunk by chunk
 */
public class StreamingDataSource extends BaseDataSource {
    private static final int PIPE_SIZE = 1024 * 64; // 64KB pipe buffer
    
    private PipedInputStream inputStream;
    private PipedOutputStream outputStream;
    private LinkedBlockingQueue<byte[]> chunkQueue;
    private AtomicBoolean isComplete;
    private Thread writerThread;
    private long totalBytesWritten = 0;
    private Uri uri;

    public StreamingDataSource() {
        super(true); // isNetwork = true
        this.chunkQueue = new LinkedBlockingQueue<>();
        this.isComplete = new AtomicBoolean(false);
    }

    @Override
    public long open(DataSpec dataSpec) throws IOException {
        uri = dataSpec.uri;
        
        // Create piped streams
        outputStream = new PipedOutputStream();
        inputStream = new PipedInputStream(outputStream, PIPE_SIZE);
        
        // Start writer thread to pump data from queue to output stream
        writerThread = new Thread(() -> {
            try {
                while (!isComplete.get() || !chunkQueue.isEmpty()) {
                    byte[] chunk = chunkQueue.poll();
                    if (chunk != null) {
                        outputStream.write(chunk);
                        outputStream.flush();
                        totalBytesWritten += chunk.length;
                    } else {
                        // Wait for data
                        Thread.sleep(10);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                try {
                    outputStream.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        });
        writerThread.start();
        
        transferStarted(dataSpec);
        
        // Return length unknown for streaming
        return C.LENGTH_UNSET;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (inputStream == null) {
            throw new IOException("DataSource is not opened");
        }
        
        int bytesRead = inputStream.read(buffer, offset, length);
        
        if (bytesRead > 0) {
            bytesTransferred(bytesRead);
        }
        
        return bytesRead;
    }

    @Override
    @Nullable
    public Uri getUri() {
        return uri;
    }

    @Override
    public void close() throws IOException {
        if (inputStream != null) {
            inputStream.close();
            inputStream = null;
        }
        
        if (outputStream != null) {
            outputStream.close();
            outputStream = null;
        }
        
        if (writerThread != null) {
            writerThread.interrupt();
            writerThread = null;
        }
        
        transferEnded();
    }

    /**
     * Append audio chunk to the stream
     */
    public void appendChunk(byte[] data) {
        if (!isComplete.get()) {
            chunkQueue.offer(data);
        }
    }

    /**
     * Signal that streaming is complete
     */
    public void complete() {
        isComplete.set(true);
    }

    /**
     * Get total bytes written so far
     */
    public long getTotalBytesWritten() {
        return totalBytesWritten;
    }
} 