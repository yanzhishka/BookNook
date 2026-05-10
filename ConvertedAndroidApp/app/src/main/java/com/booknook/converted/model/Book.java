package com.booknook.converted.model;

import java.util.ArrayList;
import java.util.List;

public class Book {
    public String id;
    public String title;
    public String author;
    public String coverUrl;
    public int progress;
    public String status;
    public int myRating;
    public boolean isLendable;
    public String content;
    public int currentPage = 1;
    public int totalPages = 1;
    public final List<Annotation> annotations = new ArrayList<>();

    public boolean isCompleted() {
        return "completed".equals(status);
    }
}
