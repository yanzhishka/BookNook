package com.booknook.converted.model;

public class Annotation {
    public String id;
    public String quote;
    public String comment;
    public String color;
    public long timestamp;

    public Annotation() {
    }

    public Annotation(String id, String quote, String comment, String color, long timestamp) {
        this.id = id;
        this.quote = quote;
        this.comment = comment;
        this.color = color;
        this.timestamp = timestamp;
    }
}
