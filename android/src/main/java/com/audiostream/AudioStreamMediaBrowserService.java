package com.audiostream;

import android.content.Intent;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media.MediaBrowserServiceCompat;

import java.util.ArrayList;
import java.util.List;

/**
 * MediaBrowserServiceCompat implementation for Android Auto integration.
 *
 * Provides a media browse tree so Android Auto can display tracks
 * and control playback from the car's head unit.
 *
 * The tree structure:
 *   ROOT
 *   └── PLAYLIST
 *       ├── Track 1
 *       ├── Track 2
 *       └── Track N
 */
public class AudioStreamMediaBrowserService extends MediaBrowserServiceCompat {

    private static final String TAG = "AudioStreamMBS";
    private static final String MEDIA_ROOT_ID = "audio_stream_root";
    private static final String MEDIA_PLAYLIST_ID = "audio_stream_playlist";

    private MediaSessionCompat mediaSession;

    // Static playlist data shared from RNAudioStreamModule
    static List<MediaBrowserCompat.MediaItem> playlistItems = new ArrayList<>();
    static MediaSessionCompat.Callback sessionCallback;

    @Override
    public void onCreate() {
        super.onCreate();

        mediaSession = new MediaSessionCompat(this, TAG);
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

        // Set playback state
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(
                        PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_STOP |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                        PlaybackStateCompat.ACTION_SEEK_TO);
        mediaSession.setPlaybackState(stateBuilder.build());

        // Set callback for transport controls
        if (sessionCallback != null) {
            mediaSession.setCallback(sessionCallback);
        } else {
            mediaSession.setCallback(new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    Log.i(TAG, "Android Auto: Play requested");
                }

                @Override
                public void onPause() {
                    Log.i(TAG, "Android Auto: Pause requested");
                }

                @Override
                public void onStop() {
                    Log.i(TAG, "Android Auto: Stop requested");
                }

                @Override
                public void onSkipToNext() {
                    Log.i(TAG, "Android Auto: Skip to next requested");
                }

                @Override
                public void onSkipToPrevious() {
                    Log.i(TAG, "Android Auto: Skip to previous requested");
                }

                @Override
                public void onSeekTo(long pos) {
                    Log.i(TAG, "Android Auto: Seek to " + pos + "ms");
                }
            });
        }

        setSessionToken(mediaSession.getSessionToken());
        Log.i(TAG, "MediaBrowserService created for Android Auto");
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName,
                                  int clientUid,
                                  @Nullable Bundle rootHints) {
        // Allow all clients to browse (Android Auto, other media browsers)
        Log.i(TAG, "onGetRoot from: " + clientPackageName);
        return new BrowserRoot(MEDIA_ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId,
                                @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        Log.i(TAG, "onLoadChildren: " + parentId);

        List<MediaBrowserCompat.MediaItem> mediaItems = new ArrayList<>();

        if (MEDIA_ROOT_ID.equals(parentId)) {
            // Root level: show playlist folder
            MediaDescriptionCompat description = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_PLAYLIST_ID)
                    .setTitle("Playlist")
                    .setSubtitle("Current playlist")
                    .build();
            mediaItems.add(new MediaBrowserCompat.MediaItem(
                    description, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

        } else if (MEDIA_PLAYLIST_ID.equals(parentId)) {
            // Playlist level: show tracks from static playlist data
            if (!playlistItems.isEmpty()) {
                mediaItems.addAll(playlistItems);
            } else {
                // Default empty state
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId("empty")
                        .setTitle("No tracks")
                        .setSubtitle("Add tracks to the playlist")
                        .build();
                mediaItems.add(new MediaBrowserCompat.MediaItem(
                        desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
        }

        result.sendResult(mediaItems);
    }

    /**
     * Update the playlist items shown in Android Auto.
     * Called from RNAudioStreamModule when playlist changes.
     */
    public static void updatePlaylistItems(List<MediaBrowserCompat.MediaItem> items) {
        playlistItems = items != null ? items : new ArrayList<>();
    }

    /**
     * Set the media session callback for Android Auto transport controls.
     * Called from RNAudioStreamModule to bridge Auto → native player.
     */
    public static void setMediaSessionCallback(MediaSessionCompat.Callback callback) {
        sessionCallback = callback;
    }
}
