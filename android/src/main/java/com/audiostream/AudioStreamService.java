package com.audiostream;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * ForegroundService for persistent audio playback.
 *
 * When enableBackgroundMode is true, this service is started to prevent the OS
 * from killing the app while audio is playing. It shows a persistent notification
 * with the current stream info.
 *
 * This is NOT a MediaBrowserService — it is a lightweight foreground service
 * solely to hold the wakelock and show the notification. ExoPlayer playback
 * remains in RNAudioStreamModule.
 */
public class AudioStreamService extends Service {

    private static final String TAG = "AudioStreamService";
    private static final String CHANNEL_ID = "audio_stream_channel";
    private static final int NOTIFICATION_ID = 1;

    public static final String ACTION_START = "com.audiostream.ACTION_START";
    public static final String ACTION_STOP = "com.audiostream.ACTION_STOP";
    public static final String ACTION_UPDATE = "com.audiostream.ACTION_UPDATE";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";

    private final IBinder binder = new LocalBinder();
    private boolean isRunning = false;

    public class LocalBinder extends Binder {
        public AudioStreamService getService() {
            return AudioStreamService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            isRunning = false;
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra(EXTRA_TITLE);
        String artist = intent.getStringExtra(EXTRA_ARTIST);

        if (title == null || title.isEmpty()) {
            title = "Audio Stream";
        }
        if (artist == null || artist.isEmpty()) {
            artist = "Playing";
        }

        Notification notification = buildNotification(title, artist);

        if (!isRunning) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isRunning = true;
            Log.i(TAG, "Foreground service started");
        } else if (ACTION_UPDATE.equals(action)) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, notification);
            }
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        Log.i(TAG, "Foreground service destroyed");
        super.onDestroy();
    }

    public boolean isServiceRunning() {
        return isRunning;
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Audio Playback",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Persistent notification for background audio playback");
        channel.setShowBadge(false);
        channel.setSound(null, null);

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String title, String artist) {
        // Use the app's launcher activity for the content intent
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            contentIntent = PendingIntent.getActivity(
                    this, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        // Stop action
        Intent stopIntent = new Intent(this, AudioStreamService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                this, 1, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Get the app's icon resource — use the launcher icon
        int iconResId = getApplicationInfo().icon;
        if (iconResId == 0) {
            iconResId = android.R.drawable.ic_media_play;
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(artist)
                .setSmallIcon(iconResId)
                .setContentIntent(contentIntent)
                .addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
                .setOngoing(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }
}
