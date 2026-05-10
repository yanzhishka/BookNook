package com.booknook.converted.model;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class ActivityPost {
    public String id;
    public User user;
    public Book book;
    public String type;
    public String content;
    public String timestamp;
    public int likes;
    public final Set<String> likedBy = new HashSet<>();
    public final List<Comment> comments = new ArrayList<>();
}
