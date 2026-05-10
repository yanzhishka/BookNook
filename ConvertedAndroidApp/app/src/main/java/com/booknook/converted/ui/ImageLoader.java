package com.booknook.converted.ui;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.LruCache;
import android.widget.ImageView;

import java.io.InputStream;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ImageLoader {
    private final LruCache<String, Bitmap> cache;
    private final ExecutorService executor = Executors.newFixedThreadPool(4);

    public ImageLoader() {
        int maxKb = (int) (Runtime.getRuntime().maxMemory() / 1024);
        cache = new LruCache<String, Bitmap>(maxKb / 8) {
            @Override
            protected int sizeOf(String key, Bitmap value) {
                return value.getByteCount() / 1024;
            }
        };
    }

    public void load(String url, ImageView imageView) {
        if (url == null || url.trim().isEmpty()) {
            imageView.setImageDrawable(null);
            return;
        }
        Bitmap cached = cache.get(url);
        if (cached != null) {
            imageView.setImageBitmap(cached);
            return;
        }
        imageView.setTag(url);
        executor.execute(() -> {
            try {
                Bitmap bitmap = decode(url);
                if (bitmap == null) return;
                cache.put(url, bitmap);
                imageView.post(() -> {
                    Object tag = imageView.getTag();
                    if (url.equals(tag)) imageView.setImageBitmap(bitmap);
                });
            } catch (Exception ignored) {
            }
        });
    }

    private Bitmap decode(String value) throws Exception {
        if (value.startsWith("data:")) {
            int comma = value.indexOf(',');
            if (comma < 0) return null;
            byte[] bytes = Base64.decode(value.substring(comma + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        }
        try (InputStream stream = new URL(value).openStream()) {
            return BitmapFactory.decodeStream(stream);
        }
    }
}
