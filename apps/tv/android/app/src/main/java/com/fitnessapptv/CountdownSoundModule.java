package com.fitnessapptv;

import android.media.MediaPlayer;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class CountdownSoundModule extends ReactContextBaseJavaModule {
    private static final String TAG = "CountdownSound";
    private MediaPlayer mediaPlayer;
    private float volume = 0.7f;

    public CountdownSoundModule(ReactApplicationContext reactContext) {
        super(reactContext);
        initializeMediaPlayer();
    }

    @Override
    public String getName() {
        return "CountdownSound";
    }

    private void initializeMediaPlayer() {
        try {
            // R.raw.countdown_321 refers to the file we placed in res/raw/
            mediaPlayer = MediaPlayer.create(getReactApplicationContext(), R.raw.countdown_321);
            if (mediaPlayer != null) {
                mediaPlayer.setVolume(volume, volume);
                Log.d(TAG, "MediaPlayer initialized successfully");
            } else {
                Log.e(TAG, "Failed to create MediaPlayer");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing MediaPlayer", e);
        }
    }

    @ReactMethod
    public void play(Promise promise) {
        try {
            if (mediaPlayer == null) {
                initializeMediaPlayer();
            }

            if (mediaPlayer != null) {
                // Reset to beginning
                mediaPlayer.seekTo(0);
                mediaPlayer.start();
                Log.d(TAG, "Playing countdown sound");
                promise.resolve(true);
            } else {
                promise.reject("PLAYER_NULL", "MediaPlayer is not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing sound", e);
            promise.reject("PLAY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setVolume(float newVolume, Promise promise) {
        try {
            volume = Math.max(0.0f, Math.min(1.0f, newVolume));
            if (mediaPlayer != null) {
                mediaPlayer.setVolume(volume, volume);
            }
            Log.d(TAG, "Volume set to: " + volume);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error setting volume", e);
            promise.reject("VOLUME_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stop(Promise promise) {
        try {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
                mediaPlayer.prepareAsync();
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping sound", e);
            promise.reject("STOP_ERROR", e.getMessage());
        }
    }

    @Override
    public void onCatalystInstanceDestroy() {
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        super.onCatalystInstanceDestroy();
    }
}