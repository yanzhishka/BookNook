package com.booknook.converted.data;

public interface ResultCallback<T> {
    void onSuccess(T value);
    void onError(Exception error);
}
