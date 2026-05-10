package com.booknook.converted.data;

import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AsyncRunner {
    public interface Job<T> {
        T run() throws Exception;
    }

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());

    public <T> void run(Job<T> job, ResultCallback<T> callback) {
        executor.execute(() -> {
            try {
                T value = job.run();
                main.post(() -> callback.onSuccess(value));
            } catch (Exception error) {
                main.post(() -> callback.onError(error));
            }
        });
    }
}
